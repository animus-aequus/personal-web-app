"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTurnstile } from "@/components/turnstile/turnstile-provider";
import { type HistoryStatus, useChatHistory } from "@/lib/chat/use-chat-history";
import {
  normalizeLocale,
  resolveBrowserLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import {
  INVITE_INVALID_ERROR_CODE,
  bucketForType,
  type SessionType,
} from "@/lib/public-access-config";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
import { useInvalidInviteStore } from "@/lib/stores/invalid-invite-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";
import {
  fetchPublicStatus,
  usePublicPauseStore,
} from "@/lib/stores/public-pause-store";
import { TURNSTILE_TOKEN_FIELD } from "@/lib/turnstile/turnstile-config";
import { notifyTurnstileFailureIfNeeded } from "@/lib/turnstile/turnstile-toast";

/**
 * Coarse lifecycle for the chat surface:
 * - `paused`    — relevant access bucket is paused; nothing is created (zero cost).
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
  acknowledgeInvalidInvite: () => void;
  historyStatus: HistoryStatus;
  rows: ReturnType<typeof useChatHistory>["rows"];
  hasMore: boolean;
  loadOlder: ReturnType<typeof useChatHistory>["loadOlder"];
  appendLive: ReturnType<typeof useChatHistory>["appendLive"];
};

/** Survives Strict Mode remount / bootstrap restart after URL strip. */
const PENDING_INVITE_STORAGE_KEY = "pending_invite_token";

function readInviteTokenFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get("invite");
  const trimmed = raw?.trim();
  return trimmed || null;
}

function stripInviteFromUrl(): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has("invite")) {
    return;
  }
  url.searchParams.delete("invite");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

function readHeldInviteToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const held = sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)?.trim();
    return held || null;
  } catch {
    return null;
  }
}

function holdInviteToken(token: string): void {
  try {
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
  } catch {
    // Private mode / quota — URL strip still applies; token stays in memory.
  }
}

