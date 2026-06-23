"use client";

import { useChat } from "@ai-sdk/react";
import {
  useSession,
  useSessionMessages,
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
import { livekitRoomName } from "@/lib/livekit/room";
import {
  type ChatMessage,
  useChatStore,
} from "@/lib/stores/chat-store";

const LIVEKIT_AGENT_NAME =
  process.env.NEXT_PUBLIC_LIVEKIT_AGENT_NAME ?? "personal-voice-agent";

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

function VoiceControls({
  sessionId,
  onDisconnect,
}: {
  sessionId: string;
  onDisconnect: () => void;
}) {
  const tokenSource = useMemo(
    () => TokenSource.endpoint("/api/livekit/token"),
    [],
  );

  const session = useSession(tokenSource, {
    roomName: livekitRoomName(sessionId),
    agentName: LIVEKIT_AGENT_NAME,
  });

  const { messages: voiceMessages } = useSessionMessages(session);
  const addVoiceMessage = useChatStore((state) => state.addVoiceMessage);

  useEffect(() => {
    for (const message of voiceMessages) {
      if (message.type === "userTranscript") {
        addVoiceMessage({
          id: message.id,
          role: "user",
          content: message.message,
          timestamp: message.timestamp,
        });
      }
      if (message.type === "agentTranscript") {
        addVoiceMessage({
          id: message.id,
          role: "assistant",
          content: message.message,
          timestamp: message.timestamp,
        });
      }
    }
  }, [voiceMessages, addVoiceMessage]);

  useEffect(() => {
    void session.start().catch((error) => {
      console.error("LiveKit session failed to start", error);
      onDisconnect();
    });

    return () => {
      void session.end();
    };
  }, [session, onDisconnect]);

  return (
    <AgentSessionProvider session={session}>
      <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Voice: {session.connectionState}
            {session.isConnected ? " · connected" : ""}
          </span>
          <StartAudioButton />
        </div>
        <AgentAudioVisualizerBar />
      </div>
    </AgentSessionProvider>
  );
}

export function ChatPanel() {
  const sessionId = useChatStore((state) => state.sessionId);
  const setSessionId = useChatStore((state) => state.setSessionId);
  const storeMessages = useChatStore((state) => state.messages);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const handleVoiceDisconnect = useCallback(() => {
    setVoiceEnabled(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      if (sessionId) {
        setBootstrapping(false);
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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ sessionId }),
      }),
    [sessionId],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
  });

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId) {
        return;
      }
      await sendMessage({ text });
    },
    [sessionId, sendMessage],
  );

  const mergedMessages = useMemo(() => {
    const textMessages = messages
      .map(uiMessageToChatMessage)
      .filter((message): message is ChatMessage => message !== null);
    const voiceMessages = storeMessages.filter(
      (message) => message.source === "voice",
    );

    return [...voiceMessages, ...textMessages].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
  }, [messages, storeMessages]);

  const isLoading = status === "submitted" || status === "streaming";

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
          onClick={() => setVoiceEnabled((current) => !current)}
        >
          {voiceEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </Button>
      </header>

      {bootstrapError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {bootstrapError}
        </p>
      ) : null}

      <MessageList messages={mergedMessages} isLoading={isLoading} />

      {sessionId && voiceEnabled ? (
        <VoiceControls
          sessionId={sessionId}
          onDisconnect={handleVoiceDisconnect}
        />
      ) : null}

      <MessageInput
        onSend={handleSend}
        disabled={!sessionId || bootstrapping || !!bootstrapError}
        isLoading={isLoading}
      />
    </div>
  );
}
