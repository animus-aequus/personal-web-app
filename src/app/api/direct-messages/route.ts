import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { sendDirectMessage } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";

export const revalidate = 0;

type SendBody = {
  sessionId?: string;
  session_id?: string;
  formId?: string;
  form_id?: string;
  name?: string;
  email?: string;
  message?: string;
  phoneNumber?: string;
  phone_number?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendBody;
    const sessionId = body.sessionId ?? body.session_id;
    const formId = body.formId ?? body.form_id;
    const name = body.name?.trim();
    const email = body.email?.trim();
    const message = body.message?.trim();
    const phoneNumber = (body.phoneNumber ?? body.phone_number)?.trim();

    const rateLimited = await enforceRateLimit(
      request,
      RateLimitRoute.DirectMessage,
      sessionId,
    );
    if (rateLimited) {
      return rateLimited;
    }

    if (!sessionId || !formId || !name || !email || !message) {
      return NextResponse.json(
        { error: "sessionId, formId, name, email, and message are required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled() && !sessionSecret) {
      return missingSessionSecretResponse();
    }

    const data = await sendDirectMessage(
      {
        sessionId,
        formId,
        name,
        email,
        message,
        phoneNumber: phoneNumber || undefined,
      },
      {
        clientIp: getClientIp(request),
        sessionSecret,
      },
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    let status = 500;
    if (message.includes("(429)")) {
      status = 429;
    } else if (message.includes("(422)")) {
      status = 422;
    } else if (message.includes("(401)")) {
      status = 401;
    } else if (message.includes("(502)")) {
      status = 502;
    } else if (message.includes("(503)")) {
      status = 503;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
