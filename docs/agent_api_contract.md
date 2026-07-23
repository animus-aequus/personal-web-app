# Agent API contract (outbound)

This frontend expects a **compatible agent API service** reachable at `AGENT_API_BASE_URL`. The reference implementation is a separate FastAPI backend with a LiveKit worker; any service honoring the same contracts can be used.

Read this file when changing Route Handlers, `agent-client.ts`, or LiveKit token minting. For worker STT/TTS and LangGraph internals, see the optional routing note in `.cursorrules`.

## REST (proxied server-side)

Base path: `/api/v1` on the agent API host.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/sessions` | `{ "session_id": string \| null }` | `{ "session_id", "thread_id", "session_secret"?, "session_expires_at"? }` — secret fields BFF-only |
| `POST` | `/sessions/verify` | `{ "session_id" }` | **204** or **401** |
| `GET` | `/sessions/{session_id}/messages` | — (query: `limit`, `before`) | paginated history page (see below) |
| `POST` | `/chat` | `{ "session_id", "message" }` | `{ "session_id", "reply" }` (single JSON; non-streaming) |
| `POST` | `/chat/stream` | `{ "session_id", "message" }` | `text/event-stream` (deltas + optional UI frames; see below) |
| `GET` | `/bookings/pending` | query `session_id` | pending OTP widget payload or **204** |
| `POST` | `/bookings/{booking_id}/confirm` | `{ "code" }` | `{ "booking_id", "status", "google_event_id"?, "note"? }` |
| `POST` | `/bookings/{booking_id}/cancel` | — | `{ "booking_id", "status", "note"? }` (PENDING abort) |
| `POST` | `/bookings/{booking_id}/cancel-request` | — | cancel OTP payload (CONFIRMED) |
| `POST` | `/cancellations/{id}/confirm` | `{ "code" }` | `{ "cancellation_id", "booking_id", "status", "note"? }` |
| `POST` | `/cancellations/{id}/abort` | — | `{ "cancellation_id", "booking_id", "status", "note"? }` |
| `GET` | `/cancellations/pending` | query `session_id` | `{ "items": [...] }` |

`note` (when present): `{ "id", "label", "sent_at" }` — a system-note message was appended to the checkpoint for this out-of-band action (see below).

Auth: optional header `X-API-Key` when `WEB_API_KEY` is set on both sides.

**Session binding (E4):** protected routes require header `X-Session-Secret` matching the Postgres row for `session_id` when `SESSION_BINDING_ENABLED` is on. BFF reads httpOnly cookie and forwards the header. Errors: **401** `{ "error": "session_auth_required" \| "session_auth_failed" \| "session_expired" }`.

### `POST /sessions`

- **Fresh start** (no `X-Session-Secret`): server generates new `session_id`, returns `session_secret` + `session_expires_at` for BFF Set-Cookie.
- **Resume** (cookie secret + matching `session_id`): same id; returns `session_expires_at` only (throttled touch may extend expiry).
- Without binding: legacy stateless id normalization (pre-E4).

### `/sessions/{session_id}/messages` history pagination

Checkpoint messages are projected into **UI rows** (`role`: `user`, `assistant`, or `system-note`). Consecutive assistant spans between user turns (e.g. tool narration + final reply) are merged into a single assistant row. `system-note` rows are synthetic — see "Out-of-band system notes" below — and render as a small muted event line, not a chat bubble.

Query parameters:

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | `10` | Page size (1–50) |
| `before` | omitted | Message `id` cursor — return the chronologically previous page |

Response:

```json
{
  "session_id": "…",
  "thread_id": "web:…",
  "messages": [
    { "id": "…", "role": "user", "content": "…", "sent_at": "…", "interrupted": false, "parts": null }
  ],
  "has_more": true,
  "next_before": "…"
}
```

Optional `parts` on assistant rows (GenUI snapshots from tool artifacts), e.g.:

```json
{
  "type": "meetings_list",
  "listId": "…",
  "meetings": [
    {
      "bookingId": "…",
      "eventName": "…",
      "slotStart": "…",
      "durationMinutes": 30
    }
  ]
}
```

- Without `before`: returns the **newest** `limit` rows (chronological order within the page).
- With `before`: returns up to `limit` rows strictly **older** than the cursor row.
- `next_before`: pass as `before` on the next request to load older history; `null` when `has_more` is false.
- Unknown cursor: HTTP **404** `{ "error": "cursor_not_found" }`.

This app maps:

- `GET /api/session/messages` → `/api/v1/sessions/{session_id}/messages` via `fetchChatHistory()`

### `/chat/stream` SSE protocol

The agent API streams **plain, AI-SDK-agnostic** Server-Sent Events. One JSON object per `data:` frame:

```
data: {"type":"delta","text":"…"}
data: {"type":"ui","widget":"otp","bookingId":"…","emailMasked":"j***@example.com","expiresAt":"…","attemptsLeft":5}
data: {"type":"ui","widget":"meetings_list","listId":"…","meetings":[…]}
data: {"type":"done"}
data: {"type":"error","message":"…"}
```

Text deltas arrive token-by-token as the LLM generates them, including any short narration the assistant emits before calling a tool. UI frames (e.g. booking OTP, meetings list) are emitted when tools publish LangGraph custom stream events. The BFF (`/api/chat`) maps `delta` → AI SDK text parts, `ui`/`otp` → `data-otp`, and `ui`/`meetings_list` → `data-meetings-list`; the agent API never speaks the AI SDK wire protocol itself (it also serves voice channels).

### Booking confirm / cancel / pending (E6/E7) + cancel CONFIRMED (E8)

Protected with `X-Session-Secret` (same session that owns the booking). Rate-limited (`BOOKING` / `BOOKING_CONFIRM`).

| Endpoint | Notes |
|----------|--------|
| `GET /bookings/pending?session_id=` | Active non-expired PENDING for rehydration |
| `POST /bookings/{id}/confirm` | Body `{ "code" }` — verifies OTP, writes Google event, returns CONFIRMED |
| `POST /bookings/{id}/cancel` | Cancels PENDING only |

Confirm errors (**409**): `otp_invalid`, `otp_expired`, `too_many_attempts`, `slot_taken`, `not_pending`.

**Out-of-band system notes:** the 4 confirm/cancel/abort endpoints above run outside the LLM turn loop, but still need the agent to know what happened. Each appends a checkpointed, tagged `HumanMessage` (`role="system-note"` once projected) and returns it as `note: { id, label, sent_at }` in the response body, so the BFF can render it in the transcript immediately instead of waiting for the next history fetch. `label` is a short human-facing summary (e.g. "Booking confirmed"); the LLM-facing instruction text is longer and never shown verbatim in the UI.

This app maps:

- `POST /api/session` → `/api/v1/sessions` via `createAgentSession()`
- `GET /api/session/messages` → `/api/v1/sessions/{session_id}/messages` via `fetchChatHistory()`
- `POST /api/chat` → `/api/v1/chat/stream` via `streamAgentChat()` (events → UI message stream for `useChat`)
- `POST /api/bookings/confirm` → `/api/v1/bookings/{id}/confirm`
- `POST /api/bookings/cancel` → `/api/v1/bookings/{id}/cancel`
- `GET /api/bookings/pending` → `/api/v1/bookings/pending`
- `POST /api/bookings/cancel-request` → `/api/v1/bookings/{id}/cancel-request`
- `POST /api/cancellations/confirm` → `/api/v1/cancellations/{id}/confirm`
- `POST /api/cancellations/abort` → `/api/v1/cancellations/{id}/abort`
- `GET /api/cancellations/pending` → `/api/v1/cancellations/pending`

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

Worker publishes GenUI on data topic **`ui_events`**:

```json
{ "type": "booking_otp", "bookingId": "…", "emailMasked": "…", "expiresAt": "…", "attemptsLeft": 5 }
{ "type": "meetings_list", "listId": "…", "meetings": [ { "bookingId": "…", "eventName": "…", "slotStart": "…", "durationMinutes": 30 } ] }
```

`interrupted` is `true` only when a **verified partial** transcript was committed after barge-in (not when the full reply fallback applies). Omitted or `false` otherwise. The UI shows an amber badge on interrupted assistant rows.

Voice replies stream to TTS sentence-by-sentence for low time-to-first-audio. The worker publishes `voice_assistant` once per turn with the full text on normal completion. On barge-in, if LiveKit supplies a verified partial (playback-aligned) transcript, that text is published (with `interrupted: true`), committed to graph state with `additional_kwargs.playback_interrupted`, and annotated for the LLM at invoke time only; otherwise the full generated reply is kept for chat and graph (audio still stops immediately).

This app consumes `chat_sync` in `src/lib/livekit/voice-chat-sync.ts` — not room transcriptions.

Before leaving voice mode, the browser publishes on data topic **`voice_control`**:

```json
{ "type": "voice_mode_exit" }
```

The worker commits any in-flight assistant reply (same partial/full rules as barge-in) and mirrors it via `voice_assistant`. No `voice_user` row is added. Implemented in `src/lib/livekit/voice-control.ts` (sent before `session.end()`).

## Related docs

- How this app uses the contract: [`architecture.md`](architecture.md)
- Implementation map: [`project_structure.md`](project_structure.md)
