"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MessageSource = "text" | "voice";

export type ChatMessagePart = {
  type: "meetings_list";
  listId: string;
  meetings: Array<{
    bookingId: string;
    eventName: string;
    slotStart: string;
    durationMinutes: number;
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
};

/**
 * Persists only `sessionId`. Hydration is deferred (`skipHydration`) and driven
 * explicitly by `useChatSession` so there is a single, deterministic point where
 * the persisted id is read — no SSR mismatch, no module-load race.
 */
export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      sessionId: null,
      setSessionId: (sessionId) => set({ sessionId }),
    }),
    {
      name: "personal-agent-chat",
      partialize: (state) => ({ sessionId: state.sessionId }),
      skipHydration: true,
    },
  ),
);
