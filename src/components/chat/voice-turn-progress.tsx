"use client";

import { Clock, Mic } from "lucide-react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";

import { publishUserTurnLengthExceeded } from "@/lib/livekit/voice-control";
import { useVoiceTurnCharUsage } from "@/lib/livekit/use-voice-turn-char-usage";
import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";
import { useRateLimitStore } from "@/lib/stores/rate-limit-store";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;
const WAVE_INTERVAL_MS = 1500;
const RESET_MS = 450;
const MIC_UNMUTE_FALLBACK_MS = 5000;

type VoiceTurnProgressProps = {
  room: Room | undefined;
  voiceEnabled: boolean;
  /** Bumped when a `voice_user` row is committed via `chat_sync`. */
  turnCommitSignal: number;
  /** Match voice chrome (mic + radial) width. */
  barMaxWidth?: number;
};

function tierForPercent(percent: number): "primary" | "amber" | "destructive" {
  if (percent >= 90) {
    return "destructive";
  }
  if (percent >= 70) {
    return "amber";
  }
  return "primary";
}

export function VoiceTurnProgress({
  room,
  voiceEnabled,
  turnCommitSignal,
  barMaxWidth,
}: VoiceTurnProgressProps) {
  const { ratio, isAtLimit, isSpeaking } = useVoiceTurnCharUsage(
    room,
    turnCommitSignal,
  );
  const agentPhase = useAgentActivityStore((state) => state.phase);
  const agentBusy = agentPhase === "thinking" || agentPhase === "responding";
  const rateLimitOpen = useRateLimitStore((state) => state.open);
  const rateLimitAction = useRateLimitStore((state) => state.action);

  const hardCutArmedRef = useRef(false);
  const micMutedForLimitRef = useRef(false);
  const awaitingUnmuteAfterCutRef = useRef(false);
  const sawAgentBusyAfterCutRef = useRef(false);
  const [waveKey, setWaveKey] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [seenCommitSignal, setSeenCommitSignal] = useState(turnCommitSignal);

  const targetRatio = useMotionValue(ratio);
  const springRatio = useSpring(targetRatio, {
    stiffness: 120,
    damping: 22,
    mass: 0.35,
  });
  const fillWidth = useTransform(springRatio, (value) => `${value * 100}%`);
  const [displayPercentText, setDisplayPercentText] = useState(0);

  useMotionValueEvent(springRatio, "change", (value) => {
    setDisplayPercentText(Math.round(value * 100));
  });

  const releaseMic = useCallback((targetRoom: Room) => {
    if (!micMutedForLimitRef.current) {
      return;
    }
    micMutedForLimitRef.current = false;
    awaitingUnmuteAfterCutRef.current = false;
    sawAgentBusyAfterCutRef.current = false;
    void targetRoom.localParticipant.setMicrophoneEnabled(true).catch((error) => {
      console.warn("Failed to re-enable mic after voice turn limit", error);
    });
  }, []);

  // Reset animation flag from props (avoid sync setState inside effects).
  if (!voiceEnabled) {
    if (isResetting) {
      setIsResetting(false);
    }
    if (seenCommitSignal !== 0) {
      setSeenCommitSignal(0);
    }
  } else if (turnCommitSignal !== 0 && turnCommitSignal !== seenCommitSignal) {
    setSeenCommitSignal(turnCommitSignal);
    setIsResetting(true);
  }

  // Only re-arm hard-cut after the meter has left the limit (post-commit stale).
  // Clearing the latch on commit alone re-fires mute + commit_user_turn while
  // isAtLimit is still true for one frame — that deadlocks the mic and can
  // interrupt the graph mid-turn.
  useEffect(() => {
    if (!isAtLimit) {
      hardCutArmedRef.current = false;
    }
  }, [isAtLimit]);

  useLayoutEffect(() => {
    if (!isResetting) {
      targetRatio.set(ratio);
    }
  }, [ratio, targetRatio, isResetting]);

  // First wave remounts when showWave becomes true; interval only restarts later.
  useEffect(() => {
    if (!voiceEnabled || !isSpeaking || agentBusy) {
      return;
    }
    const timer = setInterval(() => {
      setWaveKey((key) => key + 1);
    }, WAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [voiceEnabled, isSpeaking, agentBusy]);

  useEffect(() => {
    if (voiceEnabled) {
      return;
    }
    hardCutArmedRef.current = false;
    micMutedForLimitRef.current = false;
    awaitingUnmuteAfterCutRef.current = false;
    sawAgentBusyAfterCutRef.current = false;
    targetRatio.set(0);
  }, [voiceEnabled, targetRatio]);

  useEffect(() => {
    if (!isResetting) {
      return;
    }
    targetRatio.set(0);
    const timer = setTimeout(() => {
      setIsResetting(false);
    }, RESET_MS);
    return () => clearTimeout(timer);
  }, [isResetting, turnCommitSignal, targetRatio]);

  useEffect(() => {
    if (!voiceEnabled || !room || !isAtLimit || hardCutArmedRef.current) {
      return;
    }
    hardCutArmedRef.current = true;
    micMutedForLimitRef.current = true;
    awaitingUnmuteAfterCutRef.current = true;
    sawAgentBusyAfterCutRef.current = false;
    void room.localParticipant.setMicrophoneEnabled(false).catch((error) => {
      console.warn("Failed to mute mic at voice turn limit", error);
    });
    void publishUserTurnLengthExceeded(room).catch((error) => {
      console.warn("user_turn_length_exceeded signal failed", error);
    });
  }, [voiceEnabled, room, isAtLimit]);

  useEffect(() => {
    if (!voiceEnabled || !room || !micMutedForLimitRef.current) {
      return;
    }
    if (!awaitingUnmuteAfterCutRef.current) {
      return;
    }
    if (agentBusy) {
      sawAgentBusyAfterCutRef.current = true;
      return;
    }
    if (sawAgentBusyAfterCutRef.current) {
      releaseMic(room);
    }
  }, [voiceEnabled, room, agentBusy, releaseMic]);

  // Fallback unmute when the worker never enters thinking/responding.
  useEffect(() => {
    if (!voiceEnabled || !room || !micMutedForLimitRef.current) {
      return;
    }
    if (!awaitingUnmuteAfterCutRef.current) {
      return;
    }
    if (agentBusy || sawAgentBusyAfterCutRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      if (
        micMutedForLimitRef.current &&
        awaitingUnmuteAfterCutRef.current &&
        !sawAgentBusyAfterCutRef.current
      ) {
        releaseMic(room);
      }
    }, MIC_UNMUTE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [turnCommitSignal, voiceEnabled, room, releaseMic, agentBusy]);

  useEffect(() => {
    if (!voiceEnabled || !room || !micMutedForLimitRef.current) {
      return;
    }
    if (rateLimitOpen && rateLimitAction === "voice") {
      releaseMic(room);
    }
  }, [voiceEnabled, room, rateLimitOpen, rateLimitAction, releaseMic]);

  if (!voiceEnabled) {
    return null;
  }

  const tier = tierForPercent(displayPercentText);
  const showWave = isSpeaking && !agentBusy && !isResetting;

  return (
    <div
      className="mb-3 flex items-center gap-1 self-center"
      style={
        barMaxWidth !== undefined
          ? { width: barMaxWidth, maxWidth: "100%" }
          : { width: "100%" }
      }
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={displayPercentText}
      aria-valuetext={`${displayPercentText}% of voice turn limit`}
      aria-label="Voice turn length"
    >
      <div
        className={cn(
          "relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full",
          tier === "primary" && "bg-primary/15",
          tier === "amber" && "bg-amber-500/15",
          tier === "destructive" && "bg-destructive/15",
        )}
      >
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            tier === "primary" && "bg-primary",
            tier === "amber" && "bg-amber-500",
            tier === "destructive" && "bg-destructive",
          )}
          style={{ width: fillWidth }}
        />
        {showWave ? (
          <motion.div
            key={waveKey}
            className={cn(
              "pointer-events-none absolute inset-0 rounded-full",
              tier === "primary" &&
                "bg-gradient-to-r from-transparent via-primary/50 to-transparent",
              tier === "amber" &&
                "bg-gradient-to-r from-transparent via-amber-400/55 to-transparent",
              tier === "destructive" &&
                "bg-gradient-to-r from-transparent via-destructive/50 to-transparent",
            )}
            initial={{ x: "-100%", opacity: 0.85 }}
            animate={{ x: "100%", opacity: 0 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
        ) : null}
      </div>
      <span
        className={cn(
          "w-9 shrink-0 text-right text-xs font-medium tabular-nums",
          tier === "primary" && "text-primary",
          tier === "amber" && "text-amber-600 dark:text-amber-400",
          tier === "destructive" && "text-destructive",
        )}
      >
        {displayPercentText}%
      </span>
    </div>
  );
}

/** Amber badge for length-truncated user voice rows (Mic + Clock). */
export function VoiceTurnTruncatedBadge({
  title,
}: {
  title: string;
}) {
  return (
    <span
      className="absolute -right-2.5 -top-2.5 flex items-center gap-0.5 bg-background p-0.5 text-amber-600/55 dark:text-amber-500/50"
      title={title}
      aria-label={title}
    >
      <span className="flex size-3.5 items-center justify-center rounded-full border border-current">
        <Mic className="size-2" aria-hidden />
      </span>
      <span className="flex size-3.5 items-center justify-center rounded-full border border-current">
        <Clock className="size-2" aria-hidden />
      </span>
    </span>
  );
}
