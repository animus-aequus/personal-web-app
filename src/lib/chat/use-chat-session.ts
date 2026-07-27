"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTurnstile } from "@/components/turnstile/turnstile-provider";
import { type HistoryStatus, useChatHistory } from "@/lib/chat/use-chat-history";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile/turnstile-config";
import { notifyTurnstileFailureIfNeeded } from "@/lib/turnstile/turnstile-toast";

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
  turnstileToken: string,
): Promise<string> {
  const body: Record<string, string> = {};
  if (persistedId) {
    body.session_id = persistedId;
  }
  if (turnstileToken) {
    body[TURNSTILE_TOKEN_FIELD] = turnstileToken;
  }

  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await notifyTurnstileFailureIfNeeded(response);
    throw new Error(await response.text());
  }

  const data = (await response.json()) as { session_id: string };
  return data.session_id;
}

async function rehydratePendingBooking(sessionId: string): Promise<void> {
  try {
    const response = await fetch(
      `/api/bookings/pending?sessionId=${encodeURIComponent(sessionId)}`,
      { cache: "no-store" },
    );
    if (response.status === 204) {
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      booking_id: string;
      email_masked: string;
      expires_at: string;
      attempts_left: number;
      event_name?: string;
      slot_start?: string;
    };
    useBookingOtpStore.getState().setFromPayload({
      bookingId: data.booking_id,
      emailMasked: data.email_masked,
      expiresAt: data.expires_at,
      attemptsLeft: data.attempts_left,
      eventName: data.event_name,
      slotStart: data.slot_start,
    });
  } catch {
    // Non-fatal — OTP widget simply won't rehydrate.
  }
}

async function rehydratePendingCancellations(sessionId: string): Promise<void> {
  try {
    const response = await fetch(
      `/api/cancellations/pending?sessionId=${encodeURIComponent(sessionId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as {
      items?: Array<{
        cancellation_id: string;
        booking_id: string;
        email_masked: string;
        expires_at: string;
        attempts_left: number;
        event_name: string;
        slot_start: string;
      }>;
    };
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return;
    }
    useBookingCancelOtpStore.getState().upsertMany(
      data.items.map((item) => ({
        cancellationId: item.cancellation_id,
        bookingId: item.booking_id,
        emailMasked: item.email_masked,
        expiresAt: item.expires_at,
        attemptsLeft: item.attempts_left,
        eventName: item.event_name,
        slotStart: item.slot_start,
      })),
    );
  } catch {
    // Non-fatal — cancel OTP widgets simply won't rehydrate.
  }
}

type BootstrapDeps = {
  isCurrent: () => boolean;
  acquireToken: () => Promise<string>;
  resetAfterUse: () => void;
  loadInitial: (sessionId: string) => Promise<void>;
  resetHistory: () => void;
  setSessionId: (sessionId: string) => void;
  setBootstrapError: (error: string | null) => void;
};

/**
 * Session bootstrap. React setState runs only after the first await so this is
 * safe to kick off from a mount effect (no synchronous setState in the effect).
 */
async function bootstrapChatSession(deps: BootstrapDeps): Promise<void> {
  const {
    isCurrent,
    acquireToken,
    resetAfterUse,
    loadInitial,
    resetHistory,
    setSessionId,
    setBootstrapError,
  } = deps;

  try {
    await useChatStore.persist.rehydrate();
    if (!isCurrent()) {
      return;
    }

    setBootstrapError(null);
    resetHistory();
    useBookingOtpStore.getState().clear();
    useBookingCancelOtpStore.getState().clear();
    useMeetingsListStore.getState().clear();
    useDirectMessageStore.getState().clear();

    const persistedId = useChatStore.getState().sessionId;

    const turnstileToken = await acquireToken();
    if (!isCurrent()) {
      // Stale run (e.g. Strict Mode remount) — do not create a second session.
      resetAfterUse();
      return;
    }

    let activeSessionId: string;
    try {
      activeSessionId = await ensureServerSession(persistedId, turnstileToken);
    } finally {
      resetAfterUse();
    }

    if (!isCurrent()) {
      return;
    }

    useChatStore.getState().setSessionId(activeSessionId);
    setSessionId(activeSessionId);

    await Promise.all([
      loadInitial(activeSessionId),
      rehydratePendingBooking(activeSessionId),
      rehydratePendingCancellations(activeSessionId),
    ]);
  } catch (error) {
    if (!isCurrent()) {
      return;
    }
    setBootstrapError(
      error instanceof Error ? error.message : "Failed to start chat",
    );
  }
}

export function useChatSession(): UseChatSessionResult {
  const { acquireToken, resetAfterUse } = useTurnstile();
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

  const startBootstrap = useCallback(() => {
    const runId = ++runIdRef.current;
    return bootstrapChatSession({
      isCurrent: () => runId === runIdRef.current,
      acquireToken,
      resetAfterUse,
      loadInitial,
      resetHistory,
      setSessionId,
      setBootstrapError,
    });
  }, [acquireToken, loadInitial, resetAfterUse, resetHistory]);

  useEffect(() => {
    void startBootstrap();
    return () => {
      runIdRef.current += 1;
    };
  }, [startBootstrap]);

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
      void startBootstrap();
    },
    historyStatus,
    rows,
    hasMore,
    loadOlder,
    appendLive,
  };
}
