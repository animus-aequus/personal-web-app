"use client";

import { CirclePause } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChatLoadingSpinner } from "@/components/chat/chat-loading-spinner";
import { MessageContent } from "@/components/chat/message-content";
import { BookingCancelOtpStack } from "@/components/chat/booking-cancel-otp-card";
import { BookingOtpCard } from "@/components/chat/booking-otp-card";
import { DirectMessageCard } from "@/components/chat/direct-message-card";
import { MeetingsListCard } from "@/components/chat/meetings-list-card";
import { SmoothStreamingText } from "@/components/chat/smooth-streaming-text";
import { VoiceTurnTruncatedBadge } from "@/components/chat/voice-turn-progress";
import type { HistoryStatus } from "@/lib/chat/use-chat-history";
import { formatSystemNoteText } from "@/lib/i18n/system-note";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
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
  /** Bottom padding so the last message clears the control-bar chrome while
   * content can still scroll underneath the semi-transparent wash. */
  bottomInsetPx?: number;
  onNote?: (
    message: Omit<ChatMessage, "timestamp"> & { timestamp?: number },
  ) => void;
  /** Notifies parent while paced reveal is latched (for content trim timing). */
  onSmoothRevealMessageIdChange?: (messageId: string | null) => void;
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
  bottomInsetPx,
  onNote,
  onSmoothRevealMessageIdChange,
}: MessageListProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const isInitialScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const pendingPreserveRef = useRef<{ height: number; top: number } | null>(null);
  const prevFirstIdRef = useRef<string | undefined>(undefined);
  const prevLastIdRef = useRef<string | undefined>(undefined);
  const [smoothMessageId, setSmoothMessageId] = useState<string | null>(null);

  // Inline OTP widgets (booking confirm + cancellation) are rendered outside the
  // `messages` list below and don't participate in `useChat` state, so the
  // scroll-to-bottom effect must also react to them explicitly — otherwise a
  // newly added card can land below the fold with no scroll to reveal it.
  const cancelOtpCount = useBookingCancelOtpStore((s) => s.items.length);
  const bookingOtpActive = useBookingOtpStore((s) => s.active !== null);
  const directMessageActive = useDirectMessageStore((s) => s.active !== null);

  const lastMessage = messages[messages.length - 1];
  const awaitingFirstToken =
    isLoading && (!lastMessage || lastMessage.role === "user");

  // Latch the streaming assistant id during render so paced reveal stays
  // mounted after `isLoading` flips false until live markdown settles.
  const liveSmoothId =
    isLoading &&
    lastMessage?.role === "assistant" &&
    lastMessage.source === "text" &&
    !lastMessage.interrupted
      ? lastMessage.id
      : null;
  if (liveSmoothId !== null && liveSmoothId !== smoothMessageId) {
    setSmoothMessageId(liveSmoothId);
  }

  const clearSmoothMessage = useCallback((messageId: string) => {
    setSmoothMessageId((current) => (current === messageId ? null : current));
  }, []);

  useEffect(() => {
    onSmoothRevealMessageIdChange?.(smoothMessageId);
  }, [smoothMessageId, onSmoothRevealMessageIdChange]);

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

  const followBottomIfNeeded = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
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
  }, []);

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

    followBottomIfNeeded();
  }, [
    messages,
    isLoading,
    cancelOtpCount,
    bookingOtpActive,
    directMessageActive,
    followBottomIfNeeded,
  ]);

  // Word-by-word reveal grows content without changing `messages` identity —
  // observe the column so stick-to-bottom still tracks height.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      followBottomIfNeeded();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [followBottomIfNeeded]);

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        ref={contentRef}
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-6 md:px-6"
        style={{
          paddingBottom: bottomInsetPx ?? 24,
        }}
      >
        <div ref={topSentinelRef} className="h-px w-full shrink-0" aria-hidden />
        {isLoadingOlder ? (
          <ChatLoadingSpinner
            size="sm"
            className="mb-4"
            label={t("chat.loadingOlder")}
          />
        ) : null}
        {!isLoadingOlder && hasMoreHistory && historyStatus === "ready" ? (
          <p className="text-center text-xs text-muted-foreground">
            {t("chat.scrollUpOlder")}
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
                {formatSystemNoteText(t, {
                  kind: message.kind,
                  params: message.params,
                  fallback: message.content,
                })}
              </div>
            );
          }

          const isInterruptedAssistant =
            message.role === "assistant" && message.interrupted;
          const isTruncatedUser =
            message.role === "user" && message.interrupted;
          const useSmoothReveal =
            message.id === smoothMessageId &&
            message.role === "assistant" &&
            message.source === "text" &&
            !message.interrupted &&
            Boolean(message.content);

          return (
            <article
              key={message.id}
              className={cn(
                "text-sm leading-relaxed",
                message.role === "user" &&
                  cn(
                    "ml-auto max-w-[85%] text-foreground",
                    !isTruncatedUser && "rounded-2xl bg-card px-4 py-3",
                  ),
                  // Fixed (not max-) width: this is a flex item in a column
                  // flex container, so an auto margin + auto width would
                  // shrink-to-fit its content instead of taking a stable
                  // width — that's what made GenUI cards vary in size.
                message.role === "assistant" && "mr-auto w-[85%] text-foreground",
              )}
            >
              {isTruncatedUser ? (
                <div className="relative rounded-xl border border-amber-500/20 px-4 py-3 pr-8 dark:border-amber-500/15">
                  <MessageContent content={message.content} />
                  <VoiceTurnTruncatedBadge title={t("chat.lengthTruncated")} />
                </div>
              ) : isInterruptedAssistant ? (
                <div className="relative rounded-xl border border-amber-500/20 px-4 py-3 pr-7 dark:border-amber-500/15">
                  <MessageContent content={message.content} />
                  <span
                    className="absolute -right-2.5 -top-2.5 flex items-center justify-center bg-background p-1 text-amber-600/55 dark:text-amber-500/50"
                    title={t("chat.interrupted")}
                    aria-label={t("chat.interrupted")}
                  >
                    <CirclePause className="size-3.5" aria-hidden />
                  </span>
                </div>
              ) : (
                <>
                  {message.content ? (
                    useSmoothReveal ? (
                      <SmoothStreamingText
                        key={message.id}
                        messageId={message.id}
                        content={message.content}
                        isStreaming={Boolean(isLoading)}
                        onSettled={() => clearSmoothMessage(message.id)}
                      />
                    ) : (
                      <MessageContent content={message.content} />
                    )
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
            <DirectMessageCard sessionId={sessionId} onNote={onNote} />
          </div>
        ) : null}
        {awaitingFirstToken ? (
          <p className="text-sm text-muted-foreground">{t("chat.assistantThinking")}</p>
        ) : null}
      </div>
    </div>
  );
}
