import { NextResponse } from "next/server";

import { createAgentSession } from "@/lib/agent-client";

export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string | null;
    };
    const data = await createAgentSession(body.session_id ?? undefined);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
