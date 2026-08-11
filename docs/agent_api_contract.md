# Agent API contract (outbound)

This frontend expects a **compatible agent API service** reachable at `AGENT_API_BASE_URL`. The reference implementation is a separate FastAPI backend with a LiveKit worker; any service honoring the same contracts can be used.

Read this file when changing Route Handlers, `agent-client.ts`, or LiveKit token minting. For worker STT/TTS and LangGraph internals, see the optional routing note in `.cursorrules`.

## REST (proxied server-side)

Base path: `/api/v1` on the agent API host.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/config` | — | `{ "features": { "text_chat", "voice_chat" }, "paused_by_type": { "public": { "paused", "pause_message" }, "invited": { "paused", "pause_message" } } }` |
| `POST` | `/admin/pause` | `{ "source": "manual", "cost_usd"?, … }` | `{ "paused": true, "changed" }` — pauses **public** only |
| `POST` | `/admin/langsmith-alert` | `{ "cost_usd"?, "threshold_usd"?, "alert_name"?, "project_name"? }` | `{ "notified": true }` — Telegram only, no pause |
| `POST` | `/sessions` | `{ "session_id": string \| null, "language"?: string \| null, "timezone"?: string \| null, "invite_token"?: string \| null }` | `{ "session_id", "thread_id", "language", "timezone", "session_type", "session_secret"?, "session_expires_at"? }` — secret fields BFF-only; `session_type` is `public\|invited` |
| `PATCH` | `/sessions/{session_id}` | `{ "language"?: string, "timezone"?: string }` — at least one required | `{ "session_id", "language", "timezone" }` — authoritative normalized values |
| `POST` | `/sessions/verify` | `{ "session_id" }` | **204** or **401** |
| `GET` | `/sessions/{session_id}/messages` | — (query: `limit`, `before`) | paginated history page (see below) |
| `POST` | `/chat` | `{ "session_id", "message" }` — `message` 1–1000 chars | `{ "session_id", "reply" }` (single JSON; non-streaming) |
| `POST` | `/chat/stream` | `{ "session_id", "message" }` — same length limits | `text/event-stream` (deltas + optional UI frames; see below) |
| `GET` | `/bookings/pending` | query `session_id` | pending OTP widget payload or **204** |
| `POST` | `/bookings/{booking_id}/confirm` | `{ "code" }` | `{ "booking_id", "status", "google_event_id", "meet_url", "html_link", "ical_uid", "event_name", "slot_start", "duration_minutes", "note"? }` |
| `POST` | `/bookings/{booking_id}/cancel` | — | `{ "booking_id", "status", "note"? }` (PENDING abort) |
| `POST` | `/bookings/{booking_id}/cancel-request` | — | cancel OTP payload (CONFIRMED) |
| `POST` | `/cancellations/{id}/confirm` | `{ "code" }` | `{ "cancellation_id", "booking_id", "status", "note"? }` |
| `POST` | `/cancellations/{id}/abort` | — | `{ "cancellation_id", "booking_id", "status", "note"? }` |
| `GET` | `/cancellations/pending` | query `session_id` | `{ "items": [...] }` |

`note` (when present): `{ "id", "label", "sent_at" }` — a system-note message was appended to the checkpoint for this out-of-band action (see below).

Auth: optional header `X-API-Key` when `WEB_API_KEY` is set on both sides.

### Rate limit (`429`)

When a route is rate-limited, the agent API and BFF return **429** with:

```json
{
  "error": "rate_limit_exceeded",
  "action": "chat",
  "retry_at": "2026-08-05T01:23:45.000Z"
}
```

- `action`: `chat` | `voice` | `direct_message` | `edge` (BFF edge IP shield only; agent routes use the first three).
- `retry_at`: UTC ISO timestamp when the window allows another attempt (from Postgres window start + window length, or dual-window DM).
- `Retry-After` header: seconds until retry (compatibility).

The UI shows a localized dialog with countdown for chat, voice, and direct message. Voice publishes `ui_events` `{ "type": "rate_limit", "action": "voice", "retryAt": "…" }` when a turn is denied before TTS or graph — no `chat_sync` rows and no `reply_stream` call.

### Message length (`400` / voice `ui_events`)

User turns (text and voice transcripts) are capped at **1000 characters** on the agent API (`ChatRequest.message`, `app/agent/input_limits.py`). Oversized text chat bodies return **422** from Pydantic on the agent; the BFF rejects earlier with **400**:

```json
{ "error": "message_too_long", "maxChars": 1000 }
```

The BFF chat route accepts `{ "sessionId", "message" }` only (last user turn). Conversation history is not sent from the browser — the agent checkpointer is source of truth.

| Constant | Value | Role |
|----------|-------|------|
| `CHAT_MESSAGE_MAX` / `USER_MESSAGE_MAX_CHARS` | **1000** | Max accepted user turn (trimmed text) |
| `CHAT_MESSAGE_INPUT_CEILING` | **1500** | Textarea paste soft-cap (code points) |
| `CHAT_REQUEST_MAX_BODY_BYTES` | **10000** (10 KiB) | BFF `Content-Length` early reject |

The chat textarea shows a live error state (red border + localized hint) when trimmed input exceeds 1000 characters; send is blocked client-side.

Voice web turns use **push-to-talk**: mic starts OFF; the user taps the primary button to speak and taps again (or hits FE timeouts) to commit via `voice_control` `commit_user_turn`. Worker `turn_detection=manual` — no STT auto-endpoint. At the character limit the UI mutes and sends `user_turn_length_exceeded` (truncated turn). FE timeouts: 15 s idle without STT growth → empty warning or auto-commit; 60 s max speaking → auto-commit; 30 s thinking → `stop_speech` + error toast + idle. Voice barge-in from speech is disabled; explicit `stop_speech` in answering (or thinking timeout) only.

Precise quotas are enforced on the agent (Postgres). The BFF applies a coarse per-IP Upstash shield in `proxy.ts` and may return the same 429 shape when that edge budget is exhausted.

**Session binding (E4):** protected routes require header `X-Session-Secret` matching the Postgres row for `session_id` when `SESSION_BINDING_ENABLED` is on. BFF reads httpOnly cookie and forwards the header. Errors: **401** `{ "error": "session_auth_required" \| "session_auth_failed" \| "session_expired" }`.

### `GET /config`, `POST /admin/pause`, and `POST /admin/langsmith-alert` (public access guard)

`/config` is unauthenticated and carries no counters. Pause state lives only in `paused_by_type` (`public` and `invited`). While public is paused, `features.text_chat` and `features.voice_chat` are `false`. This app reads config through `getPublicStatus()` (15 s cache) for `GET /api/public-status` and bootstrap gating by session type / invite intent.

`/admin/pause` needs `X-API-Key` **and** `X-Admin-Secret`. It pauses the **public** bucket only (invited keeps its own turn limits). `source` is `"manual"`. Idempotent: `changed` is `false` when already paused.

`/admin/langsmith-alert` uses the same admin auth. Called from `notifyLangSmithAlert()` in the LangSmith webhook route — sends a Telegram notification only and does **not** pause access.

LLM turns are refused per `web_sessions.session_type` on the agent, so LiveKit voice is covered too. Mid-turn denials on `/chat` and `/chat/stream` return **503** `{ "error": "assistant_paused", "message" }` (before SSE starts). Voice publishes `ui_events` `{ "type": "assistant_paused" }`. The BFF forwards **503**; the UI shows the localized pause modal (not the English `message` as chat text).

### `POST /sessions`

- **Fresh start** (no `X-Session-Secret`): server generates new `session_id`, persists normalized body `language` (`en|pl|de|es|fr`, else `en`) and `timezone` (IANA, else `Europe/Warsaw`) on the same INSERT, returns `session_secret` + `session_expires_at` for BFF Set-Cookie, plus authoritative `language`, `timezone`, and `session_type` (`public` by default).
- **Resume** (cookie secret + matching `session_id`): same id; body `language` is **ignored**; body `timezone` is **updated** when provided (normalized, no-op if unchanged). Returns stored `language`, authoritative `timezone`, `session_type`, + `session_expires_at` (throttled touch may extend expiry). Client must overwrite local early-path language / `sessionType` / timezone from the response.
- **Magic link** (`invite_token` from `?invite=`): validates hash against `invitations`; **403** `{ "error": "invite_invalid" }` when unknown/expired/exhausted. Same invitation + already-authenticated session with matching `invitation_id` → resume without redeem. Otherwise atomic redeem + fresh `invited` session. Response includes `session_type: "invited"`.
- Without binding: legacy stateless id normalization (pre-E4); response `language` is normalized from the request hint or `en`; invites require binding/Postgres.

### `PATCH /sessions/{session_id}`

- Body: `{ "language"?: "en"|"pl"|"de"|"es"|"fr", "timezone"?: string }` — at least one field required. Unsupported language values normalize to `en`; invalid timezone values normalize to `Europe/Warsaw`.
- When binding enabled: requires `X-Session-Secret` for the session; updates `web_sessions` and returns authoritative `language` + `timezone`.
- Without binding: returns normalized body values without persisting (legacy mode).
- BFF: `PATCH /api/session` with `{ session_id, language?, timezone? }`; forwards cookie secret. Browser sends `timezone` on create/resume and PATCH-on-change when `Intl` zone differs after focus/travel.

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
    {
      "id": "…",
      "role": "system-note",
      "content": "Booking \"Intro call\" confirmed",
      "sent_at": "…",
      "kind": "booking_confirmed",
      "params": { "name": "Intro call" }
    }
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
      "durationMinutes": 30,
      "meetUrl": "https://meet.google.com/…",
      "htmlLink": "https://www.google.com/calendar/event?…"
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
data: {"type":"ui","widget":"direct_message","formId":"…","name":"…","email":"…","phoneNumber":"…"}
data: {"type":"done"}
data: {"type":"error","message":"…"}
```

