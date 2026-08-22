# Security (BFF + UI)

Security controls in **personal-website** (Next.js Route Handlers, chat UI, LiveKit token minting).

**Agent API / booking / calendar:** [`../personal-voice-agent/docs/security.md`](../../personal-voice-agent/docs/security.md) (when both repos are in workspace).

**Architecture context:** [`architecture.md`](architecture.md) (Authentication and secrets).

**Working notes:** optional, opt-in via user naming `docs/tmp`; when active, see `docs/tmp/.active` and rule `docs-tmp`.

---

## Scope (this repo)

| In scope | Out of scope |
|----------|--------------|
| Rate limits on `/api/*` Route Handlers | LangGraph, calendar tools, booking persistence |
| Turnstile (browser widget + server verify) | Twilio webhook validation |
| httpOnly session secret cookie | Google Calendar API |
| Proxy to agent API with `X-API-Key` | LLM prompt rules |
| Booking / cancel / direct-message proxies | |

Never add scheduling or calendar logic here — proxy and gate only. See [`agent_api_contract.md`](agent_api_contract.md).

---

## Principles

1. **Secrets stay on the server:** `WEB_API_KEY`, Cloudflare Access service token, LiveKit keys, Turnstile secret — Route Handlers only.
2. **BFF is the public edge:** rate limits and bot checks apply before proxying to the agent API.
3. **Match agent API rules:** limits and session binding should align with backend enforcement (defence in depth).
4. **`sessionId` in localStorage is not auth** — ownership is the httpOnly session secret cookie.

---

## Controls at a glance

| Control | Notes |
|---------|--------|
| `WEB_API_KEY` proxied to agent API (server-only) | Optional; required when the agent expects it |
| Cloudflare Access service token (`CF-Access-Client-*`) | Env optional; required when Access protects `api.*` |
| LiveKit JWT minting (server-only secrets) | Token route only |
| Rate limiting on Route Handlers | Upstash edge IP shield |
| Turnstile | `POST /api/session` only; chat/voice rely on session + RL |
| Session secret cookie | When `SESSION_BINDING_ENABLED=true` |
| Booking confirm / cancel / pending proxies | Thin BFF; quotas on the agent |
| Public access early reject + LangSmith alert webhook | Pause UI + Telegram notify |
| Chat message length | 1000 chars; BFF + UI live error |

Precise session quotas (messages, actions, DMs, graph recursion) live on the agent in Postgres. BFF Upstash is a coarse per-IP edge shield and does **not** duplicate those counters.

---

## Route Handler requirements

| Route | Edge IP RL | Turnstile | Session secret | Precise RL (agent) |
|-------|------------|-----------|----------------|--------------------|
| `POST /api/session` | yes (via proxy) | yes | sets cookie | session create per IP |
| `POST /api/chat` | yes | — | required | shared message budget |
| `GET /api/session/messages` | yes | — | required | — (auth + edge only) |
| `POST /api/livekit/token` | yes | — | required | — (voice turns on agent) |
| `POST /api/bookings/confirm` | yes | — | required | action budget |
| `POST /api/bookings/cancel` | yes | — | required | action budget |
| `GET /api/bookings/pending` | yes | — | required | — |
| `POST /api/bookings/cancel-request` | yes | — | required | action budget |
| `POST /api/cancellations/confirm` | yes | — | required | action budget |
| `POST /api/cancellations/abort` | yes | — | required | action budget |
| `GET /api/cancellations/pending` | yes | — | required | — |
| `POST /api/direct-messages` | yes | — | required | dual-window DM |
| `POST /api/direct-messages/cancel` | yes | — | required | action budget |
| `GET /api/public-status` | — | — | — |
| `GET /api/app-config` | — | — | — |
| `POST /api/webhooks/langsmith` | — | — | `X-Webhook-Secret` | — |

---

## Implemented controls

### BFF rate limiting

**Modules:** `src/proxy.ts`, `src/lib/rate-limit-config.ts`, `src/lib/rate-limit.ts`

**Scope:** all `/api/*` except `/api/public-status`, `/api/app-config`, and `/api/webhooks/*` (Next.js Proxy matcher).

**Store:** Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) — **BFF only**. Precise session quotas live on the agent in Postgres.

**Behaviour:**

