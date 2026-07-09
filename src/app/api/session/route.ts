import { NextResponse } from "next/server";

import { createAgentSession } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
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

    const data = await createAgentSession(body.session_id ?? undefined, getClientIp(request));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
