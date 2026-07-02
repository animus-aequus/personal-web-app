"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MessageSource = "text" | "voice";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: MessageSource;
  timestamp: number;
  /** Voice assistant row stopped by user barge-in (verified partial only). */
  interrupted?: boolean;
};

type ChatStore = {
  sessionId: string | null;
  hasHydrated: boolean;
  setSessionId: (sessionId: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      sessionId: null,
      hasHydrated: false,
      setSessionId: (sessionId) => set({ sessionId }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "personal-agent-chat",
      partialize: (state) => ({
        sessionId: state.sessionId,
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<{ sessionId: string | null }>;
        return {
          ...current,
          sessionId: data.sessionId ?? null,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
