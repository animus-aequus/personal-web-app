"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  takeStashedTurnstileToken,
  useTurnstile,
} from "@/components/turnstile/turnstile-provider";
import { type HistoryStatus, useChatHistory } from "@/lib/chat/use-chat-history";
import {
  clearHeldInviteToken,
  resolvePauseGateType,
  takeInviteToken,
} from "@/lib/chat/invite-token";
import {
  normalizeLocale,
  resolveBrowserLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import { syncSessionTimezone } from "@/lib/i18n/sync-session-timezone";
import { resolveBrowserTimezone } from "@/lib/i18n/timezone";
import {
  INVITE_INVALID_ERROR_CODE,
  PAUSED_ERROR_CODE,
  type SessionType,
} from "@/lib/public-access-config";
import {
  ASSISTANT_OFFLINE_ERROR_CODE,
  type OperatingHoursStatus,
} from "@/lib/operating-hours-config";
import {
  parseAssistantOfflineFrom503,
  resolveAssistantOfflineStatus,
} from "@/lib/operating-hours/assistant-offline";
import { useBookingCancelOtpStore } from "@/lib/stores/booking-cancel-otp-store";
import { useBookingOtpStore } from "@/lib/stores/booking-otp-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useDirectMessageStore } from "@/lib/stores/direct-message-store";
import { useHoursClosedStore } from "@/lib/stores/hours-closed-store";
import { useInvalidInviteStore } from "@/lib/stores/invalid-invite-store";
import { useInviteWelcomeStore } from "@/lib/stores/invite-welcome-store";
import { useMeetingsListStore } from "@/lib/stores/meetings-list-store";
import {
  applyAssistantPaused,
  usePublicPauseStore,
} from "@/lib/stores/public-pause-store";
import {
  TURNSTILE_ERROR_CODE,
  TURNSTILE_TOKEN_FIELD,
} from "@/lib/turnstile/turnstile-config";
import { notifyTurnstileFailureIfNeeded } from "@/lib/turnstile/turnstile-toast";

/**
 * Coarse lifecycle for the chat surface:
 * - `verifying` — Turnstile gate for a fresh visitor, or after the session cookie expired.
 * - `loading`   — session create/resume and/or initial history fetch.
 * - `ready`     — session established and initial history settled.
 * - `error`     — bootstrap or initial history failed; UI shows a retry affordance.
 *
 * Entry pause is the `/chat` RouteAccessGate, not this hook.
 */
export type ChatSessionPhase = "verifying" | "loading" | "ready" | "error";

type BootstrapStage = "verifying" | "loading";

type UseChatSessionResult = {
  sessionId: string | null;
  phase: ChatSessionPhase;
  /** True when bootstrap is re-checking after a prior/persisted session. */
  isReverification: boolean;
  /** Session create/resume returned pause after the route gate (fail-open race). */
  entryPaused: boolean;
  /** Session create returned assistant_offline after the route gate (fail-open race). */
  entryHoursClosed: OperatingHoursStatus | null;
  error: string | null;
  retry: () => void;
  acknowledgeInvalidInvite: () => void;
  historyStatus: HistoryStatus;
  rows: ReturnType<typeof useChatHistory>["rows"];
  hasMore: boolean;
  loadOlder: ReturnType<typeof useChatHistory>["loadOlder"];
  appendLive: ReturnType<typeof useChatHistory>["appendLive"];
};

class InviteInvalidClientError extends Error {
  constructor() {
    super(INVITE_INVALID_ERROR_CODE);
    this.name = "InviteInvalidClientError";
  }
}

class AssistantPausedClientError extends Error {
  constructor() {
    super(PAUSED_ERROR_CODE);
    this.name = "AssistantPausedClientError";
  }
}

class AssistantOfflineClientError extends Error {
  readonly nextOpenAt: string | null;

  constructor(nextOpenAt: string | null) {
    super(ASSISTANT_OFFLINE_ERROR_CODE);
    this.name = "AssistantOfflineClientError";
    this.nextOpenAt = nextOpenAt;
  }
}

class TurnstileRequiredClientError extends Error {
  constructor() {
    super(TURNSTILE_ERROR_CODE);
    this.name = "TurnstileRequiredClientError";
  }
}

class SessionAuthClientError extends Error {
  constructor() {
    super("session_auth_failed");
    this.name = "SessionAuthClientError";
  }
}

function normalizeInvitationName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 128);
}

