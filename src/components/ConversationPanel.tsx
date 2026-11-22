"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Message, Mode } from "@/lib/db";
import { formatPhone } from "@/lib/format";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";

interface Props {
  conversationId: number;
  /** Se llama tras borrar la conversación o si ya no existe. */
  onGone: () => void;
  /** Se llama cuando cambia algo que afecta a la lista (modo, mensaje enviado). */
  onChanged: () => void;
}

export default function ConversationPanel({ conversationId, onGone, onChanged }: Props) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages/${conversationId}`, { cache: "no-store" });
    if (res.status === 404) return onGone();
    if (!res.ok) return;
    const data = (await res.json()) as { conversation: Conversation; messages: Message[] };
    setConversation(data.conversation);
    setMessages(data.messages);
  }, [conversationId, onGone]);

  // Polling cada 2s
  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setDraft("");
    setConfirmDelete(false);
    setError(null);
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [load]);

  // Auto-scroll al último mensaje
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastId]);

  async function changeMode(mode: Mode) {
    if (!conversation) return;
    setConversation({ ...conversation, mode }); // optimista
    const res = await fetch(`/api/mode/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) setError("No se pudo cambiar el modo");
    void load();
    onChanged();
  }

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      setDraft("");
      await load();
      onChanged();
    } catch {
      setError("No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    const res = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("No se pudo borrar la conversación");
      setConfirmDelete(false);
      return;
    }
    onGone();
  }

  if (!conversation) {
    return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Cargando...</div>;
  }

  const isHuman = conversation.mode === "HUMAN";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Cabecera del chat */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{conversation.name || formatPhone(conversation.phone)}</p>
          <p className="text-xs text-gray-500">{formatPhone(conversation.phone)}</p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle mode={conversation.mode} onChange={changeMode} />
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Borrar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 px-5 py-4">
        {messages.length === 0 && <p className="text-center text-sm text-gray-400">Sin mensajes</p>}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-5 py-3">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        {isHuman ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe un mensaje como humano..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </form>
        ) : (
          <div className="flex gap-2">
            <input
              disabled
              placeholder="El bot responde automáticamente"
              className="flex-1 cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm"
            />
            <button disabled className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-white">
              Enviar
            </button>
          </div>
        )}
      </div>

      {/* Diálogo de confirmación de borrado */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-semibold text-gray-900">¿Borrar conversación?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Se borrarán todos los mensajes con {conversation.name || formatPhone(conversation.phone)} del
              dashboard. Esta acción no se puede deshacer. No afecta al chat en el teléfono.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
