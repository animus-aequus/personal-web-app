# Personal Assistant — Web UI

Next.js chat application with text messaging and LiveKit voice. Server Route Handlers proxy to a compatible agent API and mint LiveKit tokens.

**Agent-oriented docs:** [`docs/architecture.md`](docs/architecture.md) · [`docs/project_structure.md`](docs/project_structure.md) · [`docs/agent_api_contract.md`](docs/agent_api_contract.md)

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui
- Vercel AI SDK (`useChat`) for text UI
- LiveKit React SDK + lightweight Agents UI wrappers
- Three.js + `@react-three/fiber` for the agent activity aura (background visualizer)
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
| `ADMIN_PAUSE_SECRET` | `X-Admin-Secret` sent to agent admin routes (pause / LangSmith alert; server-only; must match agent env) |
| `LANGSMITH_WEBHOOK_SECRET` | Expected `X-Webhook-Secret` on `POST /api/webhooks/langsmith` (server-only) |
| `BFF_DATABASE_URL` | Optional read-only Postgres URL (`bff_reader`) for `GET /api/app-config` (transaction pooler `:6543`). Omit locally → hours gate always open. |

## Routes (this app)

| Path | Role |
|------|------|
| `/` | Redirects to `/chat` (preserves `?invite=`) |
| `/chat` | Chat UI (messages, input, voice toggle) |
| `/about-me` | About-me placeholder (pause-modal dismiss target) |
| `/terms` | Terms of use |
| `POST /api/session` | Proxy session bootstrap to agent API |
| `POST /api/chat` | Proxy chat; AI SDK SSE response |
| `POST /api/livekit/token` | Mint LiveKit room token |
| `GET /api/public-status` | Pause state for the `/chat` access gate (after Turnstile, before session) |
| `GET /api/app-config` | Operating hours from Postgres (BFF read-only; excluded from edge RL) |
| `POST /api/webhooks/langsmith` | LangSmith cost alert → Telegram notify (no pause) |

Voice uses room names `web-{session_id}--{connection_id}` per connect; room metadata carries `session_id` so text and voice can share server-side conversation state. Details: [`docs/agent_api_contract.md`](docs/agent_api_contract.md).
