import { findColor, findProduct, type Product } from "./catalog";

/** Una foto a enviar: la prenda y el color. */
export interface Photo {
  product: Product;
  color: string;
  /** Prenda sola + modelo luciéndola: se mandan las dos */
  urls: string[];
}

export interface ParsedReply {
  /** Mensajes de texto a enviar, en orden (máximo 2). */
  messages: string[];
  /** Fotos a enviar, una por prenda y color (máximo 3). */
  photos: Photo[];
  /** El bot cerró el pedido ([PEDIDO_CERRADO]) o pidió un asesor ([ASESOR]): el chat pasa a modo humano. */
  handoff: "pedido" | "asesor" | null;
}

const MAX_MESSAGES = 2;
const MAX_PHOTOS = 3;

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
 * Convierte la respuesta cruda del LLM en mensajes cortos + fotos.
 * La etiqueta [FOTOS: id1, id2] se retira del texto y se traduce a productos del catálogo.
 */
export function parseReply(raw: string): ParsedReply {
  const photos: Photo[] = [];
  let handoff: ParsedReply["handoff"] = null;
  const text = raw
    .replace(/\[PEDIDO_CERRADO\]/gi, () => ((handoff = "pedido"), ""))
    .replace(/\[ASESOR\]/gi, () => ((handoff ??= "asesor"), ""))
    .replace(/\[FOTOS?:\s*([^\]]*)\]/gi, (_, ids: string) => {
    for (const item of ids.split(",")) for (const photo of photosFor(item)) addPhoto(photos, photo);
    return "";
  })
    // por si el modelo copia la nota interna del historial
    .replace(/\[Fotos enviadas:[^\]]*\]/gi, "");

  const chunks = stripMarkdown(text)
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  // Si el modelo se pasó de 2 bloques, el resto se junta en el segundo mensaje
  const messages =
    chunks.length > MAX_MESSAGES
      ? [...chunks.slice(0, MAX_MESSAGES - 1), chunks.slice(MAX_MESSAGES - 1).join("\n")]
      : chunks;

  return { messages, photos, handoff };
}

/**
 * "rl-basico Azul Marino" → la foto de ese color. Sin color ("boss-blanco") → la foto de cada color
 * (si la prenda tiene varios colores, hasta 3).
 */
export function photosFor(item: string): Photo[] {
  const [id, ...rest] = item.trim().split(/\s+/);
  const product = id ? findProduct(id) : undefined;
  if (!product) return [];
  const color = findColor(product, rest.join(" "));
  const colors = color ? [color] : Object.keys(product.fotos);
  return colors.map((c) => ({ product, color: c, urls: product.fotos[c] }));
}

export function addPhoto(photos: Photo[], photo: Photo): void {
  if (photos.length >= MAX_PHOTOS || photos.some((x) => x.product === photo.product && x.color === photo.color)) return;
  photos.push(photo);
}

/** Texto que se guarda en el historial: así el LLM sabe qué fotos ya mandó. */
export function historyText({ messages, photos }: ParsedReply): string {
  const note = photos.length ? `\n[Fotos enviadas: ${photos.map(photoId).join(", ")}]` : "";
  return messages.join("\n\n") + note;
}

export const photoId = (f: Photo) => (Object.keys(f.product.fotos).length > 1 ? `${f.product.id} ${f.color}` : f.product.id);
