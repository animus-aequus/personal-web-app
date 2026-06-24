"use client";

import { useChat } from "@ai-sdk/react";
import {
  useSession,
  useSessionMessages,
  type ReceivedMessage,
  type UseSessionReturn,
} from "@livekit/components-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Mic, MicOff } from "lucide-react";
import { TokenSource } from "livekit-client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AgentAudioVisualizerBar } from "@/components/agents-ui/agent-audio-visualizer-bar";
import { AgentSessionProvider } from "@/components/agents-ui/agent-session-provider";
import { StartAudioButton } from "@/components/agents-ui/start-audio-button";
import { MessageInput } from "@/components/chat/message-input";
import { MessageList } from "@/components/chat/message-list";
import { Button } from "@/components/ui/button";
import { livekitRoomName, livekitVoiceRoomName } from "@/lib/livekit/room";
import { useVoiceChatSync } from "@/lib/livekit/voice-chat-sync";
import {
  type ChatMessage,
  useChatStore,
} from "@/lib/stores/chat-store";

const LIVEKIT_AGENT_NAME =
  process.env.NEXT_PUBLIC_LIVEKIT_AGENT_NAME ?? "personal-voice-agent";

function latestUserTranscript(messages: ReceivedMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type === "userTranscript" && message.message.trim()) {
      return message.message.trim();
    }
  }
  return null;
}

function uiMessageToChatMessage(message: UIMessage): ChatMessage | null {
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
    timestamp: Date.now(),
  };
}

function VoicePanel({ session }: { session: UseSessionReturn }) {
  const { messages: sessionMessages } = useSessionMessages(session);
  const liveTranscript = latestUserTranscript(sessionMessages);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Voice: {session.connectionState}
          {session.isConnected ? " · connected" : ""}
        </span>
        <StartAudioButton session={session} />
      </div>
      <AgentAudioVisualizerBar />
      {liveTranscript ? (
        <p className="truncate text-xs text-muted-foreground">
          Hearing: {liveTranscript}
        </p>
      ) : null}
    </div>
  );
}

type TextChatAreaProps = {
  sessionId: string;
  voiceConnectionId: string | null;
  voiceMessages: ChatMessage[];
  voiceEnabled: boolean;
  onVoiceDisconnect: () => void;
};

/**
 * Mounted only after sessionId exists so useChat + DefaultChatTransport are
 * created with the correct sessionId (useChat keeps the initial transport).
 */
function TextChatArea({
  sessionId,
  voiceConnectionId,
  voiceMessages,
  voiceEnabled,
  onVoiceDisconnect,
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

  const { start, end } = session;

  useVoiceChatSync(session);

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await start();
        if (cancelled) {
          return;
        }
        await session.room.startAudio();
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
      void end();
    };
  }, [voiceEnabled, voiceConnectionId, start, end, onVoiceDisconnect, session.room]);

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
      .map(uiMessageToChatMessage)
      .filter((message): message is ChatMessage => message !== null);

    return [...voiceMessages, ...textMessages].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
  }, [messages, voiceMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <>
      <MessageList messages={mergedMessages} isLoading={isLoading} />

      {voiceEnabled ? (
        <AgentSessionProvider session={session}>
          <VoicePanel session={session} />
        </AgentSessionProvider>
      ) : null}

      <MessageInput onSend={handleSend} isLoading={isLoading} />
    </>
  );
}

export function ChatPanel() {
  const sessionId = useChatStore((state) => state.sessionId);
  const setSessionId = useChatStore((state) => state.setSessionId);
  const storeMessages = useChatStore((state) => state.messages);
  const voiceMessages = useMemo(
    () => storeMessages.filter((message) => message.source === "voice"),
    [storeMessages],
  );
  const [bootstrapping, setBootstrapping] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceConnectionId, setVoiceConnectionId] = useState<string | null>(
    null,
  );
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      if (sessionId) {
        setBootstrapping((current) => (current ? false : current));
        return;
      }

      try {
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = (await response.json()) as { session_id: string };
        if (!cancelled) {
          setSessionId(data.session_id);
        }
      } catch (error) {
        if (!cancelled) {
          setBootstrapError(
            error instanceof Error ? error.message : "Failed to create session",
          );
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setSessionId]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Personal Assistant</h1>
          <p className="text-xs text-muted-foreground">
            {bootstrapping
              ? "Starting session…"
              : sessionId
                ? `Session ${sessionId.slice(0, 8)}…`
                : "No session"}
          </p>
        </div>
        <Button
          type="button"
          variant={voiceEnabled ? "default" : "outline"}
          size="icon"
          aria-pressed={voiceEnabled}
          aria-label={voiceEnabled ? "Turn voice off" : "Turn voice on"}
          disabled={!sessionId || bootstrapping}
          onClick={handleVoiceToggle}
        >
          {voiceEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </Button>
      </header>

      {bootstrapError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {bootstrapError}
        </p>
      ) : null}

      {sessionId && !bootstrapping && !bootstrapError ? (
        <TextChatArea
          key={sessionId}
          sessionId={sessionId}
          voiceConnectionId={voiceConnectionId}
          voiceMessages={voiceMessages}
          voiceEnabled={voiceEnabled}
          onVoiceDisconnect={handleVoiceDisconnect}
        />
      ) : (
        <MessageList messages={voiceMessages} isLoading={bootstrapping} />
      )}
    </div>
  );
}
