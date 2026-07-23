"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

import { cn } from "@/lib/utils";

type MessageContentProps = {
  content: string;
};

function isSafeHttpsLink(href: string | undefined): href is string {
  return typeof href === "string" && href.startsWith("https://");
}

const headingAsParagraph = (
  className: string,
): Components["h1"] => {
  return function HeadingAsParagraph({ children }) {
    return <p className={className}>{children}</p>;
  };
};

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="min-w-0 whitespace-pre-wrap [&:not(:last-child)]:mb-2">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="min-w-0">{children}</li>,
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
      return <span>{children}</span>;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {children}
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

export function MessageContent({ content }: MessageContentProps) {
  return (
    <div className={cn("chat-markdown min-w-0 text-sm leading-relaxed")}>
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
}
