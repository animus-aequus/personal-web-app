/** Default when the browser cannot resolve an IANA timezone. */
export const DEFAULT_TIMEZONE = "Europe/Warsaw";

/** Resolve the visitor's IANA timezone from the browser. */
export function resolveBrowserTimezone(): string {
  if (typeof Intl === "undefined") {
    return DEFAULT_TIMEZONE;
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    return tz || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