Text deltas arrive token-by-token as the LLM generates them, including any short narration the assistant emits before calling a tool. UI frames (e.g. booking OTP, meetings list, direct message) are emitted when tools publish LangGraph custom stream events. The BFF (`/api/chat`) maps `delta` → AI SDK text parts, `ui`/`otp` → `data-otp`, `ui`/`meetings_list` → `data-meetings-list`, and `ui`/`direct_message` → `data-direct-message`; the agent API never speaks the AI SDK wire protocol itself (it also serves voice channels).

### Booking confirm / cancel / pending (E6/E7) + cancel CONFIRMED (E8)

Protected with `X-Session-Secret` (same session that owns the booking). Rate-limited (`BOOKING` / `BOOKING_CONFIRM`).

| Endpoint | Notes |
|----------|--------|
| `GET /bookings/pending?session_id=` | Active non-expired PENDING for rehydration |
| `POST /bookings/{id}/confirm` | Body `{ "code" }` — verifies OTP, writes Google event (guest + Meet when owner OAuth is configured), returns CONFIRMED plus optional `meet_url` / `html_link` / `ical_uid` for the success dialog |
| `POST /bookings/{id}/cancel` | Cancels PENDING only |

Confirm errors (**409**): `otp_invalid`, `otp_expired`, `too_many_attempts`, `slot_taken`, `not_pending`.

