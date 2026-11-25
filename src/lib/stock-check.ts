// Ya no hay stock por color/talla exacto que rastrear (ver catalog.ts): este módulo solo
// detecta qué pide el cliente (marca, prenda, talla) a partir de lo que escribe, para que
// el handler decida solo qué fotos mandar y qué precio mencionar — sin depender de que el
// LLM lo haga bien.

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const BRAND_PATTERNS: [RegExp, string][] = [
  [/\b(ralph|lauren|rl)\b/, "Polo Ralph Lauren"],
  [/\bboss\b/, "Boss"],
  [/\blacoste\b/, "Lacoste"],
  [/\b(psycho|bunny)\b/, "Psycho Bunny"],
  [/\bpleasures?\b/, "Pleasures"],
];

/** Busca si el cliente ya nombró una marca en alguno de sus mensajes (el más reciente primero). */
export function mentionedBrand(userTexts: string[]): string | null {
  return mentionedBrands(userTexts)[0] ?? null;
}

/**
 * Todas las marcas que el cliente mencionó en la conversación (puede pedir comparar 2,
 * ej. "Ralph Lauren" y luego "Hugo Boss" — ahí hay que mandar fotos de las 2, no solo
 * de la última). Orden: la más reciente primero.
 */
export function mentionedBrands(userTexts: string[]): string[] {
  const joined = [...userTexts].reverse().map(norm).join(" ");
  const found: string[] = [];
  for (const [re, name] of BRAND_PATTERNS) if (re.test(joined)) found.push(name);
  return found;
}

/**
 * "Conjunto"/"monogram" es su propia prenda (Lacoste Conjunto Monogram, precio aparte).
 * "Camisero"/"camisa" y "polo" son las otras dos. Si el cliente dice las dos palabras,
 * manda la primera que aparece en el texto más reciente.
 */
export function mentionedPrenda(userTexts: string[]): "polo" | "camisero" | "conjunto" | null {
  const joined = [...userTexts].reverse().map(norm).join(" ");
  if (/conjunto|monogram/.test(joined)) return "conjunto";
  if (/\bcamiser/.test(joined)) return "camisero";
  if (/\bpolo/.test(joined)) return "polo";
  return null;
}

const TALLA_PATTERN = /\b(xxl|xl|s|m|l)\b/i;

/** Busca si el cliente ya dio una talla (S/M/L/XL/XXL) en alguno de sus mensajes. */
export function mentionedTalla(userTexts: string[]): "S" | "M" | "L" | "XL" | "XXL" | null {
  const joined = [...userTexts].reverse().map(norm).join(" ");
  const m = joined.match(TALLA_PATTERN);
  return m ? (m[1].toUpperCase() as "S" | "M" | "L" | "XL" | "XXL") : null;
}

/** El cliente pide ver la prenda: "foto", "imagen", "cómo se ve", "muéstrame"… */
export function asksForPhoto(text: string): boolean {
  return /\b(foto|fotos|fotito|fotitos|imagen|imagenes|pic|como se ve|muestra|muestrame|ensename|verlo|verla|verlos|verlas)\b/.test(
    norm(text)
  );
}
