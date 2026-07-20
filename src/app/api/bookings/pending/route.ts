import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fetchPendingBooking } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId =
      searchParams.get("sessionId") ?? searchParams.get("session_id");

    const rateLimited = await enforceRateLimit(
      request,
      RateLimitRoute.Booking,
      sessionId ?? undefined,
    );
    if (rateLimited) {
      return rateLimited;
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled() && !sessionSecret) {
      return missingSessionSecretResponse();
    }

    const data = await fetchPendingBooking(sessionId, {
      clientIp: getClientIp(request),
      sessionSecret,
    });
    if (!data) {
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pending fetch failed";
    let status = 500;
    if (message.includes("(401)")) {
      status = 401;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
