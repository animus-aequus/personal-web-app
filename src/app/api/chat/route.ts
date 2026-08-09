import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { openAgentChatStream, RateLimitExceededError, streamAgentChatFromResponse } from "@/lib/agent-client";
import {
  CHAT_MESSAGE_MAX,
  isChatMessageTooLong,
  isChatRequestBodyTooLarge,
} from "@/lib/chat/chat-message-validation";
import { enforcePublicAccess } from "@/lib/public-access";
import { getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";

export const revalidate = 0;
export const maxDuration = 120;

type ChatRequestBody = {
  sessionId?: string;
  session_id?: string;
  message?: string;
};

export async function POST(request: Request) {
  const paused = await enforcePublicAccess();
  if (paused) {
    return paused;
  }

  try {
    if (isChatRequestBodyTooLarge(request.headers.get("content-length"))) {
      return NextResponse.json(
        { error: "message_too_long", maxChars: CHAT_MESSAGE_MAX },
        { status: 400 },
      );
    }

    const body = (await request.json()) as ChatRequestBody;
    const sessionId = body.sessionId ?? body.session_id;
    const userText =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!userText) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (isChatMessageTooLong(userText)) {
      return NextResponse.json(
        { error: "message_too_long", maxChars: CHAT_MESSAGE_MAX },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled() && !sessionSecret) {
      return missingSessionSecretResponse();
    }

    const agentOptions = {
      clientIp: getClientIp(request),
      sessionSecret,
    };

    let agentResponse: Response;
    try {
      agentResponse = await openAgentChatStream(sessionId, userText, agentOptions);
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        return rateLimitResponse(
          error.retryAfterSeconds,
          error.action,
          error.retryAt,
        );
      }
      throw error;
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = "assistant-text";
        writer.write({ type: "text-start", id: textId });
        try {
          for await (const event of streamAgentChatFromResponse(agentResponse)) {
            if (event.type === "delta") {
              if (event.text) {
                writer.write({ type: "text-delta", id: textId, delta: event.text });
              }
            } else if (event.type === "ui" && event.widget === "otp") {
              writer.write({
                type: "data-otp",
                id: event.bookingId,
                data: {
                  bookingId: event.bookingId,
                  emailMasked: event.emailMasked,
                  expiresAt: event.expiresAt,
                  attemptsLeft: event.attemptsLeft,
                },
              });
            } else if (event.type === "ui" && event.widget === "meetings_list") {
              writer.write({
                type: "data-meetings-list",
                id: event.listId,
                data: {
                  listId: event.listId,
                  meetings: event.meetings,
                },
              });
            } else if (event.type === "ui" && event.widget === "direct_message") {
              writer.write({
                type: "data-direct-message",
                id: event.formId,
                data: {
                  formId: event.formId,
                  name: event.name,
                  email: event.email,
                  phoneNumber: event.phoneNumber,
                },
              });
            }
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
