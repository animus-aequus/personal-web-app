"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";

import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";
import { useVoiceChromeStore } from "@/lib/stores/voice-chrome-store";
import {
  publishClearUserTurn,
  publishCommitUserTurn,
  publishStopSpeech,
} from "@/lib/livekit/voice-control";
import {
  formatVoiceTurnCountdown,
  VOICE_IDLE_TIMEOUT_MS,
  VOICE_THINKING_TIMEOUT_MS,
  VOICE_TURN_MAX_MS,
  type VoiceChromeState,
} from "@/lib/livekit/voice-ptt-constants";
import {
  showVoiceEmptyTurnToast,
  showVoiceSomethingWentWrongToast,
  showVoiceThinkingTooLongToast,
} from "@/lib/livekit/voice-ptt-toasts";

type UseVoicePttOptions = {
  voiceEnabled: boolean;
  isConnected: boolean;
  room: Room | undefined;
  usedChars: number;
  onBumpTurnBoundary: () => void;
  onResetTurnBoundary: () => void;
  onExitVoice: () => void;
};

export function deriveVoiceChromeState(
  voiceEnabled: boolean,
  voiceError: boolean,
  isConnected: boolean,
  listening: boolean,
  agentPhase: "idle" | "thinking" | "responding",
  forceIdleUi: boolean,
  awaitingAgent: boolean,
  voiceReconnectPending: boolean,
): VoiceChromeState | null {
  if (!voiceEnabled) {
    return null;
  }
  if (voiceError) {
    return "error";
  }
  if (voiceReconnectPending || !isConnected) {
    return "loading";
  }
  if (listening) {
    return "speaking";
  }
  if (forceIdleUi) {
    return "idle";
  }
  if (agentPhase === "thinking") {
    return "thinking";
  }
  if (agentPhase === "responding") {
    return "answering";
  }
  // After commit/hard-cut, hold loading until the agent leaves idle so the
  // user cannot re-enter speaking in the gap before thinking/responding.
  if (awaitingAgent) {
    return "loading";
  }
  return "idle";
}

