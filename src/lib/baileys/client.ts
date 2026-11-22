import fs from "node:fs";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  useMultiFileAuthState,
  type CacheStore,
  type WASocket,
} from "@whiskeysockets/baileys";
import type { Boom } from "@hapi/boom";
import NodeCache from "@cacheable/node-cache";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import { getConnectionState, getSentMessage, saveSentMessage, setConnectionState } from "../db";

export interface WhatsAppHandle {
  sock: WASocket;
  /** Cierra sesión en WhatsApp (desvincula el dispositivo) y cierra el socket. */
  shutdown: () => Promise<void>;
}

export interface WhatsAppClientOptions {
  /** Carpeta donde Baileys guarda la sesión (ej. ./auth). */
  authDir: string;
  /** Se llama con cada socket nuevo (primer arranque y reconexiones) para registrar handlers. */
  onSocket: (sock: WASocket) => void;
}

const logger = pino({ level: "silent" });

/**
 * Envía un texto y guarda una copia en SQLite. Si el destinatario no puede descifrarlo
 * ("Esperando el mensaje..."), pide un reenvío y getMessage la devuelve a Baileys.
 */
export async function sendText(sock: WASocket, jid: string, text: string): Promise<void> {
  const sent = await sock.sendMessage(jid, { text });
  if (sent?.key.id && sent.message) {
    saveSentMessage(sent.key.id, jid, proto.Message.encode(sent.message).finish());
  }
}

/** Envía una imagen desde una URL con su pie de foto, igual que sendText (guarda copia para reenvíos). */
export async function sendImage(sock: WASocket, jid: string, url: string, caption: string): Promise<void> {
  const sent = await sock.sendMessage(jid, { image: { url }, caption: caption || undefined });
  if (sent?.key.id && sent.message) {
    saveSentMessage(sent.key.id, jid, proto.Message.encode(sent.message).finish());
  }
}

/** Muestra "escribiendo…" en el chat del cliente durante `ms` milisegundos. */
export async function simulateTyping(sock: WASocket, jid: string, ms: number): Promise<void> {
  try {
    await sock.sendPresenceUpdate("composing", jid);
    await new Promise((r) => setTimeout(r, ms));
    await sock.sendPresenceUpdate("paused", jid);
  } catch {
    // la presencia es cosmética: si falla, se envía igual
  }
}

/** "5491155555555:12@s.whatsapp.net" → "5491155555555" */
function phoneFromJid(jid: string | undefined): string | null {
  if (!jid) return null;
  return jid.split(":")[0].split("@")[0] || null;
}

export function createWhatsAppClient({ authDir, onSocket }: WhatsAppClientOptions) {
  let handle: WhatsAppHandle | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  // Fuera de start(): el conteo de reintentos sobrevive a las reconexiones del socket
  const msgRetryCounterCache = new NodeCache() as unknown as CacheStore;

  async function start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // WhatsApp rechaza versiones viejas (code 405): pedimos la última en runtime
    let version: [number, number, number] | undefined;
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
      console.log(`[bot] Versión de WhatsApp Web: ${version.join(".")}`);
    } catch (err) {
      console.warn("[bot] No se pudo obtener última versión:", err);
    }

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      // Fingerprint conocido: uno custom provoca code 440 en loop
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      msgRetryCounterCache,
      // Reenvío de mensajes que el destinatario no pudo descifrar
      getMessage: async (key) => {
        const stored = key.id ? getSentMessage(key.id) : null;
        if (!stored) return undefined;
        console.log(`[bot] Reenviando mensaje ${key.id} a ${key.remoteJid} (lo pidió el destinatario)`);
        return proto.Message.decode(stored);
      },
    });

    const current: WhatsAppHandle = {
      sock,
      shutdown: async () => {
        try {
          await sock.logout();
        } catch {
          // Si ya no estaba conectado, logout falla: lo ignoramos
        }
        try {
          sock.end(undefined);
        } catch {}
      },
    };
    handle = current;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      // Ignorar eventos de un socket que ya reemplazamos o cerramos a propósito
      if (handle !== current) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("[bot] Nuevo QR — escanéalo desde el dashboard (http://localhost:3000)");
        qrcodeTerminal.generate(qr, { small: true });
        setConnectionState({ status: "qr", qr_string: qr, phone: null });
      }

      if (connection === "connecting") {
        // Solo en el primer arranque: no degradar desde 'qr' ni desde 'connected'
        if (getConnectionState().status === "disconnected") {
          setConnectionState({ status: "connecting" });
        }
      }

      if (connection === "open") {
        const phone = phoneFromJid(sock.user?.id);
        console.log(`[bot] Conectado como ${phone ?? "desconocido"}`);
        setConnectionState({ status: "connected", qr_string: null, phone });
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const reason = lastDisconnect?.error?.message;
        console.log(`[bot] Conexión cerrada (code=${code ?? "?"}${reason ? `, ${reason}` : ""})`);

        if (code === DisconnectReason.loggedOut) {
          console.log(
            "[bot] Sesión cerrada desde el teléfono (401). No se reconecta. " +
              "Para vincular de nuevo: borra ./auth y reinicia el bot."
          );
          setConnectionState({ status: "disconnected", qr_string: null, phone: null });
          handle = null;
          return;
        }

        // Cualquier otro code: NO tocar la DB (el dashboard sigue viendo el último estado)
        scheduleReconnect(code);
      }
    });

    onSocket(sock);
  }

  function scheduleReconnect(code: number | undefined): void {
    if (reconnectTimer) return;
    // 440 = connectionReplaced (típico tras el pairing): reintentar rápido entra en loop
    const delay = code === DisconnectReason.connectionReplaced ? 15000 : 5000;
    console.log(`[bot] Reconectando en ${delay / 1000}s...`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (handle) {
        try {
          handle.sock.end(undefined);
        } catch {}
        handle = null;
      }
      start().catch((err) => {
        console.error("[bot] Error al reconectar:", err);
        scheduleReconnect(undefined);
      });
    }, delay);
  }

  /** Desconexión manual desde el dashboard: logout, borra la sesión y arranca limpio (QR nuevo). */
  async function restart(): Promise<void> {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const old = handle;
    handle = null; // los eventos del socket viejo quedan ignorados
    if (old) await old.shutdown();
    fs.rmSync(authDir, { recursive: true, force: true });
    await start();
  }

  return {
    start,
    restart,
    /** Socket activo, o null si está reconectando. */
    getSock: (): WASocket | null => handle?.sock ?? null,
  };
}
