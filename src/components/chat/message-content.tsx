"use client";

import { motion } from "motion/react";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

import { pullCompletedTokens } from "@/lib/chat/tokenize-text";
import { cn } from "@/lib/utils";
import { pickAuraTokenColor } from "@/lib/visualizer/aura-palette";

type MessageContentProps = {
  content: string;
  /**
   * Absolute word index from which new words should play enter animation.
   * Omit for settled / history rendering.
   */
  animateFromWordIndex?: number;
  /** Stable key prefix for motion spans. */
  messageId?: string;
};

function isSafeHttpsLink(href: string | undefined): href is string {
  return typeof href === "string" && href.startsWith("https://");
}

type MessageWordAnimContextValue = {
  messageId: string;
  animateFrom: number;
  /** Mutable cursor shared across sibling markdown blocks in one render. */
  nextWordIndex: number;
  /**
   * Word indices that already played enter. Survives markdown remounts so
   * soft-close / reparse does not replay opacity 0 → flicker at the tip.
   */
  playedWordIndexes: Set<number>;
};

const MessageWordAnimContext = createContext<MessageWordAnimContextValue | null>(
  null,
);

/** Prevents li > p / p > a from double-walking and double-counting words. */
const WordAnimAppliedContext = createContext(false);

function wrapTextWords(text: string, ctx: MessageWordAnimContextValue): ReactNode[] {
  const { tokens } = pullCompletedTokens(text, true);
  if (tokens.length === 0) {
    return text ? [text] : [];
  }

  const played = ctx.playedWordIndexes;

  return tokens.map((token) => {
    const wordIndex = ctx.nextWordIndex;
    ctx.nextWordIndex += 1;
    const tokenKey = `${ctx.messageId}-w-${wordIndex}`;
    const alreadyPlayed = played.has(wordIndex);
    const playEnter = wordIndex >= ctx.animateFrom && !alreadyPlayed;

    if (playEnter) {
      played.add(wordIndex);
    }

    // Keep motion.span for any word that ever entered — switching motion→span
    // when animateFrom advances remounts the tip and looks like a flicker.
    if (playEnter || alreadyPlayed) {
      return (
        <motion.span
          key={tokenKey}
          className="inline"
          initial={
            playEnter
              ? {
                  opacity: 0.35,
                  color: pickAuraTokenColor(tokenKey),
                }
              : false
          }
          animate={{
            opacity: 1,
            color: "inherit",
          }}
          transition={{
            opacity: { duration: 0.14, ease: "easeOut" },
            color: { duration: 0.32, ease: "easeOut" },
          }}
        >
          {token}
        </motion.span>
      );
    }

    return <span key={tokenKey}>{token}</span>;
  });
}

function wrapAnimatedWords(
  children: ReactNode,
  ctx: MessageWordAnimContextValue,
): ReactNode {
  return Children.map(children, (child) => {
    if (child === null || child === undefined || typeof child === "boolean") {
      return child;
    }
    if (typeof child === "string" || typeof child === "number") {
      const parts = wrapTextWords(String(child), ctx);
      if (parts.length === 1) {
        return parts[0];
      }
      return parts;
    }
    if (isValidElement<{ children?: ReactNode }>(child)) {
      if (child.type === "pre") {
        return child;
      }
      const element = child as ReactElement<{ children?: ReactNode }>;
      return cloneElement(
        element,
        undefined,
        wrapAnimatedWords(element.props.children, ctx),
      );
    }
    return child;
  });
}

function AnimatedMarkdownChildren({ children }: { children: ReactNode }) {
  const ctx = useContext(MessageWordAnimContext);
  const alreadyApplied = useContext(WordAnimAppliedContext);

  if (!ctx || alreadyApplied) {
    return children;
  }

  return (
    <WordAnimAppliedContext.Provider value={true}>
      {wrapAnimatedWords(children, ctx)}
    </WordAnimAppliedContext.Provider>
  );
}

function buildMarkdownComponents(anim: { enabled: boolean }): Components {
  const wrap = (children: ReactNode) =>
    anim.enabled ? (
      <AnimatedMarkdownChildren>{children}</AnimatedMarkdownChildren>
    ) : (
      children
    );

  const headingAsParagraph = (className: string): Components["h1"] => {
    return function HeadingAsParagraph({ children }) {
      return <p className={className}>{wrap(children)}</p>;
    };
  };

  return {
    p: ({ children }) => (
      <p className="min-w-0 whitespace-pre-wrap [&:not(:last-child)]:mb-2">
        {wrap(children)}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
    ),
    li: ({ children }) => <li className="min-w-0">{wrap(children)}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ className, children }) => {
      if (className) {
        return <code className={className}>{children}</code>;
      }
      return (
        <code className="rounded bg-muted/60 px-1 font-mono text-[0.9em]">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-2 overflow-x-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-[0.9em]">
        {children}
      </pre>
    ),
    a: ({ href, children }) => {
      if (!isSafeHttpsLink(href)) {
        return <span>{wrap(children)}</span>;
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {wrap(children)}
        </a>
      );
    },
    h1: headingAsParagraph("min-w-0 font-medium [&:not(:last-child)]:mb-2"),
    h2: headingAsParagraph("min-w-0 font-medium [&:not(:last-child)]:mb-2"),
    h3: headingAsParagraph("min-w-0 font-medium [&:not(:last-child)]:mb-2"),
    h4: headingAsParagraph("min-w-0 font-medium [&:not(:last-child)]:mb-2"),
    h5: headingAsParagraph("min-w-0 font-medium [&:not(:last-child)]:mb-2"),
    h6: headingAsParagraph("min-w-0 font-medium [&:not(:last-child)]:mb-2"),
    img: () => null,
  };
}

const staticMarkdownComponents = buildMarkdownComponents({ enabled: false });
const animatedMarkdownComponents = buildMarkdownComponents({ enabled: true });

export function MessageContent({
  content,
  animateFromWordIndex,
  messageId = "msg",
}: MessageContentProps) {
  const animate =
    animateFromWordIndex !== undefined && animateFromWordIndex >= 0;
  const components = animate
    ? animatedMarkdownComponents
    : staticMarkdownComponents;

  // Persists across re-renders / MD remounts; resets when this component remounts
  // (SmoothStreamingText is keyed by messageId).
  const [playedWordIndexes] = useState(() => new Set<number>());

  // New mutable cursor each render: sibling blocks (p then p) share one sequence.
  // Nested wraps (li > p, p > a) are skipped via WordAnimAppliedContext.
  const animState: MessageWordAnimContextValue | null = animate
    ? {
        messageId,
        animateFrom: animateFromWordIndex ?? 0,
        nextWordIndex: 0,
        playedWordIndexes,
      }
    : null;

  const markdown = (
    <div className={cn("chat-markdown min-w-0 text-sm leading-relaxed")}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );

  if (!animState) {
    return markdown;
  }

  return (
    <MessageWordAnimContext.Provider value={animState}>
      {markdown}
    </MessageWordAnimContext.Provider>
  );
}
