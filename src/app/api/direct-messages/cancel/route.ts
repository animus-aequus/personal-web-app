import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { cancelDirectMessage } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";

export const revalidate = 0;

type CancelBody = {
  sessionId?: string;
  session_id?: string;
  formId?: string;
  form_id?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelBody;
    const sessionId = body.sessionId ?? body.session_id;
    const formId = body.formId ?? body.form_id;

    const rateLimited = await enforceRateLimit(
      request,
      RateLimitRoute.Booking,
      sessionId,
    );
    if (rateLimited) {
      return rateLimited;
    }

    if (!sessionId || !formId) {
      return NextResponse.json(
        { error: "sessionId and formId are required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled() && !sessionSecret) {
      return missingSessionSecretResponse();
    }

    const data = await cancelDirectMessage(
      { sessionId, formId },
      {
        clientIp: getClientIp(request),
        sessionSecret,
      },
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cancel failed";
    let status = 500;
    if (message.includes("(429)")) {
      status = 429;
    } else if (message.includes("(422)")) {
      status = 422;
    } else if (message.includes("(401)")) {
      status = 401;
    }
    return NextResponse.json({ error: message }, { status });
  }
}