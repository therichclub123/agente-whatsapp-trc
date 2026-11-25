import { isLidUser, isPnUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import {
  setMode,
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  insertMessage,
} from "../db";
import { generateReply } from "../openrouter";
import { historyText, parseReply } from "../reply";
import { asksForPhoto, mentionedBrands, mentionedPrenda, mentionedTalla } from "../stock-check";
import { categoryIdFor, photosFor, CATALOGO_URL, type Talla } from "../catalog";
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
  const userTexts = history.filter((m) => m.role === "user").map((m) => m.content);
  const lastUserText = userTexts[userTexts.length - 1] ?? "";

  ensureLanding(parsed, lastUserText);

  // ---------- Fotos: el código decide solo, el LLM no las maneja ----------
  // Si el cliente nombra 2 marcas (ej. "Ralph Lauren" y después "Boss" para comparar),
  // se mandan las fotos de las 2 — no solo de la última que mencionó.
  const brands = mentionedBrands(userTexts);
  const prenda = mentionedPrenda(userTexts);
  const talla = mentionedTalla(userTexts) as Talla | null;
  const alreadySent = alreadySentCombos(history);
  const wantsRepeat = asksForPhoto(lastUserText);

  let photosToSend: ReturnType<typeof photosFor> = [];
  const newCombos: string[] = [];
  let hadGap = false;

  if (prenda && talla) {
    for (const brand of brands) {
      // Si no hay fotos del tipo exacto que pidió (ej. "camisero") pero la marca sí tiene
      // del otro tipo en esa talla (ej. "polo"), se manda ese — así responde Fabox en la
      // vida real: nunca deja al cliente sin nada si la marca sí tiene algo en su talla.
      const otherPrenda: typeof prenda | null = prenda === "polo" ? "camisero" : prenda === "camisero" ? "polo" : null;
      const candidates: (typeof prenda)[] = otherPrenda ? [prenda, otherPrenda] : [prenda];

      let sentSomethingForBrand = false;
      for (const p of candidates) {
        const categoryId = categoryIdFor(brand, p);
        if (!categoryId) continue;
        const comboKey = `${categoryId}:${talla}`;
        if (alreadySent.has(comboKey) && !wantsRepeat) {
          // Ya se mandó esta combinación antes: no hace falta mandar nada más para esta
          // marca (y tampoco hay que probar el otro tipo de prenda como respaldo).
          sentSomethingForBrand = true;
          break;
        }
        const photos = photosFor(talla, categoryId);
        if (photos.length) {
          photosToSend.push(...photos);
          newCombos.push(comboKey);
          sentSomethingForBrand = true;
          break; // ya encontró algo que mandar para esta marca, no hace falta seguir probando
        }
        // Esta prenda específica no tiene fotos: sigue al siguiente candidato (el otro tipo).
      }
      if (!sentSomethingForBrand) {
        // Ni el tipo pedido ni el otro tienen foto en esta talla para esta marca: hueco real
        // (ej. tallas como XS, o la marca de verdad no tiene nada en esa talla) — se marca,
        // nunca se inventa que sí hay.
        hadGap = true;
      }
    }
  }

  if (hadGap && !photosToSend.length) {
    // Ninguna de las marcas pedidas tiene foto: Fabox lo revisa a mano antes de seguir.
    parsed.messages = ["Déjame revisar si realmente tenemos esa talla y color que pides bro 🙏"];
    parsed.handoff = "verificar";
  }

  if (!parsed.messages.length && !photosToSend.length) {
    console.warn(`[bot] Respuesta vacía tras limpiar: "${reply}"`);
    return;
  }

  const sentNote = newCombos.length ? `\n[Fotos enviadas: ${newCombos.join(", ")}]` : "";
  insertMessage(convo.id, "assistant", historyText(parsed) + sentNote);

  // Mensajes cortos con "escribiendo…" entre uno y otro, como una persona
  for (const text of parsed.messages) {
    await simulateTyping(sock, jid, Math.min(600 + text.length * 25, 3500));
    await sendText(sock, jid, text);
    console.log(`[bot] → Enviado a ${phone}: "${text}"`);
  }
  // Ninguna foto lleva texto: así WhatsApp las agrupa en un solo mensaje de álbum
  // en vez de mandarlas una por una. El precio lo dice el bot en su texto (ver priceHint).
  for (const p of photosToSend) {
    try {
      await sendImage(sock, jid, p.url, "");
      console.log(`[bot] → Foto enviada a ${phone}: ${p.title}`);
    } catch (err) {
      console.error(`[bot] No se pudo enviar la foto ${p.title}:`, err);
    }
  }

  // Pedido cerrado, pidió asesor, o hay que verificar stock a mano: el bot deja de
  // responder y Fabox lo ve en el dashboard en modo HUMAN.
  if (parsed.handoff) {
    setMode(convo.id, "HUMAN");
    const why =
      parsed.handoff === "pedido"
        ? "🛒 PEDIDO CERRADO — verifica el pago y despacha"
        : parsed.handoff === "verificar"
          ? "🔍 VERIFICAR STOCK — confirma si hay y retómalo tú mismo"
          : "🙋 Pidió un asesor";
    console.log(`[bot] ${why}: ${msg.pushName ?? phone} (${phone}). Conversación ${convo.id} pasada a modo HUMAN.`);
  }
}

/** IDs de combos "categoria:talla" ya enviados antes en esta conversación. */
function alreadySentCombos(history: { role: string; content: string }[]): Set<string> {
  const ids = new Set<string>();
  for (const m of history) {
    if (m.role !== "assistant") continue;
    const match = m.content.match(/\[Fotos enviadas: ([^\]]*)\]/);
    if (!match) continue;
    for (const id of match[1].split(",")) ids.add(id.trim());
  }
  return ids;
}

/** Si el cliente no sabe qué quiere ("qué tienes", "el catálogo") y no se le mandó ni link ni fotos, se agrega el link. */
function ensureLanding(parsed: ReturnType<typeof parseReply>, last: string): void {
  if (parsed.messages.some((t) => t.includes("therichclub.online"))) return;
  const t = last.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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
