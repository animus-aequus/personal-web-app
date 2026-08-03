"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, type ReactNode } from "react";

import {
  ChatSessionError,
  ChatSessionLoading,
  PausedChatPanel,
  ReadyChatSurface,
} from "@/components/chat/chat-panel";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { AppShell } from "@/components/layout/app-shell";
import { SessionVerificationGate } from "@/components/turnstile/session-verification-gate";
import { TurnstileProvider } from "@/components/turnstile/turnstile-provider";
import { useChatSession } from "@/lib/chat/use-chat-session";

const CHAT_PATH = "/";

type SiteShellProps = {
  children: ReactNode;
};

/**
 * Shared chrome for chat and sibling pages (e.g. terms).
 * Session bootstrap + Turnstile run once for the app shell lifetime; the chat
 * surface stays mounted (hidden) while visiting other routes so context is kept.
 */
export function SiteShell({ children }: SiteShellProps) {
  return (
    <TurnstileProvider>
      <I18nProvider>
        <SiteShellInner>{children}</SiteShellInner>
      </I18nProvider>
    </TurnstileProvider>
  );
}

function SiteShellInner({ children }: SiteShellProps) {
  const pathname = usePathname();
  const showChat = pathname === CHAT_PATH;
  const {
    sessionId,
    phase,
    isReverification,
    retry,
    historyStatus,
    rows: historyRows,
    hasMore: hasMoreHistory,
    loadOlder,
    appendLive,
  } = useChatSession();

  const voiceReconnectRef = useRef<(() => void) | null>(null);

  const handleVoiceReconnectChange = useCallback(
    (reconnect: (() => void) | null) => {
      voiceReconnectRef.current = reconnect;
    },
    [],
  );

  const onVoiceReconnect = useCallback(() => {
    voiceReconnectRef.current?.();
  }, []);

  if (phase === "paused") {
    return <PausedChatPanel />;
  }

  if (phase === "verifying") {
    return <SessionVerificationGate isReverification={isReverification} />;
  }

  if (phase === "error") {
    return <ChatSessionError onRetry={retry} />;
  }

  if (phase === "ready" && sessionId) {
    return (
      <AppShell sessionId={sessionId} onVoiceReconnect={onVoiceReconnect}>
        <ReadyChatSurface
          key={sessionId}
          sessionId={sessionId}
          historyRows={historyRows}
          hasMoreHistory={hasMoreHistory}
          historyStatus={historyStatus}
          loadOlder={loadOlder}
          appendLive={appendLive}
          hidden={!showChat}
          onVoiceReconnectChange={handleVoiceReconnectChange}
        />
        {!showChat ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </div>
        ) : null}
      </AppShell>
    );
  }

  return <ChatSessionLoading />;
}
