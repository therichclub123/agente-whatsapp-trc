import { PRODUCTS, type Product } from "./catalog";

// El LLM se equivoca leyendo el stock (dice "agotado" cuando sí hay). Aquí se detecta
// qué prenda, color y talla menciona el cliente y se le da al LLM la respuesta exacta.

const norm = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palabras que identifican cada prenda en lo que escribe el cliente. */
// NOTA: "boss-blanco" (Regular Fit Boss) y "boss-regular-blanco" (Boss Regular Blanco) son dos
// prendas Boss reales distintas pero con nombres casi idénticos (ambas "boss" + blanco/negro) —
// no hay palabra única para distinguirlas en lo que escribe el cliente, así que ambas quedan con
// el mismo matcher genérico a propósito: cuando el cliente solo dice "el boss blanco" el bot va a
// mostrar el stock de las dos y puede preguntar cuál es. Si se puede, renombrar una de las dos en
// el Excel (ej. con un detalle visual) para distinguirlas de verdad.
const MATCHERS: Record<string, (t: string) => boolean> = {
  "rl-basico": (t) => /\b(ralph|rl|lauren)\b/.test(t) && /\bpolo|basico\b/.test(t) && !/camiser|camisa/.test(t),
  "rl-camisero": (t) => /\b(ralph|rl|lauren)\b/.test(t) && /camiser|camisa/.test(t) && !/europe/.test(t),
  "rl-camisero-europeo": (t) => /europe/.test(t),
  "boss-blanco": (t) =>
    /\bboss\b/.test(t) &&
    !/celeste|limon|oliv|pistacho|\bgris\b|cierre|negro\s*y\s*(blanco|verde)/.test(t),
  "boss-celeste": (t) => /\bboss\b/.test(t) && /celeste/.test(t),
  "boss-regular-blanco": (t) =>
    /\bboss\b/.test(t) &&
    !/celeste|limon|oliv|pistacho|\bgris\b|cierre|negro\s*y\s*(blanco|verde)/.test(t),
  "boss-limon": (t) => /\bboss\b/.test(t) && /limon/.test(t),
  "boss-verde-olivo": (t) => /\bboss\b/.test(t) && /oliv|pistacho/.test(t),
  "boss-gris": (t) => /\bboss\b/.test(t) && /\bgris\b/.test(t),
  "boss-negro-blanco": (t) => /\bboss\b/.test(t) && /negro\s*y\s*blanco/.test(t),
  "boss-negro-verde": (t) => /\bboss\b/.test(t) && /negro\s*y\s*verde/.test(t),
  "boss-cierre": (t) => /\bboss\b/.test(t) && /cierre|quarter\s*zip|quarterzip/.test(t),
  "lacoste-camisero": (t) => /lacoste/.test(t) && /camiser|camisa/.test(t) && !/\b2\b|dos|monogram/.test(t),
  "lacoste-camisero-2": (t) => /lacoste/.test(t) && /camiser|camisa/.test(t) && /\b2\b|dos/.test(t),
  "lacoste-conjunto-monogram": (t) => /lacoste/.test(t) && /conjunto|monogram/.test(t),
  "psycho-bunny-pb1": (t) => /psycho|bunny|\bpb\s*1\b/.test(t) && /\bpb\s*1\b|\b1\b|uno/.test(t),
  "psycho-bunny-pb2": (t) => /psycho|bunny|\bpb\s*2\b/.test(t) && /\bpb\s*2\b|\b2\b|dos/.test(t),
  "psycho-bunny-pb3": (t) => /psycho|bunny|\bpb\s*3\b/.test(t) && /\bpb\s*3\b|\b3\b|tres/.test(t),
  "pleasures-oversize": (t) => /pleasure|oversize/.test(t),
};

function sizesOf(tallas: string): string[] {
  return [...tallas.matchAll(/\b(XXL|XL|XS|S|M|L)\b/g)].map((m) => m[1]);
}

/** "Blanco → M, L · Negro → M, L" */
function availability(p: Product): string {
  return Object.entries(p.stock)
    .map(([color, tallas]) => `${color} → ${sizesOf(tallas).join(", ") || "agotado"}`)
    .join(" · ");
}

function mentionedSize(t: string): string | null {
  const m = t.match(/\b(talla\s+)?(xxl|xl|xs|s|m|l)\b/i);
  return m ? m[2].toUpperCase() : null;
}

/**
 * Nota para el LLM con el stock exacto de las prendas que el cliente mencionó en sus últimos mensajes.
 * Si además dijo color y talla, responde SÍ HAY / NO HAY. null si no mencionó ninguna prenda.
 */
export function stockHint(recentUserTexts: string[]): string | null {
  // Lo más reciente manda: se busca primero en el último mensaje y luego hacia atrás
  const texts = [...recentUserTexts].reverse().map(norm);
  const joined = texts.join(" \n ");

  const products = PRODUCTS.filter((p) => texts.some((t) => MATCHERS[p.id]?.(t)));
  if (!products.length) return null;

  const lines = products.map((p) => {
    let line = `${p.nombre}: ${availability(p)}.`;
    const color = Object.keys(p.stock).find((c) => joined.includes(norm(c).split(" ")[0]));
    const size = texts.map(mentionedSize).find(Boolean) ?? null;
    if (color && size) {
      const hay = sizesOf(p.stock[color]).includes(size);
      line += hay ? ` → ${color} talla ${size}: SÍ HAY.` : ` → ${color} talla ${size}: NO HAY.`;
    } else if (size) {
      const colores = Object.keys(p.stock).filter((c) => sizesOf(p.stock[c]).includes(size));
      line += colores.length
        ? ` → Talla ${size}: SÍ HAY en ${colores.join(", ")}.`
        : ` → Talla ${size}: NO HAY en ningún color.`;
    }
    return line;
  });

  return (
    `STOCK EXACTO de lo que pregunta el cliente (esto manda sobre cualquier otra lista; no digas agotado si aquí dice SÍ HAY): ` +
    lines.join(" | ")
  );
}

/**
 * Prendas (y color, si lo dijo) de las que habla el cliente en sus últimos mensajes, lo más reciente primero.
 * Si nombra un color, solo quedan las prendas que lo tienen ("foto del azul" → las prendas en azul).
 */
export function mentionedItems(recentUserTexts: string[]): { product: Product; color?: string }[] {
  const texts = [...recentUserTexts].reverse().map(norm);
  const latest = texts[0] ?? "";
  const ordered = texts.flatMap((t) => PRODUCTS.filter((p) => MATCHERS[p.id]?.(t)));
  const products = [...new Set(ordered)];
  const colorOf = (p: Product) => Object.keys(p.fotos).find((c) => latest.includes(norm(c).split(" ")[0]));
  const withColor = products.filter(colorOf);
  return (withColor.length ? withColor : products).map((product) => ({ product, color: colorOf(product) }));
}

/** El cliente pide ver la prenda: "foto", "imagen", "cómo se ve", "muéstrame"… */
export function asksForPhoto(text: string): boolean {
  return /\b(foto|fotos|fotito|fotitos|imagen|imagenes|pic|como se ve|muestra|muestrame|ensename|verlo|verla|verlos|verlas)\b/.test(norm(text));
}
