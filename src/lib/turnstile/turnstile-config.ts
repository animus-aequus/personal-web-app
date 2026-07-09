export const TURNSTILE_TOKEN_FIELD = "turnstileToken";
export const TURNSTILE_ERROR_CODE = "turnstile_failed";

export type TurnstileConfig = {
  enabled: boolean;
  secretKey: string | undefined;
  siteKey: string | undefined;
  failClosed: boolean;
};

let cachedConfig: TurnstileConfig | undefined;

export function loadTurnstileConfig(): TurnstileConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim() || undefined;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
  const explicitlyDisabled = process.env.TURNSTILE_DISABLED === "true";
  const isProduction = process.env.NODE_ENV === "production";
  const failClosed =
    process.env.TURNSTILE_FAIL_CLOSED === "true" ||
    (isProduction && !explicitlyDisabled);

  const enabled =
    !explicitlyDisabled && Boolean(secretKey && siteKey);

  cachedConfig = {
    enabled,
    secretKey,
    siteKey,
    failClosed,
  };
  return cachedConfig;
}

export function isTurnstileClientEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}
