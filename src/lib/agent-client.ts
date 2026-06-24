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

export type ChatResponse = {
  session_id: string;
  reply: string;
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

export async function sendAgentChat(
  sessionId: string,
  message: string,
): Promise<ChatResponse> {
  const response = await fetch(`${AGENT_API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: agentHeaders(),
    body: JSON.stringify({ session_id: sessionId, message }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chat request failed (${response.status}): ${detail}`);
  }

  return response.json();
}
