"use client";

import { useChat } from "@ai-sdk/react";
import { useSession } from "@livekit/components-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { TokenSource } from "livekit-client";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AgentSessionProvider } from "@/components/agents-ui/agent-session-provider";
import { StartAudioButton } from "@/components/agents-ui/start-audio-button";
import { BookingCancelOtpStack } from "@/components/chat/booking-cancel-otp-card";
import { BookingOtpCard } from "@/components/chat/booking-otp-card";
import { BookingSuccessDialog } from "@/components/chat/booking-success-dialog";
import { ChatControlBar } from "@/components/chat/chat-control-bar";
import { ChatGreeting } from "@/components/chat/chat-greeting";
import { ChatLoadingSpinner } from "@/components/chat/chat-loading-spinner";
import { DirectMessageCard } from "@/components/chat/direct-message-card";
import { MeetingsListCard } from "@/components/chat/meetings-list-card";
import { MessageList } from "@/components/chat/message-list";
import { PublicPauseModal } from "@/components/chat/public-pause-modal";
import { RateLimitModal } from "@/components/chat/rate-limit-modal";
import { Button } from "@/components/ui/button";
import { AgentAura } from "@/components/visualizer/agent-aura";
import { VoiceAuraBridge } from "@/components/visualizer/voice-aura-bridge";
import { mergeMessagesById } from "@/lib/chat/history-api";
import type { HistoryStatus } from "@/lib/chat/use-chat-history";
import { useChatSession } from "@/lib/chat/use-chat-session";
import { handleRateLimitResponse } from "@/lib/rate-limit-client";
import { lastUserTextFromUiMessages } from "@/lib/chat/chat-user-text";
import {
  MESSAGE_TOO_LONG_ERROR,
  throwIfMessageTooLongResponse,
} from "@/lib/chat/chat-message-errors";
import { bucketForType, PAUSED_ERROR_CODE } from "@/lib/public-access-config";
import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";
import {
  applyAssistantPaused,
  refreshPublicPauseState,
  usePublicPauseStore,
} from "@/lib/stores/public-pause-store";
import { livekitRoomName, livekitVoiceRoomName } from "@/lib/livekit/room";
import { normalizeLocale } from "@/lib/i18n/locales";
import {
  endVoiceSession,
} from "@/lib/livekit/voice-control";
import { useVoiceChatSync } from "@/lib/livekit/voice-chat-sync";
import { useVoiceTurnCharUsage } from "@/lib/livekit/use-voice-turn-char-usage";
import { useVoicePtt } from "@/lib/livekit/use-voice-ptt";
import { useVoiceUiEvents } from "@/lib/livekit/voice-ui-events";
import {
  useChatStore,
  type ChatMessage,
  type ChatMessagePart,
} from "@/lib/stores/chat-store";
import { cn } from "@/lib/utils";
const LIVEKIT_AGENT_NAME =
  process.env.NEXT_PUBLIC_LIVEKIT_AGENT_NAME ?? "personal-voice-agent";

const EASE = [0.4, 0, 0.2, 1] as const;
const CHAT_FADE_MS = 350;
/** Fallback bottom reservation until `ChatControlBar` reports its live height. */
const DEFAULT_CHROME_HEIGHT_PX = 96;
/** Extra scroll padding so the last message clears the control bar visually. */
const CHAT_MESSAGE_CHROME_GAP_PX = 24;

/**
 * Must match `bg-background/70` on the chrome wash so the scroll fade lands on
 * the same alpha instead of an opaque hard edge.
 */
const CHAT_CHROME_BG_MIX =
  "color-mix(in oklab, var(--background) 70%, transparent)";

/**
 * Softens scroll content just above the control bar.
 * Tracks live chrome height on all breakpoints.
 * Positioned absolute within the chat panel (not viewport-fixed) so it
 * follows the sidebar push layout on desktop.
 * Gradient: fully transparent → same alpha as the chrome wash below.
 *
 * Stack (bottom → top): messages → fade (15) → chrome wash (16) →
 * AgentAura (18) → control bar (20). Aura sits above the wash so the
 * fade trick is not lit from behind by the glow.
 */