Cancel-request errors (**409**): `not_confirmed`, `email_suppressed` (address on SES bounce/complaint suppress list).

**Out-of-band system notes:** the confirm/cancel/abort booking endpoints and the direct-message send/cancel endpoints run outside the LLM turn loop, but still need the agent to know what happened. Each appends a checkpointed, tagged `HumanMessage` (`role="system-note"` once projected) and returns it as `note: { id, label, sent_at, kind, params? }` in the response body, so the BFF can render it in the transcript immediately instead of waiting for the next history fetch. `content` / `label` is a short English summary (e.g. `Booking "Intro call" confirmed`); `kind` + `params` drive localized UI on the frontend (`systemNotes.*` in i18n, mapped from `kind`). Booking kinds always include `params.name` (event name). The LLM-facing instruction text is longer and never shown verbatim in the UI.

### Direct messages (private message GenUI)

Protected with `X-Session-Secret`. Send is dual-window rate-limited on the agent (`DIRECT_MESSAGE`: hourly + daily counts from `direct_messages`). Cancel uses the action budget. No pending/rehydrate — the form is ephemeral.

| Endpoint | Body | Notes |
|----------|------|--------|
| `POST /direct-messages` | `{ session_id, form_id, name, email, message, phone_number? }` | Validates fields, notifies via Telegram, inserts `direct_messages`, returns `note` |
| `POST /direct-messages/cancel` | `{ session_id, form_id }` | Appends cancel system-note only (no DB row) |

Validation: `name`/`email`/`message` required; `message` 8–1000 chars; `email` pattern; optional phone with flexible formatting (8–15 digits after normalization).

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
- `POST /api/direct-messages` → `/api/v1/direct-messages`
- `POST /api/direct-messages/cancel` → `/api/v1/direct-messages/cancel`

Shared chat `session_id` must map to backend `thread_id = web:{session_id}` so text and voice share checkpoint state.

