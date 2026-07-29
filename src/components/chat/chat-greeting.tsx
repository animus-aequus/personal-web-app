"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AURA_PALETTE_CSS } from "@/lib/visualizer/aura-palette";

const HINTS = [
  "Ask anything about Kacper",
  "Book a meeting",
  "Contact Kacper directly",
] as const;

type HeadlineToken = {
  text: string;
  accent?: string;
};

const HEADLINE_TOKENS: HeadlineToken[] = [
  { text: "Hey!" },
  { text: "Kacper's", accent: AURA_PALETTE_CSS[0] },
  { text: "AI", accent: AURA_PALETTE_CSS[1] },
  { text: "assistant" },
  { text: "here." },
];

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

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

type ChatGreetingProps = {
  visible: boolean;
};

type GreetingContentProps = {
  reducedMotion: boolean;
};

function GreetingContent({ reducedMotion }: GreetingContentProps) {
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
      const hint = HINTS[hintIndex];

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
        setHintIndex((prev) => (prev + 1) % HINTS.length);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [headlineReady, reducedMotion, hintIndex]);

  useEffect(() => {
    if (!headlineReady || !reducedMotion) {
      return;
    }

    const id = window.setInterval(() => {
      setHintIndex((prev) => (prev + 1) % HINTS.length);
    }, REDUCED_HINT_ROTATE_MS);

    return () => window.clearInterval(id);
  }, [headlineReady, reducedMotion]);

  const handleHeadlineComplete = () => {
    if (headlineDoneRef.current || reducedMotion) {
      return;
    }
    headlineDoneRef.current = true;
    setHeadlineReady(true);
  };

  const displayedHint = reducedMotion
    ? HINTS[hintIndex]
    : HINTS[hintIndex].slice(0, charCount);

  const showCaret = headlineReady && !reducedMotion;

  return (
    <div className="flex max-w-lg flex-col items-center gap-3 text-center">
      <p className="text-2xl font-normal leading-snug text-foreground/90 md:text-4xl">
        {reducedMotion ? (
          <>
            {HEADLINE_TOKENS.map((token, index) => (
              <span
                key={token.text}
                style={token.accent ? { color: token.accent } : undefined}
              >
                {token.text}
                {index < HEADLINE_TOKENS.length - 1 ? " " : ""}
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
            {HEADLINE_TOKENS.map((token, index) => (
              <span
                key={token.text}
                className="inline-block overflow-hidden align-bottom pb-[0.1em]"
              >
                <motion.span
                  className="inline-block"
                  variants={headlineWordVariants}
                  style={token.accent ? { color: token.accent } : undefined}
                >
                  {token.text}
                  {index < HEADLINE_TOKENS.length - 1 ? "\u00A0" : ""}
                </motion.span>
              </span>
            ))}
          </motion.span>
        )}
      </p>

      <p
        className="inline-flex min-h-[1.5rem] items-center justify-center text-base leading-none text-muted-foreground md:text-lg"
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

export function ChatGreeting({ visible }: ChatGreetingProps) {
  const reducedMotion = usePrefersReducedMotion();

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
      {visible ? (
        <GreetingContent key="greeting-active" reducedMotion={reducedMotion} />
      ) : null}
    </motion.div>
  );
}