function ChatScrollFade({ bottomPx }: { bottomPx: number }) {
  return (
    <div
      data-chat-scroll-fade
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-[15] mx-auto h-8 w-full max-w-3xl"
      style={{
        bottom: bottomPx,
        background: `linear-gradient(to top, ${CHAT_CHROME_BG_MIX} 0%, transparent 100%)`,
      }}
    />
  );
}

/** Stable per-session text timestamps; survives re-renders without refs in render. */
const textMessageTimestamps = new Map<string, number>();

function stableTextTimestamp(sessionId: string, messageId: string): number {
  const key = `${sessionId}\0${messageId}`;
  const existing = textMessageTimestamps.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const timestamp = Date.now();
  textMessageTimestamps.set(key, timestamp);
  return timestamp;
}

function uiMessageToChatMessage(
  message: UIMessage,
): Omit<ChatMessage, "timestamp"> | null {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const parts: ChatMessagePart[] = [];
  for (const part of message.parts) {
    if (part.type !== "data-meetings-list") {
      continue;
    }
    const data = part.data as {
      listId?: string;
      meetings?: ChatMessagePart["meetings"];
    };
    if (typeof data.listId === "string" && Array.isArray(data.meetings)) {
      parts.push({
        type: "meetings_list",
        listId: data.listId,
        meetings: data.meetings,
      });
    }
  }

  if (!text && parts.length === 0) {
    return null;
  }

  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: text,
    source: "text",
    parts: parts.length > 0 ? parts : undefined,
  };
}

type TextChatAreaProps = {
  sessionId: string;
  historyRows: ChatMessage[];
  hasMoreHistory: boolean;
  isLoadingOlder: boolean;
  historyStatus: HistoryStatus;
  onLoadOlder: () => void;
  onVoiceMessage: (
    message: Omit<ChatMessage, "timestamp"> & { timestamp?: number },
  ) => void;
  voiceConnectionId: string | null;
  voiceEnabled: boolean;
  onVoiceReconnect: () => void;
  onVoiceDisconnect: () => void;
  onVoiceToggle: () => void;
};

/**
 * Mounted only after sessionId exists so useChat + DefaultChatTransport are
 * created with the correct sessionId (useChat keeps the initial transport).
 */
