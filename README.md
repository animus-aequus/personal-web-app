# Personal Assistant — Web UI

Next.js chat application with text messaging and LiveKit voice. Server Route Handlers proxy to a compatible agent API and mint LiveKit tokens.

**Agent-oriented docs:** [`docs/architecture.md`](docs/architecture.md) · [`docs/project_structure.md`](docs/project_structure.md) · [`docs/agent_api_contract.md`](docs/agent_api_contract.md)

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

3. Configure `AGENT_API_BASE_URL` (and optional `WEB_API_KEY`) to point at a running compatible agent API. For LiveKit voice, also set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and agent dispatch name variables — see table below.

4. Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AGENT_API_BASE_URL` | Agent API base URL (default `http://localhost:8000`) |
| `WEB_API_KEY` | Optional proxy key for agent API REST |
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key (server-only) |
| `LIVEKIT_API_SECRET` | LiveKit API secret (server-only) |
| `LIVEKIT_AGENT_NAME` | Agent dispatch name for token route (server) |
| `NEXT_PUBLIC_LIVEKIT_AGENT_NAME` | Agent name for `useSession` (client; default `personal-voice-agent`) |

## Routes (this app)

| Path | Role |
|------|------|
| `/` | Chat UI (messages, input, voice toggle) |
| `POST /api/session` | Proxy session bootstrap to agent API |
| `POST /api/chat` | Proxy chat; AI SDK SSE response |
| `POST /api/livekit/token` | Mint LiveKit room token |

Voice uses room names `web-{session_id}--{connection_id}` per connect; room metadata carries `session_id` so text and voice can share server-side conversation state. Details: [`docs/agent_api_contract.md`](docs/agent_api_contract.md).
