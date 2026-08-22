"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ChatSessionError } from "@/components/chat/chat-panel";
import { SessionVerificationGate } from "@/components/turnstile/session-verification-gate";
import {
  stashTurnstileToken,
  useTurnstile,
} from "@/components/turnstile/turnstile-provider";

type AppHumanGateProps = {
  children: ReactNode;
};

type UnlockDeps = {
  isCurrent: () => boolean;
  acquireToken: () => Promise<string>;
  setUnlocked: (value: boolean) => void;
  setFailed: (value: boolean) => void;
};

async function unlockAppHumanGate(deps: UnlockDeps): Promise<void> {
  const { isCurrent, acquireToken, setUnlocked, setFailed } = deps;
  try {
    const token = await acquireToken();
    if (!isCurrent()) {
      return;
    }
    stashTurnstileToken(token);
    setFailed(false);
    setUnlocked(true);
  } catch (error) {
    if (!isCurrent()) {
      return;
    }
    console.error("App Turnstile unlock failed:", error);
    setFailed(true);
  }
}

/**
 * App-level Turnstile: must pass before any (site) view, including static pages.
 * Token is stashed for the next ``POST /api/session`` — not consumed here.
 */
export function AppHumanGate({ children }: AppHumanGateProps) {
  const { enabled, acquireToken } = useTurnstile();
  const [unlocked, setUnlocked] = useState(!enabled);
  const [failed, setFailed] = useState(false);
  const runIdRef = useRef(0);

  const unlock = useCallback(() => {
    const runId = ++runIdRef.current;
    return unlockAppHumanGate({
      isCurrent: () => runId === runIdRef.current,
      acquireToken,
      setUnlocked,
      setFailed,
    });
  }, [acquireToken]);

  useEffect(() => {
    if (unlocked || !enabled) {
      return;
    }
    void unlock();
    return () => {
      runIdRef.current += 1;
    };
  }, [enabled, unlock, unlocked]);

  if (unlocked) {
    return children;
  }

  if (failed) {
    return (
      <ChatSessionError
        onRetry={() => {
          setFailed(false);
          void unlock();
        }}
      />
    );
  }

  return <SessionVerificationGate isReverification={false} />;
}
