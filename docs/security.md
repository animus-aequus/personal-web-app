# Security (BFF + UI)

Living documentation for security controls in **personal-website** (Next.js Route Handlers, chat UI, LiveKit token minting). Updated incrementally as rollout phases land.

**Agent API / booking / calendar:** [`../personal-voice-agent/docs/security.md`](../../personal-voice-agent/docs/security.md) (when both repos are in workspace).

**Architecture context:** [`architecture.md`](architecture.md) (Authentication and secrets).

**Working notes:** optional, opt-in via user naming `docs/tmp`; when active, see `docs/tmp/.active` and rule `docs-tmp`.

---

## Scope (this repo)

| In scope | Out of scope |
|----------|--------------|
| Rate limits on `/api/*` Route Handlers | LangGraph, calendar tools, DynamoDB booking store |
| Turnstile (browser widget + server verify) | Twilio webhook validation |
| httpOnly session secret cookie (phase 4) | Google Calendar API |
| Proxy to agent API with `X-API-Key` | LLM prompt rules |
| Cancel confirmation page (phase 8) | |

Never add scheduling or calendar logic here — proxy and gate only. See [`agent_api_contract.md`](agent_api_contract.md).

---

## Principles

1. **Secrets stay on the server:** `WEB_API_KEY`, LiveKit keys, Turnstile secret — Route Handlers only.
2. **BFF is the public edge:** rate limits and bot checks apply before proxying to the agent API.
3. **Match agent API rules:** limits and session binding should align with backend enforcement (defence in depth).
4. **`sessionId` in localStorage is not auth** — phase 4 adds a server-bound session secret.

---

## Current baseline (pre-rollout)

| Control | Status |
|---------|--------|
| `WEB_API_KEY` proxied to agent API (server-only) | Implemented |
| LiveKit JWT minting (server-only secrets) | Implemented |
| Rate limiting on Route Handlers | Implemented (Upstash; see below) |
| Turnstile | Implemented (session, chat, voice connect) |
| Session secret cookie | **Done** (when `SESSION_BINDING_ENABLED=true`) |
| Booking confirm / cancel / pending proxy routes | **Done** (E7) |

---

## Rollout index (phases touching this repo)

| Phase | Topic | Status |
|-------|-------|--------|
| 0 | Doc scaffold | **Done** |
| 1 | Rate limiting (`/api/session`, `/api/chat`, `/api/session/messages`, `/api/livekit/token`) | **Done** |
| 3 | Turnstile on session create, chat, and voice connect | **Done** |
| 4 | httpOnly session secret cookie; forward `X-Session-Secret` | **Done** |
| 7 | `/api/bookings/confirm`, `/cancel`, `/pending` proxies | **Done** |
| 8 | Meetings list GenUI + cancel OTP (CONFIRMED) | **Done** |
| 12 | Clerk (optional) | Future |

Backend-only phases (2, 5–6, 9–11) are documented in the agent API [`security.md`](../../personal-voice-agent/docs/security.md). Phase 2 (agent API rate limiting) is **Done** — see that doc for env vars. E6/E7 (pending OTP) are **Done** on the agent API.

---

## Route Handler requirements (target)

| Route | Rate limit (E1) | Turnstile (E3) | Session secret (E4) |
|-------|-----------------|----------------|---------------------|
| `POST /api/session` | yes | yes | sets cookie |
| `POST /api/chat` | yes | yes | required |
| `GET /api/session/messages` | yes | — | required |
| `POST /api/livekit/token` | yes | yes | required |
| `POST /api/bookings/confirm` | yes | — | required |
| `POST /api/bookings/cancel` | yes | — | required |
| `GET /api/bookings/pending` | yes | — | required |
| `POST /api/bookings/cancel-request` | yes | — | required |
| `POST /api/cancellations/confirm` | yes | — | required |
| `POST /api/cancellations/abort` | yes | — | required |
| `GET /api/cancellations/pending` | yes | — | required |

---

## Implemented controls

### Phase 1 — BFF rate limiting

**Modules:** `src/lib/rate-limit-config.ts`, `src/lib/rate-limit.ts`

**Routes:** `POST /api/session`, `POST /api/chat`, `GET /api/session/messages`, `POST /api/livekit/token`

**Store:** Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). Shared with agent API in phase 2.

**Behaviour:**

- Sliding-window limits per route; defaults match the security rollout plan (configurable via env — see `rate-limit-config.ts`).
- **Dual keys** on session-scoped routes: generous per `IP:sessionId` bucket plus a stricter aggregate per-IP bucket (blocks session-rotation bots while leaving headroom for a normal single-session user).
- **Abuse escalation:** repeated limit hits increment an IP strike counter (`RATE_LIMIT_ABUSE_*` env). Higher strikes tighten effective limits (moderate → strict tiers).
- **429** body: `{ "error": "rate_limit_exceeded" }` with optional `Retry-After`.
- **Local dev:** when Upstash env is missing, limits are skipped (console warning). Production may set `RATE_LIMIT_FAIL_CLOSED=true` to return 503 if Redis is unavailable.

**Env (defaults in parentheses):**

