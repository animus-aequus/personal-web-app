import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { cancelBooking } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";

export const revalidate = 0;

type CancelBody = {
  bookingId?: string;
  booking_id?: string;
  sessionId?: string;
  session_id?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelBody;
    const bookingId = body.bookingId ?? body.booking_id;
    const sessionId = body.sessionId ?? body.session_id;

    const rateLimited = await enforceRateLimit(
      request,
      RateLimitRoute.Booking,
      sessionId,
    );
    if (rateLimited) {
      return rateLimited;
    }

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled() && !sessionSecret) {
      return missingSessionSecretResponse();
    }

    const data = await cancelBooking(bookingId, {
      clientIp: getClientIp(request),
      sessionSecret,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cancel failed";
    let status = 500;
    if (message.includes("(409)")) {
      status = 409;
    } else if (message.includes("(404)")) {
      status = 404;
    } else if (message.includes("(401)")) {
      status = 401;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
