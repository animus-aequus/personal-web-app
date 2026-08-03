import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAgentSession, updateAgentSessionLanguage } from "@/lib/agent-client";
import { isLocaleCode } from "@/lib/i18n/locales";
import { enforcePublicAccess } from "@/lib/public-access";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  SESSION_SECRET_COOKIE,
  sessionSecretCookieOptions,
} from "@/lib/session-cookie";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile/turnstile-config";
import { enforceTurnstile } from "@/lib/turnstile/verify-turnstile";

export const revalidate = 0;

export async function PATCH(request: Request) {
  const paused = await enforcePublicAccess();
  if (paused) {
    return paused;
  }

  const rateLimited = await enforceRateLimit(request, RateLimitRoute.Session);
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string | null;
      language?: string | null;
    };

    const sessionId = body.session_id?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const language = body.language?.trim();
    if (!language || !isLocaleCode(language)) {
      return NextResponse.json({ error: "invalid language" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const existingSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;

    const data = await updateAgentSessionLanguage(sessionId, language, {
      clientIp: getClientIp(request),
      sessionSecret: existingSecret,
    });

    return NextResponse.json(
      {
        session_id: data.session_id,
        language: data.language ?? language,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session update failed";
    const status = message.includes("(401)") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const paused = await enforcePublicAccess();
  if (paused) {
    return paused;
  }

  const rateLimited = await enforceRateLimit(request, RateLimitRoute.Session);
  if (rateLimited) {
    return rateLimited;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string | null;
      language?: string | null;
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
      language: body.language ?? null,
    });

    const response = NextResponse.json(
      {
        session_id: data.session_id,
        thread_id: data.thread_id,
        language: data.language ?? "en",
      },
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
