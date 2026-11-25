// ✏️ Catálogo que usa el bot — rediseño 2026-11-25.
// Ya NO se rastrea stock exacto por color/talla: cada categoría (marca + prenda) tiene un
// precio único. Las fotos ya no viven aquí como URLs sueltas por producto: se sacan de la
// carpeta de Google Drive "Tallas TRC" (una subcarpeta por talla S/M/L/XL/XXL, compartida
// como "cualquiera con el enlace"), filtradas por el nombre del archivo.
//
// Cuando Fabox suba fotos nuevas a esa carpeta de Drive, hay que volver a generar
// PHOTOS_BY_TALLA con el mismo proceso (listar la carpeta, categorizar por nombre de
// archivo, generar este bloque) — no se puede editar a mano con confianza.

export const LANDING_URL = "https://therichclub.online";
export const CATALOGO_URL = "https://therichclub.online/catalogo";

export type Talla = "S" | "M" | "L" | "XL" | "XXL";
export const TALLAS: Talla[] = ["S", "M", "L", "XL", "XXL"];

export type Prenda = "polo" | "camisero" | "conjunto";

export interface Category {
  id: string;
  marca: string;
  prenda: Prenda;
  nombre: string;
  precio: number;
  /** Precio antes del descuento. Si no se da, no se menciona "antes" al cliente. */
  precioNormal?: number;
}

// Precios confirmados por Fabox (2026-11-25). OJO: "psycho-polo" no tiene precio
// confirmado explícitamente — se le puso el mismo precio que "psycho-camisero" (259)
// como supuesto razonable. Avisar a Fabox para que lo confirme o corrija.
// Tampoco se confirmó un "antes" para "lacoste-polo": se deja sin tachado hasta que lo diga.
export const CATEGORIES: Category[] = [
  { id: "ralph-polo", marca: "Polo Ralph Lauren", prenda: "polo", nombre: "Polo Ralph Lauren Polo Básico Slimfit", precio: 99, precioNormal: 199 },
  { id: "ralph-camisero", marca: "Polo Ralph Lauren", prenda: "camisero", nombre: "Polo Ralph Lauren Camisero Slimfit", precio: 189, precioNormal: 399 },
  { id: "boss-polo", marca: "Boss", prenda: "polo", nombre: "Boss Polo", precio: 189, precioNormal: 399 },
  { id: "boss-camisero", marca: "Boss", prenda: "camisero", nombre: "Boss Camisero", precio: 259, precioNormal: 499 },
  { id: "lacoste-polo", marca: "Lacoste", prenda: "polo", nombre: "Lacoste Polo", precio: 159, precioNormal: 299 },
  { id: "lacoste-camisero", marca: "Lacoste", prenda: "camisero", nombre: "Lacoste Camisero Regular", precio: 189, precioNormal: 399 },
  { id: "lacoste-conjunto", marca: "Lacoste", prenda: "conjunto", nombre: "Lacoste Conjunto Monogram", precio: 299, precioNormal: 599 },
  { id: "psycho-camisero", marca: "Psycho Bunny", prenda: "camisero", nombre: "Psycho Bunny Camisero", precio: 259, precioNormal: 389 },
  { id: "psycho-polo", marca: "Psycho Bunny", prenda: "polo", nombre: "Psycho Bunny Polo", precio: 189, precioNormal: 389 },
  { id: "pleasures-polo", marca: "Pleasures", prenda: "polo", nombre: "Pleasures Polo Oversize", precio: 199, precioNormal: 299 },
];

export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

const normMarca = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Marca + prenda → id de categoría ("Boss", "polo" → "boss-polo"). */
export function categoryIdFor(marca: string, prenda: Prenda): string | undefined {
  const m = normMarca(marca);
  return CATEGORIES.find((c) => normMarca(c.marca).includes(m) && c.prenda === prenda)?.id;
}

export interface Photo {
  category: string;
  title: string;
  url: string;
}

const drive = (id: string) => `https://lh3.googleusercontent.com/d/${id}`;