function TextChatArea({
  sessionId,
  historyRows,
  hasMoreHistory,
  isLoadingOlder,
  historyStatus,
  onLoadOlder,
  onVoiceMessage,
  voiceConnectionId,
  voiceEnabled,
  onVoiceReconnect,
  onVoiceDisconnect,
  onVoiceToggle,
}: TextChatAreaProps) {
  const { t } = useTranslation();
  const language = useChatStore((state) => normalizeLocale(state.language));

  const agentMetadata = useMemo(
    () => JSON.stringify({ voice_language: language }),
    [language],
  );

  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async (options) => {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: options.roomName,
            participantName: options.participantName,
            participantIdentity: options.participantIdentity,
            participantMetadata: options.participantMetadata,
            participantAttributes: options.participantAttributes,
            agentName: options.agentName,
            agentMetadata: options.agentMetadata,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            await handleRateLimitResponse(response, "voice");
            throw new Error("rate_limit_exceeded");
          }
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? "Token generation failed");
        }

        return response.json();
      }),
    [],
  );

  const livekitRoom = voiceConnectionId
    ? livekitVoiceRoomName(sessionId, voiceConnectionId)
    : livekitRoomName(sessionId);

  const session = useSession(tokenSource, {
    roomName: livekitRoom,
    participantMetadata: sessionId,
    agentName: LIVEKIT_AGENT_NAME,
    agentMetadata,
  });

  const [voiceTurnBoundarySignal, setVoiceTurnBoundarySignal] = useState(0);

  const bumpVoiceTurnBoundary = useCallback(() => {
    setVoiceTurnBoundarySignal((count) => count + 1);
  }, []);

  const resetVoiceTurnBoundary = useCallback(() => {
    setVoiceTurnBoundarySignal(0);
  }, []);

  const charUsage = useVoiceTurnCharUsage(session.room, voiceTurnBoundarySignal);

  const exitVoiceRef = useRef<() => void>(() => {});

  const ptt = useVoicePtt({
    voiceEnabled,
    isConnected: session.isConnected,
    room: session.room,
    usedChars: charUsage.usedChars,
    onBumpTurnBoundary: bumpVoiceTurnBoundary,
    onResetTurnBoundary: resetVoiceTurnBoundary,
    onExitVoice: () => exitVoiceRef.current(),
  });

  const {
    voiceChromeState,
    listening,
    turnCountdownLabel,
    handlePrimaryClick,
    resetPttState,
    endSpeakingAfterHardCut,
    interruptSpeakingLocally,
    reportLiveKitStartError,
  } = ptt;

  const handleVoiceChatSync = useCallback(
    (message: Omit<ChatMessage, "timestamp"> & { timestamp?: number }) => {
      onVoiceMessage(message);
      if (message.role === "user") {
        bumpVoiceTurnBoundary();
      }
    },
    [onVoiceMessage, bumpVoiceTurnBoundary],
  );

  useVoiceChatSync(session, handleVoiceChatSync);
  useVoiceUiEvents(session);

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }

    let cancelled = false;
    const { start, end } = session;
    const room = session.room;

    void (async () => {
      try {
        await start({ tracks: { microphone: { enabled: false } } });
        if (cancelled) {
          return;
        }
        await room.startAudio();
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof Error && error.message === "rate_limit_exceeded") {
          onVoiceDisconnect();
          return;
        }
        console.error("LiveKit session failed to start", error);
        void refreshPublicPauseState();
        reportLiveKitStartError();
      }
    })();

    return () => {
      cancelled = true;
      void endVoiceSession(room, end);
    };
    // session identity changes on every render (connection state); including it loops start/end.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voiceEnabled + voiceConnectionId only
  }, [voiceEnabled, voiceConnectionId, onVoiceDisconnect]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          if (response.status === 429) {
            await handleRateLimitResponse(response, "chat");
            throw new Error("rate_limit_exceeded");
          }
          if (response.status === 503) {
            try {
              const body = (await response.clone().json()) as { error?: string };
              if (body.error === PAUSED_ERROR_CODE) {
                const sessionType =
                  useChatStore.getState().sessionType ?? "public";
                void applyAssistantPaused(sessionType);
                throw new Error(PAUSED_ERROR_CODE);
              }
            } catch (error) {
              if (
                error instanceof Error &&
                error.message === PAUSED_ERROR_CODE
              ) {
                throw error;
              }
            }
          }
          if (response.status === 400) {
            await throwIfMessageTooLongResponse(response);
          }
          return response;
        },
        prepareSendMessagesRequest: ({ messages }) => {
          const message = lastUserTextFromUiMessages(messages);
          return {
            body: {
              sessionId,
              message,
            },
          };
        },
      }),
    [sessionId],
  );

  const pauseStatus = usePublicPauseStore((s) => s.status);
  const activeType = usePublicPauseStore((s) => s.activeType);
  const pauseDismissed = usePublicPauseStore((s) => s.dismissed);
  const dismissPause = usePublicPauseStore((s) => s.dismiss);
  const paused = bucketForType(pauseStatus, activeType).paused;

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    transport,
    onError: (error) => {
      if (
        error.message === "rate_limit_exceeded" ||
        error.message === MESSAGE_TOO_LONG_ERROR ||
        error.message === PAUSED_ERROR_CODE
      ) {
        return;
      }
      console.error("Chat turn failed", error);
      const sessionType = useChatStore.getState().sessionType ?? "public";
      void refreshPublicPauseState(sessionType);
    },
  });

  const setOtpFromPayload = useBookingOtpStore((s) => s.setFromPayload);
  const bookingOtpActive = useBookingOtpStore((s) => s.active);
  const setActiveList = useMeetingsListStore((s) => s.setActiveList);
  const activeListId = useMeetingsListStore((s) => s.activeListId);
  const activeMeetings = useMeetingsListStore((s) => s.activeMeetings);
  const cancelOtpItems = useBookingCancelOtpStore((s) => s.items);
  const setDirectMessageFromPayload = useDirectMessageStore(
    (s) => s.setFromPayload,
  );
  const directMessageActive = useDirectMessageStore((s) => s.active);

  useEffect(() => {
    // Only the latest data-otp part matters; older parts stay in useChat history
    // after confirm/cancel and must not resurrect a dismissed widget.
    let latest: {
      bookingId: string;
      emailMasked: string;
      expiresAt: string;
      attemptsLeft?: number;
    } | null = null;
    let latestList: {
      listId: string;
      meetings: typeof activeMeetings;
    } | null = null;
    let latestDm: {
      formId: string;
      name?: string;
      email?: string;
      phoneNumber?: string;
    } | null = null;

    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type === "data-otp") {
          const data = part.data as {
            bookingId?: string;
            emailMasked?: string;
            expiresAt?: string;
            attemptsLeft?: number;
          };
          if (
            typeof data.bookingId === "string" &&
            typeof data.emailMasked === "string" &&
            typeof data.expiresAt === "string"
          ) {
            latest = {
              bookingId: data.bookingId,
              emailMasked: data.emailMasked,
              expiresAt: data.expiresAt,
              attemptsLeft: data.attemptsLeft,
            };
          }
        } else if (part.type === "data-meetings-list") {
          const data = part.data as {
            listId?: string;
            meetings?: typeof activeMeetings;
          };
          if (typeof data.listId === "string" && Array.isArray(data.meetings)) {
            latestList = { listId: data.listId, meetings: data.meetings };
          }
        } else if (part.type === "data-direct-message") {
          const data = part.data as {
            formId?: string;
            name?: string;
            email?: string;
            phoneNumber?: string;
          };
          if (typeof data.formId === "string") {
            latestDm = {
              formId: data.formId,
              name: typeof data.name === "string" ? data.name : undefined,
              email: typeof data.email === "string" ? data.email : undefined,
              phoneNumber:
                typeof data.phoneNumber === "string"
                  ? data.phoneNumber
                  : undefined,
            };
          }
        }
      }
    }

    if (latest) {
      setOtpFromPayload({
        bookingId: latest.bookingId,
        emailMasked: latest.emailMasked,
        expiresAt: latest.expiresAt,
        attemptsLeft: latest.attemptsLeft ?? 5,
      });
    }
    if (latestList) {
      setActiveList(latestList.listId, latestList.meetings);
    }
    if (latestDm) {
      setDirectMessageFromPayload(latestDm);
    }
  }, [messages, setOtpFromPayload, setActiveList, setDirectMessageFromPayload]);

  const handleSend = useCallback(
    async (text: string) => {
      await sendMessage({ text });
    },
    [sendMessage],
  );

  const mergedMessages = useMemo(() => {
    const textMessages = messages
      .map((message) => {
        const base = uiMessageToChatMessage(message);
        if (!base) {
          return null;
        }
        return {
          ...base,
          timestamp: stableTextTimestamp(sessionId, message.id),
        };
      })
      .filter((message): message is ChatMessage => message !== null);

    return mergeMessagesById(historyRows, textMessages);
  }, [historyRows, messages, sessionId]);

  const isLoading = status === "submitted" || status === "streaming";

  const setAuraPhase = useAgentActivityStore((store) => store.setPhase);

  useEffect(() => {
    if (voiceEnabled) {
      return;
    }
    setAuraPhase(
      status === "submitted"
        ? "thinking"
        : status === "streaming"
          ? "responding"
          : "idle",
    );
  }, [voiceEnabled, status, setAuraPhase]);

  useEffect(() => () => setAuraPhase("idle"), [setAuraPhase]);

  const showGreeting = mergedMessages.length === 0 && !voiceEnabled;
  const [voiceRevealReady, setVoiceRevealReady] = useState(false);
  const [chromeHeight, setChromeHeight] = useState(DEFAULT_CHROME_HEIGHT_PX);
  const userTrack = session.isConnected ? session.local.microphoneTrack : undefined;

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }
    const timer = setTimeout(() => setVoiceRevealReady(true), CHAT_FADE_MS);
    return () => {
      clearTimeout(timer);
      setVoiceRevealReady(false);
    };
  }, [voiceEnabled]);

  const voiceChromeReady = voiceEnabled && voiceRevealReady;

  const showVoiceOverlay =
    voiceEnabled &&
    (Boolean(activeListId) ||
      cancelOtpItems.length > 0 ||
      Boolean(bookingOtpActive) ||
      Boolean(directMessageActive));

  const handleExitVoice = useCallback(() => {
    setVoiceRevealReady(false);
    resetPttState();
    setTimeout(() => onVoiceToggle(), CHAT_FADE_MS);
  }, [onVoiceToggle, resetPttState]);

  useEffect(() => {
    exitVoiceRef.current = handleExitVoice;
  }, [handleExitVoice]);

  const handleHardCut = useCallback(() => {
    endSpeakingAfterHardCut();
  }, [endSpeakingAfterHardCut]);

  return (
    <AgentSessionProvider session={session}>
      <VoiceAuraBridge active={voiceEnabled} />
      <StartAudioButton
        session={session}
        label={t("chat.enableAudio")}
        className="sr-only"
      />
      <div
        data-chat-panel
        className="relative flex h-dvh min-h-0 flex-col"
      >
        <ChatGreeting visible={showGreeting} />

        <motion.div
          className="relative flex min-h-0 flex-1 flex-col"
          initial={false}
          animate={{
            opacity: voiceEnabled ? 0 : 1,
            y: voiceEnabled ? 8 : 0,
          }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{
            pointerEvents: voiceEnabled ? "none" : "auto",
          }}
          aria-hidden={voiceEnabled}
        >
          <MessageList
            messages={mergedMessages}
            isLoading={isLoading}
            onLoadOlder={onLoadOlder}
            hasMoreHistory={hasMoreHistory}
            isLoadingOlder={isLoadingOlder}
            historyStatus={historyStatus}
            sessionId={sessionId}
            showOtpInline={!voiceEnabled}
            onNote={onVoiceMessage}
            bottomInsetPx={chromeHeight + CHAT_MESSAGE_CHROME_GAP_PX}
          />
        </motion.div>

        {showVoiceOverlay ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex flex-col"
            style={{ paddingBottom: chromeHeight }}
          >
            <div className="pointer-events-auto mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-[safe_center] overflow-y-auto overscroll-y-contain px-4 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="mx-auto flex w-full flex-col items-stretch gap-3">
                {activeListId ? (
                  <MeetingsListCard
                    listId={activeListId}
                    meetings={activeMeetings}
                    sessionId={sessionId}
                    className="mt-0 max-w-none"
                  />
                ) : null}
                <BookingCancelOtpStack
                  sessionId={sessionId}
                  className="items-center"
                  onNote={onVoiceMessage}
                />
                <div className="mx-auto w-[min(100%,24rem)]">
                  <BookingOtpCard
                    sessionId={sessionId}
                    variant="overlay"
                    onNote={onVoiceMessage}
                  />
                </div>
                <div className="mx-auto w-[min(100%,24rem)]">
                  <DirectMessageCard
                    sessionId={sessionId}
                    onNote={onVoiceMessage}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!voiceEnabled ? <ChatScrollFade bottomPx={chromeHeight} /> : null}

        <div
          data-chat-chrome-wash
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[16] bg-background/70"
          style={{ height: chromeHeight }}
        />

        <AgentAura />

        <ChatControlBar
          onSend={handleSend}
          onVoiceToggle={onVoiceToggle}
          onExitVoice={handleExitVoice}
          onVoicePrimaryClick={handlePrimaryClick}
          voiceEnabled={voiceEnabled}
          voiceChromeReady={voiceChromeReady}
          voiceChromeState={voiceChromeState}
          voiceListening={listening}
          turnCountdownLabel={turnCountdownLabel}
          onHardCut={handleHardCut}
          onSpeakingInterrupt={interruptSpeakingLocally}
          voiceTurnRatio={charUsage.ratio}
          voiceTurnIsAtLimit={charUsage.isAtLimit}
          voiceTurnIsSpeaking={charUsage.isSpeaking}
          voiceTurnBoundarySignal={voiceTurnBoundarySignal}
          sessionId={sessionId}
          onVoiceReconnect={onVoiceReconnect}
          userTrack={userTrack}
          voiceRoom={session.room}
          disabled={paused}
          isLoading={isLoading}
          onChromeHeightChange={setChromeHeight}
        />

        {paused && !pauseDismissed ? (
          <PublicPauseModal onAcknowledge={dismissPause} />
        ) : null}

        <RateLimitModal />

        <BookingSuccessDialog />
      </div>
    </AgentSessionProvider>
  );
}

