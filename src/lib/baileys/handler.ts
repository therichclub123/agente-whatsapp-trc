import { isLidUser, isPnUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import {
  setMode,
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  insertMessage,
} from "../db";
import { generateReply } from "../openrouter";
import { addPhoto, historyText, parseReply, photoId, photosFor } from "../reply";
import { asksForPhoto, mentionedItems } from "../stock-check";
import { CATALOGO_URL } from "../catalog";
import { sendImage, sendText, simulateTyping } from "./client";

/**
 * Identificador que guardamos en conversations.phone:
 * - el número ("51999...") si lo conocemos;
 * - si no, el JID completo "123...@lid" (WhatsApp oculta el número de algunos contactos).
 */
export function phoneToJid(phone: string): string {
  return phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
}

/**
 * Extrae el texto de un mensaje. Las imágenes y PDFs (ej. la captura del Plin) se convierten en una nota
 * para el LLM, con su pie de foto si tiene. null si es audio/sticker/etc. (fuera de scope).
 */
function extractText(msg: WAMessage): string | null {
  const m = msg.message;
  const text = m?.conversation ?? m?.extendedTextMessage?.text ?? null;
  if (text?.trim()) return text;
  if (m?.imageMessage) {
    const caption = m.imageMessage.caption?.trim();
    return `[El cliente envió una imagen]${caption ? ` ${caption}` : ""}`;
  }
  if (m?.documentMessage) return `[El cliente envió un documento: ${m.documentMessage.fileName ?? "archivo"}]`;
  return null;
}

/** Resuelve el número real del contacto; para contactos @lid lo busca en el mapeo de Baileys. */
async function resolvePhone(sock: WASocket, msg: WAMessage, jid: string): Promise<string> {
  if (isPnUser(jid)) return jid.split("@")[0];

  const alt = msg.key.remoteJidAlt;
  if (alt && isPnUser(alt)) return alt.split("@")[0];

  try {
    const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
    if (pn) return pn.split("@")[0].split(":")[0];
  } catch {}

  return jid; // número desconocido: usamos el JID @lid tal cual
}

/** IDs ya procesados en este proceso: evita responder dos veces si WhatsApp reentrega un mensaje al reconectar. */
const processedIds = new Set<string>();

/** Antigüedad máxima de un mensaje recuperado tras una desconexión (más viejo = se ignora). */
const OFFLINE_MAX_AGE_S = 24 * 60 * 60;
/** Solo se responde solo a un atrasado si tiene menos de esto; si es más viejo, se guarda para que lo veas en el panel. */
const OFFLINE_REPLY_MAX_AGE_S = 2 * 60 * 60;

interface IncomingOptions {
  /** Llegó como 'append' (se recibió mientras el bot estaba desconectado, p. ej. el Mac dormido). */
  offline?: boolean;
  /** false = solo guardar el mensaje sin responder (para no contestar uno por uno los atrasados). */
  reply?: boolean;
}

function timestampOf(msg: WAMessage): number {
  return Number(msg.messageTimestamp ?? 0);
}

async function handleIncoming(sock: WASocket, msg: WAMessage, opts: IncomingOptions = {}): Promise<void> {
  const { offline = false, reply: shouldReply = true } = opts;
  // 1. Mensajes propios (enviados desde el teléfono del usuario)
  if (msg.key.fromMe) return;

  if (msg.key.id) {
    if (processedIds.has(msg.key.id)) return;
    processedIds.add(msg.key.id);
  }

  const jid = msg.key.remoteJid;
  if (!jid) return;
  // 2. Grupos: fuera del scope v1
  if (jid.endsWith("@g.us")) return;
  // 3. Solo chats 1:1: número clásico (@s.whatsapp.net) o identificador privado (@lid)
  if (!isPnUser(jid) && !isLidUser(jid)) return;

  // 4. Solo texto
  const text = extractText(msg);
  if (!text) {
    if (!msg.message) {
      console.log(`[bot] Mensaje de ${jid} sin contenido (no se pudo descifrar o es un evento interno)`);
    }
    return;
  }

  const phone = await resolvePhone(sock, msg, jid);

  // 5-6. Guardar el mensaje entrante
  const convo = getOrCreateConversation(phone, msg.pushName ?? null);
  if (offline) {
    // Recuperado tras desconexión: solo si es posterior a lo último que ya tenemos guardado de ese chat
    const last = getRecentHistory(convo.id, 1)[0];
    if (last && timestampOf(msg) <= last.created_at) return;
  }
  insertMessage(convo.id, "user", text);
  console.log(`[bot] ← ${offline ? "(recuperado) " : ""}Mensaje de ${msg.pushName ?? phone} (${phone}): "${text}"`);
  if (!shouldReply) return;

  // 7. Re-leer el modo: el toggle pudo cambiar desde el dashboard entre tanto
  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    console.log(`[bot] Conversación ${convo.id} en modo HUMAN: no se responde`);
    return;
  }

  // 8. Modo AI: generar, guardar y enviar (al mismo JID por el que escribió)
  const history = getRecentHistory(convo.id, 20);
  console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);
  const startedAt = Date.now();
  const reply = await generateReply(history);
  console.log(`[bot] LLM respondió en ${Date.now() - startedAt}ms`);

  const parsed = parseReply(reply);
  ensurePhotos(parsed, history);
  // Red de seguridad anti-spam: nunca remandar una foto (prenda+color) que ya se mandó en esta conversación,
  // aunque el LLM se equivoque y la vuelva a poner en su [FOTOS: ...] — salvo que el cliente la
  // esté pidiendo de nuevo explícitamente en su último mensaje (ahí sí se permite repetirla).
  const lastUserText = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!asksForPhoto(lastUserText)) {
    const alreadySent = alreadySentPhotoIds(history);
    parsed.photos = parsed.photos.filter((p) => !alreadySent.has(photoId(p)));
  }
  // Red de seguridad de 3 filtros: el LLM a veces manda fotos (casi siempre Ralph Lauren) sin que
  // el cliente haya dicho prenda, marca o talla. Si falta cualquiera de las 3, se bloquean las
  // fotos y se pregunta lo que falte, en vez de confiar en que el prompt baste.
  if (parsed.photos.length) {
    const userTexts = history.filter((m) => m.role === "user").map((m) => m.content);
    const prenda = mentionedPrenda(userTexts);
    const brand = mentionedBrand(userTexts);
    const talla = mentionedTalla(userTexts);
    if (!prenda || !brand || !talla) {
      parsed.photos = [];
      parsed.messages = [
        !prenda
          ? "¿Buscas polo o camisero? 👕"
          : !brand
            ? "¿Qué marca buscas, Ralph, Boss o Lacoste? 👀"
            : "¿Qué talla usas, para ver qué hay? 📏",
      ];
    }
  }
  if (!parsed.messages.length && !parsed.photos.length) {
    console.warn(`[bot] Respuesta vacía tras limpiar: "${reply}"`);
    return;
  }
  insertMessage(convo.id, "assistant", historyText(parsed));

  // Mensajes cortos con "escribiendo…" entre uno y otro, como una persona
  for (const text of parsed.messages) {
    await simulateTyping(sock, jid, Math.min(600 + text.length * 25, 3500));
    await sendText(sock, jid, text);
    console.log(`[bot] → Enviado a ${phone}: "${text}"`);
  }
  // Ninguna foto lleva texto: así WhatsApp las agrupa en un solo mensaje de álbum
  // en vez de mandarlas una por una. El precio y las tallas los dice el bot en su texto.
  for (const p of parsed.photos) {
    try {
      for (const url of p.urls) await sendImage(sock, jid, url, "");
      console.log(`[bot] → Foto enviada a ${phone}: ${p.product.id} ${p.color}`);
    } catch (err) {
      console.error(`[bot] No se pudo enviar la foto ${p.product.id} ${p.color}:`, err);
    }
  }

  // Pedido cerrado o pidió asesor: el bot deja de responder y Fabox lo ve en el dashboard en modo HUMAN
  if (parsed.handoff) {
    setMode(convo.id, "HUMAN");
    const why = parsed.handoff === "pedido" ? "🛒 PEDIDO CERRADO — verifica el pago y despacha" : "🙋 Pidió un asesor";
    console.log(`[bot] ${why}: ${msg.pushName ?? phone} (${phone}). Conversación ${convo.id} pasada a modo HUMAN.`);
  }
}

