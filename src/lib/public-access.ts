import { NextResponse } from "next/server";

import { fetchAgentConfig } from "@/lib/agent-client";
import {
  DEFAULT_PAUSE_MESSAGE,
  PAUSED_ERROR_CODE,
  type PublicAccessStatus,
} from "@/lib/public-access-config";

const STATUS_CACHE_TTL_MS = 15_000;

let cached: { status: PublicAccessStatus; at: number } | undefined;

export function invalidatePublicStatusCache(): void {
  cached = undefined;
}

/**
 * Pause state from the agent API, cached for 15 s (including read failures) so
 * early rejects cost no extra round trip per request.
 */
export async function getPublicStatus(): Promise<PublicAccessStatus> {
  const now = Date.now();
  if (cached && now - cached.at < STATUS_CACHE_TTL_MS) {
    return cached.status;
  }

  let status: PublicAccessStatus = { paused: false, message: null };
  try {
    const config = await fetchAgentConfig();
    status = config.paused
      ? {
          paused: true,
          message: config.pause_message?.trim() || DEFAULT_PAUSE_MESSAGE,
        }
      : { paused: false, message: null };
  } catch (error) {
    // Fail open: the agent enforces the hard turn limit itself.
    console.warn("[public-access] status read failed", error);
  }

  cached = { status, at: now };
  return status;
}

/** Returns a 503 response when the assistant is paused; null to proceed. */
export async function enforcePublicAccess(): Promise<NextResponse | null> {
  const status = await getPublicStatus();
  if (!status.paused) {
    return null;
  }

  return NextResponse.json(
    {
      error: PAUSED_ERROR_CODE,
      message: status.message ?? DEFAULT_PAUSE_MESSAGE,
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
