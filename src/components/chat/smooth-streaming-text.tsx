"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

import { MessageContent } from "@/components/chat/message-content";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSmoothTextReveal } from "@/hooks/use-smooth-text-reveal";
import { softCloseMarkdown } from "@/lib/chat/soft-close-markdown";
import { cn } from "@/lib/utils";

type SmoothStreamingTextProps = {
  messageId: string;
  content: string;
  isStreaming: boolean;
  /** Fired once after paced reveal completes. */
  onSettled?: () => void;
};

function SkeletonBar({
  widthClass,
  delay = 0,
  reducedMotion,
}: {
  widthClass: string;
  delay?: number;
  reducedMotion: boolean;
}) {
  return (
    <div
      className={cn(
        "relative h-2.5 overflow-hidden rounded-full bg-primary/10",
        widthClass,
      )}
    >
      {reducedMotion ? null : (
        <motion.div
          className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "220%" }}
          transition={{
            duration: 1.35,
            ease: [0.4, 0, 0.2, 1],
            repeat: Infinity,
            repeatDelay: 0.45,
            delay,
          }}
        />
      )}
    </div>
  );
}

/**
 * Skeleton lines under the stream — soft primary shimmer suggesting more content.
 * Hidden between awaits: fully transparent (no wash behind the text).
 */
function StreamAwaitSkeleton({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="mt-3 flex w-full flex-col gap-2" aria-hidden>
      <SkeletonBar
        widthClass="w-[92%]"
        reducedMotion={reducedMotion}
      />
      <SkeletonBar
        widthClass="w-[64%]"
        delay={0.18}
        reducedMotion={reducedMotion}
      />
    </div>
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

  const { revealedText, phase, animatingFromIndex, isAwaitingStream } =
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

  const liveContent = useMemo(
    () => softCloseMarkdown(revealedText),
    [revealedText],
  );

  const animateFromWordIndex = useMemo(() => {
    if (reducedMotion || phase === "done") {
      return undefined;
    }
    return animatingFromIndex;
  }, [reducedMotion, phase, animatingFromIndex]);

  const showLoader = isAwaitingStream && isStreaming && phase === "revealing";

  if (phase === "done") {
    return <MessageContent content={content} />;
  }

  return (
    <div className="min-w-0 w-full" aria-busy={isAwaitingStream || undefined}>
      <MessageContent
        content={liveContent}
        messageId={messageId}
        animateFromWordIndex={animateFromWordIndex}
      />
      {phase === "revealing" ? (
        <div
          className={cn(
            "transition-opacity duration-150",
            showLoader ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!showLoader}
        >
          <StreamAwaitSkeleton reducedMotion={reducedMotion} />
        </div>
      ) : null}
    </div>
  );
}
