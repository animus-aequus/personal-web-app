import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

import {
  loadRateLimitConfig,
  type RateLimitConfig,
} from "@/lib/rate-limit-config";

export type RateLimitAction = "chat" | "voice" | "direct_message" | "edge";

export type RateLimitCheckResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

let cachedConfig: RateLimitConfig | undefined;
let cachedRedis: Redis | undefined;
let cachedLimiter: Ratelimit | undefined;
let warnedMissingUpstash = false;
let warnedUpstashError = false;
const ephemeralCache = new Map();

function getConfig(): RateLimitConfig {
  cachedConfig ??= loadRateLimitConfig();
  return cachedConfig;
}

function getRedis(config: RateLimitConfig): Redis | null {
  if (!config.upstash.url || !config.upstash.token) {
    return null;
  }
  cachedRedis ??= new Redis({
    url: config.upstash.url,
    token: config.upstash.token,
  });
  return cachedRedis;
}

function getEdgeLimiter(redis: Redis, config: RateLimitConfig): Ratelimit {
  if (cachedLimiter) {
    return cachedLimiter;
  }
  cachedLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(
      config.edgePerIp,
      `${config.windowSeconds} s`,
    ),
    prefix: "bff:rl:edge_ip",
    analytics: false,
    ephemeralCache,
  });
  return cachedLimiter;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function rateLimitResponse(
  retryAfterSeconds?: number,
  action?: RateLimitAction,
  retryAt?: string,
): NextResponse {
  const headers: Record<string, string> = {};
  const body: {
    error: string;
    action?: RateLimitAction;
    retry_at?: string;
  } = { error: "rate_limit_exceeded" };

  if (retryAt !== undefined) {
    body.retry_at = retryAt;
    const remainingMs = new Date(retryAt).getTime() - Date.now();
    if (remainingMs > 0) {
      headers["Retry-After"] = String(Math.max(1, Math.ceil(remainingMs / 1000)));
    } else if (retryAfterSeconds !== undefined) {
      headers["Retry-After"] = String(retryAfterSeconds);
    }
  } else if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
    body.retry_at = new Date(
      Date.now() + retryAfterSeconds * 1000,
    ).toISOString();
  }
  if (action !== undefined) {
    body.action = action;
  }

  return NextResponse.json(body, { status: 429, headers });
}

function warnMissingUpstashOnce(): void {
  if (warnedMissingUpstash) {
    return;
  }
  warnedMissingUpstash = true;
  console.warn(
    "[rate-limit] Upstash Redis is not configured; edge rate limiting is disabled (fail-open).",
  );
}

function warnUpstashErrorOnce(error: unknown): void {
  if (warnedUpstashError) {
    return;
  }
  warnedUpstashError = true;
  console.warn(
    "[rate-limit] Upstash edge check failed; failing open so requests reach the agent.",
    error,
  );
}

/**
 * Coarse per-IP edge shield. Returns a 429 only when Upstash successfully
 * reports the visitor exceeded RATE_LIMIT_EDGE_PER_IP. Infrastructure errors
 * (missing Redis, timeouts, account quota) always fail open.
 */
export async function enforceEdgeRateLimit(
  request: Request,
): Promise<NextResponse | null> {
  const config = getConfig();
  if (!config.enabled) {
    return null;
  }

  const redis = getRedis(config);
  if (!redis) {
    warnMissingUpstashOnce();
    return null;
  }

  try {
    const limiter = getEdgeLimiter(redis, config);
    const ip = getClientIp(request);
    const result = await limiter.limit(ip);
    if (!result.success) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1000),
      );
      return rateLimitResponse(retryAfterSeconds, "edge");
    }
    return null;
  } catch (error) {
    warnUpstashErrorOnce(error);
    return null;
  }
}