- One **fixed-window** bucket per client IP (`RATE_LIMIT_EDGE_PER_IP`, default 120/h).
- `ephemeralCache` so repeated denials cost zero Redis commands.
- **429** body matches the agent shape: `{ "error": "rate_limit_exceeded", "action"?: "edge", "retry_at"?: "<ISO>" }` with optional `Retry-After`. Edge IP exhaustion uses `action: "edge"` (distinct from session chat/voice/DM limits on the agent).
- **Fail-open** on Upstash infra/account errors (missing env, timeout, 5xx, account quota / SDK exception): request continues to Route Handlers; Postgres on the agent still enforces precise limits. Do **not** use fail-closed 503 for edge Upstash on the BFF.

**Env (defaults in parentheses):**

| Variable | Purpose |
|----------|---------|
| `RATE_LIMIT_ENABLED` | Master switch (auto: on when Upstash configured) |
| `RATE_LIMIT_EDGE_PER_IP` | Coarse IP shield (120) |
| `RATE_LIMIT_WINDOW_SECONDS` | Fixed window (3600) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST (Vercel only) |

BFF still forwards client IP as `X-Forwarded-For` on agent REST calls (`agent-client.ts`) for session-create-per-IP hashing on the agent.

### Chat message length

**Modules:** `src/lib/chat/chat-message-validation.ts`, `src/lib/chat/chat-message-errors.ts`, `src/lib/chat/chat-user-text.ts`, `src/app/api/chat/route.ts`, `src/components/chat/chat-control-bar.tsx`, `src/components/chat/voice-turn-progress.tsx`, `src/lib/livekit/use-voice-turn-char-usage.ts`, `src/lib/livekit/voice-ui-events.ts`

**Limit:** **1000 characters** per text turn (`CHAT_MESSAGE_MAX`), matching agent `USER_MESSAGE_MAX_CHARS`.

**Behaviour:**

- Client sends `{ sessionId, message }` only (not full `useChat` history). Agent conversation state stays on the checkpointer.
- `POST /api/chat` returns **400** `{ "error": "message_too_long", "maxChars": 1000 }` when trimmed `message` exceeds the character limit, or when `Content-Length` exceeds **10 KiB** (`CHAT_REQUEST_MAX_BODY_BYTES` = 10000) for the single-turn JSON body (before `request.json()`).
- Chat control bar: live error when trimmed input exceeds 1000 characters; send blocked client-side. Paste soft-capped at **1500** code points (`CHAT_MESSAGE_INPUT_CEILING` = `CHAT_MESSAGE_MAX` + 500) so the error state stays visible without huge payloads.
- Voice: live progress meter from interim STT (`voice-turn-progress.tsx`); at 100% mic mute + `voice_control` `user_turn_length_exceeded`; worker truncates and commits with amber truncated-user badge (`interrupted` on `voice_user` / history). REST/telephony oversized input still hard-rejects.

### Cloudflare Turnstile

**Modules:** `src/lib/turnstile/turnstile-config.ts`, `src/lib/turnstile/verify-turnstile.ts`, `src/components/turnstile/turnstile-provider.tsx`, `src/components/turnstile/session-verification-gate.tsx`, `src/components/turnstile/app-human-gate.tsx`

**Routes verified:** `POST /api/session` only. Chat and LiveKit token rely on session secret + BFF/agent rate limits — not per-request Turnstile (avoids repeated visible challenges, especially in privacy browsers).

**Client:** `@marsidev/react-turnstile` in managed mode (widget mode configured in Cloudflare dashboard; `appearance: interaction-only` on the client). **App-level gate** (`AppHumanGate` in `SiteShell`) must pass before any `(site)` view, including static pages and before the `/chat` pause gate. The token is stashed (not `resetAfterUse` at unlock) and consumed on the first `POST /api/session` (fresh create). **Resume** with a live `pa_session_secret` cookie skips `siteverify` and the in-page verifying gate — in-app `/chat` ↔ `/about-me` / `/terms` navigation does not re-challenge until the session cookie expires. If the cookie is missing or the agent returns 401, `useChatSession` shows the verifying gate and mints a new token. First visit uses a short human-check prompt; expired-session re-bootstrap uses session-expired copy. After a token is consumed the gate unmounts (`loading` → `ready`) and `reset()` is deferred until the next `acquireToken()` (e.g. retry). Optional Cloudflare widget pre-clearance/`cf_clearance` only skips zone WAF Challenge Pages — it does not replace BFF `siteverify` on fresh create. Pause no longer skips Turnstile.

**Failure UX:** `403 { "error": "turnstile_failed" }` → shadcn Sonner error toast (top-center): “Verification failed. Please try again.” Bootstrap failures show a generic “Something went wrong. Please try again.” screen with a primary Retry button (technical details only in the console).

