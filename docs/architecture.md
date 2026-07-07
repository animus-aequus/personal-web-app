# Architecture

Next.js chat UI and BFF for a personal scheduling assistant. Text chat and LiveKit voice share one client `sessionId` and one server-side conversation thread (via the agent API).

This repo owns **browser UI**, **client state**, **Route Handlers**, and **LiveKit token minting**. Scheduling, LLM reasoning, calendar tools, and voice STT/TTS live in a **separate agent API service** — see [`agent_api_contract.md`](agent_api_contract.md) for the outbound contract.

## System context (this repo)

```
  Browser ─────────► Next.js (:3000)
       │              ├── /api/session, /api/session/messages, /api/chat  ──► Agent API (HTTP)
       │              └── /api/livekit/token       ──► LiveKit JWT
       └── WebRTC ──► LiveKit Cloud ◄── agent API worker
```

## Scope

| Layer | In this repo | Outside this repo |
|-------|--------------|-------------------|
| Chat UI, voice toggle, message merge | yes | — |
| BFF Route Handlers, `agent-client.ts` | yes | — |
| LiveKit token + `chat_sync` consumer | yes | — |
| LangGraph, calendar tools, Deepgram pipeline | no | agent API service |

Do not add scheduling logic, LLM calls, or calendar integration here.

## Session identity

1. On first load (after Zustand rehydration), `ChatPanel` calls `POST /api/session` → agent API returns `session_id`.
2. On resume, `POST /api/session` with `{ session_id }` validates the persisted id.
3. `sessionId` alone is stored in Zustand (`useChatStore`, key `personal-agent-chat`). Message bodies are **not** persisted locally.
4. Text and voice for the same `sessionId` share server checkpoint state (`thread_id = web:{sessionId}` on the agent API).
5. Chat history is loaded from the agent API (`GET /api/session/messages`), paginated newest-first (10 rows per page).

## Request lifecycle

### Bootstrap

`useChatSession` (`src/lib/chat/use-chat-session.ts`) is the single source of truth
for startup. It runs one ordered sequence and exposes a coarse `phase`
(`loading` → `ready` → `error`) that `ChatPanel` renders directly:

1. Explicitly rehydrate the persisted `sessionId` (`useChatStore.persist.rehydrate()`;
   the store uses `skipHydration: true` to avoid SSR mismatch and module-load races).
2. Client `POST /api/session` (body `{ session_id }` when resuming, `{}` when new).
3. Route Handler proxies to agent API `POST /api/v1/sessions` via `createAgentSession()` in `src/lib/agent-client.ts`.
4. `sessionId` saved to Zustand; `useChatHistory.loadInitial()` fetches the newest history page (10 UI rows) from `GET /api/session/messages?sessionId=…`.
5. `phase` becomes `ready` once the session exists and the first page settles (even when empty). `TextChatArea` mounts with `key={sessionId}` so `useChat` transport binds correctly; an empty thread shows the greeting with the input enabled.

A `runId` guard makes the sequence resilient to React Strict Mode double-invocation
and retries: only the latest run may commit state.

### Chat history (paginated)

1. `useChatHistory` loads the newest page from `GET /api/session/messages`.
2. Scrolling near the top triggers `loadOlder()` via an `IntersectionObserver` sentinel (prefetch margin 120px).
3. Older pages prepend with scroll position preserved (no jump).
4. Live text rows from `useChat` and live voice rows from `chat_sync` merge with loaded history by message `id`.

### Text chat

1. User sends via `MessageInput` → `useChat` with `DefaultChatTransport` → `/api/chat`, body `{ sessionId }`.
2. Route Handler calls `streamAgentChat()` → agent API `POST /api/v1/chat/stream`.
3. Token deltas re-emitted as AI SDK SSE (`createUIMessageStream`) for `useChat`.
4. Messages mapped with `source: "text"`.

### Web voice (LiveKit)