const PRENDA_PATTERNS: [RegExp, string][] = [
  [/\bcamiser/i, "camisero"],
  [/\bpolo/i, "polo"],
];

/** Busca si el cliente ya dijo qué tipo de prenda quiere (polo o camisero). */
function mentionedPrenda(userTexts: string[]): string | null {
  const joined = userTexts.join(" ");
  for (const [re, name] of PRENDA_PATTERNS) if (re.test(joined)) return name;
  return null;
}

const BRAND_PATTERNS: [RegExp, string][] = [
  [/\b(ralph|lauren|rl)\b/i, "Polo Ralph Lauren"],
  [/\bboss\b/i, "Boss"],
  [/\blacoste\b/i, "Lacoste"],
];

/** Busca si el cliente ya nombró una marca en alguno de sus mensajes. */
function mentionedBrand(userTexts: string[]): string | null {
  const joined = userTexts.join(" ");
  for (const [re, name] of BRAND_PATTERNS) if (re.test(joined)) return name;
  return null;
}

const TALLA_PATTERN = /\b(xs|s|m|l|xl|xxl)\b/i;

/** Busca si el cliente ya dio una talla (S/M/L/XL) en alguno de sus mensajes. */
function mentionedTalla(userTexts: string[]): boolean {
  return userTexts.some((t) => TALLA_PATTERN.test(t));
}

