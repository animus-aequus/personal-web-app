"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { GreetingBlob } from "@/components/visualizer/greeting-blob";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { AURA_PALETTE_CSS } from "@/lib/visualizer/aura-palette";

const WORD_STAGGER_S = 0.05;
const WORD_DURATION_S = 0.4;
const TYPE_MS = 32;
const HOLD_MS = 2000;
const DELETE_MS = 24;
const GAP_MS = 500;
const REDUCED_HINT_ROTATE_MS = 2500;

const EASE = [0.4, 0, 0.2, 1] as const;

const headlineContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: WORD_STAGGER_S,
    },
  },
};

const headlineWordVariants = {
  hidden: { y: "100%", opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: WORD_DURATION_S, ease: EASE },
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type HeadlineToken = {
  text: string;
  accent?: string;
};

/** Split a localized headline for staggered word animation; accent brand tokens. */
function tokenizeHeadline(headline: string): HeadlineToken[] {
  const raw = headline.trim().split(/\s+/).filter(Boolean);
  const words: string[] = [];
  for (const part of raw) {
    // Keep lone punctuation with the previous word (e.g. French "Salut !").
    if (/^[!?.…¡¿:;,]+$/.test(part) && words.length > 0) {
      words[words.length - 1] += `\u00A0${part}`;
      continue;
    }
    words.push(part);
  }

  return words.map((text) => {
    if (/kacper/i.test(text)) {
      return { text, accent: AURA_PALETTE_CSS[0] };
    }
    // AI / KI / IA as a word or hyphenated prefix (e.g. KI-Assistent).
    if (
      /^(AI|KI|IA)([-–.].*)?$/i.test(text) ||
      /(^|[^a-zA-ZÀ-ÿ])(AI|KI|IA)([^a-zA-ZÀ-ÿ]|$)/i.test(text)
    ) {
      return { text, accent: AURA_PALETTE_CSS[1] };
    }
    return { text };
  });
}

type ChatGreetingProps = {
  visible: boolean;
};

type GreetingContentProps = {
  reducedMotion: boolean;
  /** Fired once the headline reveal finishes (or immediately under reduced motion). */
  onHeadlineReady?: () => void;
};

function GreetingContent({
  reducedMotion,
  onHeadlineReady,
}: GreetingContentProps) {
  const { t } = useTranslation();
  const headlineTokens = useMemo(
    () => tokenizeHeadline(t("greeting.headline")),
    [t],
  );
  const hints = useMemo(
    () => [
      t("greeting.hints.ask"),
      t("greeting.hints.book"),
      t("greeting.hints.contact"),
    ],
    [t],
  );

  const headlineDoneRef = useRef(false);
  const [headlineReady, setHeadlineReady] = useState(reducedMotion);
  const [hintIndex, setHintIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (!headlineReady || reducedMotion) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const hint = hints[hintIndex];

      for (let i = 1; i <= hint.length; i++) {
        if (cancelled) {
          return;
        }
        setCharCount(i);
        await delay(TYPE_MS);
      }

      await delay(HOLD_MS);

      for (let i = hint.length - 1; i >= 0; i--) {
        if (cancelled) {
          return;
        }
        setCharCount(i);
        await delay(DELETE_MS);
      }

      await delay(GAP_MS);

      if (!cancelled) {
        setHintIndex((prev) => (prev + 1) % hints.length);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [headlineReady, reducedMotion, hintIndex, hints]);

  useEffect(() => {
    if (!headlineReady || !reducedMotion) {
      return;
    }

    const id = window.setInterval(() => {
      setHintIndex((prev) => (prev + 1) % hints.length);
    }, REDUCED_HINT_ROTATE_MS);

    return () => window.clearInterval(id);
  }, [headlineReady, reducedMotion, hints.length]);

  useEffect(() => {
    if (reducedMotion) {
      onHeadlineReady?.();
    }
  }, [reducedMotion, onHeadlineReady]);

  const handleHeadlineComplete = () => {
    if (headlineDoneRef.current || reducedMotion) {
      return;
    }
    headlineDoneRef.current = true;
    setHeadlineReady(true);
    onHeadlineReady?.();
  };

  const displayedHint = reducedMotion
    ? hints[hintIndex]
    : hints[hintIndex].slice(0, charCount);

  const showCaret = headlineReady && !reducedMotion;

  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <p className="text-2xl font-normal leading-snug text-foreground/90 drop-shadow-[2px_2px_2px_rgba(0,0,0,1)] md:text-4xl">
        {reducedMotion ? (
          <>
            {headlineTokens.map((token, index) => (
              <span
                key={`${token.text}-${index}`}
                style={token.accent ? { color: token.accent } : undefined}
              >
                {token.text}
                {index < headlineTokens.length - 1 ? " " : ""}
              </span>
            ))}
          </>
        ) : (
          <motion.span
            className="inline"
            variants={headlineContainerVariants}
            initial="hidden"
            animate="visible"
            onAnimationComplete={(definition) => {
              if (definition === "visible") {
                handleHeadlineComplete();
              }
            }}
          >
            {headlineTokens.map((token, index) => (
              <span
                key={`${token.text}-${index}`}
                className="inline-block overflow-hidden align-bottom pb-[0.1em]"
              >
                <motion.span
                  className="inline-block"
                  variants={headlineWordVariants}
                  style={token.accent ? { color: token.accent } : undefined}
                >
                  {token.text}
                  {index < headlineTokens.length - 1 ? "\u00A0" : ""}
                </motion.span>
              </span>
            ))}
          </motion.span>
        )}
      </p>

      <p
        className="inline-flex min-h-[1.5rem] items-center justify-center text-base leading-none text-muted-foreground drop-shadow-[1px_1px_1px_rgba(0,0,0,1)] md:text-lg"
        aria-hidden
      >
        <span>{displayedHint}</span>
        {showCaret ? (
          <span
            className="ml-0.5 inline-block h-[0.9em] w-px -translate-y-px animate-caret-blink bg-foreground/70"
            aria-hidden
          />
        ) : null}
      </p>
    </div>
  );
}

/** Safety cap if Motion's onAnimationComplete never fires. */
const BLOB_DEFER_FALLBACK_MS = 800;

export function ChatGreeting({ visible }: ChatGreetingProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { i18n } = useTranslation();
  /** Defer WebGL mount until the headline has claimed the main thread. */
  const [blobReady, setBlobReady] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset / arm blob gate when visibility flips (avoid sync setState in effects).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) {
      setBlobReady(false);
    } else if (reducedMotion) {
      setBlobReady(true);
    }
  }

  const markBlobReady = useCallback(() => {
    setBlobReady(true);
  }, []);

  useEffect(() => {
    if (!visible || reducedMotion) {
      return;
    }
    const id = window.setTimeout(() => {
      setBlobReady(true);
    }, BLOB_DEFER_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [visible, reducedMotion]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 inset-y-0 flex items-center justify-center px-6 pb-24"
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 12,
      }}
      transition={{ duration: 0.35, ease: EASE }}
      aria-hidden={!visible}
    >
      <GreetingBlob active={visible && blobReady} />
      {visible ? (
        <div className="relative z-10 w-full">
          <GreetingContent
            key={`greeting-${i18n.language}`}
            reducedMotion={reducedMotion}
            onHeadlineReady={markBlobReady}
          />
        </div>
      ) : null}
    </motion.div>
  );
}
