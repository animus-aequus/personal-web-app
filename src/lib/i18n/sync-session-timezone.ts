"use client";

import { resolveBrowserTimezone } from "@/lib/i18n/timezone";
import { useChatStore } from "@/lib/stores/chat-store";

/** PATCH session timezone when the browser zone changes (e.g. after travel). */
export async function syncSessionTimezone(
  sessionId: string,
  timezone: string = resolveBrowserTimezone(),
): Promise<string | null> {
  try {
    const response = await fetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, timezone }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { timezone?: string };
    const authoritative = data.timezone?.trim() || timezone;
    useChatStore.getState().setTimezone(authoritative);
    return authoritative;
  } catch {
    return null;
  }
}
