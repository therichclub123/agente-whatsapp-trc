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

const ALL_BRAND_NAMES = BRAND_PATTERNS.filter(([, name]) => name !== "Pleasures").map(([, name]) => name);

/** El cliente pidió ver TODAS las marcas ("todas", "cualquiera", "las 4"...), en cualquier mensaje. */
function wantsAllBrands(userTexts: string[]): boolean {
  const joined = [...userTexts].reverse().map(norm).join(" ");
  return /\b(todas|todos|cualquiera|cualquier marca|las 4|las cuatro)\b/.test(joined);
}

/**
 * Todas las marcas que el cliente mencionó en la conversación (puede pedir comparar 2,
 * ej. "Ralph Lauren" y luego "Hugo Boss" — ahí hay que mandar fotos de las 2, no solo
 * de la última). "Todas" cuenta para siempre en la conversación, no solo en el mensaje
 * donde se dijo — si no, el turno siguiente "se olvida" y parece que falta la marca.
 */
export function mentionedBrands(userTexts: string[]): string[] {
  if (wantsAllBrands(userTexts)) return ALL_BRAND_NAMES;
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
  return mentionedPrendas(userTexts)[0] ?? null;
}

/**
 * Todas las prendas que el cliente pidió — normalmente es una sola, pero si contesta
 * "ambos"/"los dos" a la pregunta de polo-o-camisero, son las dos. Antes esa respuesta no
 * se reconocía y el bot se quedaba sin saber qué prenda es, desactivando todo el sistema
 * de fotos/precio y dejando al LLM improvisar solo.
 */
export function mentionedPrendas(userTexts: string[]): ("polo" | "camisero" | "conjunto")[] {
  const joined = [...userTexts].reverse().map(norm).join(" ");
  if (/\b(ambos|los dos|las dos|los 2|las 2|polo y camiser|camiser\w* y polo)\b/.test(joined)) {
    return ["polo", "camisero"];
  }
  if (/conjunto|monogram/.test(joined)) return ["conjunto"];
  if (/\bcamiser/.test(joined)) return ["camisero"];
  if (/\bpolo/.test(joined)) return ["polo"];
  return [];
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
