"use client";

import { useChat } from "@ai-sdk/react";
import { useSession } from "@livekit/components-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { TokenSource } from "livekit-client";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AgentSessionProvider } from "@/components/agents-ui/agent-session-provider";
import { StartAudioButton } from "@/components/agents-ui/start-audio-button";
import { ChatControlBar } from "@/components/chat/chat-control-bar";
import { ChatGreeting } from "@/components/chat/chat-greeting";
import { ChatLoadingSpinner } from "@/components/chat/chat-loading-spinner";
import { MessageList } from "@/components/chat/message-list";
import { VoiceAuraBridge } from "@/components/visualizer/voice-aura-bridge";
import { mergeMessagesById } from "@/lib/chat/history-api";
import type { HistoryStatus } from "@/lib/chat/use-chat-history";
import { useChatSession } from "@/lib/chat/use-chat-session";
import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";
import { livekitRoomName, livekitVoiceRoomName } from "@/lib/livekit/room";
import {
  endVoiceSession,
  publishVoiceModeExit,
} from "@/lib/livekit/voice-control";
import { useVoiceChatSync } from "@/lib/livekit/voice-chat-sync";
import type { ChatMessage } from "@/lib/stores/chat-store";

const LIVEKIT_AGENT_NAME =
  process.env.NEXT_PUBLIC_LIVEKIT_AGENT_NAME ?? "personal-voice-agent";

const EASE = [0.4, 0, 0.2, 1] as const;
const CHAT_FADE_MS = 350;

function ChatScrollFade() {
  return (
    <div
      data-chat-scroll-fade
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[15] h-8"
      style={{
        background: "linear-gradient(to top, rgb(0 0 0) 0%, transparent 100%)",
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

  if (!text) {
    return null;
  }

  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: text,
    source: "text",
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
  onVoiceDisconnect,
  onVoiceToggle,
}: TextChatAreaProps) {
  const tokenSource = useMemo(
    () => TokenSource.endpoint("/api/livekit/token"),
    [],
  );

  const livekitRoom = voiceConnectionId
    ? livekitVoiceRoomName(sessionId, voiceConnectionId)
    : livekitRoomName(sessionId);

  const session = useSession(tokenSource, {
    roomName: livekitRoom,
    participantMetadata: sessionId,
    agentName: LIVEKIT_AGENT_NAME,
  });

  useVoiceChatSync(session, onVoiceMessage);

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }

    let cancelled = false;
    const { start, end } = session;
    const room = session.room;

    void (async () => {
      try {
        await start({ tracks: { microphone: { enabled: true } } });
        if (cancelled) {
          return;
        }
        await room.startAudio();
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("LiveKit session failed to start", error);
        onVoiceDisconnect();
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
        body: { sessionId },
      }),
    [sessionId],
  );

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    transport,
  });

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

  const handleVoiceToggle = useCallback(() => {
    if (voiceEnabled) {
      setVoiceRevealReady(false);
      void publishVoiceModeExit(session.room).catch((error) => {
        console.warn("Voice mode exit signal failed", error);
      });
      setTimeout(() => onVoiceToggle(), CHAT_FADE_MS);
      return;
    }
    onVoiceToggle();
  }, [voiceEnabled, onVoiceToggle, session.room]);

  return (
    <AgentSessionProvider session={session}>
      <VoiceAuraBridge active={voiceEnabled} />
      <StartAudioButton session={session} label="Enable audio" className="sr-only" />
      <div className="relative flex h-dvh min-h-0 flex-col">
        <ChatGreeting visible={showGreeting} />

        <motion.div
          className="relative flex min-h-0 flex-1 flex-col pb-24"
          initial={false}
          animate={{
            opacity: voiceEnabled ? 0 : 1,
            y: voiceEnabled ? 8 : 0,
          }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{ pointerEvents: voiceEnabled ? "none" : "auto" }}
          aria-hidden={voiceEnabled}
        >
          <MessageList
            messages={mergedMessages}
            isLoading={isLoading}
            onLoadOlder={onLoadOlder}
            hasMoreHistory={hasMoreHistory}
            isLoadingOlder={isLoadingOlder}
            historyStatus={historyStatus}
          />
        </motion.div>

        {!voiceEnabled ? <ChatScrollFade /> : null}

        <ChatControlBar
          onSend={handleSend}
          onVoiceToggle={handleVoiceToggle}
          voiceEnabled={voiceEnabled}
          voiceChromeReady={voiceChromeReady}
          userTrack={userTrack}
          isLoading={isLoading}
        />
      </div>
    </AgentSessionProvider>
  );
}

export function ChatPanel() {
  const {
    sessionId,
    phase,
    error,
    retry,
    historyStatus,
    rows: historyRows,
    hasMore: hasMoreHistory,
    loadOlder,
    appendLive,
  } = useChatSession();

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

  if (phase === "ready" && sessionId) {
    return (
      <div className="flex h-dvh w-full flex-col overflow-hidden">
        <TextChatArea
          key={sessionId}
          sessionId={sessionId}
          historyRows={historyRows}
          hasMoreHistory={hasMoreHistory}
          isLoadingOlder={historyStatus === "loading_more"}
          historyStatus={historyStatus}
          onLoadOlder={loadOlder}
          onVoiceMessage={appendLive}
          voiceConnectionId={voiceConnectionId}
          voiceEnabled={voiceEnabled}
          onVoiceDisconnect={handleVoiceDisconnect}
          onVoiceToggle={handleVoiceToggle}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <div className="relative flex h-dvh min-h-0 flex-col pb-24">
        {phase === "error" ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-destructive">
              {error ?? "Failed to start chat"}
            </p>
            <button
              type="button"
              className="text-sm text-foreground underline underline-offset-4"
              onClick={retry}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <ChatLoadingSpinner label="Loading chat" />
          </div>
        )}
        {!voiceEnabled ? <ChatScrollFade /> : null}
        <ChatControlBar
          onSend={() => {}}
          onVoiceToggle={handleVoiceToggle}
          voiceEnabled={voiceEnabled}
          voiceChromeReady={false}
          disabled
          isLoading={phase === "loading"}
        />
      </div>
    </div>
  );
}
