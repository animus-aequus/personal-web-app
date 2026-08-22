import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { enforceEdgeRateLimit } from "@/lib/rate-limit";

/**
 * Next.js 16 Proxy (formerly Middleware): coarse per-IP Upstash shield for
 * BFF API routes. Precise session quotas live on the agent (Postgres).
 */
export async function proxy(request: NextRequest) {
  const limited = await enforceEdgeRateLimit(request);
  if (limited) {
    return limited;
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/((?!public-status|app-config|webhooks/).*)",
  ],
};
