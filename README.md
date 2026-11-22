# Agente WhatsApp — The Rich Club

Agente de WhatsApp local que se conecta a un número real vía **Baileys** (WhatsApp Web) y responde con un LLM a través de **OpenRouter**. Incluye un dashboard en Next.js para ver conversaciones, intervenir manualmente y cambiar cada chat entre modo **IA** (responde el bot) y **HUMANO** (respondes tú desde el dashboard).

Todo corre en localhost: la data vive en SQLite (`./data/messages.db`) y la sesión de WhatsApp en `./auth/`.

## Requisitos

- Node.js 20.9+ (recomendado 22, ver `.nvmrc`)
- Una API key de [OpenRouter](https://openrouter.ai/keys)

## Instalación

```bash
npm install            # ~1 min: compila better-sqlite3
cp .env.example .env.local
# edita .env.local y pon tu OPENROUTER_API_KEY
```

### Modelo recomendado

Usa `OPENROUTER_MODEL=openai/gpt-4o-mini` (~$0.15 por millón de tokens de entrada: centavos al mes para uso normal). Los modelos `:free` de OpenRouter tienen límites muy estrictos (50 requests/día sin créditos cargados) y fallan en uso real con error **429**.

## Uso en desarrollo

En dos terminales:

```bash
npm run start:bot      # proceso de WhatsApp (Baileys)
npm run dev            # dashboard en http://localhost:3000
```

1. Abre http://localhost:3000. Si no hay sesión, verás la pantalla **Conectar número** con el QR.
2. En tu teléfono: WhatsApp → Configuración → Dispositivos vinculados → Vincular un dispositivo, y escanea.
3. El dashboard pasa solo a la lista de conversaciones. La sesión queda guardada en `./auth/`: al reiniciar el bot no se vuelve a pedir QR.

(La terminal del bot también imprime el QR en ASCII, solo como respaldo para debugging.)

## Cómo funciona

- **Dos procesos** que comparten la base SQLite (modo WAL):
  - `scripts/start-bot.ts`: Baileys, recibe mensajes, llama al LLM y envía respuestas.
  - Next.js: dashboard y API.
- **`connection_state`**: fila única donde el bot publica el estado (`disconnected`/`qr`/`connecting`/`connected`) y el QR; el dashboard la lee cada 2s.
- **`outbox`**: los mensajes que envías desde el dashboard (modo HUMANO) se encolan ahí; el bot los envía cada 2s y reintenta si la conexión cae.
- **Modo IA**: el bot responde con los últimos 20 mensajes como contexto + el system prompt (`src/lib/system-prompt.ts`).
- **Modo HUMANO**: el bot solo guarda los mensajes; respondes tú desde el dashboard.
- **Desconectar** (botón del header): borra la sesión, cierra sesión en WhatsApp y muestra un QR nuevo.

Alcance v1: solo chats 1:1 de texto. Se ignoran grupos, audios, imágenes y stickers.

## Solución de problemas

| Síntoma | Solución |
|---|---|
| El bot muestra `code=440` en loop | En el teléfono (Configuración → Dispositivos vinculados) borra dispositivos viejos de pruebas anteriores. Si persiste, cambia de IP o espera 24h. |
| `LLM 429` en los logs | El modelo `:free` agotó su cuota. Usa `OPENROUTER_MODEL=openai/gpt-4o-mini`. |
| El dashboard dice "No se recibe el QR del bot" | Verifica que `npm run start:bot` esté corriendo y reinícialo. |
| Desvinculaste el dispositivo desde el teléfono (`code=401`) | El bot no reconecta. Borra `./auth` y reinicia `npm run start:bot` para obtener un QR nuevo. |
| Se conecta y enseguida aparece `code=401` | Probablemente hay dos bots corriendo con la misma sesión. El bot ahora se niega a arrancar si ya hay otro (candado `data/bot.lock`); deja solo uno, borra `./auth` y vuelve a escanear. |
| `Falta OPENROUTER_API_KEY` | Configura la key en `.env.local` y reinicia el bot. |

## Deploy en producción (EasyPanel / Railway, sin Docker)

> ⚠️ **BLOQUEANTE: el dashboard NO tiene autenticación.** Antes de exponerlo a internet pon basic auth a nivel de proxy (EasyPanel, Caddy, Nginx) o Cloudflare Access. Si no, cualquiera con la URL puede leer todas tus conversaciones de WhatsApp y enviar mensajes haciéndose pasar por ti.

- `nixpacks.toml` y `Procfile` arrancan todo con `npm run start:all` (bot + Next.js con `concurrently`).
- `.nvmrc` fuerza Node 22.
- **Volúmenes persistentes obligatorios**: `/app/data` y `/app/auth`. Sin ellos cada redespliegue pierde las conversaciones y obliga a re-escanear el QR.
- Configura `OPENROUTER_API_KEY` y `OPENROUTER_MODEL` como variables de entorno del servicio.

## Estructura

```
src/app/api/        rutas: connection/status, connection/disconnect, conversations, messages, mode
src/components/     ConnectionGate, QRScreen, DashboardHeader, ConversationList, ConversationPanel, ...
src/lib/db.ts       SQLite: schema + helpers
src/lib/openrouter.ts, system-prompt.ts
src/lib/baileys/    client.ts (conexión/reconexión), handler.ts (mensajes entrantes)
scripts/            env-loader.ts, start-bot.ts
```

## Mejoras pendientes

- Autenticación propia en el dashboard (hoy depende del proxy).
- Recuperación automática tras `code=401` (borrar `./auth` y mostrar QR nuevo sin reiniciar el bot).
- Soporte para grupos, audios (transcripción) e imágenes.
- Polling incremental (solo mensajes nuevos) o WebSockets/SSE en lugar de polling completo.
- Avisar en el dashboard cuando el bot sugiere derivar a un asesor humano (y pasar el chat a HUMANO automáticamente).
- Catálogo/stock en la base de datos en vez de hardcodeado en el system prompt.