1. User toggles voice on → new `voiceConnectionId` (`crypto.randomUUID()`).
2. `useSession` uses `livekitVoiceRoomName(sessionId, connectionId)` and `participantMetadata: sessionId`.
3. Effect on `voiceEnabled`: `await start()` then `await session.room.startAudio()`.
4. Token from `POST /api/livekit/token` (minted here; see `agent_api_contract.md`).
5. Worker (agent API) handles STT/TTS and publishes `voice_user` / `voice_assistant` on `chat_sync`.
6. `useVoiceChatSync` appends live voice rows to in-memory history state (`appendLive`).
7. Voice off → browser publishes `voice_mode_exit` on `voice_control`, then effect cleanup calls `session.end()`.

Each voice enable uses a **new room name** (see ADR below). Chat `sessionId` stays the same.

### Message merge in UI

- **History:** checkpoint-backed rows from `useChatHistory` (paginated).
- **Text (live):** `useChat` → merged by `id` with `source: "text"`.
- **Voice (live):** `chat_sync` → `appendLive` with `source: "voice"`.
- **Display:** merged and sorted by `sent_at` / timestamp in `TextChatArea`.

**Message rendering (`message-content.tsx`):** rows with `source: "text"` (user and assistant) are rendered as Markdown via `react-markdown` — bold, italic, lists, `https://` links, and inline code. Rows with `source: "voice"` stay plain text (`whitespace-pre-wrap`). Voice/Twilio agent prompts forbid Markdown generation on the backend; the UI enforces plain display for live voice rows via `source`. History from the agent API does not yet expose channel/source per row, so reloaded history rows are all treated as `source: "text"` (acceptable because voice turns are plain text).

Live preview “Hearing: …” uses `useSessionMessages` / `userTranscript` — **not** the chat transcript list.

## Architectural decisions

### BFF proxy for agent REST

**Decision:** Browser calls Next.js Route Handlers; handlers call the agent API with `WEB_API_KEY` server-side.

**Why:** Keeps API keys off the client; single origin for the UI.

### `chat_sync` as voice transcript source of truth

**Decision:** Voice chat history from LiveKit data topic `chat_sync`, not `useSessionMessages` or room transcriptions.

**Why:** Transcriptions can be partial and may not match text sent to the agent. The worker publishes exact strings from its inference step.

### Unique LiveKit room per voice connect

**Decision:** Room `web-{sessionId}--{connectionId}`; `session_id` in room metadata and `participantMetadata`.

**Why:** LiveKit does not re-dispatch agents to an existing room. Reusing the same room after disconnect leaves voice “ignored”. Documented in `@livekit/components-react` `useSession`.

### Stable `useSession` across voice toggles

**Decision:** `useSession` in `TextChatArea` for the `sessionId` lifetime; `start()` / `end()` in a `useEffect`, not mount/unmount.

**Why:** Destroying the hook on toggle caused racey connect/disconnect and broken mic lifecycle.

### AI SDK streaming adapter

**Decision:** `/api/chat` proxies agent API `POST /api/v1/chat/stream` and re-emits plain SSE deltas as the Vercel AI SDK UI message stream.

**Why:** `useChat` expects the AI SDK transport shape; the agent API streams token-by-token over its own SSE protocol (see `agent_api_contract.md`).

### Background aura via a normalized activity phase

**Decision:** Text and voice each map their native loading signal (`useChat().status` / `useVoiceAssistant().state`) into one ephemeral store (`agent-activity-store`) with a small `phase` enum. The three.js aura reads only that store and lives at the page root behind content.

**Why:** Keeps the visualizer decoupled from both input modes, avoids prop drilling through the chat tree, and lets a single component render behind everything. The store is not persisted (transient UI state). High-frequency `audioLevel` is read in the render loop rather than subscribed to, so per-frame audio updates never re-render React.

## Voice UI stack