async function ensureServerSession(
  persistedId: string | null,
  turnstileToken: string,
  language: LocaleCode,
  timezone: string,
  inviteToken: string | null,
): Promise<{
  sessionId: string;
  language: LocaleCode;
  timezone: string;
  sessionType: SessionType;
  invitationName: string | null;
}> {
  const body: Record<string, string> = {
    language,
    timezone,
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
    if (turnstileToken) {
      await notifyTurnstileFailureIfNeeded(response);
    }
    const text = await response.text();
    if (response.status === 401) {
      throw new SessionAuthClientError();
    }
    if (response.status === 403) {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error === INVITE_INVALID_ERROR_CODE) {
          throw new InviteInvalidClientError();
        }
        if (parsed.error === TURNSTILE_ERROR_CODE) {
          throw new TurnstileRequiredClientError();
        }
      } catch (error) {
        if (
          error instanceof InviteInvalidClientError ||
          error instanceof TurnstileRequiredClientError
        ) {
          throw error;
        }
      }
      if (text.includes(INVITE_INVALID_ERROR_CODE)) {
        throw new InviteInvalidClientError();
      }
      if (text.includes(TURNSTILE_ERROR_CODE)) {
        throw new TurnstileRequiredClientError();
      }
    }
    if (response.status === 503) {
      const offline = parseAssistantOfflineFrom503(response.status, text);
      if (offline) {
        throw new AssistantOfflineClientError(offline.nextOpenAt);
      }
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error === PAUSED_ERROR_CODE) {
          throw new AssistantPausedClientError();
        }
      } catch (error) {
        if (error instanceof AssistantPausedClientError) {
          throw error;
        }
        if (error instanceof AssistantOfflineClientError) {
          throw error;
        }
      }
      if (text.includes(PAUSED_ERROR_CODE)) {
        throw new AssistantPausedClientError();
      }
    }
    throw new Error(text);
  }

  const data = (await response.json()) as {
    session_id: string;
    language?: string;
    timezone?: string;
    session_type: SessionType;
    invitation_name?: string | null;
  };
  const sessionType: SessionType =
    data.session_type === "invited" ? "invited" : "public";
  const invitationName =
    sessionType === "invited" && inviteToken
      ? normalizeInvitationName(data.invitation_name)
      : null;
  return {
    sessionId: data.session_id,
    language: normalizeLocale(data.language, language),
    timezone: data.timezone?.trim() || timezone,
    sessionType,
    invitationName,
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
    timezone: string;
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
  useChatStore.getState().setTimezone(session.timezone);
  usePublicPauseStore.getState().setActiveType(session.sessionType);
  setSessionId(session.sessionId);

  await Promise.all([
    loadInitial(session.sessionId),
    rehydratePendingBooking(session.sessionId),
    rehydratePendingCancellations(session.sessionId),
  ]);
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
  setEntryPaused: (value: boolean) => void;
  setEntryHoursClosed: (value: OperatingHoursStatus | null) => void;
  hadReadySession: () => boolean;
};

type SessionBootstrapResult = {
  sessionId: string;
  language: LocaleCode;
  timezone: string;
  sessionType: SessionType;
  invitationName: string | null;
};

async function mintTurnstileToken(deps: {
  isCurrent: () => boolean;
  turnstileEnabled: boolean;
  acquireToken: () => Promise<string>;
  resetAfterUse: () => void;
  setBootstrapStage: (stage: BootstrapStage) => void;
}): Promise<string | null> {
  const {
    isCurrent,
    turnstileEnabled,
    acquireToken,
    resetAfterUse,
    setBootstrapStage,
  } = deps;
  if (!turnstileEnabled) {
    return "";
  }
  setBootstrapStage("verifying");
  const token = await acquireToken();
  if (!isCurrent()) {
    resetAfterUse();
    return null;
  }
  setBootstrapStage("loading");
  return token;
}

