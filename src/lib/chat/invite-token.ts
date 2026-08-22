import type { SessionType } from "@/lib/public-access-config";

/** Survives Strict Mode remount / bootstrap restart after URL strip. */
const PENDING_INVITE_STORAGE_KEY = "pending_invite_token";

export function readInviteTokenFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get("invite");
  const trimmed = raw?.trim();
  return trimmed || null;
}

function stripInviteFromUrl(): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has("invite")) {
    return;
  }
  url.searchParams.delete("invite");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

function readHeldInviteToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const held = sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)?.trim();
    return held || null;
  } catch {
    return null;
  }
}

function holdInviteToken(token: string): void {
  try {
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
  } catch {
    // Private mode / quota — URL strip still applies; token stays in memory.
  }
}

export function clearHeldInviteToken(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Peek invite from URL or sessionStorage without stripping ``?invite=``. */
export function peekInviteToken(): string | null {
  return readInviteTokenFromUrl() ?? readHeldInviteToken();
}

/**
 * Take invite from URL (preferred) or sessionStorage hold.
 * Strips ``?invite=`` immediately to reduce Referer leakage.
 */
export function takeInviteToken(): string | null {
  const fromUrl = readInviteTokenFromUrl();
  if (fromUrl) {
    holdInviteToken(fromUrl);
    stripInviteFromUrl();
    return fromUrl;
  }
  return readHeldInviteToken();
}

export function resolvePauseGateType(
  inviteToken: string | null,
  persistedType: SessionType | null,
  persistedId: string | null,
): SessionType {
  if (inviteToken) {
    return "invited";
  }
  if (persistedType === "invited" && persistedId) {
    return "invited";
  }
  return "public";
}
