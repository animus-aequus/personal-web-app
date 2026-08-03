"use client";

import { toast } from "sonner";

import i18n from "@/lib/i18n/client";
import { syncDocumentLanguage } from "@/components/i18n/i18n-provider";
import { normalizeLocale, type LocaleCode } from "@/lib/i18n/locales";
import { useChatStore } from "@/lib/stores/chat-store";

export type ChangeAppLanguageOptions = {
  sessionId?: string | null;
  /** When voice is active, call after a successful language change. */
  onVoiceReconnect?: () => void;
};

export async function changeAppLanguage(
  next: LocaleCode,
  options: ChangeAppLanguageOptions = {},
): Promise<boolean> {
  const store = useChatStore.getState();
  const prev = normalizeLocale(store.language ?? i18n.language);
  const normalized = normalizeLocale(next);

  if (prev === normalized) {
    return true;
  }

  store.setLanguage(normalized);
  await i18n.changeLanguage(normalized);
  syncDocumentLanguage(normalized);

  const sessionId = options.sessionId ?? store.sessionId;
  if (!sessionId) {
    options.onVoiceReconnect?.();
    return true;
  }

  try {
    const response = await fetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, language: normalized }),
    });

    if (!response.ok) {
      throw new Error(`PATCH failed (${response.status})`);
    }

    const data = (await response.json()) as { language?: string };
    const authoritative = normalizeLocale(data.language, normalized);
    store.setLanguage(authoritative);
    if (authoritative !== i18n.language) {
      await i18n.changeLanguage(authoritative);
      syncDocumentLanguage(authoritative);
    }
    options.onVoiceReconnect?.();
    return true;
  } catch {
    store.setLanguage(prev);
    await i18n.changeLanguage(prev);
    syncDocumentLanguage(prev);
    toast.error(i18n.t("language.changeFailed"));
    return false;
  }
}