| Piece | Location | Role |
|-------|----------|------|
| Session hook | `chat-panel.tsx` | `useSession`, lifecycle, merge |
| Session context | `agent-session-provider.tsx` | `SessionProvider` + `RoomAudioRenderer` |
| Audio unlock | `start-audio-button.tsx` | `StartAudio` fallback |
| Visualizer | `agent-wave-visualizer.tsx` | Agent wave + user radial dots in control bar |
| Room naming | `lib/livekit/room.ts` | `livekitVoiceRoomName`, parsers |
| Data sync | `lib/livekit/voice-chat-sync.ts` | `chat_sync` → Zustand |

## Agent activity aura (background visualizer)

A full-viewport, gradient border glow (three.js / `@react-three/fiber`) sits **behind** the chat and animates while the agent is busy — in both text and voice modes.

| Piece | Location | Role |
|-------|----------|------|
| Aura renderer | `components/visualizer/agent-aura.tsx` | R3F `<Canvas>` + fullscreen shader quad; rounded border glow, integrated shimmer/colour phases, audio-reactive pulse |
| Activity state | `lib/stores/agent-activity-store.ts` | Ephemeral (not persisted) `phase` + transient `audioLevel` |
| Text bridge | `chat-panel.tsx` (`TextChatArea`) | Maps `useChat().status` → `phase` when voice is off |
| Voice bridge | `components/visualizer/voice-aura-bridge.tsx` | Maps `useVoiceAssistant().state` + live TTS volume → `phase` / `audioLevel` when voice is on |

- **Phase model:** `idle` | `thinking` | `responding`.
  - Text: `submitted` → `thinking`, `streaming` → `responding`.
  - Voice: `thinking`/`connecting`/`initializing` → `thinking`, `speaking` → `responding`.
- Exactly one bridge owns `phase` at a time: the text effect no-ops while `voiceEnabled`; the voice bridge no-ops while inactive.
- `audioLevel` is high-frequency and transient — read via `getState()` in the render loop, never subscribed to in React.
- Mounted in `app/page.tsx` behind a `relative z-10` content wrapper; `pointer-events-none`. Respects `prefers-reduced-motion`; the render loop is paused (`frameloop="never"`) shortly after returning to `idle`.

## Authentication and secrets

| Secret | Where | Notes |
|--------|-------|-------|
| `WEB_API_KEY` | Route Handlers (`agent-client.ts`) | Proxied as `X-API-Key` when set |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | `/api/livekit/token` only | Never in browser |
| `AGENT_API_BASE_URL` | Server only | Default `http://localhost:8000` |

**Security rollout:** BFF-side controls (rate limits, Turnstile, session cookie) are tracked in [`security.md`](security.md). Agent API booking and calendar auth: optional repo [`../personal-voice-agent/docs/security.md`](../personal-voice-agent/docs/security.md).

**Agent working notes:** opt-in `docs/tmp/` (inactive by default; see `.cursor/rules/docs-tmp.mdc`).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AGENT_API_BASE_URL` | Agent API base URL |
| `WEB_API_KEY` | Optional agent API REST auth |
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Server-only token minting |
| `LIVEKIT_AGENT_NAME` | Agent dispatch name (token route) |
| `NEXT_PUBLIC_LIVEKIT_AGENT_NAME` | Agent name for `useSession` (client) |

## Invariants (do not violate)

1. No scheduling, LLM, or calendar logic in this repo.
2. Voice chat rows from `chat_sync`, not session transcriptions.
3. New `voiceConnectionId` / room name on each voice enable.
4. Do not mount/unmount `useSession` on voice toggle — use `start()` / `end()`.
5. `sessionId` must match agent API `session_id` for shared thread state.
6. Agent API and LiveKit secrets only in Route Handlers.

## Related docs

- Security controls and rollout: [`security.md`](security.md)
- Outbound API contract: [`agent_api_contract.md`](agent_api_contract.md)
- Module map: [`project_structure.md`](project_structure.md)
- Human onboarding: [`README.md`](README.md)