| Variable | Purpose |
|----------|---------|
| `RATE_LIMIT_ENABLED` | Master switch (auto: on when Upstash configured) |
| `RATE_LIMIT_FAIL_CLOSED` | 503 when Redis missing in production (default `true` in prod) |
| `RATE_LIMIT_WINDOW_SECONDS` | Window for all route buckets (3600) |
| `RATE_LIMIT_SESSION_PER_IP` | Session create (10) |
| `RATE_LIMIT_CHAT_PER_SESSION` / `_PER_IP` | Chat (60 / 120) |
| `RATE_LIMIT_MESSAGES_PER_SESSION` / `_PER_IP` | History (120 / 240) |
| `RATE_LIMIT_LIVEKIT_PER_SESSION` / `_PER_IP` | Voice token (20 / 40) |
| `RATE_LIMIT_BOOKING_PER_SESSION` / `_PER_IP` | Booking pending/cancel (30 / 60) |
| `RATE_LIMIT_BOOKING_CONFIRM_PER_SESSION` / `_PER_IP` | Booking confirm (20 / 40) |
| `RATE_LIMIT_ABUSE_STRIKE_WINDOW_SECONDS` | Strike TTL (86400) |
| `RATE_LIMIT_ABUSE_STRIKES_MODERATE` / `_STRICT` | Tier thresholds (2 / 5) |
| `RATE_LIMIT_ABUSE_MODERATE_FACTOR` / `_STRICT_FACTOR` | Limit multipliers (0.5 / 0.25) |

**Agent API (phase 2):** BFF forwards client IP as `X-Forwarded-For` on all agent REST calls (`agent-client.ts`) so Fargate rate limits apply per visitor.

### Phase 3 — Cloudflare Turnstile

**Modules:** `src/lib/turnstile/turnstile-config.ts`, `src/lib/turnstile/verify-turnstile.ts`, `src/components/turnstile/turnstile-provider.tsx`

**Routes verified:** `POST /api/session`, `POST /api/chat`, `POST /api/livekit/token` (each voice connect, not per utterance)

**Client:** `@marsidev/react-turnstile` in managed mode (widget mode configured in Cloudflare dashboard; `appearance: interaction-only` on the client). Fresh token per protected action; widget resets after each use.

**Failure UX:** `403 { "error": "turnstile_failed" }` → shadcn Sonner error toast (top-center): “Verification failed. Please try again.”

**Env:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Browser widget (managed site key from Cloudflare) |
| `TURNSTILE_SECRET_KEY` | Server siteverify (Route Handlers only) |
| `TURNSTILE_DISABLED` | Skip verification when `true` (local dev) |
| `TURNSTILE_FAIL_CLOSED` | Return 503 when enabled but secret missing in production (default on in prod) |

**Local dev:** set `TURNSTILE_DISABLED=true` or omit both keys to skip verification (same pattern as rate limits without Upstash).

### Phase 4 — Session secret cookie

**Modules:** `src/lib/session-cookie.ts`, updates to `src/lib/agent-client.ts`, Route Handlers under `src/app/api/session/`, `chat/`, `livekit/token/`

**Cookie:** `pa_session_secret` — httpOnly, `SameSite=Lax`, `Secure` in production. `Max-Age` derived from agent `session_expires_at`.

**BFF behaviour:**

- `POST /api/session` — forwards existing cookie as `X-Session-Secret` for resume; sets cookie when agent returns `session_secret` (fresh start) or refreshes `Max-Age` on resume
- `POST /api/chat`, `GET /api/session/messages`, `POST /api/livekit/token` — require cookie when binding enabled; forward `X-Session-Secret` to agent API
- LiveKit: `verifyAgentSession()` before JWT mint

**Env:**

| Variable | Purpose |
|----------|---------|
| `SESSION_BINDING_ENABLED` | Enable cookie + secret forwarding (set `true` with agent Postgres E4) |

**Client:** `sessionId` remains in Zustand/localStorage; secret never exposed to JS. Fresh start after deploy replaces `sessionId` when cookie missing.

### Phase 7 — Booking OTP proxy routes

**Modules:** `src/app/api/bookings/confirm/route.ts`, `cancel/route.ts`, `pending/route.ts`, `src/lib/agent-client.ts` (confirm/cancel/pending + SSE `ui`), `src/lib/stores/booking-otp-store.ts`, `src/components/chat/booking-otp-card.tsx`

**Routes:** thin proxies forwarding `X-Session-Secret` + client IP; rate limits `Booking` / `BookingConfirm`.

**UI:** GenUI OTP card (shadcn `input-otp`) — inline in text chat, overlay in voice; rehydrated via `GET /api/bookings/pending` on bootstrap. LiveKit topic `ui_events`.

### Phase 8 — Meetings list + cancel OTP

**Modules:** `meetings-list-card.tsx`, `booking-cancel-otp-card.tsx`, `meetings-list-store.ts`, `booking-cancel-otp-store.ts`, BFF `/api/bookings/cancel-request`, `/api/cancellations/*`, history `parts`

**UI:** `meetings_list` GenUI is part of assistant message history (`parts`); Cancel buttons only while `activeListId` matches (Zustand, cleared on refresh). Cancel OTP cards are ephemeral (multi-stack), rehydrated via `GET /api/cancellations/pending`. Voice: scrollable overlay above chrome (list + cancel OTPs + confirm OTP).

---

## Related docs

- [`architecture.md`](architecture.md)
- [`agent_api_contract.md`](agent_api_contract.md)
- [`project_structure.md`](project_structure.md)
