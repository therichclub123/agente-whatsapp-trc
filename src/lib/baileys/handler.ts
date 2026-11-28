import { isLidUser, isPnUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import {
  setMode,
  getConversationById,
  getOrCreateConversation,
  getRecentHistory,
  insertMessage,
  type Message,
} from "../db";
import { EmptyLLMResponseError, generateReply } from "../openrouter";
import { historyText, parseReply } from "../reply";
import { asksForPhoto, mentionedBrands, mentionedPrendas, mentionedTalla } from "../stock-check";
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
  const pushName = msg.pushName ?? null;
  console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);
  const startedAt = Date.now();
  let reply: string;
  try {
    reply = await generateReply(history);
  } catch (err) {
    if (!(err instanceof EmptyLLMResponseError)) throw err;
    // El LLM no respondió tras ~1 min de reintentos (ver generateReply): el cliente nunca se
    // queda callado — se le avisa que espere y se sigue intentando solo, en segundo plano,
    // hasta conseguir una respuesta real (nunca se deriva a HUMANO solo por esto).
    console.error(`[bot] LLM sigue sin responder tras los reintentos (${pushName ?? phone}). Aviso y sigo en segundo plano.`);
    await simulateTyping(sock, jid, 800);
    await sendText(sock, jid, WAITING_MESSAGE);
    retryInBackground(sock, jid, phone, pushName, convo.id, history);
    return;
  }
  console.log(`[bot] LLM respondió en ${Date.now() - startedAt}ms`);

  await deliverReply(sock, jid, phone, pushName, convo.id, history, reply);
}

/** Se manda una sola vez si el LLM no responde tras ~1 min; mientras tanto sigue reintentando aparte. */
const WAITING_MESSAGE = "Dame un momento bro, ya te resuelvo 🙏";

/**
 * El cliente ya recibió el mensaje de espera: se sigue llamando al LLM en segundo plano
 * (cada intento ya reintenta ~1 min adentro, ver generateReply) hasta conseguir una
 * respuesta real, sin bloquear el procesamiento de otros mensajes entrantes.
 */
function retryInBackground(
  sock: WASocket,
  jid: string,
  phone: string,
  pushName: string | null,
  conversationId: number,
  history: Message[]
): void {
  const MAX_BACKGROUND_ATTEMPTS = 10; // ~10 min en total (cada intento ya tarda ~1 min adentro)

  (async () => {
    for (let attempt = 1; attempt <= MAX_BACKGROUND_ATTEMPTS; attempt++) {
      // Fabox pudo haber tomado la conversación a mano mientras esperábamos
      const fresh = getConversationById(conversationId);
      if (!fresh || fresh.mode !== "AI") return;

      try {
        const reply = await generateReply(history);
        await deliverReply(sock, jid, phone, pushName, conversationId, history, reply);
        return;
      } catch (err) {
        if (!(err instanceof EmptyLLMResponseError)) {
          console.error(`[bot] Reintento en segundo plano falló para ${pushName ?? phone}:`, err);
          return;
        }
        console.error(`[bot] Reintento en segundo plano ${attempt}/${MAX_BACKGROUND_ATTEMPTS} también vacío (${pushName ?? phone}).`);
      }
    }
    console.error(`[bot] Se agotaron los reintentos en segundo plano para ${pushName ?? phone}; el LLM no respondió en ~10 min.`);
  })().catch((err) => console.error(`[bot] Error inesperado reintentando en segundo plano (${pushName ?? phone}):`, err));
}

