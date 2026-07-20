const AGENT_API_BASE_URL =
  process.env.AGENT_API_BASE_URL ?? "http://localhost:8000";
const WEB_API_KEY = process.env.WEB_API_KEY ?? "";

export type AgentRequestOptions = {
  clientIp?: string;
  sessionSecret?: string;
};

function agentHeaders(options?: AgentRequestOptions): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (WEB_API_KEY) {
    headers["X-API-Key"] = WEB_API_KEY;
  }
  if (options?.clientIp) {
    headers["X-Forwarded-For"] = options.clientIp;
  }
  if (options?.sessionSecret) {
    headers["X-Session-Secret"] = options.sessionSecret;
  }
  return headers;
}

export type CreateSessionResponse = {
  session_id: string;
  thread_id: string;
  session_secret?: string | null;
  session_expires_at?: string | null;
};

export const HISTORY_PAGE_SIZE = 10;

export type HistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sent_at: string;
  interrupted?: boolean;
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
  options?: AgentRequestOptions,
): Promise<CreateSessionResponse> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/sessions`, {
    method: "POST",
    headers: agentHeaders(options),
    body: JSON.stringify({ session_id: sessionId ?? null }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Session creation failed (${response.status}): ${detail}`);
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
  | { type: "done" }
  | { type: "error"; message?: string };

function isAgentStreamEvent(value: unknown): value is AgentStreamEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "delta") {
    return typeof record.text === "string";
  }
  if (record.type === "ui") {
    return (
      record.widget === "otp" &&
      typeof record.bookingId === "string" &&
      typeof record.emailMasked === "string" &&
      typeof record.expiresAt === "string" &&
      (record.attemptsLeft === undefined || typeof record.attemptsLeft === "number")
    );
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
 * Stream a chat turn from the agent API, yielding SSE events (text deltas + UI).
 */
export async function* streamAgentChat(
  sessionId: string,
  message: string,
  options?: AgentRequestOptions,
): AsyncGenerator<AgentStreamEvent, void, unknown> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: agentHeaders(options),
    body: JSON.stringify({ session_id: sessionId, message }),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Chat stream failed (${response.status}): ${detail}`);
  }

  const reader = response.body.getReader();
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

export type PendingBookingResponse = {
  booking_id: string;
  email_masked: string;
  expires_at: string;
  attempts_left: number;
  event_name: string;
  slot_start: string;
};

export type ConfirmBookingResponse = {
  booking_id: string;
  status: string;
  google_event_id?: string | null;
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
    const detail = await response.text();
    throw new Error(`Booking confirm failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function cancelBooking(
  bookingId: string,
  options?: AgentRequestOptions,
): Promise<void> {
  const response = await fetch(
    `${AGENT_API_BASE_URL}/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: "POST",
      headers: agentHeaders(options),
      cache: "no-store",
    },
  );
  if (!response.ok && response.status !== 204) {
    const detail = await response.text();
    throw new Error(`Booking cancel failed (${response.status}): ${detail}`);
  }
}
