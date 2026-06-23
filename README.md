# Personal Voice Agent — Web Frontend

Next.js PoC for the [personal-voice-agent](../personal-voice-agent) backend: multi-turn text chat and LiveKit voice in one session.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui
- Vercel AI SDK (`useChat`) for text UI
- LiveKit React SDK + lightweight Agents UI wrappers
- Zustand for unified message history (text + voice)

## Setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Run the backend and LiveKit worker (separate terminals):

```bash
# FastAPI
cd ../personal-voice-agent
uv run uvicorn app.api:app --reload --port 8080

# LiveKit worker
uv run python -m app.livekit.worker dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AGENT_API_BASE_URL` | FastAPI base URL (default `http://localhost:8080`) |
| `WEB_API_KEY` | Optional proxy key for backend REST |
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key (server-only) |
| `LIVEKIT_API_SECRET` | LiveKit API secret (server-only) |
| `NEXT_PUBLIC_LIVEKIT_AGENT_NAME` | Agent dispatch name (default `personal-voice-agent`) |

## Routes

| Path | Role |
|------|------|
| `/` | Chat UI (messages, input, voice toggle) |
| `POST /api/session` | Proxy session bootstrap |
| `POST /api/chat` | Proxy chat → FastAPI (AI SDK SSE) |
| `POST /api/livekit/token` | Mint LiveKit room token |

Voice rooms use the name `web-{session_id}` so text and voice share DynamoDB state on the backend.
