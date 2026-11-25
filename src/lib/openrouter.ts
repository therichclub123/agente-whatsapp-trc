import OpenAI from "openai";
import type { Message } from "./db";
import { SYSTEM_PROMPT } from "./system-prompt";
import { sizeHint } from "./size-guide";
import { mentionedBrand, mentionedPrenda } from "./stock-check";
import { categoryIdFor, findCategory } from "./catalog";

/**
 * Precio exacto de lo que el cliente ya mencionó (marca + prenda), para que el LLM nunca
 * invente un número. null si todavía no dijo ambas cosas.
 */
function priceHint(userTexts: string[]): string | null {
  const brand = mentionedBrand(userTexts);
  const prenda = mentionedPrenda(userTexts);
  if (!brand || !prenda) return null;
  const categoryId = categoryIdFor(brand, prenda);
  const category = categoryId ? findCategory(categoryId) : undefined;
  if (!category) return null;
  return (
    `PRECIO EXACTO (úsalo tal cual, no inventes otro): ${category.nombre} — S/ ${category.precio}` +
    (category.precioNormal ? ` (antes S/ ${category.precioNormal})` : "") +
    "."
  );
}

// Se leen al cargar el módulo: en el proceso bot, scripts/env-loader.ts debe importarse antes
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: API_KEY || "missing-key",
  // Los 429 de OpenRouter suelen ser momentáneos: reintentar con backoff exponencial (~30s en total)
  maxRetries: 5,
  timeout: 30_000,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Agente WhatsApp",
  },
});

/**
 * Genera la respuesta del bot a partir del historial reciente (orden ascendente).
 * Los mensajes 'human' (enviados desde el dashboard) salieron del lado del negocio,
 * así que el LLM los ve como respuestas 'assistant' previas.
 */
/** Lo que más se le olvida al modelo; va al final para que pese más. */
const REMINDER =
  "RECORDATORIO: no escribas tú las fotos ni ningún tag de corchetes para mandarlas — el sistema las manda solo " +
  "apenas sepa prenda, marca y talla. Tu trabajo es solo conversar y, si ya tienes esos 3 datos, mencionar el " +
  "precio exacto (viene en una nota del sistema) y seguir la venta. Si el cliente no sabe qué quiere, manda el link de la landing. " +
  "NUNCA pegues la lista de categorías/precios del catálogo ni resumas varias marcas juntas en un mensaje — " +
  "un precio es siempre de UNA sola prenda a la vez, la que ya confirmó marca+prenda.";

export async function generateReply(history: Message[]): Promise<string> {
  if (!API_KEY || API_KEY.startsWith("sk-or-...")) {
    throw new Error("Falta OPENROUTER_API_KEY en .env.local");
  }

  // Talla calculada por código a partir de la medida que dio el cliente (últimos 6 mensajes)
  const userTexts = history.filter((m) => m.role === "user").map((m) => m.content);
  const hint = sizeHint(userTexts.slice(-6));
  // Precio exacto de lo que el cliente ya mencionó (últimos 4 mensajes)
  const price = priceHint(userTexts.slice(-4));

  const completion = await client.chat.completions.create({
    model: MODEL,
    // Tope duro para que no mande testamentos: el prompt pide máx. 30 palabras.
    max_tokens: 160,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      ...(hint ? [{ role: "system" as const, content: hint }] : []),
      ...(price ? [{ role: "system" as const, content: price }] : []),
      { role: "system" as const, content: REMINDER },
    ],
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) throw new Error("El LLM devolvió una respuesta vacía");
  return reply;
}
