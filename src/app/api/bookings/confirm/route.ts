import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { confirmBooking } from "@/lib/agent-client";
import { enforceRateLimit, getClientIp, RateLimitRoute } from "@/lib/rate-limit";
import {
  isSessionBindingEnabled,
  missingSessionSecretResponse,
  SESSION_SECRET_COOKIE,
} from "@/lib/session-cookie";

export const revalidate = 0;

type ConfirmBody = {
  bookingId?: string;
  booking_id?: string;
  code?: string;
  sessionId?: string;
  session_id?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmBody;
    const bookingId = body.bookingId ?? body.booking_id;
    const code = body.code?.trim();
    const sessionId = body.sessionId ?? body.session_id;

    const rateLimited = await enforceRateLimit(
      request,
      RateLimitRoute.BookingConfirm,
      sessionId,
    );
    if (rateLimited) {
      return rateLimited;
    }

    if (!bookingId || !code) {
      return NextResponse.json(
        { error: "bookingId and code are required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const sessionSecret = cookieStore.get(SESSION_SECRET_COOKIE)?.value;
    if (isSessionBindingEnabled() && !sessionSecret) {
      return missingSessionSecretResponse();
    }

    const data = await confirmBooking(bookingId, code, {
      clientIp: getClientIp(request),
      sessionSecret,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirm failed";
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
