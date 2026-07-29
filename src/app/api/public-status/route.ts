import { NextResponse } from "next/server";

import { getPublicStatus } from "@/lib/public-access";

export const revalidate = 0;

/** Read before Turnstile and session creation, so a paused assistant costs nothing. */
export async function GET() {
  const status = await getPublicStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
