"use client";

import { create } from "zustand";

type VoiceReconnectStore = {
  reconnect: (() => void) | null;
  setReconnect: (reconnect: (() => void) | null) => void;
  trigger: () => void;
};

export const useVoiceReconnectStore = create<VoiceReconnectStore>((set, get) => ({
  reconnect: null,
  setReconnect: (reconnect) => set({ reconnect }),
  trigger: () => {
    get().reconnect?.();
  },
}));
