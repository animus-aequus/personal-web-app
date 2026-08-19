import { parseRateLimitFromResponse } from "@/lib/rate-limit-client";
import type { RateLimitAction } from "@/lib/rate-limit";

const AGENT_API_BASE_URL =
  process.env.AGENT_API_BASE_URL ?? "http://localhost:8000";
const WEB_API_KEY = process.env.WEB_API_KEY ?? "";
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID ?? "";
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET ?? "";
const ADMIN_PAUSE_SECRET = process.env.ADMIN_PAUSE_SECRET ?? "";

export { RateLimitExceededError } from "@/lib/rate-limit-client";

export type AgentRequestOptions = {
  clientIp?: string;
  sessionSecret?: string;
};

function agentHeaders(options?: AgentRequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (WEB_API_KEY) {
    headers["X-API-Key"] = WEB_API_KEY;
  }
  if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = CF_ACCESS_CLIENT_SECRET;
  }
  if (options?.clientIp) {
    headers["X-Forwarded-For"] = options.clientIp;
  }
  if (options?.sessionSecret) {
    headers["X-Session-Secret"] = options.sessionSecret;
  }
  return headers;
}

/** Throw RateLimitExceededError when the agent returns 429. */
async function throwIfRateLimited(
  response: Response,
  fallbackAction: RateLimitAction = "chat",
): Promise<void> {
  const rateLimit = await parseRateLimitFromResponse(response, fallbackAction);
  if (rateLimit) {
    throw rateLimit;
  }
}

export type CreateSessionResponse = {
  session_id: string;
  thread_id: string;
  /** Authoritative session locale from the agent (en|pl|de|es|fr). */
  language?: string | null;
  /** Authoritative visitor IANA timezone from the agent. */
  timezone?: string | null;
  session_type: "public" | "invited";
  session_secret?: string | null;
  session_expires_at?: string | null;
  /** invitations.name — present only after a fresh invite_token redeem. */
  invitation_name?: string | null;
};

export type UpdateSessionResponse = {
  session_id: string;
  language: string;
  timezone: string;
};

export type AgentPauseBucket = {
  paused: boolean;
  pause_message?: string | null;
};

export type AgentClientConfig = {
  features: Record<string, boolean>;
  paused_by_type: {
    public: AgentPauseBucket;
    invited: AgentPauseBucket;
  };
};

export class InviteInvalidError extends Error {
  readonly code = "invite_invalid";

  constructor(message = "Invalid invitation") {
    super(message);
    this.name = "InviteInvalidError";
  }
}

export class AssistantPausedError extends Error {
  readonly pauseMessage: string;

  constructor(pauseMessage: string) {
    super(pauseMessage);
    this.name = "AssistantPausedError";
    this.pauseMessage = pauseMessage;
  }
}

function parseAgentErrorDetail(
  text: string,
): { error?: string; message?: string } | null {
  try {
    const parsed = JSON.parse(text) as {
      detail?: { error?: string; message?: string } | string;
      error?: string;
      message?: string;
    };
    if (parsed.detail && typeof parsed.detail === "object") {
      return {
        error: parsed.detail.error,
        message: parsed.detail.message,
      };
    }
    return { error: parsed.error, message: parsed.message };
  } catch {
    return null;
  }
}

