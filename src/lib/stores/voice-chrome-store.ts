"use client";

import { create } from "zustand";

import type { VoiceChromeState } from "@/lib/livekit/voice-ptt-constants";

type VoiceChromeStore = {
  voiceChromeState: VoiceChromeState | null;
  setVoiceChromeState: (state: VoiceChromeState | null) => void;
  voiceReconnectPending: boolean;
  setVoiceReconnectPending: (pending: boolean) => void;
  voiceLanguageChangeInFlight: boolean;
  setVoiceLanguageChangeInFlight: (inFlight: boolean) => void;
  /** Clear ephemeral voice UI locks (e.g. leaving `/chat`). */
  reset: () => void;
};

export const useVoiceChromeStore = create<VoiceChromeStore>((set) => ({
  voiceChromeState: null,
  setVoiceChromeState: (voiceChromeState) =>
    set((state) =>
      state.voiceChromeState === voiceChromeState
        ? state
        : { voiceChromeState },
    ),
  voiceReconnectPending: false,
  setVoiceReconnectPending: (voiceReconnectPending) =>
    set((state) =>
      state.voiceReconnectPending === voiceReconnectPending
        ? state
        : { voiceReconnectPending },
    ),
  voiceLanguageChangeInFlight: false,
  setVoiceLanguageChangeInFlight: (voiceLanguageChangeInFlight) =>
    set((state) =>
      state.voiceLanguageChangeInFlight === voiceLanguageChangeInFlight
        ? state
        : { voiceLanguageChangeInFlight },
    ),
  reset: () =>
    set((state) =>
      state.voiceChromeState === null &&
      !state.voiceReconnectPending &&
      !state.voiceLanguageChangeInFlight
        ? state
        : {
            voiceChromeState: null,
            voiceReconnectPending: false,
            voiceLanguageChangeInFlight: false,
          },
    ),
}));
