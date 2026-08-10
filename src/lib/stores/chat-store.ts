"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  normalizeLocale,
  resolveBrowserLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import type { SessionType } from "@/lib/public-access-config";

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
  /** Assistant barge-in partial or user voice turn cut for length. */
  interrupted?: boolean;
  parts?: ChatMessagePart[];
  /** System-note i18n kind (from agent API). */
  kind?: string;
  /** Interpolation params for system-note i18n. */
  params?: Record<string, string>;
};

type ChatStore = {
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
  sessionType: SessionType | null;
  setSessionType: (sessionType: SessionType | null) => void;
  /**
   * UI/session locale (persisted). ``null`` until rehydrate/bootstrap resolves
   * early path (localStorage → navigator → en). After create/resume, always
   * overwritten from the server response.
   */
  language: LocaleCode | null;
  setLanguage: (language: LocaleCode) => void;
};

/**
 * Persists `sessionId`, `sessionType`, and `language`. Hydration is deferred
 * (`skipHydration`) and driven explicitly by `useChatSession`.
 */
export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      sessionId: null,
      setSessionId: (sessionId) => set({ sessionId }),
      sessionType: null,
      setSessionType: (sessionType) => set({ sessionType }),
      language: null,
      setLanguage: (language) => set({ language: normalizeLocale(language) }),
    }),
    {
      name: "personal-agent-chat",
      partialize: (state) => ({
        sessionId: state.sessionId,
        ...(state.sessionType != null ? { sessionType: state.sessionType } : {}),
        ...(state.language != null ? { language: state.language } : {}),
      }),
      merge: (persisted, current) => {
        const partial = (persisted ?? {}) as Partial<ChatStore>;
        const hasStoredLanguage =
          typeof partial.language === "string" && partial.language.length > 0;
        const sessionType =
          partial.sessionType === "invited" || partial.sessionType === "public"
            ? partial.sessionType
            : null;
        return {
          ...current,
          ...partial,
          sessionType,
          language: hasStoredLanguage
            ? normalizeLocale(partial.language)
            : resolveBrowserLocale(),
        };
      },
      skipHydration: true,
    },
  ),
);
