/** httpOnly session secret cookie (E4) — never expose to browser JS. */

export const SESSION_SECRET_COOKIE = "pa_session_secret";
export const SESSION_SECRET_HEADER = "X-Session-Secret";

export function isSessionBindingEnabled(): boolean {
  const raw = process.env.SESSION_BINDING_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Max-Age in seconds from ISO expiry (clamped to >= 0). */
export function cookieMaxAgeSeconds(expiresAtIso: string): number {
  const expiresMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresMs)) {
    return 60 * 60 * 24 * 30;
  }
  return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
}

export function sessionSecretCookieOptions(expiresAtIso: string): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookieMaxAgeSeconds(expiresAtIso),
  };
}

export function missingSessionSecretResponse(): Response {
  return Response.json(
    { error: "session_auth_required" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