export async function fetchAgentConfig(): Promise<AgentClientConfig> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/config`, {
    method: "GET",
    headers: agentHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Agent config fetch failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export type PauseAssistantRequest = {
  source: "manual";
  costUsd?: number;
  thresholdUsd?: number;
  alertName?: string;
  projectName?: string;
};

export type PauseAssistantResponse = {
  paused: boolean;
  changed: boolean;
};

/** Flip the agent's public access pause flag (manual operator kill-switch). */
export async function pauseAssistant(
  body: PauseAssistantRequest,
): Promise<PauseAssistantResponse> {
  if (!ADMIN_PAUSE_SECRET) {
    throw new Error("ADMIN_PAUSE_SECRET is not configured");
  }

  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/admin/pause`, {
    method: "POST",
    headers: { ...agentHeaders(), "X-Admin-Secret": ADMIN_PAUSE_SECRET },
    body: JSON.stringify({
      source: body.source,
      cost_usd: body.costUsd ?? null,
      threshold_usd: body.thresholdUsd ?? null,
      alert_name: body.alertName ?? null,
      project_name: body.projectName ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Assistant pause failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export type LangSmithAlertRequest = {
  costUsd?: number;
  thresholdUsd?: number;
  alertName?: string;
  projectName?: string;
};

export type LangSmithAlertResponse = {
  notified: boolean;
};

/** Forward a LangSmith cost alert to the agent (Telegram notify only — no pause). */
export async function notifyLangSmithAlert(
  body: LangSmithAlertRequest,
): Promise<LangSmithAlertResponse> {
  if (!ADMIN_PAUSE_SECRET) {
    throw new Error("ADMIN_PAUSE_SECRET is not configured");
  }

  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/admin/langsmith-alert`,
    {
      method: "POST",
      headers: { ...agentHeaders(), "X-Admin-Secret": ADMIN_PAUSE_SECRET },
      body: JSON.stringify({
        cost_usd: body.costUsd ?? null,
        threshold_usd: body.thresholdUsd ?? null,
        alert_name: body.alertName ?? null,
        project_name: body.projectName ?? null,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `LangSmith alert notify failed (${response.status}): ${detail}`,
    );
  }

  return response.json();
}

export const HISTORY_PAGE_SIZE = 10;

export type HistoryMeetingItem = {
  bookingId: string;
  eventName: string;
  slotStart: string;
  durationMinutes: number;
  meetUrl: string | null;
  htmlLink: string | null;
};

export type HistoryMessagePart = {
  type: "meetings_list";
  listId: string;
  meetings: HistoryMeetingItem[];
};

export type HistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system-note";
  content: string;
  sent_at: string;
  interrupted?: boolean;
  parts?: HistoryMessagePart[] | null;
  kind?: string | null;
  params?: Record<string, string> | null;
};

export type HistoryPageResponse = {
  session_id: string;
  thread_id: string;
  messages: HistoryMessage[];
  has_more: boolean;
  next_before: string | null;
};

export async function fetchChatHistory(
  sessionId: string,
  options?: { before?: string; limit?: number } & AgentRequestOptions,
): Promise<HistoryPageResponse> {
  const params = new URLSearchParams();
  const limit = options?.limit ?? HISTORY_PAGE_SIZE;
  params.set("limit", String(limit));
  if (options?.before) {
    params.set("before", options.before);
  }

  const query = params.toString();
  const url = `${AGENT_API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: agentHeaders(options),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`History fetch failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export async function createAgentSession(
  sessionId: string | undefined,
  options?: AgentRequestOptions & {
    language?: string | null;
    timezone?: string | null;
    inviteToken?: string | null;
  },
): Promise<CreateSessionResponse> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/sessions`, {
    method: "POST",
    headers: agentHeaders(options),
    body: JSON.stringify({
      session_id: sessionId ?? null,
      language: options?.language ?? null,
      timezone: options?.timezone ?? null,
      invite_token: options?.inviteToken?.trim() || null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    await throwIfRateLimited(response, "chat");
    const detail = await response.text();
    if (response.status === 403 && detail.includes("invite_invalid")) {
      throw new InviteInvalidError();
    }
    const agentError = parseAgentErrorDetail(detail);
    if (response.status === 503 && agentError?.error === "assistant_paused") {
      throw new AssistantPausedError(
        agentError.message ?? "Assistant is temporarily unavailable",
      );
    }
    throw new Error(`Session creation failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export async function updateAgentSession(
  sessionId: string,
  body: { language?: string; timezone?: string },
  options?: AgentRequestOptions,
): Promise<UpdateSessionResponse> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: agentHeaders(options),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Session update failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export async function verifyAgentSession(
  sessionId: string,
  options?: AgentRequestOptions,
): Promise<void> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/sessions/verify`, {
    method: "POST",
    headers: agentHeaders(options),
    body: JSON.stringify({ session_id: sessionId }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Session verify failed (${response.status}): ${detail}`);
  }
}

/**
 * SSE frame payload from agent API `POST /api/v1/chat/stream`.
 * Canonical spec: `docs/agent_api_contract.md` ("/chat/stream" SSE protocol).
 * Text chat only — voice and future channels use separate contracts.
 */
export type AgentStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "ui";
      widget: "otp";
      bookingId: string;
      emailMasked: string;
      expiresAt: string;
      attemptsLeft?: number;
    }
  | {
      type: "ui";
      widget: "meetings_list";
      listId: string;
      meetings: HistoryMeetingItem[];
    }
  | {
      type: "ui";
      widget: "direct_message";
      formId: string;
      name?: string;
      email?: string;
      phoneNumber?: string;
    }
  | { type: "done" }
  | { type: "error"; message?: string };

function isMeetingItem(value: unknown): value is HistoryMeetingItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const linkOk = (value: unknown) => value === null || typeof value === "string";
  return (
    typeof record.bookingId === "string" &&
    typeof record.eventName === "string" &&
    typeof record.slotStart === "string" &&
    typeof record.durationMinutes === "number" &&
    linkOk(record.meetUrl) &&
    linkOk(record.htmlLink)
  );
}

function isAgentStreamEvent(value: unknown): value is AgentStreamEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "delta") {
    return typeof record.text === "string";
  }
  if (record.type === "ui") {
    if (record.widget === "otp") {
      return (
        typeof record.bookingId === "string" &&
        typeof record.emailMasked === "string" &&
        typeof record.expiresAt === "string" &&
        (record.attemptsLeft === undefined || typeof record.attemptsLeft === "number")
      );
    }
    if (record.widget === "meetings_list") {
      return (
        typeof record.listId === "string" &&
        Array.isArray(record.meetings) &&
        record.meetings.every(isMeetingItem)
      );
    }
    if (record.widget === "direct_message") {
      return (
        typeof record.formId === "string" &&
        (record.name === undefined || typeof record.name === "string") &&
        (record.email === undefined || typeof record.email === "string") &&
        (record.phoneNumber === undefined || typeof record.phoneNumber === "string")
      );
    }
    return false;
  }
  if (record.type === "done") {
    return true;
  }
  if (record.type === "error") {
    return (
      record.message === undefined || typeof record.message === "string"
    );
  }
  return false;
}

function parseSseData(rawEvent: string): AgentStreamEvent | null {
  const dataLine = rawEvent
    .split("\n")
    .find((line) => line.startsWith("data:"));
  if (!dataLine) {
    return null;
  }
  const payload = dataLine.slice("data:".length).trim();
  if (!payload) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    return isAgentStreamEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Open the agent chat stream; throws RateLimitExceededError on 429.
 */
export async function openAgentChatStream(
  sessionId: string,
  message: string,
  options?: AgentRequestOptions,
): Promise<Response> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: agentHeaders(options),
    body: JSON.stringify({ session_id: sessionId, message }),
    cache: "no-store",
  });

  const rateLimit = await parseRateLimitFromResponse(response, "chat");
  if (rateLimit) {
    throw rateLimit;
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    const agentError = parseAgentErrorDetail(detail);
    if (response.status === 503 && agentError?.error === "assistant_paused") {
      throw new AssistantPausedError(
        agentError.message ?? "Assistant is temporarily unavailable",
      );
    }
    throw new Error(`Chat stream failed (${response.status}): ${detail}`);
  }

  return response;
}

async function* streamEventsFromResponse(
  response: Response,
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const event = parseSseData(rawEvent);
        if (!event) {
          continue;
        }
        if (event.type === "error") {
          throw new Error(event.message ?? "Agent stream error");
        }
        if (event.type === "done") {
          return;
        }
        yield event;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed after a normal `done` or client abort.
    }
    reader.releaseLock();
  }
}

/**
 * Stream SSE events from an already-open agent chat response.
 */
export async function* streamAgentChatFromResponse(
  response: Response,
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  yield* streamEventsFromResponse(response);
}

/**
 * Stream a chat turn from the agent API, yielding SSE events (text deltas + UI).
 */
export async function* streamAgentChat(
  sessionId: string,
  message: string,
  options?: AgentRequestOptions,
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  const response = await openAgentChatStream(sessionId, message, options);
  yield* streamEventsFromResponse(response);
}

export type PendingBookingResponse = {
  booking_id: string;
  email_masked: string;
  expires_at: string;
  attempts_left: number;
  event_name: string;
  slot_start: string;
};

export type SystemNoteInfo = {
  id: string;
  label: string;
  kind: string;
  sent_at: string;
  params?: Record<string, string> | null;
};

export type ConfirmBookingResponse = {
  booking_id: string;
  status: string;
  google_event_id: string | null;
  meet_url: string | null;
  html_link: string | null;
  ical_uid: string | null;
  event_name: string;
  slot_start: string;
  duration_minutes: number;
  note: SystemNoteInfo | null;
};

export type CancelBookingResponse = {
  booking_id: string;
  status: string;
  note?: SystemNoteInfo | null;
};

export async function fetchPendingBooking(
  sessionId: string,
  options?: AgentRequestOptions,
): Promise<PendingBookingResponse | null> {
  const url = `${AGENT_API_BASE_URL}/api/v1/bookings/pending?session_id=${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: agentHeaders(options),
    cache: "no-store",
  });
  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Pending booking fetch failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function confirmBooking(
  bookingId: string,
  code: string,
  options?: AgentRequestOptions,
): Promise<ConfirmBookingResponse> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/bookings/${encodeURIComponent(bookingId)}/confirm`,
    {
      method: "POST",
      headers: agentHeaders(options),
      body: JSON.stringify({ code }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await throwIfRateLimited(response, "chat");
    const detail = await response.text();
    throw new Error(`Booking confirm failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function cancelBooking(
  bookingId: string,
  options?: AgentRequestOptions,
): Promise<CancelBookingResponse> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: "POST",
      headers: agentHeaders(options),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await throwIfRateLimited(response, "chat");
    const detail = await response.text();
    throw new Error(`Booking cancel failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export type CancelRequestResponse = {
  cancellation_id: string;
  booking_id: string;
  email_masked: string;
  expires_at: string;
  attempts_left: number;
  event_name: string;
  slot_start: string;
};

export type CancellationConfirmResponse = {
  cancellation_id: string;
  booking_id: string;
  status: string;
  note?: SystemNoteInfo | null;
};

export type CancellationAbortResponse = {
  cancellation_id: string;
  booking_id: string;
  status: string;
  note?: SystemNoteInfo | null;
};

export type CancellationPendingItem = CancelRequestResponse;

export async function requestBookingCancellation(
  bookingId: string,
  options?: AgentRequestOptions,
): Promise<CancelRequestResponse> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel-request`,
    {
      method: "POST",
      headers: agentHeaders(options),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await throwIfRateLimited(response, "chat");
    const detail = await response.text();
    throw new Error(`Cancel request failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function confirmCancellation(
  cancellationId: string,
  code: string,
  options?: AgentRequestOptions,
): Promise<CancellationConfirmResponse> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/cancellations/${encodeURIComponent(cancellationId)}/confirm`,
    {
      method: "POST",
      headers: agentHeaders(options),
      body: JSON.stringify({ code }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await throwIfRateLimited(response, "chat");
    const detail = await response.text();
    throw new Error(`Cancellation confirm failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function abortCancellation(
  cancellationId: string,
  options?: AgentRequestOptions,
): Promise<CancellationAbortResponse> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/cancellations/${encodeURIComponent(cancellationId)}/abort`,
    {
      method: "POST",
      headers: agentHeaders(options),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await throwIfRateLimited(response, "chat");
    const detail = await response.text();
    throw new Error(`Cancellation abort failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function fetchPendingCancellations(
  sessionId: string,
  options?: AgentRequestOptions,
): Promise<CancellationPendingItem[]> {
  const url = `${AGENT_API_BASE_URL}/api/v1/cancellations/pending?session_id=${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: agentHeaders(options),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Pending cancellations fetch failed (${response.status}): ${detail}`,
    );
  }
  const data = (await response.json()) as { items?: CancellationPendingItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export type DirectMessageSendResponse = {
  message_id: string;
  note?: SystemNoteInfo | null;
};

export type DirectMessageCancelResponse = {
  form_id: string;
  note?: SystemNoteInfo | null;
};

export async function sendDirectMessage(
  body: {
    sessionId: string;
    formId: string;
    name: string;
    email: string;
    message: string;
    phoneNumber?: string;
  },
  options?: AgentRequestOptions,
): Promise<DirectMessageSendResponse> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/direct-messages`, {
    method: "POST",
    headers: agentHeaders(options),
    body: JSON.stringify({
      session_id: body.sessionId,
      form_id: body.formId,
      name: body.name,
      email: body.email,
      message: body.message,
      phone_number: body.phoneNumber ?? null,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const rateLimit = await parseRateLimitFromResponse(response, "direct_message");
    if (rateLimit) {
      throw rateLimit;
    }
    const detail = await response.text();
    throw new Error(`Direct message send failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function cancelDirectMessage(
  body: { sessionId: string; formId: string },
  options?: AgentRequestOptions,
): Promise<DirectMessageCancelResponse> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/direct-messages/cancel`,
    {
      method: "POST",
      headers: agentHeaders(options),
      body: JSON.stringify({
        session_id: body.sessionId,
        form_id: body.formId,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    await throwIfRateLimited(response, "chat");
    const detail = await response.text();
    throw new Error(
      `Direct message cancel failed (${response.status}): ${detail}`,
    );
  }
  return response.json();
}
