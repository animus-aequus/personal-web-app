import { NextResponse } from "next/server";

import { fetchAgentConfig } from "@/lib/agent-client";
import {
  DEFAULT_PAUSE_MESSAGE,
  PAUSED_ERROR_CODE,
  emptyPublicAccessStatus,
  type PublicAccessBucketStatus,
  type PublicAccessStatus,
  type SessionType,
} from "@/lib/public-access-config";

const STATUS_CACHE_TTL_MS = 15_000;

let cached: { status: PublicAccessStatus; at: number } | undefined;

export function invalidatePublicStatusCache(): void {
  cached = undefined;
}

function normalizeBucket(
  raw: { paused?: boolean; pause_message?: string | null } | undefined,
): PublicAccessBucketStatus {
  if (!raw || raw.paused !== true) {
    return { paused: false, message: null };
  }
  const message =
    (typeof raw.pause_message === "string" && raw.pause_message.trim()) ||
    DEFAULT_PAUSE_MESSAGE;
  return { paused: true, message };
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

  let status = emptyPublicAccessStatus();
  try {
    const config = await fetchAgentConfig();
    const byType = config.paused_by_type;
    status = {
      byType: {
        public: normalizeBucket(byType.public),
        invited: normalizeBucket(byType.invited),
      },
    };
  } catch (error) {
    // Fail open: the agent enforces the hard turn limit itself.
    console.warn("[public-access] status read failed", error);
  }

  cached = { status, at: now };
  return status;
}

/** Returns a 503 response when the given bucket is paused; null to proceed. */
export async function enforcePublicAccess(
  sessionType: SessionType = "public",
): Promise<NextResponse | null> {
  const status = await getPublicStatus();
  const bucket = status.byType[sessionType];
  if (!bucket?.paused) {
    return null;
  }
  return NextResponse.json(
    {
      error: PAUSED_ERROR_CODE,
      message: bucket.message ?? DEFAULT_PAUSE_MESSAGE,
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
