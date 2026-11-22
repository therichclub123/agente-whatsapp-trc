import type { Message } from "@/lib/db";

function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday ? time : `${d.toLocaleDateString("es", { day: "2-digit", month: "short" })} ${time}`;
}

const STYLES: Record<Message["role"], { row: string; bubble: string; label: string }> = {
  user: {
    row: "justify-start",
    bubble: "bg-white border border-gray-200 text-gray-900",
    label: "Cliente",
  },
  assistant: {
    row: "justify-end",
    bubble: "bg-emerald-600 text-white",
    label: "Bot",
  },
  human: {
    row: "justify-end",
    bubble: "bg-amber-500 text-white",
    label: "Humano",
  },
};

export default function MessageBubble({ message }: { message: Message }) {
  const s = STYLES[message.role];
  return (
    <div className={`flex ${s.row}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm ${s.bubble}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        <p className="mt-1 text-right text-[10px] opacity-70">
          {s.label} · {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
