"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { joinTokens, pullCompletedTokens } from "@/lib/chat/tokenize-text";

export type SmoothRevealPhase = "revealing" | "crossfading" | "done";

type UseSmoothTextRevealOptions = {
  /** Growing source text from the stream. */
  targetText: string;
  /** True while the assistant reply is still streaming. */
  isStreaming: boolean;
  /** Reset when the message identity changes. */
  messageId: string;
  /** Prefer instant reveal (no per-word pacing). */
  reducedMotion?: boolean;
};

type UseSmoothTextRevealResult = {
  revealedTokens: string[];
  revealedText: string;
  phase: SmoothRevealPhase;
  /** Absolute indices of tokens that should play the enter animation. */
  animatingFromIndex: number;
};

const CROSSFADE_MS = 280;

function pacingForQueue(
  queueLength: number,
  flushing: boolean,
): { intervalMs: number; batchSize: number } {
  if (flushing) {
    if (queueLength > 24) {
      return { intervalMs: 8, batchSize: 6 };
    }
    if (queueLength > 12) {
      return { intervalMs: 12, batchSize: 4 };
    }
    if (queueLength > 4) {
      return { intervalMs: 16, batchSize: 2 };
    }
    return { intervalMs: 20, batchSize: 1 };
  }

  if (queueLength > 24) {
    return { intervalMs: 12, batchSize: 4 };
  }
  if (queueLength > 12) {
    return { intervalMs: 18, batchSize: 2 };
  }
  if (queueLength > 8) {
    return { intervalMs: 25, batchSize: 1 };
  }
  return { intervalMs: 45, batchSize: 1 };
}

/**
 * Idempotent sync: derive completed tokens from the full target and enqueue
 * only tokens not already revealed or queued.
 */
function syncQueueFromTarget(args: {
  targetText: string;
  isStreaming: boolean;
  queueRef: RefObject<string[]>;
  remainderRef: RefObject<string>;
  revealedCountRef: RefObject<number>;
}): string[] {
  const {
    targetText,
    isStreaming,
    queueRef,
    remainderRef,
    revealedCountRef,
  } = args;

  const { tokens, remainder } = pullCompletedTokens(targetText, !isStreaming);
  remainderRef.current = remainder;

  const alreadyHandled = revealedCountRef.current + queueRef.current.length;
  if (tokens.length > alreadyHandled) {
    queueRef.current.push(...tokens.slice(alreadyHandled));
  } else if (tokens.length < alreadyHandled) {
    // Target shrank / replaced — rebuild queue from the new token list.
    queueRef.current = tokens.slice(revealedCountRef.current);
  }

  return queueRef.current;
}

export function useSmoothTextReveal({
  targetText,
  isStreaming,
  messageId,
  reducedMotion = false,
}: UseSmoothTextRevealOptions): UseSmoothTextRevealResult {
  const [revealedTokens, setRevealedTokens] = useState<string[]>([]);
  const [phase, setPhase] = useState<SmoothRevealPhase>("revealing");
  const [animatingFromIndex, setAnimatingFromIndex] = useState(0);
  const [activeMessageId, setActiveMessageId] = useState(messageId);

  const queueRef = useRef<string[]>([]);
  const remainderRef = useRef("");
  const phaseRef = useRef<SmoothRevealPhase>("revealing");
  const revealedCountRef = useRef(0);
  const targetTextRef = useRef(targetText);
  const isStreamingRef = useRef(isStreaming);
  const reducedMotionRef = useRef(reducedMotion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust state during render when the message identity changes (React-recommended).
  if (messageId !== activeMessageId) {
    setActiveMessageId(messageId);
    setRevealedTokens([]);
    setAnimatingFromIndex(0);
    setPhase("revealing");
  }

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearCrossfadeTimer = () => {
    if (crossfadeTimerRef.current !== null) {
      clearTimeout(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
  };

  // Keep timer-loop inputs fresh without writing refs during render.
  useEffect(() => {
    targetTextRef.current = targetText;
    isStreamingRef.current = isStreaming;
    reducedMotionRef.current = reducedMotion;
  }, [targetText, isStreaming, reducedMotion]);

  // Reset mutable reveal buffers and run the adaptive reveal loop for this message.
  useEffect(() => {
    clearTimer();
    clearCrossfadeTimer();
    queueRef.current = [];
    remainderRef.current = "";
    revealedCountRef.current = 0;
    phaseRef.current = "revealing";

    const appendRevealed = (tokens: string[], fromIndex: number) => {
      setAnimatingFromIndex(fromIndex);
      setRevealedTokens((prev) => [...prev, ...tokens]);
    };

    const setPhaseBoth = (next: SmoothRevealPhase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    syncQueueFromTarget({
      targetText: targetTextRef.current,
      isStreaming: isStreamingRef.current,
      queueRef,
      remainderRef,
      revealedCountRef,
    });

    if (reducedMotionRef.current && queueRef.current.length > 0) {
      const drained = queueRef.current.splice(0, queueRef.current.length);
      const from = revealedCountRef.current;
      revealedCountRef.current += drained.length;
      appendRevealed(drained, from);
    }

    const schedule = (delayMs: number) => {
      clearTimer();
      timerRef.current = setTimeout(tick, delayMs);
    };

    const beginCrossfade = () => {
      if (phaseRef.current !== "revealing") {
        return;
      }
      setPhaseBoth("crossfading");
      clearCrossfadeTimer();
      const fadeMs = reducedMotionRef.current ? 0 : CROSSFADE_MS;
      crossfadeTimerRef.current = setTimeout(() => {
        setPhaseBoth("done");
        crossfadeTimerRef.current = null;
      }, fadeMs);
    };

    const tick = () => {
      if (phaseRef.current !== "revealing") {
        return;
      }

      syncQueueFromTarget({
        targetText: targetTextRef.current,
        isStreaming: isStreamingRef.current,
        queueRef,
        remainderRef,
        revealedCountRef,
      });

      if (reducedMotionRef.current && queueRef.current.length > 0) {
        const drained = queueRef.current.splice(0, queueRef.current.length);
        const from = revealedCountRef.current;
        revealedCountRef.current += drained.length;
        appendRevealed(drained, from);
      }

      const flushing = !isStreamingRef.current;
      const queue = queueRef.current;

      if (queue.length > 0) {
        const { intervalMs, batchSize } = reducedMotionRef.current
          ? { intervalMs: 0, batchSize: queue.length }
          : pacingForQueue(queue.length, flushing);
        const batch = queue.splice(0, batchSize);
        const from = revealedCountRef.current;
        revealedCountRef.current += batch.length;
        appendRevealed(batch, from);
        schedule(Math.max(intervalMs, 0));
        return;
      }

      if (flushing && remainderRef.current.length === 0) {
        beginCrossfade();
        return;
      }

      schedule(flushing ? 16 : 45);
    };

    schedule(0);

    return () => {
      clearTimer();
      clearCrossfadeTimer();
    };
  }, [messageId]);

  // Enqueue newly completed tokens when the stream grows or ends.
  useEffect(() => {
    if (phaseRef.current !== "revealing") {
      return;
    }

    syncQueueFromTarget({
      targetText,
      isStreaming,
      queueRef,
      remainderRef,
      revealedCountRef,
    });
  }, [targetText, isStreaming]);

  return {
    revealedTokens,
    revealedText: joinTokens(revealedTokens),
    phase,
    animatingFromIndex,
  };
}

export const SMOOTH_REVEAL_CROSSFADE_MS = CROSSFADE_MS;
