"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type HistoryStatus, useChatHistory } from "@/lib/chat/use-chat-history";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useTurnstile } from "@/components/turnstile/turnstile-provider";
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

  const bootstrap = useCallback(async () => {
    const runId = ++runIdRef.current;
    setBootstrapError(null);
    resetHistory();
    useBookingOtpStore.getState().clear();

    try {
      await useChatStore.persist.rehydrate();
      const persistedId = useChatStore.getState().sessionId;

      const turnstileToken = await acquireToken();
      let activeSessionId: string;
      try {
        activeSessionId = await ensureServerSession(persistedId, turnstileToken);
      } finally {
        resetAfterUse();
      }

      if (runId !== runIdRef.current) {
        return;
      }

      useChatStore.getState().setSessionId(activeSessionId);
      setSessionId(activeSessionId);

      await Promise.all([
        loadInitial(activeSessionId),
        rehydratePendingBooking(activeSessionId),
      ]);
    } catch (error) {
      if (runId !== runIdRef.current) {
        return;
      }
      setBootstrapError(
        error instanceof Error ? error.message : "Failed to start chat",
      );
    }
  }, [acquireToken, loadInitial, resetAfterUse, resetHistory]);

  useEffect(() => {
    (() => bootstrap())();
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
