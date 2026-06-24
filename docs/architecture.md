# Architecture

Next.js chat UI and BFF for a personal scheduling assistant. Text chat and LiveKit voice share one client `sessionId` and one server-side conversation thread (via the agent API).

This repo owns **browser UI**, **client state**, **Route Handlers**, and **LiveKit token minting**. Scheduling, LLM reasoning, calendar tools, and voice STT/TTS live in a **separate agent API service** — see [`agent_api_contract.md`](agent_api_contract.md) for the outbound contract.

## System context (this repo)

```
  Browser ─────────► Next.js (:3000)
       │              ├── /api/session, /api/chat  ──► Agent API (HTTP)
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

1. On first load, `ChatPanel` calls `POST /api/session` → agent API returns `session_id`.
2. `sessionId` is stored in Zustand (`useChatStore`, persisted as `personal-agent-chat`).
3. Text and voice for the same `sessionId` must share server checkpoint state (`thread_id = web:{sessionId}` on the agent API).

## Request lifecycle

### Bootstrap

1. Client `POST /api/session` (optional body `{ session_id }` for resume).
2. Route Handler proxies to agent API `POST /api/v1/sessions` via `createAgentSession()` in `src/lib/agent-client.ts`.
3. `sessionId` saved to Zustand; `TextChatArea` mounts with `key={sessionId}` so `useChat` transport binds correctly.

### Text chat

1. User sends via `MessageInput` → `useChat` with `DefaultChatTransport` → `/api/chat`, body `{ sessionId }`.
2. Route Handler calls `sendAgentChat()` → agent API `POST /api/v1/chat`.
3. Reply wrapped in AI SDK SSE (`createUIMessageStream`) for `useChat`.
4. Messages mapped with `source: "text"`.

### Web voice (LiveKit)

1. User toggles voice on → new `voiceConnectionId` (`crypto.randomUUID()`).
2. `useSession` uses `livekitVoiceRoomName(sessionId, connectionId)` and `participantMetadata: sessionId`.
3. Effect on `voiceEnabled`: `await start()` then `await session.room.startAudio()`.
4. Token from `POST /api/livekit/token` (minted here; see `agent_api_contract.md`).
5. Worker (agent API) handles STT/TTS and publishes `voice_user` / `voice_assistant` on `chat_sync`.
6. `useVoiceChatSync` writes voice rows to Zustand.
7. Voice off → effect cleanup calls `session.end()`.

Each voice enable uses a **new room name** (see ADR below). Chat `sessionId` stays the same.

### Message merge in UI

- **Text:** `useChat` → `source: "text"`.
- **Voice:** Zustand, `source: "voice"`, from `chat_sync` only.
- **Display:** merged and sorted by timestamp in `TextChatArea`.

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

**Decision:** `/api/chat` emits AI SDK SSE with one text delta even when the agent API returns a single JSON `{ reply }`.

**Why:** `useChat` expects the Vercel AI SDK transport shape.

## Voice UI stack

| Piece | Location | Role |
|-------|----------|------|
| Session hook | `chat-panel.tsx` | `useSession`, lifecycle, merge |
| Session context | `agent-session-provider.tsx` | `SessionProvider` + `RoomAudioRenderer` |
| Audio unlock | `start-audio-button.tsx` | `StartAudio` fallback |
| Visualizer | `agent-audio-visualizer-bar.tsx` | `BarVisualizer` |
| Room naming | `lib/livekit/room.ts` | `livekitVoiceRoomName`, parsers |
| Data sync | `lib/livekit/voice-chat-sync.ts` | `chat_sync` → Zustand |

## Authentication and secrets

| Secret | Where | Notes |
|--------|-------|-------|
| `WEB_API_KEY` | Route Handlers (`agent-client.ts`) | Proxied as `X-API-Key` when set |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | `/api/livekit/token` only | Never in browser |
| `AGENT_API_BASE_URL` | Server only | Default `http://localhost:8000` |

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

- Outbound API contract: [`agent_api_contract.md`](agent_api_contract.md)
- Module map: [`project_structure.md`](project_structure.md)
- Human onboarding: [`README.md`](README.md)
