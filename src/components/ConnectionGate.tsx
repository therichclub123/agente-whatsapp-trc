"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConnectionStatus, ConversationListItem } from "@/lib/db";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";
import DashboardHeader from "./DashboardHeader";
import QRScreen from "./QRScreen";

interface StatusResponse {
  status: ConnectionStatus;
  qrPng?: string;
  phone?: string | null;
}

export default function ConnectionGate() {
  const [conn, setConn] = useState<StatusResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/connection/status", { cache: "no-store" });
      if (res.ok) setConn((await res.json()) as StatusResponse);
    } catch {
      // Servidor reiniciándose: se reintenta en el próximo tick
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { conversations: ConversationListItem[] };
        setConversations(data.conversations);
      }
    } catch {}
  }, []);

  const connected = conn?.status === "connected";

  // Polling cada 2s: estado de conexión siempre; conversaciones solo si está conectado
  useEffect(() => {
    const tick = () => {
      void loadStatus();
      if (connected) void loadConversations();
    };
    tick();
    const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, [connected, loadStatus, loadConversations]);

  const handleGone = useCallback(() => {
    setSelectedId(null);
    void loadConversations();
  }, [loadConversations]);

  const handleChanged = useCallback(() => void loadConversations(), [loadConversations]);

  async function handleDisconnect() {
    await fetch("/api/connection/disconnect", { method: "POST" });
    setSelectedId(null);
    await loadStatus();
  }

  if (!conn) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
      </div>
    );
  }

  if (!connected) {
    return <QRScreen status={conn.status} qrPng={conn.qrPng ?? null} />;
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader phone={conn.phone ?? null} onDisconnect={handleDisconnect} />
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        {selectedId !== null ? (
          <ConversationPanel
            key={selectedId}
            conversationId={selectedId}
            onGone={handleGone}
            onChanged={handleChanged}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Selecciona una conversación
          </div>
        )}
      </div>
    </div>
  );
}
