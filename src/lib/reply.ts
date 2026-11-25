export interface ParsedReply {
  /** Mensajes de texto a enviar, en orden (máximo 2). */
  messages: string[];
  /**
   * El bot cerró el pedido ([PEDIDO_CERRADO]), pidió un asesor ([ASESOR]), o necesita que
   * Fabox confirme stock antes de seguir ([VERIFICAR]): el chat pasa a modo humano.
   */
  handoff: "pedido" | "asesor" | "verificar" | null;
}

const MAX_MESSAGES = 2;

/** Quita el formato markdown que WhatsApp mostraría tal cual (**, ##, viñetas). */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/[ \t]+$/gm, "");
}

/**
 * Convierte la respuesta cruda del LLM en mensajes cortos. Las fotos ya NO las maneja el
 * LLM (ver catalog.ts + handler.ts): el código decide solo, a partir de marca+prenda+talla
 * ya mencionados en la conversación, qué fotos mandar.
 */
export function parseReply(raw: string): ParsedReply {
  let handoff: ParsedReply["handoff"] = null;
  const text = raw
    .replace(/\[PEDIDO_CERRADO\]/gi, () => ((handoff = "pedido"), ""))
    .replace(/\[ASESOR\]/gi, () => ((handoff ??= "asesor"), ""))
    .replace(/\[VERIFICAR\]/gi, () => ((handoff ??= "verificar"), ""));

  const chunks = stripMarkdown(text)
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  // Si el modelo se pasó de 2 bloques, el resto se junta en el segundo mensaje
  const messages =
    chunks.length > MAX_MESSAGES
      ? [...chunks.slice(0, MAX_MESSAGES - 1), chunks.slice(MAX_MESSAGES - 1).join("\n")]
      : chunks;

  return { messages, handoff };
}

/** Texto que se guarda en el historial (no hace falta nota de fotos: el handler las rastrea aparte). */
export function historyText({ messages }: ParsedReply): string {
  return messages.join("\n\n");
}