**Env:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Browser widget (managed site key from Cloudflare) |
| `TURNSTILE_SECRET_KEY` | Server siteverify (Route Handlers only) |
| `TURNSTILE_DISABLED` | Skip verification when `true` (local dev) |
| `TURNSTILE_FAIL_CLOSED` | Return 503 when enabled but secret missing in production (default on in prod) |

**Local dev:** set `TURNSTILE_DISABLED=true` or omit both keys to skip verification (same pattern as rate limits without Upstash).

### Session secret cookie

**Modules:** `src/lib/session-cookie.ts`, updates to `src/lib/agent-client.ts`, Route Handlers under `src/app/api/session/`, `chat/`, `livekit/token/`

**Cookie:** `pa_session_secret` — httpOnly, `SameSite=Lax`, `Secure` in production. `Max-Age` derived from agent `session_expires_at`.

**BFF behaviour:**

- `POST /api/session` — Turnstile `siteverify` on **fresh** create (no session cookie). Resume with `pa_session_secret` skips Turnstile and forwards the cookie as `X-Session-Secret`; sets cookie when agent returns `session_secret` (fresh start) or refreshes `Max-Age` on resume
- `POST /api/chat`, `GET /api/session/messages`, `POST /api/livekit/token` — require cookie when binding enabled; forward `X-Session-Secret` to agent API
- LiveKit: `verifyAgentSession()` before JWT mint

**Env:**

| Variable | Purpose |
|----------|---------|
| `SESSION_BINDING_ENABLED` | Enable cookie + secret forwarding (set `true` with agent Postgres) |

**Client:** `sessionId` remains in Zustand/localStorage; secret never exposed to JS. Fresh start after deploy replaces `sessionId` when cookie missing.

### Booking OTP proxy routes

**Modules:** `src/app/api/bookings/confirm/route.ts`, `cancel/route.ts`, `pending/route.ts`, `src/lib/agent-client.ts` (confirm/cancel/pending + SSE `ui`), `src/lib/stores/booking-otp-store.ts`, `src/components/chat/booking-otp-card.tsx`

**Routes:** thin proxies forwarding `X-Session-Secret` + client IP; precise booking RL is on the agent (Postgres action budget).

**UI:** GenUI OTP card (shadcn `input-otp`) — inline in text chat, overlay in voice; rehydrated via `GET /api/bookings/pending` on bootstrap. LiveKit topic `ui_events`.

### Meetings list + cancel OTP

**Modules:** `meetings-list-card.tsx`, `booking-cancel-otp-card.tsx`, `meetings-list-store.ts`, `booking-cancel-otp-store.ts`, BFF `/api/bookings/cancel-request`, `/api/cancellations/*`, history `parts`

**UI:** `meetings_list` GenUI is part of assistant message history (`parts`); Cancel buttons only while `activeListId` matches (Zustand, cleared on refresh). Cancel OTP cards are ephemeral (multi-stack), rehydrated via `GET /api/cancellations/pending`. Voice: scrollable overlay above chrome (list + cancel OTPs + confirm OTP). Cancel-request **409** `email_suppressed` → toast (OTP email blocked by agent SES suppress list).

### Direct message GenUI

**Modules:** `direct-message-card.tsx`, `direct-message-store.ts`, `direct-message-validation.ts`, BFF `/api/direct-messages`, `/api/direct-messages/cancel`, `agent-client` send/cancel

**Behaviour:**

- Tool `open_direct_message_form` opens an ephemeral form (SSE `ui`/`direct_message` → `data-direct-message`, LiveKit `ui_events`). Not stored in history `parts`; no pending rehydrate.
- Send: FE+BE validation → agent dual-window DM limit (row counts on `direct_messages`) → Telegram notify + insert → system-note with name/email/message.
- Cancel: agent action budget → system-note only (`Private message cancelled`).

### Public access cost guard (early reject + LangSmith webhook)

**Modules:** `src/lib/public-access-config.ts`, `src/lib/public-access.ts`, `src/app/api/public-status/route.ts`, `src/app/api/webhooks/langsmith/route.ts`, `notifyLangSmithAlert()` / `pauseAssistant()` / `fetchAgentConfig()` in `src/lib/agent-client.ts`, `src/lib/stores/public-pause-store.ts`, `src/components/chat/public-pause-modal.tsx`, `src/lib/access/conditions/pause.ts`, invite UI in `use-chat-session.ts` / `invalid-invite-modal.tsx` / `invite-welcome-modal.tsx`

