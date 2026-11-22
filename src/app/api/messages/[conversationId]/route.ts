import { NextRequest, NextResponse } from "next/server";
import { enqueueOutbox, getConversationById, getMessages, insertMessage } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const conversation = getConversationById(Number(conversationId));
  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ conversation, messages: getMessages(conversation.id) });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const conversation = getConversationById(Number(conversationId));
  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "El mensaje está vacío" }, { status: 400 });
  }

  // Visible en el dashboard al instante; el bot lo envía por WhatsApp desde el outbox
  const message = insertMessage(conversation.id, "human", content);
  enqueueOutbox(conversation.id, conversation.phone, content);

  return NextResponse.json({ ok: true, messageId: message.id });
}
