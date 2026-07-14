import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { streamAgentChat } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile/turnstile-config";
import { enforceTurnstile } from "@/lib/turnstile/verify-turnstile";

export const revalidate = 0;
export const maxDuration = 120;

type ChatRequestBody = {
  sessionId?: string;
  session_id?: string;
  messages?: UIMessage[];
  turnstileToken?: string;
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

    const rateLimited = await enforceRateLimit(request, RateLimitRoute.Chat, sessionId);
    if (rateLimited) {
      return rateLimited;
    }

    const turnstileBlocked = await enforceTurnstile(
      request,
      body[TURNSTILE_TOKEN_FIELD],
    );
    if (turnstileBlocked) {
      return turnstileBlocked;
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!userText) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled() && !sessionSecret) {
      return missingSessionSecretResponse();
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = "assistant-text";
        writer.write({ type: "text-start", id: textId });
        try {
          for await (const delta of streamAgentChat(sessionId, userText, {
            clientIp: getClientIp(request),
            sessionSecret,
          })) {
            writer.write({ type: "text-delta", id: textId, delta });
          }
        } finally {
          writer.write({ type: "text-end", id: textId });
        }
      },
      onError: (error) =>
        error instanceof Error ? error.message : "Chat failed",
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    const status = message.includes("(401)") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
