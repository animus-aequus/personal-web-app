# Agent API contract (outbound)

This frontend expects a **compatible agent API service** reachable at `AGENT_API_BASE_URL`. The reference implementation is a separate FastAPI backend with a LiveKit worker; any service honoring the same contracts can be used.

Read this file when changing Route Handlers, `agent-client.ts`, or LiveKit token minting. For worker STT/TTS and LangGraph internals, see the optional routing note in `.cursorrules`.

## REST (proxied server-side)

Base path: `/api/v1` on the agent API host.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions` | `{ "session_id": string \| null }` | `{ "session_id", "thread_id", … }` |
| `POST` | `/chat` | `{ "session_id", "message" }` | `{ "session_id", "reply" }` (single JSON; non-streaming) |
| `POST` | `/chat/stream` | `{ "session_id", "message" }` | `text/event-stream` of assistant text deltas (see below) |

Auth: optional header `X-API-Key` when `WEB_API_KEY` is set on both sides.

### `/chat/stream` SSE protocol

The agent API streams **plain, AI-SDK-agnostic** Server-Sent Events. One JSON object per `data:` frame:

```
data: {"type":"delta","text":"…"}
data: {"type":"done"}
data: {"type":"error","message":"…"}
```

Text deltas arrive token-by-token as the LLM generates them, including any short narration the assistant emits before calling a tool. The BFF (`/api/chat`) maps these to the Vercel AI SDK UI message stream (`text-start` / `text-delta` / `text-end`); the agent API never speaks the AI SDK wire protocol itself (it also serves voice channels).

This app maps:

- `POST /api/session` → `/api/v1/sessions` via `createAgentSession()`
- `POST /api/chat` → `/api/v1/chat/stream` via `streamAgentChat()` (async generator of deltas), re-emitted as a UI message stream for `useChat`

Shared chat `session_id` must map to backend `thread_id = web:{session_id}` so text and voice share checkpoint state.

## LiveKit voice (browser ↔ worker)

Token minting is **this repo** (`POST /api/livekit/token`). Audio and STT/TTS run in the agent API’s LiveKit worker, not in the browser.

| Topic | Contract |
|-------|----------|
| Room per connect | `web-{session_id}--{connection_id}` |
| Room metadata | `{"session_id": "<chat session_id>"}` |
| Agent dispatch | `RoomAgentDispatch` name must match worker registration (`LIVEKIT_AGENT_NAME` / `NEXT_PUBLIC_LIVEKIT_AGENT_NAME`) |
| Token request | `participantMetadata` = chat `sessionId` (preferred over parsing room name) |

Worker publishes chat rows on data topic **`chat_sync`**:

```json
{ "type": "voice_user", "turnId": "…", "text": "…" }
{ "type": "voice_assistant", "turnId": "…", "text": "…" }
{ "type": "voice_assistant", "turnId": "…", "text": "…", "interrupted": true }
```

`interrupted` is `true` only when a **verified partial** transcript was committed after barge-in (not when the full reply fallback applies). Omitted or `false` otherwise. The UI shows an amber badge on interrupted assistant rows.

Voice replies stream to TTS sentence-by-sentence for low time-to-first-audio. The worker publishes `voice_assistant` once per turn with the full text on normal completion. On barge-in, if LiveKit supplies a verified partial (playback-aligned) transcript, that text is published (with `interrupted: true`), committed to graph state with `additional_kwargs.playback_interrupted`, and annotated for the LLM at invoke time only; otherwise the full generated reply is kept for chat and graph (audio still stops immediately).

This app consumes `chat_sync` in `src/lib/livekit/voice-chat-sync.ts` — not room transcriptions.

## Related docs

- How this app uses the contract: [`architecture.md`](architecture.md)
- Implementation map: [`project_structure.md`](project_structure.md)
