import { NextResponse } from "next/server";

import { getPublicStatus, invalidatePublicStatusCache } from "@/lib/public-access";

export const revalidate = 0;

/** Read before Turnstile and session creation, so a paused assistant costs nothing. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("refresh") === "1") {
    invalidatePublicStatusCache();
  }
  const status = await getPublicStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
