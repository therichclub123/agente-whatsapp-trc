import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// ---------- Tipos ----------

export type Mode = "AI" | "HUMAN";
export type Role = "user" | "assistant" | "human";
export type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: Mode;
  last_message_at: number | null;
  created_at: number;
}

export interface ConversationListItem extends Conversation {
  last_message_preview: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: Role;
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: 1;
  status: ConnectionStatus;
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

// ---------- Inicialización ----------

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "messages.db");

const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  last_message_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS connection_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
    NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(sent, created_at);

-- Copia de cada mensaje enviado por WhatsApp (protobuf). Baileys la pide vía getMessage
-- cuando el destinatario no pudo descifrarlo y solicita un reenvío.
CREATE TABLE IF NOT EXISTS wa_sent (
  id TEXT PRIMARY KEY,
  remote_jid TEXT NOT NULL,
  message BLOB NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

function openDatabase(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  // Bot y Next.js escriben en el mismo archivo: esperar en vez de fallar con SQLITE_BUSY
  db.pragma("busy_timeout = 5000");
  db.exec(DDL);
  return db;
}

// En desarrollo Next.js recarga módulos (HMR): reutilizamos la conexión vía globalThis
const globalForDb = globalThis as unknown as { __waDb?: Database.Database };
export const db: Database.Database = globalForDb.__waDb ?? openDatabase();
if (process.env.NODE_ENV !== "production") globalForDb.__waDb = db;

// ---------- Conversaciones ----------

export function getOrCreateConversation(phone: string, name?: string | null): Conversation {
  const existing = db
    .prepare("SELECT * FROM conversations WHERE phone = ?")
    .get(phone) as Conversation | undefined;

  if (existing) {
    // Actualiza el nombre si WhatsApp nos da uno y aún no lo teníamos o cambió
    if (name && name !== existing.name) {
      db.prepare("UPDATE conversations SET name = ? WHERE id = ?").run(name, existing.id);
      return { ...existing, name };
    }
    return existing;
  }

  return db
    .prepare("INSERT INTO conversations (phone, name) VALUES (?, ?) RETURNING *")
    .get(phone, name ?? null) as Conversation;
}

export function getConversationById(id: number): Conversation | null {
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | Conversation
    | undefined;
  return row ?? null;
}

export function setMode(conversationId: number, mode: Mode): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(mode, conversationId);
}

export function listConversations(): ConversationListItem[] {
  // Subquery correlacionada para el preview: una sola consulta, sin N+1
  return db
    .prepare(
      `SELECT c.*,
         (SELECT m.content FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1) AS last_message_preview
       FROM conversations c
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
    )
    .all() as ConversationListItem[];
}

export const deleteConversation = db.transaction((id: number): void => {
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  // Solo borramos lo pendiente; lo ya enviado queda como histórico
  db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
});

// ---------- Mensajes ----------

export const insertMessage = db.transaction(
  (conversationId: number, role: Role, content: string): Message => {
    const msg = db
      .prepare(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?) RETURNING *"
      )
      .get(conversationId, role, content) as Message;
    db.prepare("UPDATE conversations SET last_message_at = ? WHERE id = ?").run(
      msg.created_at,
      conversationId
    );
    return msg;
  }
);

export function getMessages(conversationId: number, limit = 50): Message[] {
  // Los últimos N, devueltos en orden cronológico ascendente
  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(conversationId, limit) as Message[];
  return rows.reverse();
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  // DESC + LIMIT aprovecha el índice; reverse en JS para dejarlos en orden ascendente
  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(conversationId, limit) as Message[];
  return rows.reverse();
}

// ---------- Estado de conexión ----------

export function getConnectionState(): ConnectionState {
  return db.prepare("SELECT * FROM connection_state WHERE id = 1").get() as ConnectionState;
}

/**
 * Actualiza solo los campos provistos. `undefined` (o ausente) preserva el valor
 * actual; `null` explícito lo borra.
 */
export function setConnectionState(update: {
  status: ConnectionStatus;
  qr_string?: string | null;
  phone?: string | null;
}): void {
  const sets = ["status = @status", "updated_at = unixepoch()"];
  const params: Record<string, unknown> = { status: update.status };

  if (update.qr_string !== undefined) {
    sets.push("qr_string = @qr_string");
    params.qr_string = update.qr_string;
  }
  if (update.phone !== undefined) {
    sets.push("phone = @phone");
    params.phone = update.phone;
  }

  db.prepare(`UPDATE connection_state SET ${sets.join(", ")} WHERE id = 1`).run(params);
}

// ---------- Outbox (mensajes humanos del dashboard → bot) ----------

export function enqueueOutbox(conversationId: number, phone: string, content: string): void {
  db.prepare("INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)").run(
    conversationId,
    phone,
    content
  );
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return db
    .prepare("SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC, id ASC LIMIT ?")
    .all(limit) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}

// ---------- Mensajes enviados (para reenvíos de WhatsApp) ----------

const SENT_RETENTION_SECONDS = 7 * 24 * 3600;

export function saveSentMessage(id: string, remoteJid: string, message: Uint8Array): void {
  db.prepare("INSERT OR REPLACE INTO wa_sent (id, remote_jid, message) VALUES (?, ?, ?)").run(
    id,
    remoteJid,
    Buffer.from(message)
  );
  // Los reenvíos se piden en minutos/horas: lo de más de 7 días ya no sirve
  db.prepare("DELETE FROM wa_sent WHERE created_at < unixepoch() - ?").run(SENT_RETENTION_SECONDS);
}

export function getSentMessage(id: string): Buffer | null {
  const row = db.prepare("SELECT message FROM wa_sent WHERE id = ?").get(id) as
    | { message: Buffer }
    | undefined;
  return row?.message ?? null;
}
