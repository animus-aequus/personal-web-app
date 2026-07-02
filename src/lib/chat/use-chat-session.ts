"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type HistoryStatus, useChatHistory } from "@/lib/chat/use-chat-history";
import { useChatStore } from "@/lib/stores/chat-store";

/**
 * Coarse lifecycle for the chat surface, derived from the bootstrap sequence and
 * the initial history load:
 * - `loading`  — hydrating storage, creating/resuming the session, or fetching
 *                the first history page. UI shows a spinner and disables input.
 * - `ready`    — session established and initial history settled (possibly empty).
 *                UI mounts the chat; an empty thread shows the greeting.
 * - `error`    — bootstrap or initial history failed; UI shows a retry affordance.
 */
export type ChatSessionPhase = "loading" | "ready" | "error";

type UseChatSessionResult = {
  sessionId: string | null;
  phase: ChatSessionPhase;
  error: string | null;
  retry: () => void;
  historyStatus: HistoryStatus;
  rows: ReturnType<typeof useChatHistory>["rows"];
  hasMore: boolean;
  loadOlder: ReturnType<typeof useChatHistory>["loadOlder"];
  appendLive: ReturnType<typeof useChatHistory>["appendLive"];
};

async function ensureServerSession(
  persistedId: string | null,
): Promise<string> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(persistedId ? { session_id: persistedId } : {}),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = (await response.json()) as { session_id: string };
  return data.session_id;
}

export function useChatSession(): UseChatSessionResult {
  const {
    rows,
    status: historyStatus,
    hasMore,
    error: historyError,
    loadInitial,
    loadOlder,
    appendLive,
    reset: resetHistory,
  } = useChatHistory();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Guards against overlapping bootstraps (React Strict Mode double-invoke,
  // retries): only the latest run may commit state.
  const runIdRef = useRef(0);

  const bootstrap = useCallback(async () => {
    const runId = ++runIdRef.current;
    setBootstrapError(null);
    resetHistory();

    try {
      await useChatStore.persist.rehydrate();
      const persistedId = useChatStore.getState().sessionId;

      const activeSessionId = await ensureServerSession(persistedId);
      if (runId !== runIdRef.current) {
        return;
      }

      useChatStore.getState().setSessionId(activeSessionId);
      setSessionId(activeSessionId);

      await loadInitial(activeSessionId);
    } catch (error) {
      if (runId !== runIdRef.current) {
        return;
      }
      setBootstrapError(
        error instanceof Error ? error.message : "Failed to start chat",
      );
    }
  }, [loadInitial, resetHistory]);

  useEffect(() => {
    void bootstrap();
    return () => {
      // Invalidate the in-flight run so its late resolution cannot commit.
      runIdRef.current += 1;
    };
  }, [bootstrap]);

  const phase: ChatSessionPhase =
    bootstrapError || historyStatus === "error"
      ? "error"
      : sessionId &&
          (historyStatus === "ready" ||
            historyStatus === "exhausted" ||
            historyStatus === "loading_more")
        ? "ready"
        : "loading";

  return {
    sessionId,
    phase,
    error: bootstrapError ?? historyError,
    retry: () => {
      void bootstrap();
    },
    historyStatus,
    rows,
    hasMore,
    loadOlder,
    appendLive,
  };
}
