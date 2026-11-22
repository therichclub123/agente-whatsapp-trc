"use client";

import type { ConversationListItem } from "@/lib/db";
import { formatPhone } from "@/lib/format";

function relativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

interface Props {
  conversations: ConversationListItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        Aún no hay conversaciones. Cuando alguien escriba a tu WhatsApp aparecerá aquí.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {conversations.map((c) => {
        const selected = c.id === selectedId;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full px-4 py-3 text-left transition-colors ${
                selected ? "bg-gray-100" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-gray-900">{c.name || formatPhone(c.phone)}</span>
                <span className="shrink-0 text-[11px] text-gray-400">
                  {relativeTime(c.last_message_at)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-gray-500">
                  {c.last_message_preview ?? "Sin mensajes"}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    c.mode === "AI" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {c.mode === "AI" ? "IA" : "HUMAN"}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