async function ensureServerSessionOrRecreate(
  persistedId: string | null,
  turnstileToken: string,
  language: LocaleCode,
  timezone: string,
  inviteToken: string | null,
  mint: () => Promise<string | null>,
  resetAfterUse: () => void,
): Promise<SessionBootstrapResult | null> {
  try {
    return await ensureServerSession(
      persistedId,
      turnstileToken,
      language,
      timezone,
      inviteToken,
    );
  } catch (error) {
    if (!(error instanceof SessionAuthClientError) || !persistedId) {
      throw error;
    }
    resetAfterUse();
    const freshToken = await mint();
    if (freshToken === null) {
      return null;
    }
    return await ensureServerSession(
      null,
      freshToken,
      language,
      timezone,
      inviteToken,
    );
  }
}

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
    setEntryPaused,
    setEntryHoursClosed,
    hadReadySession,
  } = deps;

  const mint = () =>
    mintTurnstileToken({
      isCurrent,
      turnstileEnabled,
      acquireToken,
      resetAfterUse,
      setBootstrapStage,
    });

  try {
    await useChatStore.persist.rehydrate();
    if (!isCurrent()) {
      return;
    }

    setBootstrapError(null);
    setEntryPaused(false);
    setEntryHoursClosed(null);
    setSessionId(null);
    resetHistory();
    useBookingOtpStore.getState().clear();
    useBookingCancelOtpStore.getState().clear();
    useMeetingsListStore.getState().clear();
    useDirectMessageStore.getState().clear();
    useHoursClosedStore.getState().reset();

    const inviteToken = takeInviteToken();
    const storeState = useChatStore.getState();
    const persistedId = storeState.sessionId;
    const pauseGateType = resolvePauseGateType(
      inviteToken,
      storeState.sessionType,
      persistedId,
    );

    // Early path: persisted language from rehydrate/merge, else navigator.
    const earlyLanguage = storeState.language ?? resolveBrowserLocale();
    const browserTimezone = resolveBrowserTimezone();
    if (storeState.language == null) {
      useChatStore.getState().setLanguage(earlyLanguage);
    }
    setIsReverification(Boolean(persistedId) || hadReadySession());

    let turnstileToken = takeStashedTurnstileToken() ?? "";
    if (!turnstileToken && !persistedId) {
      const minted = await mint();
      if (minted === null) {
        return;
      }
      turnstileToken = minted;
    } else {
      setBootstrapStage("loading");
    }

    if (!isCurrent()) {
      resetAfterUse();
      return;
    }

    setBootstrapStage("loading");

    try {
      let session: SessionBootstrapResult | null;
      try {
        session = await ensureServerSessionOrRecreate(
          persistedId,
          turnstileToken,
          earlyLanguage,
          browserTimezone,
          inviteToken,
          mint,
          resetAfterUse,
        );
      } catch (error) {
        if (
          error instanceof TurnstileRequiredClientError ||
          error instanceof SessionAuthClientError
        ) {
          const minted = await mint();
          if (minted === null) {
            return;
          }
          const resumeId =
            error instanceof SessionAuthClientError ? null : persistedId;
          session = await ensureServerSessionOrRecreate(
            resumeId,
            minted,
            earlyLanguage,
            browserTimezone,
            inviteToken,
            mint,
            resetAfterUse,
          );
        } else {
          throw error;
        }
      }
      if (!session) {
        return;
      }
      // Queue the welcome before any later isCurrent() bail-out or token
      // clear. A superseded Strict Mode / remount run still redeemed; the
      // follow-up bootstrap resumes without invitation_name.
      if (session.invitationName) {
        useInviteWelcomeStore.getState().show(session.invitationName);
      }
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
      if (error instanceof AssistantPausedClientError) {
        void applyAssistantPaused(pauseGateType);
        setEntryPaused(true);
        return;
      }
      if (error instanceof AssistantOfflineClientError) {
        const hours = await resolveAssistantOfflineStatus(error.nextOpenAt);
        if (!isCurrent()) {
          return;
        }
        setEntryHoursClosed(hours);
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
  const [entryPaused, setEntryPaused] = useState(false);
  const [entryHoursClosed, setEntryHoursClosed] =
    useState<OperatingHoursStatus | null>(null);

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
      setEntryPaused,
      setEntryHoursClosed,
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
        const browserTimezone = resolveBrowserTimezone();
        const resumeId = hadPriorSession ? storeState.sessionId : null;

        const mint = () =>
          mintTurnstileToken({
            isCurrent,
            turnstileEnabled,
            acquireToken,
            resetAfterUse,
            setBootstrapStage,
          });

        let session: SessionBootstrapResult | null = null;
        if (resumeId) {
          try {
            session = await ensureServerSession(
              resumeId,
              "",
              earlyLanguage,
              browserTimezone,
              null,
            );
          } catch (error) {
            if (
              !(error instanceof TurnstileRequiredClientError) &&
              !(error instanceof SessionAuthClientError)
            ) {
              throw error;
            }
          }
        }

        if (!session) {
          const turnstileToken = await mint();
          if (turnstileToken === null) {
            return;
          }
          session = await ensureServerSessionOrRecreate(
            resumeId,
            turnstileToken,
            earlyLanguage,
            browserTimezone,
            null,
            mint,
            resetAfterUse,
          );
        }
        if (!session) {
          return;
        }
        await finishReadySession(
          { isCurrent, loadInitial, setSessionId },
          session,
        );
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        if (error instanceof AssistantPausedClientError) {
          const type = useChatStore.getState().sessionType ?? "public";
          void applyAssistantPaused(type);
          setEntryPaused(true);
          return;
        }
        if (error instanceof AssistantOfflineClientError) {
          const hours = await resolveAssistantOfflineStatus(error.nextOpenAt);
          if (!isCurrent()) {
            return;
          }
          setEntryHoursClosed(hours);
          return;
        }
        console.error("Invalid-invite recovery failed:", error);
        setBootstrapError(
          error instanceof Error ? error.message : "Failed to start chat",
        );
      } finally {
        resetAfterUse();
        // Always clear — a superseded run must not leave OK permanently disabled.
        useInvalidInviteStore.getState().setRecovering(false);
      }
    })();
  }, [acquireToken, loadInitial, resetAfterUse, turnstileEnabled]);

  const phase: ChatSessionPhase =
    bootstrapError || historyStatus === "error"
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

  useEffect(() => {
    if (phase !== "ready" || !sessionId) {
      return;
    }

    const maybeSyncTimezone = () => {
      const browserTz = resolveBrowserTimezone();
      const storedTz = useChatStore.getState().timezone;
      if (storedTz === browserTz) {
        return;
      }
      void syncSessionTimezone(sessionId, browserTz);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        maybeSyncTimezone();
      }
    };

    window.addEventListener("focus", maybeSyncTimezone);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", maybeSyncTimezone);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [phase, sessionId]);

  return {
    sessionId,
    phase,
    isReverification,
    entryPaused,
    entryHoursClosed,
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