/** Bootstrap stopped before Turnstile and session creation — nothing to chat with. */
export function PausedChatPanel() {
  const { t } = useTranslation();
  const dismissed = usePublicPauseStore((s) => s.dismissed);
  const dismiss = usePublicPauseStore((s) => s.dismiss);

  if (!dismissed) {
    return <PublicPauseModal onAcknowledge={dismiss} />;
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center px-6 text-center">
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("pause.defaultMessage")}
      </p>
    </div>
  );
}

export function ChatSessionError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-muted-foreground">{t("chat.errorGeneric")}</p>
      <Button type="button" variant="default" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

export function ChatSessionLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center overflow-hidden">
      <ChatLoadingSpinner label={t("chat.loadingChat")} />
    </div>
  );
}

type ReadyChatSurfaceProps = {
  sessionId: string;
  historyRows: ReturnType<typeof useChatSession>["rows"];
  hasMoreHistory: boolean;
  historyStatus: HistoryStatus;
  loadOlder: ReturnType<typeof useChatSession>["loadOlder"];
  appendLive: ReturnType<typeof useChatSession>["appendLive"];
  /** Keep mounted while navigating away so session/voice/useChat state survives. */
  hidden?: boolean;
  onVoiceReconnectChange?: (reconnect: (() => void) | null) => void;
};

