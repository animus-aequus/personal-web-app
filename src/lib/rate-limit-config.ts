export type RateLimitConfig = {
  enabled: boolean;
  /** Requests allowed per IP in the window (edge shield only). */
  edgePerIp: number;
  windowSeconds: number;
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
  return {
    enabled: readBool("RATE_LIMIT_ENABLED", upstashConfigured),
    edgePerIp: readPositiveInt("RATE_LIMIT_EDGE_PER_IP", 120),
    windowSeconds: readPositiveInt("RATE_LIMIT_WINDOW_SECONDS", 3600),
    upstash: {
      url: upstashUrl,
      token: upstashToken,
    },
  };
}
