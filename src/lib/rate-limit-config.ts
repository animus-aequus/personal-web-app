export type RateLimitScope =
  | "session"
  | "chat_session"
  | "chat_ip"
  | "messages_session"
  | "messages_ip"
  | "livekit_session"
  | "livekit_ip";

export type AbuseTier = "normal" | "moderate" | "strict";

export type RateLimitRouteConfig = {
  /** Per-session (or single IP for session create) limit at normal tier. */
  perSession: number;
  /** Aggregate per-IP limit; omitted when route is IP-only. */
  perIp?: number;
};

export type RateLimitConfig = {
  enabled: boolean;
  failClosed: boolean;
  windowSeconds: number;
  routes: Record<
    "session" | "chat" | "messages" | "livekit",
    RateLimitRouteConfig
  >;
  abuse: {
    strikeWindowSeconds: number;
    strikesModerate: number;
    strikesStrict: number;
    moderateFactor: number;
    strictFactor: number;
  };
  upstash: {
    url: string | undefined;
    token: string | undefined;
  };
};

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readFactor(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const upstashConfigured = Boolean(upstashUrl && upstashToken);

export function loadRateLimitConfig(): RateLimitConfig {
  const windowSeconds = readPositiveInt("RATE_LIMIT_WINDOW_SECONDS", 3600);

  return {
    enabled: readBool("RATE_LIMIT_ENABLED", upstashConfigured),
    failClosed: readBool("RATE_LIMIT_FAIL_CLOSED", process.env.NODE_ENV === "production"),
    windowSeconds,
    routes: {
      session: {
        perSession: readPositiveInt("RATE_LIMIT_SESSION_PER_IP", 10),
      },
      chat: {
        perSession: readPositiveInt("RATE_LIMIT_CHAT_PER_SESSION", 60),
        perIp: readPositiveInt("RATE_LIMIT_CHAT_PER_IP", 120),
      },
      messages: {
        perSession: readPositiveInt("RATE_LIMIT_MESSAGES_PER_SESSION", 120),
        perIp: readPositiveInt("RATE_LIMIT_MESSAGES_PER_IP", 240),
      },
      livekit: {
        perSession: readPositiveInt("RATE_LIMIT_LIVEKIT_PER_SESSION", 20),
        perIp: readPositiveInt("RATE_LIMIT_LIVEKIT_PER_IP", 40),
      },
    },
    abuse: {
      strikeWindowSeconds: readPositiveInt(
        "RATE_LIMIT_ABUSE_STRIKE_WINDOW_SECONDS",
        86_400,
      ),
      strikesModerate: readPositiveInt("RATE_LIMIT_ABUSE_STRIKES_MODERATE", 2),
      strikesStrict: readPositiveInt("RATE_LIMIT_ABUSE_STRIKES_STRICT", 5),
      moderateFactor: readFactor("RATE_LIMIT_ABUSE_MODERATE_FACTOR", 0.5),
      strictFactor: readFactor("RATE_LIMIT_ABUSE_STRICT_FACTOR", 0.25),
    },
    upstash: {
      url: upstashUrl,
      token: upstashToken,
    },
  };
}

export function abuseTierForStrikes(
  strikes: number,
  config: RateLimitConfig,
): AbuseTier {
  if (strikes >= config.abuse.strikesStrict) {
    return "strict";
  }
  if (strikes >= config.abuse.strikesModerate) {
    return "moderate";
  }
  return "normal";
}

export function effectiveLimit(
  baseLimit: number,
  tier: AbuseTier,
  config: RateLimitConfig,
): number {
  const factor =
    tier === "strict"
      ? config.abuse.strictFactor
      : tier === "moderate"
        ? config.abuse.moderateFactor
        : 1;
  return Math.max(1, Math.floor(baseLimit * factor));
}
