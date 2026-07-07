import { NextResponse } from "next/server";

import { fetchChatHistory } from "@/lib/agent-client";
import { enforceRateLimit } from "@/lib/rate-limit";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") ?? searchParams.get("session_id");

    const rateLimited = await enforceRateLimit(request, "messages", sessionId ?? undefined);
    if (rateLimited) {
      return rateLimited;
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const before = searchParams.get("before") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    if (limit !== undefined && (Number.isNaN(limit) || limit < 1 || limit > 50)) {
      return NextResponse.json(
        { error: "limit must be between 1 and 50" },
        { status: 400 },
      );
    }

    const data = await fetchChatHistory(sessionId, { before, limit });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "History failed";
    const status = message.includes("(404)") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
