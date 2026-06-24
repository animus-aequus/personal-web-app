# Agent API contract (outbound)

This frontend expects a **compatible agent API service** reachable at `AGENT_API_BASE_URL`. The reference implementation is a separate FastAPI backend with a LiveKit worker; any service honoring the same contracts can be used.

Read this file when changing Route Handlers, `agent-client.ts`, or LiveKit token minting. For worker STT/TTS and LangGraph internals, see the optional routing note in `.cursorrules`.

## REST (proxied server-side)

Base path: `/api/v1` on the agent API host.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions` | `{ "session_id": string \| null }` | `{ "session_id", "thread_id", … }` |
| `POST` | `/chat` | `{ "session_id", "message" }` | `{ "session_id", "reply" }` |

Auth: optional header `X-API-Key` when `WEB_API_KEY` is set on both sides.

This app maps:

- `POST /api/session` → `/api/v1/sessions` via `createAgentSession()`
- `POST /api/chat` → `/api/v1/chat` via `sendAgentChat()`

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
```

This app consumes `chat_sync` in `src/lib/livekit/voice-chat-sync.ts` — not room transcriptions.

## Related docs

- How this app uses the contract: [`architecture.md`](architecture.md)
- Implementation map: [`project_structure.md`](project_structure.md)