function clearHeldInviteToken(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Take invite from URL (preferred) or sessionStorage hold.
 * Strips ``?invite=`` immediately to reduce Referer leakage.
 */
function takeInviteToken(): string | null {
  const fromUrl = readInviteTokenFromUrl();
  if (fromUrl) {
    holdInviteToken(fromUrl);
    stripInviteFromUrl();
    return fromUrl;
  }
  return readHeldInviteToken();
}

function resolvePauseGateType(
  inviteToken: string | null,
  persistedType: SessionType | null,
  persistedId: string | null,
): SessionType {
  if (inviteToken) {
    return "invited";
  }
  if (persistedType === "invited" && persistedId) {
    return "invited";
  }
  return "public";
}

class InviteInvalidClientError extends Error {
  constructor() {
    super(INVITE_INVALID_ERROR_CODE);
    this.name = "InviteInvalidClientError";
  }
}

async function ensureServerSession(
  persistedId: string | null,
  turnstileToken: string,
  language: LocaleCode,
  inviteToken: string | null,
): Promise<{
  sessionId: string;
  language: LocaleCode;
  sessionType: SessionType;
}> {
  const body: Record<string, string> = {
    language,
  };
  if (persistedId) {
    body.session_id = persistedId;
  }
  if (turnstileToken) {
    body[TURNSTILE_TOKEN_FIELD] = turnstileToken;
  }
  if (inviteToken) {
    body.invite_token = inviteToken;
  }

  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await notifyTurnstileFailureIfNeeded(response);
    const text = await response.text();
    if (response.status === 403) {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error === INVITE_INVALID_ERROR_CODE) {
          throw new InviteInvalidClientError();
        }
      } catch (error) {
        if (error instanceof InviteInvalidClientError) {
          throw error;
        }
      }
      if (text.includes(INVITE_INVALID_ERROR_CODE)) {
        throw new InviteInvalidClientError();
      }
    }
    throw new Error(text);
  }

  const data = (await response.json()) as {
    session_id: string;
    language?: string;
    session_type: SessionType;
  };
  const sessionType: SessionType =
    data.session_type === "invited" ? "invited" : "public";
  return {
    sessionId: data.session_id,
    language: normalizeLocale(data.language, language),
    sessionType,
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

async function finishReadySession(
  deps: Pick<
    BootstrapDeps,
    "isCurrent" | "loadInitial" | "setSessionId"
  >,
  session: {
    sessionId: string;
    language: LocaleCode;
    sessionType: SessionType;
  },
): Promise<void> {
  const { isCurrent, loadInitial, setSessionId } = deps;
  if (!isCurrent()) {
    return;
  }

  useChatStore.getState().setSessionId(session.sessionId);
  useChatStore.getState().setSessionType(session.sessionType);
  useChatStore.getState().setLanguage(session.language);
  usePublicPauseStore.getState().setActiveType(session.sessionType);
  setSessionId(session.sessionId);

  await Promise.all([
    loadInitial(session.sessionId),
    rehydratePendingBooking(session.sessionId),
    rehydratePendingCancellations(session.sessionId),
  ]);
  if (!isCurrent()) {
    return;
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

    const inviteToken = takeInviteToken();
    const storeState = useChatStore.getState();
    const persistedId = storeState.sessionId;
    const persistedType = storeState.sessionType;
    const pauseGateType = resolvePauseGateType(
      inviteToken,
      persistedType,
      persistedId,
    );

    // Before Turnstile and session creation: a paused assistant must not cost
    // a Turnstile verification, an Upstash command or a session row.
    const publicStatus = await fetchPublicStatus();
    if (!isCurrent()) {
      return;
    }
    usePublicPauseStore.getState().setStatus(publicStatus, pauseGateType);
    if (bucketForType(publicStatus, pauseGateType).paused) {
      setBootstrapStage("paused");
      return;
    }

    // Early path: persisted language from rehydrate/merge, else navigator.
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
      resetAfterUse();
      return;
    }

    setBootstrapStage("loading");

    try {
      const session = await ensureServerSession(
        persistedId,
        turnstileToken,
        earlyLanguage,
        inviteToken,
      );
      clearHeldInviteToken();
      await finishReadySession(
        { isCurrent, loadInitial, setSessionId },
        session,
      );
    } catch (error) {
      if (error instanceof InviteInvalidClientError) {
        clearHeldInviteToken();
        useInvalidInviteStore.getState().show(Boolean(persistedId));
        // Keep prior session id in the Zustand store; React sessionId stays null
        // until the user acknowledges the dialog (resume or fresh public).
        setBootstrapStage("loading");
        return;
      }
      throw error;
    } finally {
      resetAfterUse();
    }
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

  const acknowledgeInvalidInvite = useCallback(() => {
    const { hadPriorSession, dismiss, recovering, setRecovering } =
      useInvalidInviteStore.getState();
    if (recovering) {
      return;
    }
    setRecovering(true);
    dismiss();

    void (async () => {
      const runId = ++runIdRef.current;
      const isCurrent = () => runId === runIdRef.current;
      try {
        setBootstrapError(null);
        setBootstrapStage("loading");

        await useChatStore.persist.rehydrate();
        if (!isCurrent()) {
          return;
        }

        const storeState = useChatStore.getState();
        const earlyLanguage = storeState.language ?? resolveBrowserLocale();
        const resumeId = hadPriorSession ? storeState.sessionId : null;

        if (turnstileEnabled) {
          setBootstrapStage("verifying");
        }
        const turnstileToken = await acquireToken();
        if (!isCurrent()) {
          resetAfterUse();
          return;
        }
        setBootstrapStage("loading");

        try {
          let session;
          try {
            session = await ensureServerSession(
              resumeId,
              turnstileToken,
              earlyLanguage,
              null,
            );
          } catch (error) {
            const staleSession =
              resumeId &&
              error instanceof Error &&
              error.message.includes("(401)");
            if (!staleSession) {
              throw error;
            }
            // Turnstile tokens are single-use — mint a fresh one for create.
            resetAfterUse();
            const freshToken = await acquireToken();
            if (!isCurrent()) {
              resetAfterUse();
              return;
            }
            session = await ensureServerSession(
              null,
              freshToken,
              earlyLanguage,
              null,
            );
          }
          await finishReadySession(
            { isCurrent, loadInitial, setSessionId },
            session,
          );
        } finally {
          resetAfterUse();
        }
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        console.error("Invalid-invite recovery failed:", error);
        setBootstrapError(
          error instanceof Error ? error.message : "Failed to start chat",
        );
      } finally {
        // Always clear — a superseded run must not leave OK permanently disabled.
        useInvalidInviteStore.getState().setRecovering(false);
      }
    })();
  }, [acquireToken, loadInitial, resetAfterUse, turnstileEnabled]);

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
    acknowledgeInvalidInvite,
    historyStatus,
    rows,
    hasMore,
    loadOlder,
    appendLive,
  };
}
