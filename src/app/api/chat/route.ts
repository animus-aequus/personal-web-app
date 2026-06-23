import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";

import { sendAgentChat } from "@/lib/agent-client";

export const revalidate = 0;
export const maxDuration = 120;

type ChatRequestBody = {
  sessionId?: string;
  session_id?: string;
  messages?: UIMessage[];
};

function extractUserText(messages: UIMessage[] | undefined): string {
  if (!messages?.length) {
    return "";
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return "";
  }

  return last.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const sessionId = body.sessionId ?? body.session_id;
    const userText = extractUserText(body.messages);

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!userText) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const { reply } = await sendAgentChat(sessionId, userText);

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const textId = "assistant-text";
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: reply });
        writer.write({ type: "text-end", id: textId });
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
