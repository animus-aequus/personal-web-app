import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

import {
  abuseTierForStrikes,
  effectiveLimit,
  loadRateLimitConfig,
  type RateLimitConfig,
  type RateLimitScope,
} from "@/lib/rate-limit-config";

export type RateLimitCheckResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type RouteKind = "session" | "chat" | "messages" | "livekit";

let cachedConfig: RateLimitConfig | undefined;
let cachedRedis: Redis | undefined;
let warnedMissingUpstash = false;
const limiterCache = new Map<string, Ratelimit>();

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

function windowLabel(seconds: number): `${number} s` {
  return `${seconds} s`;
}

function getLimiter(
  redis: Redis,
  scope: RateLimitScope,
  limit: number,
  windowSeconds: number,
): Ratelimit {
  const cacheKey = `${scope}:${limit}:${windowSeconds}`;
  const existing = limiterCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, windowLabel(windowSeconds)),
    prefix: `bff:rl:${scope}`,
    analytics: false,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
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

async function getAbuseStrikes(redis: Redis, ip: string): Promise<number> {
  const value = await redis.get<number>(`bff:abuse:${ip}`);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function recordAbuseStrike(
  redis: Redis,
  ip: string,
  config: RateLimitConfig,
): Promise<void> {
  const key = `bff:abuse:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, config.abuse.strikeWindowSeconds);
  }
}

async function consumeLimit(
  redis: Redis,
  config: RateLimitConfig,
  scope: RateLimitScope,
  identifier: string,
  baseLimit: number,
  tier: ReturnType<typeof abuseTierForStrikes>,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const limit = effectiveLimit(baseLimit, tier, config);
  const limiter = getLimiter(redis, scope, limit, config.windowSeconds);
  const result = await limiter.limit(identifier);

  if (!result.success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

async function checkRouteLimits(
  route: RouteKind,
  ip: string,
  sessionId: string | undefined,
  config: RateLimitConfig,
  redis: Redis,
): Promise<RateLimitCheckResult> {
  const strikes = await getAbuseStrikes(redis, ip);
  const tier = abuseTierForStrikes(strikes, config);
  const routeConfig = config.routes[route];

  const checks: Array<{
    scope: RateLimitScope;
    identifier: string;
    baseLimit: number;
  }> = [];

  if (route === "session") {
    checks.push({
      scope: "session",
      identifier: ip,
      baseLimit: routeConfig.perSession,
    });
  } else if (!sessionId) {
    if (routeConfig.perIp !== undefined) {
      checks.push({
        scope: `${route}_ip` as RateLimitScope,
        identifier: ip,
        baseLimit: routeConfig.perIp,
      });
    }
  } else {
    checks.push({
      scope: `${route}_session` as RateLimitScope,
      identifier: `${ip}:${sessionId}`,
      baseLimit: routeConfig.perSession,
    });

    if (routeConfig.perIp !== undefined) {
      checks.push({
        scope: `${route}_ip` as RateLimitScope,
        identifier: ip,
        baseLimit: routeConfig.perIp,
      });
    }
  }

  for (const check of checks) {
    const outcome = await consumeLimit(
      redis,
      config,
      check.scope,
      check.identifier,
      check.baseLimit,
      tier,
    );
    if (!outcome.allowed) {
      await recordAbuseStrike(redis, ip, config);
      return outcome;
    }
  }

  return { allowed: true };
}

function rateLimitResponse(retryAfterSeconds?: number): NextResponse {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return NextResponse.json(
    { error: "rate_limit_exceeded" },
    { status: 429, headers },
  );
}

function warnMissingUpstashOnce(): void {
  if (warnedMissingUpstash) {
    return;
  }
  warnedMissingUpstash = true;
  console.warn(
    "[rate-limit] Upstash Redis is not configured; rate limiting is disabled for local dev.",
  );
}

/**
 * Returns a 429 response when limited, otherwise null (request may proceed).
 */
export async function enforceRateLimit(
  request: Request,
  route: RouteKind,
  sessionId?: string | null,
): Promise<NextResponse | null> {
  const config = getConfig();
  if (!config.enabled) {
    return null;
  }

  const redis = getRedis(config);
  if (!redis) {
    warnMissingUpstashOnce();
    if (config.failClosed && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "rate_limit_unavailable" },
        { status: 503 },
      );
    }
    return null;
  }

  const ip = getClientIp(request);
  const normalizedSessionId = sessionId?.trim() || undefined;
  const result = await checkRouteLimits(
    route,
    ip,
    normalizedSessionId,
    config,
    redis,
  );

  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSeconds);
  }

  return null;
}
