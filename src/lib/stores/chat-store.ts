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
  messages: ChatMessage[];
  voiceMessageIds: Set<string>;
  setSessionId: (sessionId: string) => void;
  addMessage: (message: Omit<ChatMessage, "timestamp"> & { timestamp?: number }) => void;
  addVoiceMessage: (message: Omit<ChatMessage, "source" | "timestamp"> & { timestamp?: number }) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessionId: null,
      messages: [],
      voiceMessageIds: new Set<string>(),
      setSessionId: (sessionId) => set({ sessionId }),
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              timestamp: message.timestamp ?? Date.now(),
            },
          ],
        })),
      addVoiceMessage: (message) => {
        const { voiceMessageIds } = get();
        const timestamp = message.timestamp ?? Date.now();
        if (voiceMessageIds.has(message.id)) {
          // Upsert: e.g. interrupted voice turn replaces full generated text
          // with the actually-spoken transcript (same turnId-assistant id).
          set((state) => ({
            messages: state.messages.map((row) =>
              row.id === message.id
                ? {
                    ...row,
                    content: message.content,
                    timestamp,
                    interrupted: message.interrupted ?? row.interrupted,
                  }
                : row,
            ),
          }));
          return;
        }
        const nextIds = new Set(voiceMessageIds);
        nextIds.add(message.id);
        set((state) => ({
          voiceMessageIds: nextIds,
          messages: [
            ...state.messages,
            {
              ...message,
              source: "voice",
              timestamp,
            },
          ],
        }));
      },
      clearMessages: () => set({ messages: [], voiceMessageIds: new Set<string>() }),
    }),
    {
      name: "personal-agent-chat",
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages,
        voiceMessageIds: Array.from(state.voiceMessageIds),
      }),
      merge: (persisted, current) => {
        const data = persisted as Partial<{
          sessionId: string | null;
          messages: ChatMessage[];
          voiceMessageIds: string[];
        }>;
        return {
          ...current,
          ...data,
          voiceMessageIds: new Set(data.voiceMessageIds ?? []),
        };
      },
    },
  ),
);
