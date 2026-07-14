import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAgentSession } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  SESSION_SECRET_COOKIE,
  sessionSecretCookieOptions,
} from "@/lib/session-cookie";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile/turnstile-config";
import { enforceTurnstile } from "@/lib/turnstile/verify-turnstile";

export const revalidate = 0;

export async function POST(request: Request) {
  const rateLimited = await enforceRateLimit(request, RateLimitRoute.Session);
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string | null;
      [TURNSTILE_TOKEN_FIELD]?: string;
    };

    const turnstileBlocked = await enforceTurnstile(
      request,
      body[TURNSTILE_TOKEN_FIELD],
    );
    if (turnstileBlocked) {
      return turnstileBlocked;
    }

    const cookieStore = await cookies();
    const existingSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;

    const data = await createAgentSession(body.session_id ?? undefined, {
      clientIp: getClientIp(request),
      sessionSecret: existingSecret,
    });

    const response = NextResponse.json(
      { session_id: data.session_id, thread_id: data.thread_id },
      { headers: { "Cache-Control": "no-store" } },
    );

    const secret = data.session_secret ?? existingSecret;
    const expiresAt = data.session_expires_at;
    if (isSessionBindingEnabled() && secret && expiresAt) {
      response.cookies.set(
        SESSION_SECRET_COOKIE,
        secret,
        sessionSecretCookieOptions(expiresAt),
      );
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session failed";
    const status = message.includes("(401)") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
