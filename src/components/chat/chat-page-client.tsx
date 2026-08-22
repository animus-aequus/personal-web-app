"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { PauseFallback } from "@/components/access/pause-fallback";
import {
  ChatSessionError,
  ChatSessionLoading,
  ReadyChatSurface,
} from "@/components/chat/chat-panel";
import { InvalidInviteModal } from "@/components/chat/invalid-invite-modal";
import { InviteWelcomeModal } from "@/components/chat/invite-welcome-modal";
import { SessionVerificationGate } from "@/components/turnstile/session-verification-gate";
import { useChatSession } from "@/lib/chat/use-chat-session";
import { ABOUT_ME_PATH } from "@/lib/site-paths";
import { useInvalidInviteStore } from "@/lib/stores/invalid-invite-store";
import { useInviteWelcomeStore } from "@/lib/stores/invite-welcome-store";
import { useVoiceChromeStore } from "@/lib/stores/voice-chrome-store";
import { useVoiceReconnectStore } from "@/lib/stores/voice-reconnect-store";

export function ChatPageClient() {
  const {
    sessionId,
    phase,
    isReverification,
    entryPaused,
    retry,
    acknowledgeInvalidInvite,
    historyStatus,
    rows: historyRows,
    hasMore: hasMoreHistory,
    loadOlder,
    appendLive,
  } = useChatSession();
  const router = useRouter();
  const invalidInviteOpen = useInvalidInviteStore((s) => s.open);
  const inviteWelcomeOpen = useInviteWelcomeStore((s) => s.open);
  const setReconnect = useVoiceReconnectStore((s) => s.setReconnect);

  const dismissEntryPause = useCallback(() => {
    router.push(ABOUT_ME_PATH);
  }, [router]);

  const handleVoiceReconnectChange = useCallback(
    (reconnect: (() => void) | null) => {
      setReconnect(reconnect);
    },
    [setReconnect],
  );

  useEffect(() => {
    return () => {
      setReconnect(null);
      useVoiceChromeStore.getState().reset();
    };
  }, [setReconnect]);

  if (entryPaused) {
    return <PauseFallback onDismiss={dismissEntryPause} />;
  }

  if (invalidInviteOpen) {
    return (
      <>
        <ChatSessionLoading />
        <InvalidInviteModal onAcknowledge={acknowledgeInvalidInvite} />
      </>
    );
  }

  if (phase === "verifying") {
    return <SessionVerificationGate isReverification={isReverification} />;
  }

  if (phase === "error") {
    return <ChatSessionError onRetry={retry} />;
  }

  if (phase === "ready" && sessionId) {
    return (
      <>
        <ReadyChatSurface
          key={sessionId}
          sessionId={sessionId}
          historyRows={historyRows}
          hasMoreHistory={hasMoreHistory}
          historyStatus={historyStatus}
          loadOlder={loadOlder}
          appendLive={appendLive}
          onVoiceReconnectChange={handleVoiceReconnectChange}
        />
        {inviteWelcomeOpen ? <InviteWelcomeModal /> : null}
      </>
    );
  }

  return <ChatSessionLoading />;
}