**Pause buckets:** agent `GET /api/v1/config` returns `paused_by_type.public` and `paused_by_type.invited`. BFF `GET /api/public-status` mirrors both. The `/chat` **RouteAccessGate** pause condition gates on **invited** when `?invite=` is present or the persisted `sessionType` is `invited`; otherwise **public**. This runs **after** app-level Turnstile and **before** `POST /api/session`. Hard enforcement of turn caps remains on the agent (`try_consume_turn(session_type)`). Invited sessions may **fall back** to the public turn budget when invited is exhausted but public still has capacity; `paused_by_type.invited` is effective only when **both** buckets are paused. `POST /api/session`, chat, and LiveKit token no longer apply a type-agnostic early reject — the agent resolves type on create/resume/turn.

**UI:** entry pause is the `/chat` access engine (not a `useChatSession` phase). Mid-session pauses (text **503** `assistant_paused`, voice `ui_events` `assistant_paused`) call `applyAssistantPaused(sessionType)` and show the same localized pause modal (`pause.defaultMessage`). Overlay + `OK` → `/about-me` (entry and mid-session). There is no dead-end paused chrome on `/`.

### Operating hours (BFF Postgres + `/chat` gate)

**Modules:** `src/lib/db/postgres.ts`, `src/lib/app-config.ts`, `src/lib/operating-hours/*`, `src/app/api/app-config/route.ts`, `src/lib/access/conditions/operating-hours.ts`, `src/components/chat/hours-closed-modal.tsx`

**Storage (agent Postgres):** table `app_config` (`key`, `value` jsonb, `updated_at`). Seed row `operating_hours` (per-weekday windows, IANA timezone). RLS enabled; policy `app_config_bff_reader_select` grants **SELECT** to role `bff_reader` only. Agent runtime uses the `postgres` role (bypasses RLS). Not `app_runtime_state`.

**BFF:** `BFF_DATABASE_URL` connects as `bff_reader` (transaction pooler). Missing URL → gate and `enforceOperatingHours()` **fail-open** (always open for local dev). `GET /api/app-config` evaluates `open` / `nextOpenAt` server-side (~30 s cache). Excluded from Upstash edge RL in `proxy.ts`.

**Gate order on `/chat`:** Turnstile → `operatingHours` → `pause` → session bootstrap. Outside hours: `HoursClosedModal` + redirect `/about-me`; pause/agent not called.

**Proxy enforce:** `enforceOperatingHours()` on `POST /api/session`, `POST /api/chat`, `POST /api/livekit/token` returns **503** `{ "error": "assistant_offline", "next_open_at"?: "<ISO>" }` when DB is configured and currently closed.

**Env (website):** `BFF_DATABASE_URL` (server-only, read-only role).

**Invites:** `?invite=` is read on bootstrap, sent as `invite_token` on `POST /api/session`, then stripped from the URL. **403** `invite_invalid` opens a dialog; OK resumes a prior session if one existed, otherwise creates a public session. A **fresh redeem** returns `invitation_name` (`invitations.name`) and the UI shows a one-shot welcome overlay. Same-invite resume (already consumed for this session) and exhausted/invalid tokens do not.

**LangSmith webhook:** notifies via Telegram only (`POST /api/v1/admin/langsmith-alert`). Does **not** pause the assistant.

**Env:** `LANGSMITH_WEBHOOK_SECRET`, `ADMIN_PAUSE_SECRET` (both server-only; the second must match the agent).

Resume, manual pause and limit changes are SQL-only — see the runbook in the agent API [`security.md`](../../personal-voice-agent/docs/security.md).

### `app_config` (operating hours for BFF)

**Agent modules:** migration `018_add_app_config`, `app/db/models/app_config.py`

**Store:** `app_config` (`key` text PK, `value` jsonb, `updated_at`). Seed `operating_hours` with IANA timezone and per-weekday windows (`"0"`–`"6"` = Mon–Sun; `[]` = closed). RLS enabled; `bff_reader` has SELECT via policy `app_config_bff_reader_select`. Website BFF reads through `BFF_DATABASE_URL` — not the agent HTTP API. Distinct from `app_runtime_state` (pause/turn limits) and from calendar `working_hours.py` (booking tool JSON).

**Ops:** set `bff_reader` password after migration; grant only on `app_config`. Keep ECS schedule and `operating_hours` row in sync manually.

---

## Related docs

- [`architecture.md`](architecture.md)
- [`agent_api_contract.md`](agent_api_contract.md)
- [`project_structure.md`](project_structure.md)
