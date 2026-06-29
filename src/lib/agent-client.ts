const AGENT_API_BASE_URL =
  process.env.AGENT_API_BASE_URL ?? "http://localhost:8000";
const WEB_API_KEY = process.env.WEB_API_KEY ?? "";

function agentHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (WEB_API_KEY) {
    headers["X-API-Key"] = WEB_API_KEY;
  }
  return headers;
}

export type CreateSessionResponse = {
  session_id: string;
  thread_id: string;
  voice_websocket_url: string;
};

export async function createAgentSession(
  sessionId?: string,
): Promise<CreateSessionResponse> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/sessions`, {
    method: "POST",
    headers: agentHeaders(),
    body: JSON.stringify({ session_id: sessionId ?? null }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Session creation failed (${response.status}): ${detail}`);
  }

  return response.json();
}

type AgentStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message?: string };

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
    return JSON.parse(payload) as AgentStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Stream a chat turn from the agent API, yielding assistant text deltas as
 * they arrive. Consumes the backend's SSE protocol (delta / done / error);
 * the caller maps these to the Vercel AI SDK UI message stream.
 */
export async function* streamAgentChat(
  sessionId: string,
  message: string,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: agentHeaders(),
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
        if (event.type === "delta") {
          if (event.text) {
            yield event.text;
          }
        } else if (event.type === "done") {
          return;
        } else if (event.type === "error") {
          throw new Error(event.message ?? "Agent stream error");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
