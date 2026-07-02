"use client";

import { useCallback, useRef, useState } from "react";

import {
  fetchHistoryPage,
  historyMessageToChatMessage,
  prependUniqueMessages,
  type HistoryStatus,
} from "@/lib/chat/history-api";
import type { ChatMessage } from "@/lib/stores/chat-store";

type UseChatHistoryResult = {
  rows: ChatMessage[];
  status: HistoryStatus;
  hasMore: boolean;
  nextBefore: string | null;
  error: string | null;
  loadInitial: (sessionId: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  appendLive: (message: Omit<ChatMessage, "timestamp"> & { timestamp?: number }) => void;
  reset: () => void;
};

export function useChatHistory(): UseChatHistoryResult {
  const [rows, setRows] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<HistoryStatus>("idle");
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const nextBeforeRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  const syncNextBefore = useCallback((cursor: string | null) => {
    nextBeforeRef.current = cursor;
    setNextBefore(cursor);
  }, []);

  const reset = useCallback(() => {
    sessionIdRef.current = null;
    loadingMoreRef.current = false;
    setRows([]);
    setStatus("idle");
    setHasMore(false);
    syncNextBefore(null);
    setError(null);
  }, [syncNextBefore]);

  const loadInitial = useCallback(async (sessionId: string) => {
    sessionIdRef.current = sessionId;
    loadingMoreRef.current = false;
    setStatus("loading");
    setError(null);

    try {
      const page = await fetchHistoryPage(sessionId);
      const mapped = page.messages.map(historyMessageToChatMessage);
      setRows(mapped);
      setHasMore(page.has_more);
      syncNextBefore(page.next_before);
      setStatus(page.has_more ? "ready" : "exhausted");
    } catch (err) {
      setRows([]);
      setHasMore(false);
      syncNextBefore(null);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to load history");
    }
  }, [syncNextBefore]);

  const loadOlder = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    const cursor = nextBeforeRef.current;
    if (!sessionId || !cursor || loadingMoreRef.current) {
      return;
    }

    loadingMoreRef.current = true;
    setStatus("loading_more");
    setError(null);

    try {
      const page = await fetchHistoryPage(sessionId, { before: cursor });
      const mapped = page.messages.map(historyMessageToChatMessage);
      setRows((current) => prependUniqueMessages(current, mapped));
      setHasMore(page.has_more);
      syncNextBefore(page.next_before);
      setStatus(page.has_more ? "ready" : "exhausted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load older messages";
      if (message.includes("(404)")) {
        loadingMoreRef.current = false;
        await loadInitial(sessionId);
        return;
      }
      setStatus((current) =>
        current === "loading_more" ? "ready" : current,
      );
      setError(message);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [loadInitial, syncNextBefore]);

  const appendLive = useCallback(
    (message: Omit<ChatMessage, "timestamp"> & { timestamp?: number }) => {
      const row: ChatMessage = {
        ...message,
        timestamp: message.timestamp ?? Date.now(),
      };
      setRows((current) => {
        const existingIndex = current.findIndex((item) => item.id === row.id);
        if (existingIndex === -1) {
          return [...current, row].sort((a, b) => a.timestamp - b.timestamp);
        }
        const next = [...current];
        next[existingIndex] = { ...next[existingIndex], ...row };
        return next.sort((a, b) => a.timestamp - b.timestamp);
      });
    },
    [],
  );

  return {
    rows,
    status,
    hasMore,
    nextBefore,
    error,
    loadInitial,
    loadOlder,
    appendLive,
    reset,
  };
}

export type { HistoryStatus };
