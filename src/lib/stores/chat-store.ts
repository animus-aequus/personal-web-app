"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  normalizeLocale,
  resolveBrowserLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import {
  DEFAULT_VOICE_LANGUAGE,
  parseVoiceLanguage,
  type VoiceLanguageCode,
} from "@/lib/livekit/voice-languages";

export type MessageSource = "text" | "voice";

export type ChatMessagePart = {
  type: "meetings_list";
  listId: string;
  meetings: Array<{
    bookingId: string;
    eventName: string;
    slotStart: string;
    durationMinutes: number;
    meetUrl: string | null;
    htmlLink: string | null;
  }>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system-note";
  content: string;
  source: MessageSource;
  timestamp: number;
  /** Voice assistant row stopped by user barge-in (verified partial only). */
  interrupted?: boolean;
  parts?: ChatMessagePart[];
};

type ChatStore = {
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
  /**
   * UI/session locale (persisted). ``null`` until rehydrate/bootstrap resolves
   * early path (localStorage → navigator → en). After create/resume, always
   * overwritten from the server response.
   */
  language: LocaleCode | null;
  setLanguage: (language: LocaleCode) => void;
  /** STT language for LiveKit voice (persisted). */
  voiceLanguage: VoiceLanguageCode;
  setVoiceLanguage: (voiceLanguage: VoiceLanguageCode) => void;
};

/**
 * Persists `sessionId`, `language`, and `voiceLanguage`. Hydration is deferred
 * (`skipHydration`) and driven explicitly by `useChatSession` so there is a
 * single, deterministic point where the persisted id is read — no SSR
 * mismatch, no module-load race.
 *
 * Initial `language` is ``null`` (not ``en``): Zustand persist skips ``merge``
 * when storage is empty, so a DEFAULT_LOCALE initializer would permanently
 * win over ``navigator`` on first visit.
 */
export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      sessionId: null,
      setSessionId: (sessionId) => set({ sessionId }),
      language: null,
      setLanguage: (language) => set({ language: normalizeLocale(language) }),
      voiceLanguage: DEFAULT_VOICE_LANGUAGE,
      setVoiceLanguage: (voiceLanguage) =>
        set({ voiceLanguage: parseVoiceLanguage(voiceLanguage) }),
    }),
    {
      name: "personal-agent-chat",
      partialize: (state) => ({
        sessionId: state.sessionId,
        ...(state.language != null ? { language: state.language } : {}),
        voiceLanguage: state.voiceLanguage,
      }),
      merge: (persisted, current) => {
        const partial = (persisted ?? {}) as Partial<ChatStore>;
        const hasStoredLanguage =
          typeof partial.language === "string" && partial.language.length > 0;
        return {
          ...current,
          ...partial,
          language: hasStoredLanguage
            ? normalizeLocale(partial.language)
            : resolveBrowserLocale(),
          voiceLanguage: parseVoiceLanguage(
            partial.voiceLanguage,
            current.voiceLanguage,
          ),
        };
      },
      skipHydration: true,
    },
  ),
);
