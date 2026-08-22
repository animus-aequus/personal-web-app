"use client";

import { Mail, Phone } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { buttonVariants } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  ABOUT_EMAIL,
  ABOUT_FULL_NAME,
  ABOUT_GITHUB_URL,
  ABOUT_LINKEDIN_URL,
  ABOUT_PHONE_DISPLAY,
  ABOUT_PHONE_E164,
} from "@/lib/about/social-links";
import { pullCompletedTokens } from "@/lib/chat/tokenize-text";
import { cn } from "@/lib/utils";
import { pickAuraTokenColor } from "@/lib/visualizer/aura-palette";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 26, mass: 0.55 };
const WORD_STAGGER_S = 0.045;
const BLOCK_STAGGER_S = 0.12;

type ChainStep =
  | { kind: "words"; text: string; className?: string; as?: "h2" | "p" }
  | { kind: "socials" }
  | { kind: "contact" }
  | { kind: "spacer" };

function splitWords(text: string): string[] {
  const { tokens } = pullCompletedTokens(text, true);
  return tokens.length > 0 ? tokens : [text];
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 4.126 0 2.063 2.063 0 0 1-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function AnimatedWord({
  word,
  tokenKey,
  reducedMotion,
  delay,
  className,
}: {
  word: string;
  tokenKey: string;
  reducedMotion: boolean;
  delay: number;
  className?: string;
}) {
  if (reducedMotion) {
    return <span className={className}>{word}</span>;
  }

  return (
    <motion.span
      className={cn("inline", className)}
      initial={{
        opacity: 0,
        scale: 0.5,
        color: pickAuraTokenColor(tokenKey),
      }}
      animate={{
        opacity: 1,
        scale: 1,
        color: "inherit",
      }}
      transition={{
        ...SPRING,
        delay,
      }}
    >
      {word}
    </motion.span>
  );
}

function AnimatedBlock({
  children,
  tokenKey,
  reducedMotion,
  delay,
  className,
}: {
  children: React.ReactNode;
  tokenKey: string;
  reducedMotion: boolean;
  delay: number;
  className?: string;
}) {
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        scale: 0.5,
        color: pickAuraTokenColor(tokenKey),
      }}
      animate={{
        opacity: 1,
        scale: 1,
        color: "inherit",
      }}
      transition={{
        ...SPRING,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

export function AboutIntro() {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();

  const bioParagraphs = useMemo(
    () => [t("aboutMe.bio.p1"), t("aboutMe.bio.p2"), t("aboutMe.bio.p3")],
    [t],
  );

  const steps = useMemo<ChainStep[]>(() => {
    const chain: ChainStep[] = [
      { kind: "words", text: ABOUT_FULL_NAME, className: "text-3xl font-semibold tracking-tight text-foreground sm:text-4xl", as: "h2" },
      { kind: "socials" },
      { kind: "contact" },
      { kind: "spacer" },
      ...bioParagraphs.map((text) => ({
        kind: "words" as const,
        text,
        className: "text-sm leading-relaxed text-foreground/85 sm:text-base",
        as: "p" as const,
      })),
    ];
    return chain;
  }, [bioParagraphs]);

  let wordIndex = 0;
  let blockIndex = 0;

  const renderStep = (step: ChainStep, stepIndex: number) => {
    if (step.kind === "words") {
      const words = splitWords(step.text);
      const Tag = step.as ?? "p";
      const blockDelay = blockIndex * BLOCK_STAGGER_S;
      blockIndex += 1;

      return (
        <Tag key={`step-${stepIndex}`} className={step.className}>
          {words.map((word, index) => {
            const current = wordIndex;
            wordIndex += 1;
            return (
              <AnimatedWord
                key={`${stepIndex}-w-${index}`}
                word={word}
                tokenKey={`about-${current}`}
                reducedMotion={reducedMotion}
                delay={blockDelay + current * WORD_STAGGER_S}
              />
            );
          })}
        </Tag>
      );
    }

    if (step.kind === "socials") {
      const delay = blockIndex * BLOCK_STAGGER_S;
      blockIndex += 1;
      return (
        <AnimatedBlock
          key={`step-${stepIndex}`}
          tokenKey={`about-block-${stepIndex}`}
          reducedMotion={reducedMotion}
          delay={delay}
          className="mt-4 flex items-center gap-2"
        >
          <Link
            href={ABOUT_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-10 text-foreground/80 hover:text-foreground",
            )}
          >
            <GithubIcon className="size-5" />
          </Link>
          <Link
            href={ABOUT_LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            title="LinkedIn"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-10 text-foreground/80 hover:text-foreground",
            )}
          >
            <LinkedInIcon className="size-5" />
          </Link>
        </AnimatedBlock>
      );
    }

    if (step.kind === "contact") {
      const delay = blockIndex * BLOCK_STAGGER_S;
      blockIndex += 1;
      return (
        <AnimatedBlock
          key={`step-${stepIndex}`}
          tokenKey={`about-block-${stepIndex}`}
          reducedMotion={reducedMotion}
          delay={delay}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2"
        >
          <a
            href={`mailto:${ABOUT_EMAIL}`}
            className="inline-flex items-center gap-2 text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <Mail className="size-4 shrink-0" aria-hidden />
            {ABOUT_EMAIL}
          </a>
          <a
            href={`tel:${ABOUT_PHONE_E164}`}
            className="inline-flex items-center gap-2 text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <Phone className="size-4 shrink-0" aria-hidden />
            {ABOUT_PHONE_DISPLAY}
          </a>
        </AnimatedBlock>
      );
    }

    return <div key={`step-${stepIndex}`} className="mt-2" aria-hidden />;
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {steps.map((step, index) => renderStep(step, index))}
    </div>
  );
}
