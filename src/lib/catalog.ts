// ✏️ Catálogo que usa el bot: stock por talla/color, precios y foto de cada prenda.
// Cuando cambie el stock o subas una prenda nueva, actualiza SOLO este archivo.
// Las fotos son las mismas de therichclub.online (Google Drive).
//
// Actualizado 2026-11-21 desde "The Rich Club (1).xlsx" (Black Friday, 58 filas activas).
// hugo-camisero, guess-camisero y adidas-cortaviento se quitaron: ya no están en el
// catálogo (confirmado por Fabox el 2026-11-21).

export const LANDING_URL = "https://therichclub.online";
export const CATALOGO_URL = "https://therichclub.online/catalogo";

export interface Product {
  /** Identificador corto que el bot usa para pedir la foto: [FOTOS: rl-basico] */
  id: string;
  nombre: string;
  precio: number;
  precioNormal: number;
  /** Stock por color → tallas disponibles (ej. "M (2)") */
  stock: Record<string, string>;
  /** Fotos de cada color: [prenda sola, modelo luciéndola] (las mismas de la hoja de therichclub.online) */
  fotos: Record<string, string[]>;
}

const drive = (id: string) => `https://lh3.googleusercontent.com/d/${id}`;

export const PRODUCTS: Product[] = [
  {
    id: "rl-basico",
    nombre: "Ralph Lauren Polo Básico Slimfit",
    precio: 99,
    precioNormal: 199,
    stock: {
      Negro: "S (1), M (2)",
      "Azul Marino": "M (2), L (3), XL (2)",
      Blanco: "S (3)",
      Beige: "S (1), XL (1)",
    },
    fotos: {
      Negro: [drive("1i3nrRzyxBu00Zk8emCt39fqgQpEWKfIQ"), drive("15hKS_AO45uoOVx8r3EKewPYllR7VZyjV")],
      "Azul Marino": [drive("1gqg9f_vvUMwzsIv_pxoThokf4n76wm_Z"), drive("1MzfSRm9Mcw514fCZ5mY1AjRSX_t-3qOh")],
      Blanco: [drive("1wIRO0cLjI1EvCMp8M62PVRJd2mw5Wl4n"), drive("1Me-vTS3d6cz8kyktdDTTTrZ-rEOgGwil")],
      Beige: [drive("1V-QerYNkQ-kTj6XsrlQLMQ0fbpmYfKiy"), drive("11nS_krUqKJplsbcjJP1NjGsFAv_yx6tW")],
    },
  },
  {
    id: "boss-blanco",
    nombre: "Boss Camisero Regular Fit",
    precio: 249,
    precioNormal: 499,
    stock: {
      Blanco: "L (1)",
      Negro: "XL (1)",
    },
    fotos: {
      Blanco: [drive("1uE7dynM3Hk8fTHc8C38hiT5fJ2AYW4js"), drive("1b1CKlwZxh7U5oEnWiFV4Zlv0WCvTVOBn")],
      Negro: [drive("17SwVZiX1lTQQrSF1eZUeNicGOpFkRlJz"), drive("1zdtzAq9MliFaEfaaIqgcsVzuwUpTDWmM")],
    },
  },
  {
    id: "boss-celeste",
    nombre: "Boss Camisero Regular Fit Celeste",
    precio: 249,
    precioNormal: 499,
    stock: { "Celeste Claro": "M (1)" },
    fotos: { "Celeste Claro": [drive("1Wu-A5qa2tsc9RVOsdRT-5igGtDsB-0jY"), drive("1Y_DcEvt5rNBCCa_lfSu69EU5ejqwQXux")] },
  },
  {
    id: "rl-camisero",
    nombre: "Ralph Lauren Camisero Slimfit",
    precio: 189,
    precioNormal: 399,
    stock: {
      "Azul Marino": "S (2), M (2), L (2), XL (2)",
      Negro: "S (1), M (2), L (3), XL (2)",
      Blanco: "S (3), M (1), L (2), XL (2)",
    },
    fotos: {
      "Azul Marino": [drive("1M_wAHxmQTJynSVBKkSyDN-W31c1hUjkN"), drive("1ZLKmMQBhHPFp7LzprfEYmC6t6j6CCTpV")],
      Negro: [drive("1URSRjrYq1pBDUAdsTBeBSLyTxvmmepvS"), drive("1lchQodG0mK5CAiNAMyda6kwA85PurAia")],
      Blanco: [drive("1BGmr_jKkcy7vWRKEi90-5khAkyHd3omh"), drive("1UwnZ822xkLgFC7JkH5aN0Zj8Idtv5TMq")],
    },
  },
  {
    id: "rl-camisero-europeo",
    nombre: "Ralph Lauren Camisero Slimfit estilo europeo",
    precio: 189,
    precioNormal: 399,
    stock: { Beige: "M (2)" },
    fotos: { Beige: [drive("1JP4Fhw_KCHGyd5Xwbs7jZkagRbuIPetb"), drive("1vtkd_rY00w8LgA74RRs5I8esY8f3MnY4")] },
  },
  {
    id: "pleasures-oversize",
    nombre: "Pleasures Polo Oversize",
    precio: 199,
    precioNormal: 299,
    stock: { "Verde Oliva": "L (1)" },
    fotos: { "Verde Oliva": [drive("1Wc-z8NCdRnMiXrY89ui3cXUOUSRowRjB"), drive("1zHfKaJpbHjet6FTglLu8-WL3gCrmbEli")] },
  },
  {
    id: "lacoste-camisero",
    nombre: "Lacoste Camisero Regular",
    precio: 189,
    precioNormal: 399,
    stock: {
      "Azul Noche": "S (2), M (3), L (3), XL (2)",
      Beige: "S (2), M (2), L (3), XL (1)",
    },
    fotos: {
      "Azul Noche": [drive("13X7cMXX5JMcq5hzlY5L7bWnad7vSOqG6"), drive("1SN8MSIP-hdY95RkXTzr8NeayYRqoiMiW")],
      Beige: [drive("1E0a3ZmasKUu6CUuSZgYKPL4226ieCgVL"), drive("1nSddMeuSSKgqE1MosrN9k2mEg7s0kex7")],
    },
  },
  {
    id: "lacoste-camisero-2",
    nombre: "Lacoste Camisero Regular 2",
    precio: 189,
    precioNormal: 399,
    stock: {
      Naranja: "S (1), M (3), L (2), XL (2)",
      "Azul Noche": "S (1), M (3), L (2), XL (2)",
    },
    fotos: {
      Naranja: [drive("1SQ4_m1NOiGYDv0luilo6pbm4V7Yvsb9v"), drive("13FiocoX9MKQwEehJSNejNFEEpg2DdNzK")],
      "Azul Noche": [drive("1uJwPNrR1UEW25EmaHlKa9TkXKy1lpb4N"), drive("1JPdWpm_ekb_XXBDz0LLhzS1oyDEPKIT5")],
    },
  },
  {
    id: "boss-regular-blanco",
    nombre: "Boss Camisero Regular Blanco",
    precio: 249,
    precioNormal: 499,
    stock: {
      Blanco: "L (2)",
      Negro: "M (2), L (2)",
    },
    fotos: {
      Blanco: [drive("1UXeYDS80XhjeEMmZHXAmHvobvKExJCIz"), drive("1sluLPecPG4pip7FTn4coXFELD6TN_dIi")],
      Negro: [drive("1bgf_mRsZn_o8E8RF8OSHSpsKEsLHpotW"), drive("1zDNaAMojgbwM_fKM_hHu3dVcY3V3nNgS")],
    },
  },
  {
    id: "boss-limon",
    nombre: "Boss Camisero Regular Limón",
    precio: 249,
    precioNormal: 499,
    stock: { Verde: "M (1)" },
    fotos: { Verde: [drive("1kC8Ts-7rReWJ5bmpBIAq6N7RBwofk0Ft"), drive("1sg-FRa7NiOfIHgRksdapBUbJ7B5ySLVm")] },
  },
  {
    id: "boss-verde-olivo",
    nombre: "Boss Camisero Verde Olivo",
    precio: 249,
    precioNormal: 499,
    stock: { "Verde Pistacho Claro": "M (1)" },
    fotos: { "Verde Pistacho Claro": [drive("1hh2eS45Am0CzTZG66kNKveE-0W3wvYYB"), drive("1olw-F6O32XZrfNIZlEM5i_uhlAfCXN14")] },
  },
  {
    id: "boss-gris",
    nombre: "Boss Camisero Regular Gris",
    precio: 249,
    precioNormal: 499,
    stock: { Gris: "L (2)" },
    fotos: { Gris: [drive("1hZ9a5VwLUNGOs2J-NpcRHxeAg6gYJZAW"), drive("13sMU7YaeKqSEtFfQij8fxqmh-xs8otww")] },
  },
  {
    id: "boss-negro-blanco",
    nombre: "Boss Camisero Negro y Blanco",
    precio: 249,
    precioNormal: 499,
    stock: { Negro: "M (1)" },
    fotos: { Negro: [drive("1DyAnSJvMK85AWf_tkaEUVGB8IVWhCWDs"), drive("17znLUJzwkjjwyCHfYeuZpC_akf11sfH2")] },
  },
  {
    id: "boss-negro-verde",
    nombre: "Boss Camisero Negro y Verde",
    precio: 249,
    precioNormal: 499,
    stock: { Negro: "M (1)" },
    fotos: { Negro: [drive("18Ja0Hyki6fOeAfgR9RfedrEWo-TXIV0E"), drive("1Z3jV2N1-IbBDZRNr5kPS31gQR8eJK1Zr")] },
  },
  {
    id: "boss-cierre",
    nombre: "Boss Quarter Zip Cierre",
    precio: 249,
    precioNormal: 499,
    stock: {
      Negro: "M (1), L (2)",
      Blanco: "M (2), L (2)",
    },
    fotos: {
      Negro: [drive("1rzkIIgy83BmYlvNt-oL-Nr-Q7evbZB4U"), drive("1diKmZaX-3WvKvI2IAoanXWZzCfKRtYtS")],
      Blanco: [drive("1gE2HKfmCk8GGMYUiWjJEzFfPLfiBZlQd"), drive("1ULYTFpsuf-A4hk29Uxj4niobTpufiw_C")],
    },
  },
  {
    id: "lacoste-conjunto-monogram",
    nombre: "Lacoste Conjunto Monogram",
    precio: 299,
    precioNormal: 599,
    stock: { "Marrón Medio": "L (2)" },
    fotos: { "Marrón Medio": [drive("12y3kjGmzQlsA5-yiQjmYScH0ml_ukCAM"), drive("1SODBayE38SUcdUcMvirTrhMbdiGNaBo6")] },
  },
  {
    id: "psycho-bunny-pb1",
    nombre: "Psycho Bunny Camisero PB1",
    precio: 229,
    precioNormal: 389,
    stock: { Negro: "M (3)" },
    fotos: { Negro: [drive("1O5qcEAvw0DPYt4z-Q7g5ENBxRqkdFiB0"), drive("1_d-78-YMVdJxRKC9JMXqultz4bgTlBNj")] },
  },
  {
    id: "psycho-bunny-pb2",
    nombre: "Psycho Bunny Camisero PB2",
    precio: 229,
    precioNormal: 389,
    stock: { Negro: "M (2)" },
    fotos: { Negro: [drive("14kyf_fPC5dq01VTAGAvixaK3IPb_mi58"), drive("1mTK0yvE8q8Ci6YDrDUXwRzskWbH6OH6v")] },
  },
  {
    id: "psycho-bunny-pb3",
    nombre: "Psycho Bunny Camisero PB3",
    precio: 229,
    precioNormal: 399,
    stock: { Morado: "M (2)" },
    fotos: { Morado: [drive("1I5BmJauGK8ERTZSzNPBa8Lb8t6KHMe9n"), drive("1S7qvn6MZrKyeT0l57cNEhJSwW-2Vxh7V")] },
  },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id.trim().toLowerCase());
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Color del producto que coincide con el texto ("azul" → "Azul Marino"); undefined si no hay. */
export function findColor(p: Product, text: string): string | undefined {
  const t = norm(text);
  if (!t) return undefined;
  const colors = Object.keys(p.fotos);
  return colors.find((c) => norm(c) === t) ?? colors.find((c) => norm(c).includes(t) || t.includes(norm(c).split(" ")[0]));
}

/** Catálogo en texto compacto para el system prompt (solo para que el bot sepa qué hay; nunca lo pega al cliente). */
export function catalogForPrompt(): string {
  return PRODUCTS.map((p) => {
    const stock = Object.entries(p.stock)
      .map(([color, tallas]) => `${color} → tallas ${tallas.replace(/\s*\(\d+\)/g, "")}`)
      .join(" | ");
    return `- [${p.id}] ${p.nombre} — S/ ${p.precio} (antes S/ ${p.precioNormal}) — ${stock}`;
  }).join("\n");
}
