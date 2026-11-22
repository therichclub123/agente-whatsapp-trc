import OpenAI from "openai";
import type { Message } from "./db";
import { SYSTEM_PROMPT } from "./system-prompt";
import { sizeHint } from "./size-guide";
import { stockHint } from "./stock-check";

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
  'RECORDATORIO: termina con UNA pregunta de opciones (A o B), que NO se pueda responder con "sí" o "no". ' +
  'Mal: "¿Te lo separo?", "¿Te va ese?", "¿Lo quieres?". Bien: "¿Te lo separo en M o en L?", "¿Es para Lima o provincia?". ' +
  'Si el cliente no sabe qué quiere, manda el link de la landing. Si ya nombró marca, prenda o color, manda las fotos con [FOTOS: …], no la landing.';

export async function generateReply(history: Message[]): Promise<string> {
  if (!API_KEY || API_KEY.startsWith("sk-or-...")) {
    throw new Error("Falta OPENROUTER_API_KEY en .env.local");
  }

  // Talla calculada por código a partir de la medida que dio el cliente (últimos 6 mensajes)
  const userTexts = history.filter((m) => m.role === "user").map((m) => m.content);
  const hint = sizeHint(userTexts.slice(-6));
  // Stock exacto de las prendas que mencionó el cliente (últimos 4 mensajes)
  const stock = stockHint(userTexts.slice(-4));

  const completion = await client.chat.completions.create({
    model: MODEL,
    // Tope duro para que no mande testamentos: el prompt pide máx. 30 palabras
    max_tokens: 160,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      ...(hint ? [{ role: "system" as const, content: hint }] : []),
      ...(stock ? [{ role: "system" as const, content: stock }] : []),
      { role: "system" as const, content: REMINDER },
    ],
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) throw new Error("El LLM devolvió una respuesta vacía");
  return reply;
}
