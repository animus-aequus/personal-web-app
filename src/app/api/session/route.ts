import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createAgentSession,
  updateAgentSession,
  InviteInvalidError,
  AssistantPausedError,
  RateLimitExceededError,
} from "@/lib/agent-client";
import { isLocaleCode } from "@/lib/i18n/locales";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/timezone";
import { INVITE_INVALID_ERROR_CODE } from "@/lib/public-access-config";
import { getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  SESSION_SECRET_COOKIE,
  sessionSecretCookieOptions,
} from "@/lib/session-cookie";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile/turnstile-config";
import { enforceTurnstile } from "@/lib/turnstile/verify-turnstile";

export const revalidate = 0;

function normalizeTimezoneInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string | null;
      language?: string | null;
      timezone?: string | null;
    };

    const sessionId = body.session_id?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const language = body.language?.trim();
    const timezone = normalizeTimezoneInput(body.timezone);
    const hasLanguage = Boolean(language && isLocaleCode(language));
    const hasTimezone = Boolean(timezone);

    if (!hasLanguage && !hasTimezone) {
      return NextResponse.json(
        { error: "language or timezone required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const existingSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;

    const data = await updateAgentSession(
      sessionId,
      {
        ...(hasLanguage ? { language } : {}),
        ...(hasTimezone && timezone ? { timezone } : {}),
      },
      {
        clientIp: getClientIp(request),
        sessionSecret: existingSecret,
      },
    );

    return NextResponse.json(
      {
        session_id: data.session_id,
        language: data.language ?? language ?? "en",
        timezone: data.timezone ?? timezone ?? DEFAULT_TIMEZONE,
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
  try {
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string | null;
      language?: string | null;
      timezone?: string | null;
      invite_token?: string | null;
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
      timezone: normalizeTimezoneInput(body.timezone),
      inviteToken: body.invite_token ?? null,
    });

    const invitationName = data.invitation_name?.trim() || null;
    const response = NextResponse.json(
      {
        session_id: data.session_id,
        thread_id: data.thread_id,
        language: data.language ?? "en",
        timezone: data.timezone ?? DEFAULT_TIMEZONE,
        session_type: data.session_type,
        ...(invitationName ? { invitation_name: invitationName } : {}),
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
    if (error instanceof InviteInvalidError) {
      return NextResponse.json(
        { error: INVITE_INVALID_ERROR_CODE },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof RateLimitExceededError) {
      return rateLimitResponse(
        error.retryAfterSeconds,
        error.action,
        error.retryAt,
      );
    }
    if (error instanceof AssistantPausedError) {
      return NextResponse.json(
        { error: "assistant_paused", message: error.pauseMessage },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const message = error instanceof Error ? error.message : "Session failed";
    const status = message.includes("(401)") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
