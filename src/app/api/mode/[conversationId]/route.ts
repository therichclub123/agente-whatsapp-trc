import { NextRequest, NextResponse } from "next/server";
import { getConversationById, setMode, type Mode } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const conversation = getConversationById(Number(conversationId));
  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { mode?: unknown } | null;
  const mode = body?.mode;
  if (mode !== "AI" && mode !== "HUMAN") {
    return NextResponse.json({ error: "mode debe ser 'AI' o 'HUMAN'" }, { status: 400 });
  }

  setMode(conversation.id, mode as Mode);
  return NextResponse.json({ ok: true, mode });
}