/** IDs de fotos (prenda+color) que ya se mandaron antes en esta conversación, leídos del "[Fotos enviadas: ...]" del historial. */
function alreadySentPhotoIds(history: { role: string; content: string }[]): Set<string> {
  const ids = new Set<string>();
  for (const m of history) {
    if (m.role !== "assistant") continue;
    const match = m.content.match(/\[Fotos enviadas: ([^\]]*)\]/);
    if (!match) continue;
    for (const id of match[1].split(",")) ids.add(id.trim());
  }
  return ids;
}

/**
 * Red de seguridad para las fotos (el LLM a veces no las manda o dice que "no puede"):
 * - si el cliente pide foto, se manda la de la prenda/color del que viene hablando;
 * - si en su último mensaje nombra una prenda concreta (ya sabe lo que quiere) y aún no se le mandó su foto, se manda.
 */
export function ensurePhotos(parsed: ReturnType<typeof parseReply>, history: { role: string; content: string }[]): void {
  const userTexts = history.filter((m) => m.role === "user").map((m) => m.content);
  const last = userTexts[userTexts.length - 1] ?? "";
  const sent = history.filter((m) => m.role === "assistant").map((m) => m.content).join("\n");

  const items = asksForPhoto(last)
    ? parsed.photos.length ? [] : mentionedItems(userTexts.slice(-4))
    : mentionedItems([last]).filter(({ product }) => !sent.includes(product.id));
  for (const { product, color } of items) {
    for (const photo of photosFor(color ? `${product.id} ${color}` : product.id)) addPhoto(parsed.photos, photo);
  }
  ensureLanding(parsed, last);
  if (!parsed.photos.length) return;
  parsed.messages = parsed.messages.filter((t) => !/no (puedo|podemos|tengo como) (enviar|mandar|pasar)/i.test(t));
  if (!parsed.messages.length) parsed.messages = ["Mira bro, aquí te va 👇"];
}

/** Si el cliente no sabe qué quiere ("qué tienes", "el catálogo") y no se le mandó ni link ni fotos, se agrega el link. */
function ensureLanding(parsed: ReturnType<typeof parseReply>, last: string): void {
  if (parsed.photos.length || parsed.messages.some((t) => t.includes("therichclub.online"))) return;
  const t = last.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!/\b(que (tienes|tienen|hay|venden|modelos)|catalogo|modelos|que ropa|todo lo que)\b/.test(t)) return;
  const i = Math.max(parsed.messages.length - 1, 0);
  parsed.messages[i] = `Mira todo lo que tenemos aquí 👇\n${CATALOGO_URL}\n${parsed.messages[i] ?? ""}`.trim();
}

/** Registra el handler de mensajes entrantes en un socket (se llama en cada reconexión). */
export function registerMessageHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type === "notify") {
      // Mensajes nuevos en tiempo real
      for (const msg of messages) await safeHandle(sock, msg);
      return;
    }

    // 'append': lo que llegó mientras el bot estaba desconectado (Mac dormido, internet caído…).
    // Se guardan todos, pero se responde una sola vez por chat (al último mensaje del cliente),
    // y no se responde si Fabox ya contestó desde el celular.
    const now = Math.floor(Date.now() / 1000);
    const byChat = new Map<string, WAMessage[]>();
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (!jid || now - timestampOf(msg) > OFFLINE_MAX_AGE_S) continue;
      byChat.set(jid, [...(byChat.get(jid) ?? []), msg]);
    }

    for (const [jid, msgs] of byChat) {
      msgs.sort((a, b) => timestampOf(a) - timestampOf(b));
      const fromClient = msgs.filter((m) => !m.key.fromMe);
      if (!fromClient.length) continue;
      const lastClient = fromClient[fromClient.length - 1];
      const answeredFromPhone = msgs.some((m) => m.key.fromMe && timestampOf(m) >= timestampOf(lastClient));
      const tooOld = now - timestampOf(lastClient) > OFFLINE_REPLY_MAX_AGE_S;
      console.log(
        `[bot] ⏪ Recuperando ${fromClient.length} mensaje(s) de ${jid} recibidos mientras estaba desconectado` +
          (answeredFromPhone ? " (ya respondiste desde el celular: no contesto)" : "") +
          (tooOld && !answeredFromPhone ? " (tiene más de 2 h: lo guardo sin responder, revísalo en el panel)" : "")
      );
      for (const msg of fromClient) {
        await safeHandle(sock, msg, { offline: true, reply: msg === lastClient && !answeredFromPhone && !tooOld });
      }
    }
  });
}

async function safeHandle(sock: WASocket, msg: WAMessage, opts?: IncomingOptions): Promise<void> {
  try {
    await handleIncoming(sock, msg, opts);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      console.error(
        "[bot] LLM 429 (rate limit). Si usas un modelo :free, cambia OPENROUTER_MODEL a openai/gpt-4o-mini."
      );
    } else {
      console.error("[bot] Error procesando mensaje:", err);
    }
  }
}
