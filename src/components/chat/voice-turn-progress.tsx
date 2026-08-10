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
import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";
import { useRateLimitStore } from "@/lib/stores/rate-limit-store";
import { cn } from "@/lib/utils";

const EASE = [0.4, 0, 0.2, 1] as const;
const WAVE_INTERVAL_MS = 1500;
const RESET_MS = 450;

type VoiceTurnProgressProps = {
  room: Room | undefined;
  voiceEnabled: boolean;
  listening: boolean;
  ratio: number;
  isAtLimit: boolean;
  isSpeaking: boolean;
  /** Bumped on turn commit or empty discard — drives meter reset animation. */
  turnBoundarySignal: number;
  barMaxWidth?: number;
  countdownLabel: string;
  onHardCut: () => void;
  onSpeakingInterrupt?: () => void;
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
  listening,
  ratio,
  isAtLimit,
  isSpeaking,
  turnBoundarySignal,
  barMaxWidth,
  countdownLabel,
  onHardCut,
  onSpeakingInterrupt,
}: VoiceTurnProgressProps) {
  const agentPhase = useAgentActivityStore((state) => state.phase);
  const agentBusy = agentPhase === "thinking" || agentPhase === "responding";
  const rateLimitOpen = useRateLimitStore((state) => state.open);
  const rateLimitAction = useRateLimitStore((state) => state.action);

  const hardCutArmedRef = useRef(false);
  const [waveKey, setWaveKey] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [seenBoundarySignal, setSeenBoundarySignal] = useState(turnBoundarySignal);

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

  const handleHardCut = useCallback(() => {
    if (!room) {
      return;
    }
    void room.localParticipant.setMicrophoneEnabled(false).catch((error) => {
      console.warn("Failed to mute mic at voice turn limit", error);
    });
    void publishUserTurnLengthExceeded(room).catch((error) => {
      console.warn("user_turn_length_exceeded signal failed", error);
    });
    onHardCut();
  }, [onHardCut, room]);

  if (!voiceEnabled) {
    if (isResetting) {
      setIsResetting(false);
    }
    if (seenBoundarySignal !== 0) {
      setSeenBoundarySignal(0);
    }
  } else if (
    turnBoundarySignal !== 0 &&
    turnBoundarySignal !== seenBoundarySignal
  ) {
    setSeenBoundarySignal(turnBoundarySignal);
    setIsResetting(true);
  }

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

  useEffect(() => {
    if (!voiceEnabled || !listening || !isSpeaking || agentBusy) {
      return;
    }
    const timer = setInterval(() => {
      setWaveKey((key) => key + 1);
    }, WAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [voiceEnabled, listening, isSpeaking, agentBusy]);

  useEffect(() => {
    if (voiceEnabled) {
      return;
    }
    hardCutArmedRef.current = false;
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
  }, [isResetting, turnBoundarySignal, targetRatio]);

  useEffect(() => {
    if (!voiceEnabled || !listening || !room || !isAtLimit || hardCutArmedRef.current) {
      return;
    }
    hardCutArmedRef.current = true;
    handleHardCut();
  }, [voiceEnabled, listening, room, isAtLimit, handleHardCut]);

  useEffect(() => {
    if (!voiceEnabled || !listening || !room) {
      return;
    }
    if (rateLimitOpen && rateLimitAction === "voice") {
      onSpeakingInterrupt?.();
    }
  }, [
    voiceEnabled,
    listening,
    room,
    rateLimitOpen,
    rateLimitAction,
    onSpeakingInterrupt,
  ]);

  if (!voiceEnabled || !listening) {
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
      <span className="w-9 shrink-0 text-left text-xs font-medium tabular-nums text-white">
        {countdownLabel}
      </span>
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