/** Convierte la respuesta cruda del LLM en mensajes/fotos y los envía. Lo usa tanto el camino normal como retryInBackground. */
async function deliverReply(
  sock: WASocket,
  jid: string,
  phone: string,
  pushName: string | null,
  conversationId: number,
  history: Message[],
  reply: string
): Promise<void> {
  const convo = { id: conversationId };
  const parsed = parseReply(reply);
  const userTexts = history.filter((m) => m.role === "user").map((m) => m.content);
  const lastUserText = userTexts[userTexts.length - 1] ?? "";

  ensureLanding(parsed, lastUserText);

  // ---------- Fotos: el código decide solo, el LLM no las maneja ----------
  // Si el cliente nombra 2 marcas (ej. "Ralph Lauren" y después "Boss" para comparar),
  // se mandan las fotos de las 2 — no solo de la última que mencionó. "Todas" se recuerda
  // para el resto de la conversación (ver mentionedBrands), no solo el mensaje donde se dijo.
  const brands = mentionedBrands(userTexts);
  // Normalmente una sola prenda, pero si contestó "ambos"/"los dos" son las dos — hay que
  // mandar fotos de polo Y camisero, no quedarse sin saber qué prenda es (eso desactivaba
  // todo el sistema y dejaba al LLM improvisar solo).
  const prendas = mentionedPrendas(userTexts);
  const talla = mentionedTalla(userTexts) as Talla | null;
  // Qué fotos (por título, no por categoría) ya se mandaron ANTES en esta conversación —
  // la regla es "nunca la misma foto dos veces", a nivel de archivo individual, no de
  // categoría: si la categoría cambia de alguna forma entre turnos pero la foto es la
  // misma imagen, igual no se vuelve a mandar.
  const alreadySentTitles = alreadySentPhotoTitles(history);
  const wantsRepeat = asksForPhoto(lastUserText);

  let photosToSend: ReturnType<typeof photosFor> = [];
  const newTitles: string[] = [];
  let hadGap = false;

  const ASK_MARCA = "¿Qué marca te interesa, Ralph, Boss, Lacoste o Psycho Bunny? 👀";
  const ASK_TALLA = "¿Qué talla usas, S, M, L o XL? 📏";
  // Qué pregunta fija tocaría mandar ESTE turno, según lo que todavía falte.
  const nextAsk = !brands.length ? ASK_MARCA : !talla ? ASK_TALLA : null;
  // Última respuesta del bot (sin la nota de fotos enviadas) — solo cuenta como loop si
  // es EXACTAMENTE la misma pregunta que se repetiría ahora (ej. ya resolvió la marca y
  // ahora falta la talla, eso NO es repetir — es la primera vez que se pregunta la talla).
  const lastBotText = [...history].reverse().find((m) => m.role === "assistant")?.content.split("\n[Fotos enviadas:")[0];
  const wouldRepeatSameQuestion = nextAsk !== null && nextAsk === lastBotText;

  // Red de seguridad anti-alucinación: si falta marca o talla, el código corta la respuesta
  // del LLM y pregunta directo lo que falta — nunca se deja que el LLM improvise un precio
  // o un "ya te mando las fotos" cuando en realidad no hay ninguna marca/talla resuelta
  // todavía (así se coló el bug de mandar los precios de las 4 marcas juntas).
  // Si la pregunta que tocaría mandar es IDÉNTICA a la de la vez pasada (el cliente contestó
  // algo que no resolvió nada), no se repite una tercera vez — se deriva a Fabox (así se
  // coló el bug de mandar la misma pregunta 4 veces seguidas).
  if (prendas.length && nextAsk && wouldRepeatSameQuestion) {
    parsed.messages = ["Déjame llamar a mi encargado para que resuelva directo tu duda, bro 🙏"];
    parsed.handoff = "verificar";
  } else if (prendas.length && nextAsk) {
    parsed.messages = [nextAsk];
  } else if (prendas.length && talla) {
    for (const prenda of prendas) {
      for (const brand of brands) {
        // Si pidió solo un tipo (no "ambos") y no hay fotos de ese tipo exacto pero la
        // marca sí tiene del otro tipo en esa talla, se manda ese — así responde Fabox en
        // la vida real: nunca deja al cliente sin nada si la marca sí tiene algo en su
        // talla. Si pidió "ambos" explícito, no se usa este respaldo — se intenta cada uno.
        const otherPrenda: typeof prenda | null =
          prendas.length > 1 ? null : prenda === "polo" ? "camisero" : prenda === "camisero" ? "polo" : null;
        const candidates: (typeof prenda)[] = otherPrenda ? [prenda, otherPrenda] : [prenda];

        let sentSomethingForCombo = false;
        for (const p of candidates) {
          const categoryId = categoryIdFor(brand, p);
          if (!categoryId) continue;
          const photos = photosFor(talla, categoryId);
          if (!photos.length) continue; // esta prenda no tiene nada: prueba el otro candidato

          const freshPhotos = photos.filter((photo) => wantsRepeat || !alreadySentTitles.has(photo.title));
          if (freshPhotos.length) {
            photosToSend.push(...freshPhotos);
            newTitles.push(...freshPhotos.map((photo) => photo.title));
          }
          // Ya sea que hubiera fotos nuevas o que ya se hubieran mandado todas antes, esta
          // combinación queda cubierta — no es un hueco de stock, así que no se prueba el
          // otro candidato ni se deriva a Fabox.
          sentSomethingForCombo = true;
          break;
        }
        if (!sentSomethingForCombo) {
          // Ni el tipo pedido ni el otro tienen foto en esta talla para esta marca: hueco
          // real (ej. tallas como XS, o la marca de verdad no tiene nada en esa talla) —
          // se marca, nunca se inventa que sí hay.
          hadGap = true;
        }
      }
    }
  }

  if (hadGap && !photosToSend.length) {
    // Ninguna de las marcas pedidas tiene foto: Fabox lo revisa a mano antes de seguir.
    parsed.messages = ["Voy a hablar con mi encargado para que responda directo tu duda, bro 🙏"];
    parsed.handoff = "verificar";
  }

  if (!parsed.messages.length && !photosToSend.length) {
    console.warn(`[bot] Respuesta vacía tras limpiar: "${reply}"`);
    return;
  }

  const sentNote = newTitles.length ? `\n[Fotos enviadas: ${newTitles.join(" || ")}]` : "";
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
    console.log(`[bot] ${why}: ${pushName ?? phone} (${phone}). Conversación ${convo.id} pasada a modo HUMAN.`);
  }
}

/** Títulos de foto (archivo individual) ya enviados antes en esta conversación. */
function alreadySentPhotoTitles(history: { role: string; content: string }[]): Set<string> {
  const titles = new Set<string>();
  for (const m of history) {
    if (m.role !== "assistant") continue;
    const match = m.content.match(/\[Fotos enviadas: ([^\]]*)\]/);
    if (!match) continue;
    for (const title of match[1].split("||")) titles.add(title.trim());
  }
  return titles;
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
