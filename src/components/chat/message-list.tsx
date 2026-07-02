"use client";

import { CirclePause } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { HistoryStatus } from "@/lib/chat/use-chat-history";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/stores/chat-store";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading?: boolean;
  onLoadOlder?: () => void;
  hasMoreHistory?: boolean;
  isLoadingOlder?: boolean;
  historyStatus?: HistoryStatus;
};

/** Auto-follow stays active while the viewport is within this distance of the bottom. */
const STICK_TO_BOTTOM_THRESHOLD_PX = 80;
const TOP_SENTINEL_ROOT_MARGIN = "120px 0px 0px 0px";

function scrollToBottom(element: HTMLDivElement) {
  element.scrollTop = element.scrollHeight;
}

function isNearBottom(element: HTMLDivElement): boolean {
  const distance =
    element.scrollHeight - element.scrollTop - element.clientHeight;
  return distance <= STICK_TO_BOTTOM_THRESHOLD_PX;
}

export function MessageList({
  messages,
  isLoading,
  onLoadOlder,
  hasMoreHistory = false,
  isLoadingOlder = false,
  historyStatus,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const isInitialScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const pendingPreserveRef = useRef<{ height: number; top: number } | null>(null);
  const prevFirstIdRef = useRef<string | undefined>(undefined);
  const prevLastIdRef = useRef<string | undefined>(undefined);

  const lastMessage = messages[messages.length - 1];
  const awaitingFirstToken =
    isLoading && (!lastMessage || lastMessage.role === "user");

  const triggerLoadOlder = useCallback(() => {
    if (!onLoadOlder || !hasMoreHistory || isLoadingOlder) {
      return;
    }
    const element = scrollRef.current;
    if (element) {
      pendingPreserveRef.current = {
        height: element.scrollHeight,
        top: element.scrollTop,
      };
    }
    onLoadOlder();
  }, [hasMoreHistory, isLoadingOlder, onLoadOlder]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const onScroll = () => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        lastScrollTopRef.current = element.scrollTop;
        return;
      }

      const scrolledUp = element.scrollTop < lastScrollTopRef.current - 1;
      lastScrollTopRef.current = element.scrollTop;

      if (scrolledUp) {
        stickToBottomRef.current = false;
        return;
      }

      stickToBottomRef.current = isNearBottom(element);
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel || !onLoadOlder) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          triggerLoadOlder();
        }
      },
      {
        root,
        rootMargin: TOP_SENTINEL_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadOlder, triggerLoadOlder]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const firstId = messages[0]?.id;
    const lastId = messages[messages.length - 1]?.id;
    const prepended =
      firstId !== prevFirstIdRef.current &&
      lastId === prevLastIdRef.current &&
      prevFirstIdRef.current !== undefined;

    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;

    if (pendingPreserveRef.current) {
      const { height, top } = pendingPreserveRef.current;
      pendingPreserveRef.current = null;
      programmaticScrollRef.current = true;
      element.scrollTop = element.scrollHeight - height + top;
      lastScrollTopRef.current = element.scrollTop;
      return;
    }

    if (prepended) {
      return;
    }

    const shouldFollow =
      isInitialScrollRef.current || stickToBottomRef.current;

    if (!shouldFollow) {
      return;
    }

    programmaticScrollRef.current = true;
    scrollToBottom(element);
    lastScrollTopRef.current = element.scrollTop;
    isInitialScrollRef.current = false;
  }, [messages, isLoading]);

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6">
        <div ref={topSentinelRef} className="h-px w-full shrink-0" aria-hidden />
        {isLoadingOlder ? (
          <p className="text-center text-xs text-muted-foreground">
            Loading older messages…
          </p>
        ) : null}
        {!isLoadingOlder && hasMoreHistory && historyStatus === "ready" ? (
          <p className="text-center text-xs text-muted-foreground">
            Scroll up for older messages
          </p>
        ) : null}
        {messages.map((message) => {
          const isInterruptedAssistant =
            message.role === "assistant" && message.interrupted;

          return (
            <article
              key={message.id}
              className={cn(
                "max-w-[85%] text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto rounded-2xl bg-muted/50 px-4 py-3 text-foreground"
                  : "mr-auto text-foreground",
              )}
            >
              {isInterruptedAssistant ? (
                <div className="relative rounded-xl border border-amber-500/20 px-4 py-3 pr-7 dark:border-amber-500/15">
                  <p className="min-w-0 whitespace-pre-wrap">{message.content}</p>
                  <span
                    className="absolute -right-2.5 -top-2.5 flex items-center justify-center bg-background p-1 text-amber-600/55 dark:text-amber-500/50"
                    title="Interrupted before finishing"
                    aria-label="Interrupted before finishing"
                  >
                    <CirclePause className="size-3.5" aria-hidden />
                  </span>
                </div>
              ) : (
                <p className="min-w-0 whitespace-pre-wrap">{message.content}</p>
              )}
            </article>
          );
        })}
        {awaitingFirstToken ? (
          <p className="text-sm text-muted-foreground">Assistant is thinking…</p>
        ) : null}
      </div>
    </div>
  );
}
