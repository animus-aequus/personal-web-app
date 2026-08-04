"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import { MessageContent } from "@/components/chat/message-content";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  SMOOTH_REVEAL_CROSSFADE_MS,
  useSmoothTextReveal,
} from "@/hooks/use-smooth-text-reveal";
import { pickAuraTokenColor } from "@/lib/visualizer/aura-palette";

type SmoothStreamingTextProps = {
  messageId: string;
  content: string;
  isStreaming: boolean;
  /** Fired once after plain → markdown crossfade completes. */
  onSettled?: () => void;
};

export function SmoothStreamingText({
  messageId,
  content,
  isStreaming,
  onSettled,
}: SmoothStreamingTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const settledRef = useRef(false);

  const { revealedTokens, revealedText, phase, animatingFromIndex } =
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