export function useVoicePtt({
  voiceEnabled,
  isConnected,
  room,
  usedChars,
  onBumpTurnBoundary,
  onResetTurnBoundary,
  onExitVoice,
}: UseVoicePttOptions) {
  const agentPhase = useAgentActivityStore((state) => state.phase);
  const setAgentPhase = useAgentActivityStore((state) => state.setPhase);
  const voiceReconnectPending = useVoiceChromeStore(
    (state) => state.voiceReconnectPending,
  );
  const voiceLanguageChangeInFlight = useVoiceChromeStore(
    (state) => state.voiceLanguageChangeInFlight,
  );
  const setVoiceReconnectPending = useVoiceChromeStore(
    (state) => state.setVoiceReconnectPending,
  );

  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const [turnRemainingMs, setTurnRemainingMs] = useState(VOICE_TURN_MAX_MS);
  const [forceIdleUi, setForceIdleUi] = useState(false);
  const [awaitingAgent, setAwaitingAgent] = useState(false);
  const [prevVoiceEnabled, setPrevVoiceEnabled] = useState(voiceEnabled);
  const [prevVoiceReconnectPending, setPrevVoiceReconnectPending] = useState(
    voiceReconnectPending,
  );

  const usedCharsRef = useRef(usedChars);
  const lastActivityCharsRef = useRef(0);
  const speakingStartedAtRef = useRef<number | null>(null);
  const thinkingLatchRef = useRef(false);
  const endingSpeakingRef = useRef(false);
  const forceIdleUiRef = useRef(false);
  const prevVoiceEnabledRef = useRef(voiceEnabled);

  useLayoutEffect(() => {
    usedCharsRef.current = usedChars;
    const activeForceIdleUi = forceIdleUi && agentPhase !== "idle";
    forceIdleUiRef.current = activeForceIdleUi;
    if (agentPhase === "idle" && !listening) {
      thinkingLatchRef.current = false;
    }
  }, [usedChars, forceIdleUi, agentPhase, listening]);

  const activeForceIdleUi = forceIdleUi && agentPhase !== "idle";

  if (forceIdleUi && agentPhase === "idle" && !listening) {
    setForceIdleUi(false);
  }

  if (
    awaitingAgent &&
    (agentPhase !== "idle" || activeForceIdleUi || !voiceEnabled)
  ) {
    setAwaitingAgent(false);
  }

  if (voiceEnabled !== prevVoiceEnabled) {
    setPrevVoiceEnabled(voiceEnabled);
    if (!voiceEnabled) {
      setListening(false);
      setVoiceError(false);
      setTurnRemainingMs(VOICE_TURN_MAX_MS);
      setForceIdleUi(false);
      setAwaitingAgent(false);
      setVoiceReconnectPending(false);
      useVoiceChromeStore.getState().setVoiceLanguageChangeInFlight(false);
    }
  }

  if (voiceReconnectPending !== prevVoiceReconnectPending) {
    setPrevVoiceReconnectPending(voiceReconnectPending);
    if (voiceReconnectPending) {
      setListening(false);
      setAwaitingAgent(false);
      setForceIdleUi(false);
    }
  }

  const voiceChromeState = deriveVoiceChromeState(
    voiceEnabled,
    voiceError,
    isConnected,
    listening,
    agentPhase,
    activeForceIdleUi,
    awaitingAgent,
    voiceReconnectPending,
  );

  const setVoiceChromeState = useVoiceChromeStore(
    (state) => state.setVoiceChromeState,
  );

  useLayoutEffect(() => {
    setVoiceChromeState(voiceChromeState);
  }, [setVoiceChromeState, voiceChromeState]);

  const setMicEnabled = useCallback(
    async (enabled: boolean) => {
      if (!room) {
        return;
      }
      try {
        await room.localParticipant.setMicrophoneEnabled(enabled);
      } catch (error) {
        console.warn("Failed to toggle microphone", error);
      }
    },
    [room],
  );

  useLayoutEffect(() => {
    if (voiceReconnectPending) {
      void setMicEnabled(false);
    }
  }, [voiceReconnectPending, setMicEnabled]);

  useEffect(() => {
    if (
      !voiceReconnectPending ||
      !isConnected ||
      voiceLanguageChangeInFlight
    ) {
      return;
    }
    setVoiceReconnectPending(false);
  }, [
    isConnected,
    voiceLanguageChangeInFlight,
    voiceReconnectPending,
    setVoiceReconnectPending,
  ]);

  useLayoutEffect(() => {
    const wasEnabled = prevVoiceEnabledRef.current;
    prevVoiceEnabledRef.current = voiceEnabled;

    if (wasEnabled && !voiceEnabled) {
      lastActivityCharsRef.current = 0;
      speakingStartedAtRef.current = null;
      thinkingLatchRef.current = false;
      endingSpeakingRef.current = false;
      void setMicEnabled(false);
      setAgentPhase("idle");
      onResetTurnBoundary();
    }
  }, [
    voiceEnabled,
    onResetTurnBoundary,
    setAgentPhase,
    setMicEnabled,
  ]);

  const resetPttState = useCallback(() => {
    setListening(false);
    setVoiceError(false);
    setTurnRemainingMs(VOICE_TURN_MAX_MS);
    setForceIdleUi(false);
    setAwaitingAgent(false);
    lastActivityCharsRef.current = 0;
    speakingStartedAtRef.current = null;
    thinkingLatchRef.current = false;
    endingSpeakingRef.current = false;
    void setMicEnabled(false);
    setAgentPhase("idle");
    onResetTurnBoundary();
  }, [onResetTurnBoundary, setAgentPhase, setMicEnabled]);

  const reportLiveKitStartError = useCallback(() => {
    setVoiceReconnectPending(false);
    useVoiceChromeStore.getState().setVoiceLanguageChangeInFlight(false);
    setVoiceError(true);
    setListening(false);
    showVoiceSomethingWentWrongToast();
  }, [setVoiceReconnectPending]);

  const beginEndSpeaking = useCallback(() => {
    if (endingSpeakingRef.current) {
      return false;
    }
    endingSpeakingRef.current = true;
    return true;
  }, []);

  const endSpeakingTurnEmpty = useCallback(() => {
    if (!beginEndSpeaking()) {
      return;
    }
    setListening(false);
    setAwaitingAgent(false);
    speakingStartedAtRef.current = null;
    lastActivityCharsRef.current = 0;
    setTurnRemainingMs(VOICE_TURN_MAX_MS);
    void setMicEnabled(false);
    onBumpTurnBoundary();
    if (room) {
      void publishClearUserTurn(room).catch((error) => {
        console.warn("clear_user_turn signal failed", error);
      });
    }
    showVoiceEmptyTurnToast();
  }, [beginEndSpeaking, onBumpTurnBoundary, room, setMicEnabled]);

  const endSpeakingTurnCommit = useCallback(() => {
    if (!beginEndSpeaking()) {
      return;
    }
    if (!room) {
      endingSpeakingRef.current = false;
      return;
    }
    setListening(false);
    setAwaitingAgent(true);
    speakingStartedAtRef.current = null;
    lastActivityCharsRef.current = 0;
    setTurnRemainingMs(VOICE_TURN_MAX_MS);
    void setMicEnabled(false);
    onBumpTurnBoundary();
    void publishCommitUserTurn(room).catch((error) => {
      console.warn("commit_user_turn signal failed", error);
    });
  }, [beginEndSpeaking, onBumpTurnBoundary, room, setMicEnabled]);

  const endSpeakingAfterHardCut = useCallback(() => {
    if (!beginEndSpeaking()) {
      return;
    }
    setListening(false);
    setAwaitingAgent(true);
    speakingStartedAtRef.current = null;
    lastActivityCharsRef.current = 0;
    setTurnRemainingMs(VOICE_TURN_MAX_MS);
    onBumpTurnBoundary();
    void setMicEnabled(false);
  }, [beginEndSpeaking, onBumpTurnBoundary, setMicEnabled]);

  const interruptSpeakingLocally = useCallback(() => {
    if (!listening && !endingSpeakingRef.current) {
      onBumpTurnBoundary();
      void setMicEnabled(false);
      return;
    }
    if (!beginEndSpeaking()) {
      onBumpTurnBoundary();
      void setMicEnabled(false);
      setListening(false);
      return;
    }
    setListening(false);
    setAwaitingAgent(false);
    speakingStartedAtRef.current = null;
    lastActivityCharsRef.current = 0;
    setTurnRemainingMs(VOICE_TURN_MAX_MS);
    onBumpTurnBoundary();
    void setMicEnabled(false);
    if (room) {
      void publishClearUserTurn(room).catch((error) => {
        console.warn("clear_user_turn signal failed", error);
      });
    }
  }, [beginEndSpeaking, listening, onBumpTurnBoundary, room, setMicEnabled]);

  const endSpeakingTurn = useCallback(() => {
    const chars = usedCharsRef.current;
    if (chars === 0) {
      endSpeakingTurnEmpty();
      return;
    }
    endSpeakingTurnCommit();
  }, [endSpeakingTurnCommit, endSpeakingTurnEmpty]);

  const startListening = useCallback(() => {
    if (
      !room ||
      voiceError ||
      !isConnected ||
      awaitingAgent ||
      voiceReconnectPending ||
      agentPhase !== "idle"
    ) {
      return;
    }
    endingSpeakingRef.current = false;
    thinkingLatchRef.current = false;
    setForceIdleUi(false);
    setAwaitingAgent(false);
    setListening(true);
    speakingStartedAtRef.current = Date.now();
    lastActivityCharsRef.current = usedCharsRef.current;
    setTurnRemainingMs(VOICE_TURN_MAX_MS);
    void setMicEnabled(true);
  }, [
    agentPhase,
    awaitingAgent,
    isConnected,
    room,
    setMicEnabled,
    voiceError,
    voiceReconnectPending,
  ]);

  const handlePrimaryClick = useCallback(() => {
    if (!voiceChromeState) {
      return;
    }
    switch (voiceChromeState) {
      case "idle":
        startListening();
        break;
      case "speaking":
        endSpeakingTurn();
        break;
      case "answering":
        if (room) {
          void publishStopSpeech(room).catch((error) => {
            console.warn("Stop speech signal failed", error);
          });
        }
        break;
      case "error":
        onExitVoice();
        break;
      default:
        break;
    }
  }, [endSpeakingTurn, onExitVoice, room, startListening, voiceChromeState]);

  useEffect(() => {
    if (!voiceEnabled || !awaitingAgent) {
      return;
    }
    // Safety: if the agent never leaves idle after commit, unlock UI.
    const timer = setTimeout(() => {
      setAwaitingAgent(false);
    }, 8_000);
    return () => clearTimeout(timer);
  }, [awaitingAgent, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled || !listening) {
      return;
    }
    if (usedChars > lastActivityCharsRef.current) {
      lastActivityCharsRef.current = usedChars;
    }
  }, [listening, usedChars, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled || !listening) {
      return;
    }

    const startedAt = speakingStartedAtRef.current ?? Date.now();
    speakingStartedAtRef.current = startedAt;
    let lastChars = lastActivityCharsRef.current;
    let lastActivityAt = Date.now();

    const interval = setInterval(() => {
      if (endingSpeakingRef.current) {
        return;
      }

      const now = Date.now();
      const elapsed = now - startedAt;
      const remaining = Math.max(0, VOICE_TURN_MAX_MS - elapsed);
      setTurnRemainingMs(remaining);

      const chars = usedCharsRef.current;
      if (chars > lastChars) {
        lastChars = chars;
        lastActivityCharsRef.current = chars;
        lastActivityAt = now;
      }

      if (remaining <= 0) {
        endSpeakingTurn();
        return;
      }

      if (now - lastActivityAt >= VOICE_IDLE_TIMEOUT_MS) {
        endSpeakingTurn();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [endSpeakingTurn, listening, voiceEnabled]);

  useEffect(() => {
    if (
      !voiceEnabled ||
      activeForceIdleUi ||
      agentPhase !== "thinking" ||
      thinkingLatchRef.current
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (forceIdleUiRef.current || thinkingLatchRef.current) {
        return;
      }
      thinkingLatchRef.current = true;
      setForceIdleUi(true);
      if (room) {
        void publishStopSpeech(room).catch((error) => {
          console.warn("Stop speech signal failed", error);
        });
      }
      showVoiceThinkingTooLongToast();
      setListening(false);
      void setMicEnabled(false);
    }, VOICE_THINKING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [activeForceIdleUi, agentPhase, room, setMicEnabled, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }
    if (agentPhase === "idle" && !listening) {
      void setMicEnabled(false);
    }
  }, [agentPhase, listening, setMicEnabled, voiceEnabled]);

  const turnCountdownLabel = formatVoiceTurnCountdown(turnRemainingMs);

  return {
    listening,
    voiceError,
    voiceChromeState,
    turnCountdownLabel,
    turnRemainingMs,
    startListening,
    endSpeakingTurn,
    endSpeakingAfterHardCut,
    interruptSpeakingLocally,
    endSpeakingTurnEmpty,
    endSpeakingTurnCommit,
    resetPttState,
    reportLiveKitStartError,
    handlePrimaryClick,
    setVoiceError,
  };
}
