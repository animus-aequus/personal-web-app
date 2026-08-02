"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTurnstile } from "@/components/turnstile/turnstile-provider";
import { type HistoryStatus, useChatHistory } from "@/lib/chat/use-chat-history";
import {
  normalizeLocale,
  resolveBrowserLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";
import {
  fetchPublicStatus,
  usePublicPauseStore,
} from "@/lib/stores/public-pause-store";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile/turnstile-config";
import { notifyTurnstileFailureIfNeeded } from "@/lib/turnstile/turnstile-toast";

/**
 * Coarse lifecycle for the chat surface:
 * - `paused`    — public access is paused; nothing is created (zero cost).
 * - `verifying` — Turnstile gate (human check) before session create/resume.
 * - `loading`   — session create/resume and/or initial history fetch.
 * - `ready`     — session established and initial history settled.
 * - `error`     — bootstrap or initial history failed; UI shows a retry affordance.
 */
export type ChatSessionPhase =
  | "paused"
  | "verifying"
  | "loading"
  | "ready"
  | "error";

type BootstrapStage = "verifying" | "loading" | "paused";

type UseChatSessionResult = {
  sessionId: string | null;
  phase: ChatSessionPhase;
  /** True when bootstrap is re-checking after a prior/persisted session. */
  isReverification: boolean;
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
  language: LocaleCode,
): Promise<{ sessionId: string; language: LocaleCode }> {
  const body: Record<string, string> = {
    language,
  };
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

  const data = (await response.json()) as {
    session_id: string;
    language?: string;
  };
  return {
    sessionId: data.session_id,
    // Server is authoritative once a session exists (DB wins over early path).
    language: normalizeLocale(data.language, language),
  };
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
  turnstileEnabled: boolean;
  acquireToken: () => Promise<string>;
  resetAfterUse: () => void;
  loadInitial: (sessionId: string) => Promise<void>;
  resetHistory: () => void;
  setSessionId: (sessionId: string | null) => void;
  setBootstrapError: (error: string | null) => void;
  setBootstrapStage: (stage: BootstrapStage) => void;
  setIsReverification: (value: boolean) => void;
  hadReadySession: () => boolean;
};

/**
 * Session bootstrap. React setState runs only after the first await so this is
 * safe to kick off from a mount effect (no synchronous setState in the effect).
 */
async function bootstrapChatSession(deps: BootstrapDeps): Promise<void> {
  const {
    isCurrent,
    turnstileEnabled,
    acquireToken,
    resetAfterUse,
    loadInitial,
    resetHistory,
    setSessionId,
    setBootstrapError,
    setBootstrapStage,
    setIsReverification,
    hadReadySession,
  } = deps;

  try {
    await useChatStore.persist.rehydrate();
    if (!isCurrent()) {
      return;
    }

    setBootstrapError(null);
    setSessionId(null);
    resetHistory();
    useBookingOtpStore.getState().clear();
    useBookingCancelOtpStore.getState().clear();
    useMeetingsListStore.getState().clear();
    useDirectMessageStore.getState().clear();

    // Before Turnstile and session creation: a paused assistant must not cost
    // a Turnstile verification, an Upstash command or a session row.
    const publicStatus = await fetchPublicStatus();
    if (!isCurrent()) {
      return;
    }
    usePublicPauseStore.getState().setStatus(publicStatus);
    if (publicStatus.paused) {
      setBootstrapStage("paused");
      return;
    }

    const storeState = useChatStore.getState();
    const persistedId = storeState.sessionId;
    // Early path: persisted language from rehydrate/merge, else navigator.
    // Store starts as null when storage is empty (persist skips merge then).
    const earlyLanguage = storeState.language ?? resolveBrowserLocale();
    if (storeState.language == null) {
      useChatStore.getState().setLanguage(earlyLanguage);
    }
    setIsReverification(Boolean(persistedId) || hadReadySession());

    if (turnstileEnabled) {
      setBootstrapStage("verifying");
    } else {
      setBootstrapStage("loading");
    }

    const turnstileToken = await acquireToken();
    if (!isCurrent()) {
      // Stale run (e.g. Strict Mode remount) — do not create a second session.
      resetAfterUse();
      return;
    }

    setBootstrapStage("loading");

    let activeSessionId: string;
    let sessionLanguage: LocaleCode;
    try {
      const session = await ensureServerSession(
        persistedId,
        turnstileToken,
        earlyLanguage,
      );
      activeSessionId = session.sessionId;
      sessionLanguage = session.language;
    } finally {
      resetAfterUse();
    }

    if (!isCurrent()) {
      return;
    }

    useChatStore.getState().setSessionId(activeSessionId);
    useChatStore.getState().setLanguage(sessionLanguage);
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
    console.error("Chat session bootstrap failed:", error);
    setBootstrapError(
      error instanceof Error ? error.message : "Failed to start chat",
    );
  }
}

export function useChatSession(): UseChatSessionResult {
  const { enabled: turnstileEnabled, acquireToken, resetAfterUse } =
    useTurnstile();
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
  const [bootstrapStage, setBootstrapStage] =
    useState<BootstrapStage>("loading");
  const [isReverification, setIsReverification] = useState(false);

  // Guards against overlapping bootstraps (React Strict Mode double-invoke,
  // retries): only the latest run may commit state.
  const runIdRef = useRef(0);
  const hadReadySessionRef = useRef(false);

  const startBootstrap = useCallback(() => {
    const runId = ++runIdRef.current;
    return bootstrapChatSession({
      isCurrent: () => runId === runIdRef.current,
      turnstileEnabled,
      acquireToken,
      resetAfterUse,
      loadInitial,
      resetHistory,
      setSessionId,
      setBootstrapError,
      setBootstrapStage,
      setIsReverification,
      hadReadySession: () => hadReadySessionRef.current,
    });
  }, [
    acquireToken,
    loadInitial,
    resetAfterUse,
    resetHistory,
    turnstileEnabled,
  ]);

  useEffect(() => {
    void startBootstrap();
    return () => {
      runIdRef.current += 1;
    };
  }, [startBootstrap]);

  const phase: ChatSessionPhase =
    bootstrapStage === "paused"
      ? "paused"
      : bootstrapError || historyStatus === "error"
        ? "error"
        : sessionId &&
            (historyStatus === "ready" ||
              historyStatus === "exhausted" ||
              historyStatus === "loading_more")
          ? "ready"
          : bootstrapStage === "verifying"
            ? "verifying"
            : "loading";

  useEffect(() => {
    if (phase === "ready") {
      hadReadySessionRef.current = true;
    }
  }, [phase]);

  useEffect(() => {
    if (historyStatus === "error" && historyError) {
      console.error("Chat history load failed:", historyError);
    }
  }, [historyError, historyStatus]);

  return {
    sessionId,
    phase,
    isReverification,
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
