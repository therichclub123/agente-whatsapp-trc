// env-loader DEBE ser el primer import: puebla process.env antes de que se evalúen los demás módulos
import "./env-loader";
import path from "node:path";
import fs from "node:fs";
import {
  getConnectionState,
  getPendingOutbox,
  markOutboxSent,
  setConnectionState,
} from "../src/lib/db";
import { createWhatsAppClient, sendText } from "../src/lib/baileys/client";
import { phoneToJid, registerMessageHandler } from "../src/lib/baileys/handler";

// En Railway se pone AUTH_DIR=/app/data/auth para que la sesión viva en el mismo disco persistente que la base de datos
const AUTH_DIR = path.resolve(process.cwd(), process.env.AUTH_DIR ?? "auth");
const RESTART_FLAG = path.resolve(process.cwd(), "data", ".restart");
const LOCK_FILE = path.resolve(process.cwd(), "data", "bot.lock");

// ---------- Candado: un solo proceso bot por sesión ----------
// Dos bots con la misma carpeta ./auth se pisan en WhatsApp y la sesión termina en 401.
//
// El candado guarda "pid:timestamp" y se refresca cada pocos segundos mientras el
// bot corre. Si el candado tiene más de LOCK_STALE_MS sin refrescarse, se asume
// abandonado (el proceso murió sin poder limpiarlo, p. ej. un crash o un redeploy
// que mató el contenedor) y se ignora, aunque el PID por coincidencia exista en
// el contenedor nuevo (los PID se reinician en cada contenedor y un número viejo
// puede coincidir con un proceso real sin relación).

const LOCK_STALE_MS = 10_000;
const LOCK_REFRESH_MS = 3_000;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function writeLock(): void {
  fs.writeFileSync(LOCK_FILE, `${process.pid}:${Date.now()}`);
}

function acquireLock(): void {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  if (fs.existsSync(LOCK_FILE)) {
    const [pidRaw, tsRaw] = fs.readFileSync(LOCK_FILE, "utf-8").trim().split(":");
    const pid = Number(pidRaw);
    const ts = Number(tsRaw);
    const stale = !ts || Date.now() - ts > LOCK_STALE_MS;
    if (pid && pid !== process.pid && !stale && isProcessAlive(pid)) {
      console.error(
        `[bot] Ya hay otro bot corriendo (PID ${pid}). Dos bots con la misma sesión hacen que ` +
          `WhatsApp la cierre (401). Detén el otro proceso antes de iniciar este.`
      );
      process.exit(1);
    }
    if (stale) console.log(`[bot] Candado viejo (PID ${pid}) sin refrescar: lo tomo como abandonado.`);
  }
  writeLock();
  setInterval(writeLock, LOCK_REFRESH_MS);
  process.on("exit", () => {
    try {
      if (fs.readFileSync(LOCK_FILE, "utf-8").trim().split(":")[0] === String(process.pid)) fs.unlinkSync(LOCK_FILE);
    } catch {}
  });
}

const client = createWhatsAppClient({
  authDir: AUTH_DIR,
  onSocket: registerMessageHandler,
});

// ---------- Outbox: mensajes humanos del dashboard → WhatsApp (cada 2s) ----------

let outboxBusy = false;
async function processOutbox(): Promise<void> {
  if (outboxBusy) return;
  const sock = client.getSock();
  if (!sock || getConnectionState().status !== "connected") return;

  outboxBusy = true;
  try {
    for (const item of getPendingOutbox()) {
      try {
        await sendText(sock, phoneToJid(item.phone), item.content);
        markOutboxSent(item.id);
        console.log(`[bot] → Enviado (humano) a ${item.phone}: "${item.content}"`);
      } catch (err) {
        // Queda con sent=0 y se reintenta en el próximo tick
        console.error(`[bot] Error enviando outbox #${item.id}:`, err);
        break;
      }
    }
  } finally {
    outboxBusy = false;
  }
}

// ---------- Flag de desconexión manual (lo crea /api/connection/disconnect) ----------

let restarting = false;
async function checkRestartFlag(): Promise<void> {
  if (restarting || !fs.existsSync(RESTART_FLAG)) return;
  restarting = true;
  try {
    fs.unlinkSync(RESTART_FLAG);
    console.log("[bot] Desconexión solicitada desde el dashboard. Reiniciando sesión...");
    await client.restart();
  } catch (err) {
    console.error("[bot] Error al reiniciar la sesión:", err);
  } finally {
    restarting = false;
  }
}

// ---------- Arranque ----------

async function main(): Promise<void> {
  acquireLock();
  console.log("[bot] Iniciando agente de WhatsApp...");
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.startsWith("sk-or-...")) {
    console.warn("[bot] ⚠ OPENROUTER_API_KEY no configurada en .env.local: el modo IA fallará.");
  }

  // Un flag viejo de una ejecución anterior no debe disparar un logout al arrancar
  if (fs.existsSync(RESTART_FLAG)) fs.unlinkSync(RESTART_FLAG);

  // Sin sesión guardada, el estado de la DB puede ser de una ejecución anterior: empezar limpio
  if (!fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
    setConnectionState({ status: "disconnected", qr_string: null, phone: null });
    console.log("[bot] No hay sesión guardada: esperando escaneo del QR en http://localhost:3000");
  }

  await client.start();

  setInterval(() => void processOutbox(), 2000);
  setInterval(() => void checkRestartFlag(), 1000);
}

main().catch((err) => {
  console.error("[bot] Error fatal:", err);
  process.exit(1);
});

// process.exit() dispara el evento 'exit', que libera el candado
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log("\n[bot] Detenido.");
    process.exit(0);
  });
}
