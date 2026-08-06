import type { RateLimitAction } from "@/lib/rate-limit";
import { useRateLimitStore } from "@/lib/stores/rate-limit-store";

export class RateLimitExceededError extends Error {
  readonly action: RateLimitAction;
  readonly retryAt: string;
  readonly retryAfterSeconds: number;

  constructor(params: {
    action?: RateLimitAction;
    retryAt?: string;
    retryAfterSeconds?: number;
  }) {
    super("rate_limit_exceeded");
    this.name = "RateLimitExceededError";
    this.action = params.action ?? "chat";
    this.retryAfterSeconds = params.retryAfterSeconds ?? 60;
    this.retryAt =
      params.retryAt ??
      new Date(Date.now() + this.retryAfterSeconds * 1000).toISOString();
  }
}

type RateLimitPayload = {
  error?: string;
  action?: RateLimitAction;
  retry_at?: string;
};

function parseRetryAfterHeader(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After")?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeRateLimitPayload(
  value: unknown,
): RateLimitPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.error !== "rate_limit_exceeded") {
    return null;
  }
  const action =
    record.action === "chat" ||
    record.action === "voice" ||
    record.action === "direct_message"
      ? record.action
      : undefined;
  const retryAt =
    typeof record.retry_at === "string" ? record.retry_at : undefined;
  return { error: "rate_limit_exceeded", action, retry_at: retryAt };
}

/**
 * Parse a 429 response into a structured error (FastAPI `detail` or flat BFF body).
 */
export async function parseRateLimitFromResponse(
  response: Response,
  fallbackAction: RateLimitAction = "chat",
): Promise<RateLimitExceededError | null> {
  if (response.status !== 429) {
    return null;
  }

  const retryAfterSeconds = parseRetryAfterHeader(response) ?? 60;
  let action = fallbackAction;
  let retryAt: string | undefined;

  try {
    const body = (await response.json()) as unknown;
    const nested =
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      (body as { detail: unknown }).detail;
    const payload = normalizeRateLimitPayload(nested ?? body);
    if (payload?.action) {
      action = payload.action;
    }
    if (payload?.retry_at) {
      retryAt = payload.retry_at;
    }
  } catch {
    // Fall back to Retry-After header only.
  }

  return new RateLimitExceededError({
    action,
    retryAt,
    retryAfterSeconds,
  });
}

export function showRateLimitDialog(params: {
  action: RateLimitAction;
  retryAt: string;
}): void {
  useRateLimitStore.getState().show(params);
}

export async function handleRateLimitResponse(
  response: Response,
  fallbackAction: RateLimitAction = "chat",
): Promise<boolean> {
  const error = await parseRateLimitFromResponse(response, fallbackAction);
  if (!error) {
    return false;
  }
  showRateLimitDialog({
    action: error.action,
    retryAt: error.retryAt,
  });
  return true;
}