## LiveKit voice (browser ↔ worker)

Token minting is **this repo** (`POST /api/livekit/token`). Audio and STT/TTS run in the agent API’s LiveKit worker, not in the browser.

| Topic | Contract |
|-------|----------|
| Room per connect | `web-{session_id}--{connection_id}` |
| Room metadata | `{"session_id": "<chat session_id>", "voice_language": "<en\|pl\|de\|es\|fr>"}` (`voice_language` mirrors job metadata as a fallback) |
| Agent dispatch | `RoomAgentDispatch` name must match worker registration (`LIVEKIT_AGENT_NAME` / `NEXT_PUBLIC_LIVEKIT_AGENT_NAME`) |
| Agent job metadata | `{"voice_language": "<en\|pl\|de\|es\|fr>"}` (default `en`). Drives worker STT language, TTS provider/voice, and spoken reply language. Polish uses Amazon Polly (Ola, neural); other listed languages use Deepgram Aura. |
| Token request | `participantMetadata` = chat `sessionId` (preferred over parsing room name); optional `agentMetadata` JSON with `voice_language` forwarded into agent job metadata |

Worker publishes chat rows on data topic **`chat_sync`**:

```json
{ "type": "voice_user", "turnId": "…", "text": "…" }
{ "type": "voice_user", "turnId": "…", "text": "…", "interrupted": true }
{ "type": "voice_assistant", "turnId": "…", "text": "…" }
{ "type": "voice_assistant", "turnId": "…", "text": "…", "interrupted": true }
```

Worker publishes GenUI on data topic **`ui_events`**:

```json
{ "type": "booking_otp", "bookingId": "…", "emailMasked": "…", "expiresAt": "…", "attemptsLeft": 5 }
{ "type": "meetings_list", "listId": "…", "meetings": [ { "bookingId": "…", "eventName": "…", "slotStart": "…", "durationMinutes": 30, "meetUrl": "…", "htmlLink": "…" } ] }
{ "type": "direct_message", "formId": "…", "name": "…", "email": "…", "phoneNumber": "…" }
{ "type": "rate_limit", "action": "voice", "retryAt": "2026-08-05T01:23:45.000Z" }
{ "type": "message_too_long", "maxChars": 1000 }
```

`interrupted` on `voice_assistant` is `true` only when a **verified partial** transcript was committed after barge-in (not when the full reply fallback applies). On `voice_user`, `interrupted: true` marks a length-truncated user turn (amber Mic+Clock badge in UI; `length_truncated` on checkpoint `HumanMessage`). Omitted or `false` otherwise.

Voice replies stream to TTS sentence-by-sentence for low time-to-first-audio. The worker publishes `voice_assistant` once per turn with the full text on normal completion. On barge-in, if LiveKit supplies a verified partial (playback-aligned) transcript, that text is published (with `interrupted: true`), committed to graph state with `additional_kwargs.playback_interrupted`, and annotated for the LLM at invoke time only; otherwise the full generated reply is kept for chat and graph (audio still stops immediately).

This app consumes `chat_sync` in `src/lib/livekit/voice-chat-sync.ts` — not room transcriptions.

On data topic **`voice_control`** the browser may publish:

```json
{ "type": "voice_mode_exit" }
{ "type": "stop_speech" }
{ "type": "user_turn_length_exceeded" }
{ "type": "commit_user_turn" }
{ "type": "clear_user_turn" }
```

| Type | When | Effect |
|------|------|--------|
| `voice_mode_exit` | Before leaving voice / disconnect | Commit in-flight assistant (same partial/full rules as barge-in); no `voice_user`; then client ends the session |
| `stop_speech` | UI stop while agent is thinking/speaking | Same commit rules; stay in the room (no disconnect, no barge-in prompt hint on the next turn) |
| `user_turn_length_exceeded` | Voice UI meter hits 100% | Client mutes mic; worker `commit_user_turn()` with truncation; truncated `voice_user` + graph turn with length hint |
| `commit_user_turn` | PTT send (button or FE timeout with speech) | Worker `commit_user_turn()`; normal `voice_user` when transcript non-empty |
| `clear_user_turn` | Empty PTT send or local speaking interrupt | Worker `clear_user_turn()`; drops open STT buffer without a user row |

Implemented in `src/lib/livekit/voice-control.ts`.

## Related docs

- How this app uses the contract: [`architecture.md`](architecture.md)
- Implementation map: [`project_structure.md`](project_structure.md)
