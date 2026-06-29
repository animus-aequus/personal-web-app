"use client";

import { create } from "zustand";

/**
 * Normalized agent activity driving the background aura. Both the text
 * (`useChat`) and voice (`useVoiceAssistant`) flows map their own state into
 * this single phase so the aura can live at the page root behind everything.
 */
export type AuraPhase = "idle" | "thinking" | "responding";

type AgentActivityStore = {
  phase: AuraPhase;
  /**
   * Live agent audio amplitude (0..1) while speaking. High-frequency and
   * transient — read via `getState()` inside the render loop, never subscribe
   * to it in React (it would re-render on every audio frame).
   */
  audioLevel: number;
  setPhase: (phase: AuraPhase) => void;
  setAudioLevel: (audioLevel: number) => void;
};

export const useAgentActivityStore = create<AgentActivityStore>((set) => ({
  phase: "idle",
  audioLevel: 0,
  setPhase: (phase) =>
    set((state) => (state.phase === phase ? state : { phase })),
  setAudioLevel: (audioLevel) =>
    set((state) =>
      state.audioLevel === audioLevel ? state : { audioLevel },
    ),
}));
