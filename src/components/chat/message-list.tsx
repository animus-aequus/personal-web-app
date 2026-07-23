"use client";

import { CirclePause } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { ChatLoadingSpinner } from "@/components/chat/chat-loading-spinner";
import { MessageContent } from "@/components/chat/message-content";
import { BookingCancelOtpStack } from "@/components/chat/booking-cancel-otp-card";
import { BookingOtpCard } from "@/components/chat/booking-otp-card";
import { MeetingsListCard } from "@/components/chat/meetings-list-card";
import type { HistoryStatus } from "@/lib/chat/use-chat-history";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/stores/chat-store";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading?: boolean;
  onLoadOlder?: () => void;
  hasMoreHistory?: boolean;
  isLoadingOlder?: boolean;
  historyStatus?: HistoryStatus;
  sessionId?: string | null;
  showOtpInline?: boolean;
  onNote?: (
    message: Omit<ChatMessage, "timestamp"> & { timestamp?: number },
  ) => void;
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
  sessionId,
  showOtpInline = false,
  onNote,
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

  // Inline OTP widgets (booking confirm + cancellation) are rendered outside the
  // `messages` list below and don't participate in `useChat` state, so the
  // scroll-to-bottom effect must also react to them explicitly — otherwise a
  // newly added card can land below the fold with no scroll to reveal it.
  const cancelOtpCount = useBookingCancelOtpStore((s) => s.items.length);
  const bookingOtpActive = useBookingOtpStore((s) => s.active !== null);

  const lastMessage = messages[messages.length - 1];
  const awaitingFirstToken =
    isLoading && (!lastMessage || lastMessage.role === "user");

  const triggerLoadOlder = useCallback(() => {
    if (!onLoadOlder || !hasMoreHistory || isLoadingOlder) {
      return;
    }
    // Keep the first in-flight preserve snapshot; a second trigger before rows
    // prepend must not overwrite it or scroll restoration will jump.
    if (pendingPreserveRef.current !== null) {
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
  }, [messages, isLoading, cancelOtpCount, bookingOtpActive]);

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-6">
        <div ref={topSentinelRef} className="h-px w-full shrink-0" aria-hidden />
        {isLoadingOlder ? (
          <ChatLoadingSpinner
            size="sm"
            className="mb-4"
            label="Loading older messages"
          />
        ) : null}
        {!isLoadingOlder && hasMoreHistory && historyStatus === "ready" ? (
          <p className="text-center text-xs text-muted-foreground">
            Scroll up for older messages
          </p>
        ) : null}
        {messages.map((message) => {
          if (message.role === "system-note") {
            return (
              <div
                key={message.id}
                role="status"
                className="mx-auto rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
              >
                {message.content}
              </div>
            );
          }

          const isInterruptedAssistant =
            message.role === "assistant" && message.interrupted;

          return (
            <article
              key={message.id}
              className={cn(
                "text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-muted/50 px-4 py-3 text-foreground"
                  // Fixed (not max-) width: this is a flex item in a column
                  // flex container, so an auto margin + auto width would
                  // shrink-to-fit its content instead of taking a stable
                  // width — that's what made GenUI cards vary in size.
                  : "mr-auto w-[85%] text-foreground",
              )}
            >
              {isInterruptedAssistant ? (
                <div className="relative rounded-xl border border-amber-500/20 px-4 py-3 pr-7 dark:border-amber-500/15">
                  <MessageContent
                    content={message.content}
                    source={message.source}
                  />
                  <span
                    className="absolute -right-2.5 -top-2.5 flex items-center justify-center bg-background p-1 text-amber-600/55 dark:text-amber-500/50"
                    title="Interrupted before finishing"
                    aria-label="Interrupted before finishing"
                  >
                    <CirclePause className="size-3.5" aria-hidden />
                  </span>
                </div>
              ) : (
                <>
                  {message.content ? (
                    <MessageContent
                      content={message.content}
                      source={message.source}
                    />
                  ) : null}
                  {message.parts?.map((part) => {
                    if (part.type !== "meetings_list" || !sessionId) {
                      return null;
                    }
                    return (
                      <MeetingsListCard
                        key={part.listId}
                        listId={part.listId}
                        meetings={part.meetings}
                        sessionId={sessionId}
                      />
                    );
                  })}
                </>
              )}
            </article>
          );
        })}
        {showOtpInline && sessionId ? (
          <div className="mr-auto flex w-[min(100%,24rem)] flex-col gap-3">
            <BookingCancelOtpStack sessionId={sessionId} onNote={onNote} />
            <BookingOtpCard sessionId={sessionId} variant="inline" onNote={onNote} />
          </div>
        ) : null}
        {awaitingFirstToken ? (
          <p className="text-sm text-muted-foreground">Assistant is thinking…</p>
        ) : null}
      </div>
    </div>
  );
}