/**
 * Owns voice toggle state for the session lifetime. Stays mounted across
 * in-app routes (chat ↔ terms) so Turnstile/bootstrap are not repeated.
 */
export function ReadyChatSurface({
  sessionId,
  historyRows,
  hasMoreHistory,
  historyStatus,
  loadOlder,
  appendLive,
  hidden = false,
  onVoiceReconnectChange,
}: ReadyChatSurfaceProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceConnectionId, setVoiceConnectionId] = useState<string | null>(
    null,
  );

  const handleVoiceDisconnect = useCallback(() => {
    setVoiceEnabled(false);
  }, []);

  const handleVoiceToggle = useCallback(() => {
    setVoiceEnabled((enabled) => {
      if (enabled) {
        return false;
      }
      setVoiceConnectionId(crypto.randomUUID());
      return true;
    });
  }, []);

  const handleVoiceReconnect = useCallback(() => {
    if (voiceEnabled) {
      setVoiceConnectionId(crypto.randomUUID());
    }
  }, [voiceEnabled]);

  useEffect(() => {
    onVoiceReconnectChange?.(handleVoiceReconnect);
    return () => onVoiceReconnectChange?.(null);
  }, [handleVoiceReconnect, onVoiceReconnectChange]);

  return (
    <div
      className={cn(
        "flex h-dvh w-full flex-col overflow-hidden",
        hidden && "hidden",
      )}
      inert={hidden || undefined}
      aria-hidden={hidden}
    >
      <TextChatArea
        sessionId={sessionId}
        historyRows={historyRows}
        hasMoreHistory={hasMoreHistory}
        isLoadingOlder={historyStatus === "loading_more"}
        historyStatus={historyStatus}
        onLoadOlder={loadOlder}
        onVoiceMessage={appendLive}
        voiceConnectionId={voiceConnectionId}
        voiceEnabled={voiceEnabled}
        onVoiceReconnect={handleVoiceReconnect}
        onVoiceDisconnect={handleVoiceDisconnect}
        onVoiceToggle={handleVoiceToggle}
      />
    </div>
  );
}
