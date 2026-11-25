// Tablas de tallas oficiales de cada marca (medidas del CUERPO en cm, no de la prenda).
// Fuentes:
// - Ralph Lauren: ralphlauren.global → Men's Size Guide (polos y camisas). Revisado el 16/10/2026.
// - BOSS y HUGO (misma tabla del grupo HUGO BOSS): guía publicada por el distribuidor Hurleys
//   (hurleys.co.uk/pages/boss-size-guide); hugoboss.com no permitió la consulta. Revisado el 16/10/2026.

export const SIZE_GUIDE = `
POLO RALPH LAUREN — Polos, polos piqué y ropa casual (medidas del cuerpo, cm)
- XS: pecho 78.7–86.4 | cuello 35.6 | cintura 66–71.1 | manga 81.3–82.6
- S: pecho 88.9–94 | cuello 35.6–36.8 | cintura 71.1–76.2 | manga 81.3–83.8
- M: pecho 96.5–101.6 | cuello 38.1–39.4 | cintura 78.7–86.4 | manga 86.4–88.9
- L: pecho 106.7–114.3 | cuello 40.6–41.9 | cintura 88.9–96.5 | manga 88.9–91.4
- XL: pecho 116.8–121.9 | cuello 43.2–44.5 | cintura 101.6–106.7 | manga 91.4–94
- XXL: pecho 124.5–132.1 | cuello 45.7–47 | cintura 109.2–114.3 | manga 94–96.5
TRC vende Polo Ralph Lauren solo en SLIM FIT: entallado en pecho y brazos, suelto en la cintura. Los tres fits usan la misma tabla del cuerpo; cambia el corte de la prenda:
- Custom Slim vs Classic: 7.6 cm menos de pecho, hombro 2.5 cm más ajustado, 3.8 cm más corto de largo.
- Slim vs Custom Slim: 7.6 cm menos de pecho, mismo hombro, 1.3 cm más corto.
Camiseros RL (camisas de vestir, por cuello): cuello 38.1 → pecho 96.5 | 39.4 → 101.6 | 40.6 → 106.7 | 41.9 → 111.8 | 43.2 → 116.8.

BOSS y HUGO — Camisas, camiseros, polos y tops (medidas del cuerpo, cm; TRC vende Boss, pero usa la tabla compartida del grupo HUGO BOSS). TRC vende Boss en REGULAR STRETCH FIT (al cliente se le dice solo "Regular Fit").
- XS (EU 44): pecho 92 | cintura 80 | brazo 81.1 | cuello 36
- S (EU 46): pecho 95 | cintura 83 | brazo 83 | cuello 37–38
- M (EU 48): pecho 98 | cintura 86 | brazo 85 | cuello 39–40
- L (EU 50): pecho 102 | cintura 90 | brazo 87 | cuello 41–42
- XL (EU 52): pecho 106 | cintura 94 | brazo 88.9 | cuello 43–44
- XXL (EU 54): pecho 110 | cintura 98 | brazo 90.3 | cuello 45–46

BUSCADOR RÁPIDO POR PECHO (usa ESTO para responder; redondea la medida del cliente al cm entero)
Polo Ralph Lauren:
- hasta 86 → XS | 87–88 → entre XS y S | 89–94 → S | 95–96 → entre S y M | 97–101 → M
- 102–106 → entre M y L | 107–114 → L | 115–116 → entre L y XL | 117–122 → XL | 123–124 → entre XL y XXL | 125–132 → XXL
BOSS y HUGO:
- hasta 92 → XS | 93–94 → entre XS y S | 95 → S | 96–97 → entre S y M | 98 → M
- 99–101 → entre M y L | 102 → L | 103–105 → entre L y XL | 106 → XL | 107–109 → entre XL y XXL | 110 → XXL

CÓMO MEDIRSE (según Polo Ralph Lauren)
- Pecho: la cinta alrededor de la parte más ancha del pecho y omóplatos, con los brazos abajo.
- Cuello: alrededor del medio del cuello (a la altura de la manzana de Adán), dejando un dedo de holgura.
- Cintura: a la altura del ombligo, con la cinta pegada al cuerpo.
`.trim();

// ---------- Cálculo exacto de talla (el LLM se equivoca leyendo rangos) ----------

type Brand = "Ralph Lauren" | "BOSS / HUGO";

/** [pecho mínimo, pecho máximo, talla] según las tablas oficiales; los huecos dan "entre X y Y". */
const RANGES: Record<Brand, [number, number, string][]> = {
  "Ralph Lauren": [
    [0, 86.4, "XS"], [88.9, 94, "S"], [96.5, 101.6, "M"], [106.7, 114.3, "L"],
    [116.8, 121.9, "XL"], [124.5, 132.1, "XXL"],
  ],
  "BOSS / HUGO": [
    [0, 92, "XS"], [95, 95, "S"], [98, 98, "M"], [102, 102, "L"], [106, 106, "XL"], [110, 110, "XXL"],
  ],
};

export function sizeFor(brand: Brand, chestCm: number): string {
  const rows = RANGES[brand];
  for (let i = 0; i < rows.length; i++) {
    const [min, max, size] = rows[i];
    if (chestCm >= min && chestCm <= max) return size;
    const next = rows[i + 1];
    if (next && chestCm > max && chestCm < next[0]) return `entre ${size} y ${next[2]}`;
  }
  return `más de ${rows[rows.length - 1][2]} (fuera de la tabla)`;
}

type Fit = "rl-slim" | "regular-stretch";

/** Talla + recomendación según el corte que vende TRC (RL Slim Fit; Boss y Hugo Regular Stretch Fit). */
function recommend(fit: Fit, cm: number): string {
  const brand: Brand = fit === "rl-slim" ? "Ralph Lauren" : "BOSS / HUGO";
  const size = sizeFor(brand, cm);
  const between = size.match(/^entre (\S+) y (\S+)$/);
  if (!between) return size;
  const [, small, big] = between;
  if (fit === "rl-slim") return `${size}; recomienda ${big} porque el Slim Fit es entallado`;
  return `${size}; ${small} si le gusta entallado o ${big} si lo quiere más suelto`;
}

/** Busca una medida de pecho (60–150 cm) en el texto del cliente: "mido 104 de pecho", "104cm", "pecho 98". */
export function extractChestCm(text: string): number | null {
  const t = text.toLowerCase();
  if (!/pecho|cm|cent[ií]metro|mido|contorno/.test(t)) return null;
  // "mido 1.75 y peso 80 kg": sin la palabra pecho, peso/estatura no son contorno de pecho
  if (!/pecho|contorno/.test(t) && /kg|kilo|peso|estatura|altura|alto/.test(t)) return null;
  const m = t.match(/(\d{2,3}(?:[.,]\d)?)\s*(?:cm|cent)?/g);
  for (const raw of m ?? []) {
    const n = parseFloat(raw.replace(",", "."));
    if (n >= 60 && n <= 150) return Math.round(n);
  }
  return null;
}

/** Nota para el LLM con la talla ya calculada en las dos tablas, o null si el cliente no dio medida. */
export function sizeHint(recentUserTexts: string[]): string | null {
  for (const text of [...recentUserTexts].reverse()) {
    const cm = extractChestCm(text);
    if (cm === null) continue;
    return (
      `DATO CALCULADO (úsalo tal cual, no recalcules): el cliente mide ${cm} cm de pecho. ` +
      `Polo Ralph Lauren Slim Fit → ${recommend("rl-slim", cm)}. ` +
      `Boss Regular Fit → ${recommend("regular-stretch", cm)}. ` +
      `Responde con la talla de la marca que está viendo.`
    );
  }
  return null;
}
