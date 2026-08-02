/** Supported UI/session locales (must match agent API allowlist). */

export const LOCALE_CODES = ["en", "pl", "de", "es", "fr"] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

export const DEFAULT_LOCALE: LocaleCode = "en";

export function isLocaleCode(value: unknown): value is LocaleCode {
  return (
    typeof value === "string" &&
    (LOCALE_CODES as readonly string[]).includes(value)
  );
}

/** Normalize a BCP-47 tag or bare code; unsupported → fallback. */
export function normalizeLocale(
  value: unknown,
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (isLocaleCode(normalized)) {
    return normalized;
  }
  const base = normalized.split("-", 1)[0];
  return isLocaleCode(base) ? base : fallback;
}

/**
 * Prefer the first supported tag from ``navigator.languages``, then
 * ``navigator.language``. Used for early-path UI before session exists.
 */
export function resolveBrowserLocale(
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode {
  if (typeof navigator === "undefined") {
    return fallback;
  }
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter((tag): tag is string => typeof tag === "string" && Boolean(tag));
  for (const tag of candidates) {
    const normalized = tag.trim().toLowerCase();
    if (isLocaleCode(normalized)) {
      return normalized;
    }
    const base = normalized.split("-", 1)[0];
    if (isLocaleCode(base)) {
      return base;
    }
  }
  return fallback;
}
