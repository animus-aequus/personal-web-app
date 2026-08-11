"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { MessageContent } from "@/components/chat/message-content";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  SMOOTH_REVEAL_CROSSFADE_MS,
  useSmoothTextReveal,
} from "@/hooks/use-smooth-text-reveal";
import { pickAuraTokenColor } from "@/lib/visualizer/aura-palette";

const WAVE_EASE = [0.4, 0, 0.2, 1] as const;
const WAVE_INTERVAL_MS = 1500;

type SmoothStreamingTextProps = {
  messageId: string;
  content: string;
  isStreaming: boolean;
  /** Fired once after plain → markdown crossfade completes. */
  onSettled?: () => void;
};

/** Short primary shimmer at the caret — same language as voice turn progress. */
function StreamAwaitWave({ reducedMotion }: { reducedMotion: boolean }) {
  const [waveKey, setWaveKey] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const timer = setInterval(() => {
      setWaveKey((key) => key + 1);
    }, WAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  return (
    <span
      className="relative ml-0.5 inline-block h-[0.85em] w-12 max-w-[40%] overflow-hidden align-[-0.05em] rounded-r-sm"
      aria-hidden
    >
      {reducedMotion ? (
        <span className="absolute inset-0 bg-gradient-to-r from-primary/55 via-primary/25 to-transparent opacity-80" />
      ) : (
        <motion.span
          key={waveKey}
          className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-primary/70 via-primary/35 to-transparent"
          initial={{ x: "-40%", opacity: 1 }}
          animate={{ x: "100%", opacity: 0 }}
          transition={{ duration: 1.15, ease: WAVE_EASE }}
        />
      )}
    </span>
  );
}

export function SmoothStreamingText({
  messageId,
  content,
  isStreaming,
  onSettled,
}: SmoothStreamingTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const settledRef = useRef(false);

  const { revealedTokens, revealedText, phase, animatingFromIndex, isAwaitingStream } =
    useSmoothTextReveal({
      targetText: content,
      isStreaming,
      messageId,
      reducedMotion,
    });

  useEffect(() => {
    settledRef.current = false;
  }, [messageId]);

  useEffect(() => {
    if (phase !== "done" || settledRef.current) {
      return;
    }
    settledRef.current = true;
    onSettled?.();
  }, [phase, onSettled]);

  if (phase === "done") {
    return <MessageContent content={content} />;
  }

  const showMarkdown = phase === "crossfading";
  const fadeSeconds = reducedMotion ? 0 : SMOOTH_REVEAL_CROSSFADE_MS / 1000;

  return (
    <div className="grid min-w-0">
      <motion.div
        className="col-start-1 row-start-1 min-w-0 text-sm leading-relaxed whitespace-pre-wrap"
        initial={false}
        animate={{ opacity: showMarkdown ? 0 : 1 }}
        transition={{ duration: fadeSeconds, ease: "easeOut" }}
        aria-hidden={showMarkdown}
        aria-busy={isAwaitingStream || undefined}
      >
        {revealedTokens.map((token, index) => {
          const shouldAnimate = !reducedMotion && index >= animatingFromIndex;
          const tokenKey = `${messageId}-${index}`;

          return (
            <motion.span
              key={tokenKey}
              initial={
                shouldAnimate
                  ? {
                      opacity: 0,
                      color: pickAuraTokenColor(tokenKey),
                    }
                  : false
              }
              animate={{
                opacity: 1,
                color: "var(--foreground)",
              }}
              transition={{
                opacity: { duration: 0.16, ease: "easeOut" },
                color: { duration: 0.38, ease: "easeOut" },
              }}
            >
              {token}
            </motion.span>
          );
        })}
        {isAwaitingStream && isStreaming && phase === "revealing" ? (
          <StreamAwaitWave reducedMotion={reducedMotion} />
        ) : null}
      </motion.div>

      {showMarkdown ? (
        <motion.div
          className="col-start-1 row-start-1 min-w-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: fadeSeconds, ease: "easeOut" }}
        >
          <MessageContent content={content || revealedText} />
        </motion.div>
      ) : null}
    </div>
  );
}
