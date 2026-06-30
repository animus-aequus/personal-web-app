"use client";

import {
  useTrackVolume,
  useVoiceAssistant,
  type TrackReference,
} from "@livekit/components-react";
import { useEffect } from "react";

import {
  type AuraPhase,
  useAgentActivityStore,
} from "@/lib/stores/agent-activity-store";

/**
 * Maps the LiveKit voice agent state (and live TTS amplitude) into the shared
 * aura phase while voice mode is active. Must render inside `SessionProvider`.
 * When inactive it yields control of the phase to the text-chat bridge.
 */
export function VoiceAuraBridge({ active }: { active: boolean }) {
  const { state, audioTrack } = useVoiceAssistant();
  const volume = useTrackVolume(
    audioTrack as TrackReference,
    audioTrack ? { fftSize: 256, smoothingTimeConstant: 0.6 } : undefined,
  );
  const setPhase = useAgentActivityStore((store) => store.setPhase);
  const setAudioLevel = useAgentActivityStore((store) => store.setAudioLevel);

  useEffect(() => {
    if (!active) {
      return;
    }
    let phase: AuraPhase = "idle";
    if (state === "speaking") {
      phase = "responding";
    } else if (
      state === "thinking" ||
      state === "connecting" ||
      state === "initializing"
    ) {
      phase = "thinking";
    }
    setPhase(phase);
  }, [active, state, setPhase]);

  useEffect(() => {
    if (!active) {
      setAudioLevel(0);
      return;
    }
    setAudioLevel(state === "speaking" ? Math.min(volume, 1) : 0);
  }, [active, state, volume, setAudioLevel]);

  return null;
}