export const PHOTOS_BY_TALLA: Record<Talla, Photo[]> = {
  S: [
    { category: "boss-polo", title: "Boss Polo 1.jpeg", url: drive("10MoCSNByDctViidATudtM0siEbIxc3vR") },
    { category: "boss-polo", title: "Boss Polo 2.jpeg", url: drive("1Wf5JDQ1r-_mAxi33ibcG9OQHwzDd0d_u") },
    { category: "boss-polo", title: "Boss Polo 3.jpeg", url: drive("1GHasW9T0tVpHSWLfaNmADS2wpxqS3bRe") },
    { category: "boss-polo", title: "Boss Polo 4.jpeg", url: drive("1gmjIqjis4xxIc5Cjb64a27dU2yU4-nM7") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 1 prenda.png", url: drive("1mbdfsGNSrqgSLCeK14kgYqSjjZYpQMV4") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 2 modelo.jpg", url: drive("1ND0qsjfyBdrMkgSynQyzij-PAK5YsCFp") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 1 prenda.png", url: drive("1JwcQxlDqrBeIxEMavhZDGO0pt2xTpjDa") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 2 modelo.jpg", url: drive("1_Vk9iEf4DSsmwHipVOKth0KlgeBMrrC5") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 1 prenda.jpg", url: drive("1CF_7TaHgfX_IAqw7iOAi8BcKTq96e-q5") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 2 modelo.png", url: drive("1PhzTiu1nDUSb5MC0445A229XlIyT_Anu") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 1 prenda.jpg", url: drive("15woieSDktcHesLoObR-NIhZUi7L9rFBw") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 2 modelo.png", url: drive("1ivN-MfNLjEDxHA8uJPV1EvP5QMSysQGl") },
    { category: "lacoste-polo", title: "Lacoste Polo 1.jpeg", url: drive("1u2uyN5p3tivNvEQw-InaCi7mMsLgHgP2") },
    { category: "lacoste-polo", title: "Lacoste Polo 2.jpeg", url: drive("1Ky2Bgno562wA0rW0uOZBC31ojfgLAQlY") },
    { category: "lacoste-polo", title: "Lacoste Polo 3.jpeg", url: drive("1ODVsmna0KyC34Y4mjIUklHrYsbnaenKl") },
    { category: "lacoste-polo", title: "Lacoste Polo 4.jpeg", url: drive("1LMBcCjlwTWcX_rFFlQ-p157dkKnhxDVl") },
    { category: "lacoste-polo", title: "Lacoste Polo 5.jpeg", url: drive("13v_6n9I7Urd9Erb2gnMADIwlQBliHbWV") },
    { category: "psycho-polo", title: "Psycho Bunny Polo 1.jpeg", url: drive("1pz3lFQjB5ZxyHlGMDNrRFTbEoRGnhZC0") },
    { category: "psycho-polo", title: "Psycho Bunny Polo 2.jpeg", url: drive("1n4c50sJ2bYY-CF8Q4hheNT0rJaJuiTqM") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 1 prenda.jpg", url: drive("1rzdsrQcfykab6I4fU74y9KCrhG_YrpIY") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 2 modelo.png", url: drive("1XaoxTEi9fcvhnKxHbT30IjL45-RUppYp") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 1 prenda.png", url: drive("1sc1wv_pujBQjZDkTMSBSjsPkLf6-3Lq4") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 2 modelo.png", url: drive("1dn5UEh5hgIhHhN2xzNRESrU8R6mPeV5B") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 1 prenda.png", url: drive("1JkVe3WlNMV5Xg8Cm7tcb-JK5RbFM0r3c") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 2 modelo.png", url: drive("1EWi1eUx33Y8AGuYQDV5lmZA1A62ESjN9") },
  ],
  M: [
    { category: "boss-camisero", title: "Boss Camisero Negro y Blanco - Negro - 1 prenda.png", url: drive("1ZTexLtm22YfElz9Wk8EvEg9QwAx6_fOr") },
    { category: "boss-camisero", title: "Boss Camisero Negro y Blanco - Negro - 2 modelo.png", url: drive("14wJxiBMbU84fSWEjp2wt4hhLhRgh9BWM") },
    { category: "boss-camisero", title: "Boss Camisero Negro y Verde - Negro - 1 prenda.png", url: drive("1tapsItIhgNk_20j9upmNgGT_YGE80Tsb") },
    { category: "boss-camisero", title: "Boss Camisero Negro y Verde - Negro - 2 modelo.png", url: drive("1t3KjE1RORBfXuCVl5HnXqaLkn8KcVgy1") },
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Blanco - 1 prenda.png", url: drive("1dp_PwbS6jnAcIo6Kn3rlCipkvPjztQw5") },
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Blanco - 2 modelo.png", url: drive("1xHjscCpcyIjsSjqT8u4uT417cYWUcjw_") },
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Negro - 1 prenda.png", url: drive("1CBSws9uhT7l0ZO2C-u4hKESFxQOqpKZb") },
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Negro - 2 modelo.png", url: drive("1h2FmL1T9Gb4wAiLekn878jQzSeNthBWl") },
    { category: "boss-camisero", title: "Boss Camisero Regular Fit Celeste - Celeste Claro - 1 prenda.png", url: drive("1GBmtNDz6caRAhPpM_q6MBhofHBqeGIYH") },
    { category: "boss-camisero", title: "Boss Camisero Regular Fit Celeste - Celeste Claro - 2 modelo.png", url: drive("1QzSdgUNVzj6C_IUo_WWRNHugHqS4iX7O") },
    { category: "boss-camisero", title: "Boss Camisero Regular Limón - Verde - 1 prenda.png", url: drive("1rV6F2MbUaLG_JvwxHu-8J_GC67OySzmS") },
    { category: "boss-camisero", title: "Boss Camisero Regular Limón - Verde - 2 modelo.png", url: drive("1rl70UAhRO6pgQDDEznzkWtaKRhKb66-e") },
    { category: "boss-camisero", title: "Boss Camisero Verde Olivo - Verde Pistacho Claro - 1 prenda.png", url: drive("1EU5w7AHWgwh0RhEZAlgHgi7w8854k0Fk") },
    { category: "boss-camisero", title: "Boss Camisero Verde Olivo - Verde Pistacho Claro - 2 modelo.png", url: drive("1iQQ4aajsv7-nhlKqif0xbA0LHaRUXvk4") },
    { category: "boss-polo", title: "Boss Polo 1.jpeg", url: drive("1WfVj02X3zS7Hzb_hnqD9VhIgDV78LEEt") },
    { category: "boss-polo", title: "Boss Polo 10.png", url: drive("1ZGhgiYp2OXmselXy3e9eH6zPulOcVYeB") },
    { category: "boss-polo", title: "Boss Polo 11.JPG", url: drive("1Q_x2IswzxGoIVE2a1tO7km16HsZMZalU") },
    { category: "boss-polo", title: "Boss Polo 12.JPG", url: drive("1HHtR8-9CUjdafH9DiKDFzQzZ2BWxUxdw") },
    { category: "boss-polo", title: "Boss Polo 2.jpeg", url: drive("1ENnVDEmW3FV8XwpF72CZJ4-Cb-fZla6V") },
    { category: "boss-polo", title: "Boss Polo 5.png", url: drive("148kXnSQ0T3dlgpYlywAWyEFYpgqy14JN") },
    { category: "boss-polo", title: "Boss Polo 6.png", url: drive("18WRtiWu2q_EWzZYDsTMVIWmnxgDrlGNn") },
    { category: "boss-polo", title: "Boss Polo 7.png", url: drive("1THZED0BMk1y298OjMnV9jxFRjhU0xgDH") },
    { category: "boss-polo", title: "Boss Polo 8.png", url: drive("18_DnP_87N4BBq6ekTbpeGvz8aXoTH0UL") },
    { category: "boss-polo", title: "Boss Polo 9.png", url: drive("1aS0DgavsCAiqIN3GXkDXLV8Su2GzZxpz") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Blanco - 1 prenda.png", url: drive("1Ea_o4L5NCwwFWj8Q0_TqFuZfRmTQymmv") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Blanco - 2 modelo.png", url: drive("15FDyk7eNp4Hd5pAsgVVjTtbflff2_N_t") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Negro - 1 prenda.png", url: drive("1hrDAjbEgXAswhaTqRfoQ-9WJFjvKPwI5") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Negro - 2 modelo.png", url: drive("1hLpls3SjKjDelDhQRL_zdtuoUMDRLUKU") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 1 prenda.png", url: drive("1DHq_-hm4CRcq0isolm8DpHzrFu_8WRST") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 2 modelo.jpg", url: drive("1oqp0mfrGZY6-oZJEaj9k06_3PeteqFMp") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 1 prenda.png", url: drive("1Cd-kyok0OlA77ZoYD_iEarylONFce3y_") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 2 modelo.jpg", url: drive("1WwzqqkxqQjW_3rRl-8oBmLBYborSgg4H") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 1 prenda.jpg", url: drive("1hCeiKrL8CAbaLpNz4_YvOc3np4DomgnC") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 2 modelo.png", url: drive("18ewGrcsA_9Wt4EJuc85RCM9zQ8c5_Yxv") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 1 prenda.jpg", url: drive("1frYf21jSjEeaHHoNK3qk25PYyRTYbIst") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 2 modelo.png", url: drive("1TYkG_Nhxsyi5nDlJRl_izUIXcrjP_Yhj") },
    { category: "lacoste-polo", title: "Lacoste Polo 1.jpeg", url: drive("1qs1q2kjcdnUoKHYKougXznoVvFFMJNcH") },
    { category: "lacoste-polo", title: "Lacoste Polo 2.jpeg", url: drive("1l4TtzYNTO5qexiicBv8S4zFdxRyDYDjn") },
    { category: "lacoste-polo", title: "Lacoste Polo 3.jpeg", url: drive("1nxrAo3u3_1Ts1GTtmOauoCEX3_7yRMfd") },
    { category: "lacoste-polo", title: "Lacoste Polo 4.jpeg", url: drive("1jabv7Vd7ZW8UrBQZQBuQ1lwr40TwCugq") },
    { category: "lacoste-polo", title: "Lacoste Polo 5.jpeg", url: drive("1MsaJrr4oFZh8y7e8YWQr2rHhNhjscXaF") },
    { category: "psycho-camisero", title: "Psycho Bunny Camisero PB1 - Negro - 1 prenda.png", url: drive("1N9Ma7QwtdwXLSwq_Il0kRj3Jq6GeymGc") },
    { category: "psycho-camisero", title: "Psycho Bunny Camisero PB1 - Negro - 2 modelo.png", url: drive("1R6nbnI5F1A_pbDNmPj_RkSX4oAR-2WkN") },
    { category: "psycho-camisero", title: "Psycho Bunny Camisero PB2 - Negro - 1 prenda.png", url: drive("1EA4fce21_pe2M8jANvdNgRInEu5H1972") },
    { category: "psycho-camisero", title: "Psycho Bunny Camisero PB2 - Negro - 2 modelo.png", url: drive("1jR2aBL7U7HFrSYQCp3znX6NsrZg0r2XO") },
    { category: "psycho-camisero", title: "Psycho Bunny Camisero PB3 - Morado - 1 prenda.png", url: drive("120d_NeaOov2-O6Xcx1E_Neqzja5aS0Sc") },
    { category: "psycho-camisero", title: "Psycho Bunny Camisero PB3 - Morado - 2 modelo.png", url: drive("1Xgk0--hxxm3kKjQsoShEkS3GxaeEETVe") },
    { category: "psycho-polo", title: "Psycho Bunny Polo 3.jpg", url: drive("1mcKS33nNO3zphyjEwoacYotGvI3ujOHB") },
    { category: "psycho-polo", title: "Psycho Bunny Polo 4.jpg", url: drive("1WLZiVdmgWypathNy3mhISjpVMu8V7l00") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 1 prenda.jpg", url: drive("1x7mEYs2cdtAtZidgxZZ0eAzVdgZ9SCBO") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 2 modelo.png", url: drive("1A3eC18ehniEcRH7awsvoqNq__-R8KS78") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 1 prenda.png", url: drive("1La4Z_p2BdsKC_KamVSHQwtaT-q_WS9I_") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 2 modelo.png", url: drive("1mdqIl6AqQ8OrtTNc8X712JZnZYw1p4j8") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 1 prenda.png", url: drive("1csMi4y21w1_2TdH32w9Zq_rjacU6crde") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 2 modelo.png", url: drive("1DTlJ2jwv36o1-dBZKWxW0QvYkioMLCHr") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit estilo europeo - Beige - 1 prenda.png", url: drive("1hRG3kZhcgpe6j-f2Yn__zIGMz3oYf5s1") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit estilo europeo - Beige - 2 modelo.jpg", url: drive("1uSxsmupefCNOtNBsNXvLMwHx4FR5v5QB") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Azul Marino - 1 prenda.jpg", url: drive("1V-EkeyBM95nEwt9nT_KYRJ3uVBPic9tQ") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Azul Marino - 2 modelo.png", url: drive("1x5YgH_fak05DmAqicEV9sEXyHhPuKKJM") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Negro - 1 prenda.jpg", url: drive("15Idjr9FTnqtIOJl28JUKDj2q74mWPg9g") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Negro - 2 modelo.png", url: drive("1lXXicnYUQorcstpGwuMepMLyjTVKcgeS") },
  ],
  L: [
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Blanco - 1 prenda.png", url: drive("10YvEzYEo4_iD8wQuQ6Zvo8ZxUugx9WTm") },
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Blanco - 2 modelo.png", url: drive("1Uh77xjSMw_P9rNnBF1MG5WVu-HhILePr") },
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Negro - 1 prenda.png", url: drive("1bBDzc7acjX_n3_f3b9FXRQC6ilDJTWGq") },
    { category: "boss-camisero", title: "Boss Camisero Regular Blanco - Negro - 2 modelo.png", url: drive("1odLiOyzQ8Vp4WqOIpJovEfvePjr32dDC") },
    { category: "boss-camisero", title: "Boss Camisero Regular Fit - Blanco - 1 prenda.png", url: drive("1GaTA3Ud5rvQz1NdbRdMmIOMUXyHXUqxj") },
    { category: "boss-camisero", title: "Boss Camisero Regular Fit - Blanco - 2 modelo.png", url: drive("1RzKZZ1dCHq3OkZPWEyyed8Q_wwjZXizn") },
    { category: "boss-camisero", title: "Boss Camisero Regular Gris - Gris - 1 prenda.png", url: drive("13IhVbDxgLI9zekAHCFXisTgjSNR3W7Yy") },
    { category: "boss-camisero", title: "Boss Camisero Regular Gris - Gris - 2 modelo.png", url: drive("1jWsf3oIasNuwz9fZs1H6PU2DHeLJRskG") },
    { category: "boss-polo", title: "Boss Polo 1.jpeg", url: drive("1h3JaM9HM1ONNi6mwP6xsBHQGRj6BauRq") },
    { category: "boss-polo", title: "Boss Polo 13.JPG", url: drive("1FryGOTOVGJV4t4YqsqW2wLEJMn5TD96Z") },
    { category: "boss-polo", title: "Boss Polo 14.JPG", url: drive("1F7Jww1Z4xy3dFx5wAs34aGthqWV0BrY-") },
    { category: "boss-polo", title: "Boss Polo 15.JPG", url: drive("1hcQWPYwncUM1zRX45pN4jhrxiXDYcHlH") },
    { category: "boss-polo", title: "Boss Polo 2.jpeg", url: drive("1_W5UMVglhfJT22BaALp_wfUuU4ih9bgH") },
    { category: "boss-polo", title: "Boss Polo 5.png", url: drive("10hq_0Q9Kqjbe5gR0Cr8mWhjpyroozS3N") },
    { category: "boss-polo", title: "Boss Polo 6.png", url: drive("1XCcDfApumvZCGNzducfVjCFsbCpETym9") },
    { category: "boss-polo", title: "Boss Polo 7.png", url: drive("15Bn3QIC0sRNYFWd504lHUpLKL8DuFhf3") },
    { category: "boss-polo", title: "Boss Polo 8.png", url: drive("150wBz5bEsC4T53MnENS-3VFvdJI0kV3B") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Blanco - 1 prenda.png", url: drive("16AVXelEOVZXLQVK2cldS9M0qtiMa6qfi") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Blanco - 2 modelo.png", url: drive("16m4aUCEhw3prSe_0SZ83YcePzK2XOK2t") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Negro - 1 prenda.png", url: drive("1kSBjPzkmGFnFXNFysIa2tZv0JJ59t67I") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Negro - 2 modelo.png", url: drive("1u_B447ksRqs_iqx4a1k3hSxrlGBTQqpo") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 1 prenda.png", url: drive("1AMRo8JHy-643EfByKJJG0Lt6JfzHHNLi") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 2 modelo.jpg", url: drive("1xW8rZ0l2gc3377L9zvT6XpkSyCknRlqy") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 1 prenda.png", url: drive("1l6g7Hjz_C0lyGTsVOQqryBA2u_0M0vlr") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 2 modelo.jpg", url: drive("1eSg7OJUFfbnnLZqIxH30cRWmGGE-TZjZ") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 1 prenda.jpg", url: drive("1yfjsa-k_VRpdTrL9mXLKzBebYAtc7maA") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 2 modelo.png", url: drive("1ATwFnEglzFQhBbE9CSiVAHSM8dHVPf2U") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 1 prenda.jpg", url: drive("1amLxvW4odDvFvrqgMPa6o7Y6C5Ho0ZEZ") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 2 modelo.png", url: drive("1gBfl0dFoACiCHSPLzvyOSuWlA-9KX_e0") },
    { category: "lacoste-conjunto", title: "Lacoste Conjunto Monogram - Marrón Medio - 3 prenda.png", url: drive("1hp1mxl7H4eN9qqZRVQY2--6deFkLwrs3") },
    { category: "lacoste-conjunto", title: "Lacoste Conjunto Monogram - Marrón Medio - 4 modelo.png", url: drive("1ocWBVGnEbpcHCnLlUZEayAvvK4dn7nWq") },
    { category: "lacoste-polo", title: "Lacoste Polo 1.jpeg", url: drive("1AavSAqpynh5yDJcvKc78J5qCBcYXxf8q") },
    { category: "lacoste-polo", title: "Lacoste Polo 2.jpeg", url: drive("1Yef5PM77beUU_6l3BA8CxDqmKgIg22F4") },
    { category: "lacoste-polo", title: "Lacoste Polo 3.jpeg", url: drive("1E6AwLTdwGT_-OBIMs205Tz_jwgue_niW") },
    { category: "lacoste-polo", title: "Lacoste Polo 4.jpeg", url: drive("18T45MY9kzR-fDAtCKdy_lE9cgDSnQsCy") },
    { category: "lacoste-polo", title: "Lacoste Polo 5.jpeg", url: drive("18xyp9oXN-0O_faHSYfPzKcGYL5RyADKl") },
    { category: "psycho-polo", title: "Psycho Bunny Polo 5.png", url: drive("19pYax03TaghPECvyUv2ReY94KtNpYSMa") },
    { category: "psycho-polo", title: "Psycho Bunny Polo 6.png", url: drive("1Hb3NK8j6zOIgHH_GLzsE0T7N3MvoEoUE") },
    { category: "psycho-polo", title: "Psycho Bunny Polo 8.jpeg", url: drive("14AV-JBG4P6qFv78CaDeNPUUT2UEbLHTR") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 1 prenda.jpg", url: drive("14NkjSCs4YSmODwsZSiRzD_7liyflnz9O") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 2 modelo.png", url: drive("1yaTIBS1ol_fwYGFxg6JkeOboguS_RacG") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 1 prenda.png", url: drive("1CoxEU995Ka7p9xrJDERnB9GntV746qt-") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 2 modelo.png", url: drive("1luWAY9gCiYHHCUC4jx2Zld0c53bChkzZ") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 1 prenda.png", url: drive("1wG16EmTAXlIjZMCRabS9QyHHsGsZhTIv") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 2 modelo.png", url: drive("1dl71qP-gUbiO-fPpLLAXd2LwFrAiIyPG") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Azul Marino - 1 prenda.jpg", url: drive("1mcK1pElILMHguvPphWY0OZe-WIoXx7a6") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Azul Marino - 2 modelo.png", url: drive("17iQAHe70feeNskAb3wrw0gZhacjg9jMZ") },
  ],
  XL: [
    { category: "boss-camisero", title: "Boss Camisero Regular Fit - Negro - 1 prenda.png", url: drive("1v77B2yE4XnqMmEBvGhvk8Nw9wKJbSItE") },
    { category: "boss-camisero", title: "Boss Camisero Regular Fit - Negro - 2 modelo.png", url: drive("1Priri_MBx9QgKLAKFr8G-EhaoOz6S5tW") },
    { category: "boss-polo", title: "Boss Polo 1.jpeg", url: drive("1HPSxV30GQRYnh6_q2e-Pp-gw82VT9Chj") },
    { category: "boss-polo", title: "Boss Polo 16.jpg", url: drive("1AbwaPg1X1b5hYypYxOrA33EeiID7pJEK") },
    { category: "boss-polo", title: "Boss Polo 2.jpeg", url: drive("1hGIS2dXcIsjUkIkrMk66Zn-l3LERdUxA") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Blanco - 1 prenda.png", url: drive("1g77o9oEcUYBzW8tlli1Bwu-CXllu8L-y") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Blanco - 2 modelo.png", url: drive("1_uWmMZOZF9NUuT4t2RWiQIh7os2a9nFL") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Negro - 1 prenda.png", url: drive("1pG1MnRhtGQ9X8z4JYx9lXDRK7jytPn0I") },
    { category: "boss-camisero", title: "Boss Quarter Zip Cierre - Negro - 2 modelo.png", url: drive("1ZJmlKAzdmJ2eWAl_i6HtM2jDBkURB3Q_") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 1 prenda.png", url: drive("1vSGFYgt6_XFhB_wA36ML4MLMB12E2HNI") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Azul Noche - 2 modelo.jpg", url: drive("1Qy1PNXuhv7bKfAgHhbfDA4_K9hcpief2") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 1 prenda.png", url: drive("1a11306t8L5tFAButc8PR2y2te7t7Lhnc") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular - Beige - 2 modelo.jpg", url: drive("1FehkMqIKKfm09UwyExtvHQEPKyLO4D_i") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 1 prenda.jpg", url: drive("1YzRvB9sPS-x8LeE3XVoOTMfVGprLSklv") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Azul Noche - 2 modelo.png", url: drive("1wSCkISu0KwJcJ1sJoNGb49wUbiF2W5Dg") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 1 prenda.jpg", url: drive("1xYz2iqEOx42QRHLgJwaA4cSiImo7EydF") },
    { category: "lacoste-camisero", title: "Lacoste Camisero Regular 2 - Naranja - 2 modelo.png", url: drive("1qPRGMKBNxrYe9jBWMX9TnOz7CspEKKQ-") },
    { category: "lacoste-polo", title: "Lacoste Polo 1.jpeg", url: drive("1Uxqt9zMDg7UCdi0r9lxyGGiQF1JlMLmR") },
    { category: "lacoste-polo", title: "Lacoste Polo 2.jpeg", url: drive("16st7JDYDRpLaYZ7zVKKeheMS4DW_8Fri") },
    { category: "lacoste-polo", title: "Lacoste Polo 3.jpeg", url: drive("1e0DnAsOfmryRQ3uRJ3aV9w5hPYMhWIl5") },
    { category: "lacoste-polo", title: "Lacoste Polo 4.jpeg", url: drive("1DMCM-I42SqWiDohQrgA92Jcg7wMWgO5y") },
    { category: "lacoste-polo", title: "Lacoste Polo 5.jpeg", url: drive("1kHJQrbD4NNDN-7b60cmebmnb5XBePRju") },
    { category: "lacoste-polo", title: "Lacoste Polo 6.JPG", url: drive("1YC3xhRw_Z4fAL6uV2ovNQWBnwPSkbQ_g") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 1 prenda.jpg", url: drive("1ikY276nMaL1RoEqqDEH0BJnrR6HpkeNy") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Azul Marino - 2 modelo.png", url: drive("1xxqDO9SDCAuO0tOUXY2A0GTvo5vyNXyw") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 1 prenda.png", url: drive("1FJroaTnKPDKYIE0LJWpQXKgqwcCI6vb8") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Blanco - 2 modelo.png", url: drive("1aMLn9xz6Q2OqhndqM1cP0U7uiEjExKdb") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 1 prenda.png", url: drive("1-jLUgnoVUBehZ0D0evTK484CY4-8wx8t") },
    { category: "ralph-camisero", title: "Ralph Lauren Camisero Slimfit - Negro - 2 modelo.png", url: drive("1nmvy1ZVr43SDTNpmAhSPZIr2jHlf_vmF") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Beige - 1 prenda.png", url: drive("1sd9lo15UeLV9Xw-v4Kc8ILwC-EfqKPgz") },
    { category: "ralph-polo", title: "Ralph Lauren Polo Básico Slimfit - Beige - 2 modelo.png", url: drive("1qfVG1jPmub7nEXPXQDHY4ySRqxMODzEw") },
  ],
  XXL: [
    { category: "psycho-polo", title: "Psycho Bunny Polo 7.JPG", url: drive("14ChRcQ8oXRYzf_0LObeABDKXHz0k0dbc") },
  ],
};

/** Todas las fotos de una categoría en una talla (vacío si no hay nada que mostrar). */
export function photosFor(talla: Talla, categoryId: string): Photo[] {
  return PHOTOS_BY_TALLA[talla].filter((p) => p.category === categoryId);
}

/** Catálogo en texto compacto para el system prompt. */
export function catalogForPrompt(): string {
  return CATEGORIES.map((c) => `- [${c.id}] ${c.nombre} — S/ ${c.precio}${c.precioNormal ? ` (antes S/ ${c.precioNormal})` : ""}`).join("\n");
}
