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

1. **Secrets stay on the server:** `WEB_API_KEY`, Cloudflare Access service token, LiveKit keys, Turnstile secret — Route Handlers only.
2. **BFF is the public edge:** rate limits and bot checks apply before proxying to the agent API.
3. **Match agent API rules:** limits and session binding should align with backend enforcement (defence in depth).
4. **`sessionId` in localStorage is not auth** — phase 4 adds a server-bound session secret.

---

## Current baseline (pre-rollout)

| Control | Status |
|---------|--------|
| `WEB_API_KEY` proxied to agent API (server-only) | Implemented |
| Cloudflare Access service token (`CF-Access-Client-*`) on agent calls | Implemented (env optional; required when Access protects `api.*`) |
| LiveKit JWT minting (server-only secrets) | Implemented |
| Rate limiting on Route Handlers | Implemented (Upstash edge IP shield; see below) |
| Turnstile | Implemented (`POST /api/session` only; chat/voice rely on session + RL) |
| Session secret cookie | **Done** (when `SESSION_BINDING_ENABLED=true`) |
| Booking confirm / cancel / pending proxy routes | **Done** (E7) |
| Public access early reject + LangSmith pause webhook | **Done** (see below) |

---

## Rollout index (phases touching this repo)

| Phase | Topic | Status |
|-------|-------|--------|
| 0 | Doc scaffold | **Done** |
| 1 | Coarse edge rate limiting (per-IP Upstash via `proxy.ts`) | **Done** |
| 3 | Turnstile on session create (chat/voice use session binding + rate limits) | **Done** |
| 4 | httpOnly session secret cookie; forward `X-Session-Secret` | **Done** |
| 7 | `/api/bookings/confirm`, `/cancel`, `/pending` proxies | **Done** |
| 8 | Meetings list GenUI + cancel OTP (CONFIRMED) | **Done** |
| — | Direct message GenUI proxies (agent dual-window RL) | **Done** |
| — | Public access cost guard (early reject, `/api/public-status`, LangSmith webhook) | **Done** |
| — | Clerk (optional) | Future |

Backend-only phases (2, 5–6, 9–12) are documented in the agent API [`security.md`](../../personal-voice-agent/docs/security.md). Phase 2 (agent API rate limiting on **Postgres**) is **Done**. E6/E7/E8/E9/E10/E11/E12 are **Done** on the agent API. **E9** (lean booking quotas) and **E12** (graph `recursion_limit`) are backend-only. **E10** (LiveKit voice + shared text/voice message budget on `web_sessions`) is agent-enforced; BFF Upstash is a coarse per-IP edge shield only and does **not** duplicate session quotas.

---

## Route Handler requirements (target)

| Route | Edge IP RL (E1) | Turnstile (E3) | Session secret (E4) | Precise RL (agent) |
|-------|-----------------|----------------|---------------------|--------------------|
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
| `GET /api/public-status` | — | — | — | — |
| `POST /api/webhooks/langsmith` | — | — | `X-Webhook-Secret` | — |

---

## Implemented controls

### Phase 1 — BFF rate limiting

**Modules:** `src/proxy.ts`, `src/lib/rate-limit-config.ts`, `src/lib/rate-limit.ts`

**Scope:** all `/api/*` except `/api/public-status` and `/api/webhooks/*` (Next.js Proxy matcher).

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

**Agent API (phase 2):** BFF still forwards client IP as `X-Forwarded-For` on agent REST calls (`agent-client.ts`) for session-create-per-IP hashing on the agent.

### Phase 3 — Cloudflare Turnstile

**Modules:** `src/lib/turnstile/turnstile-config.ts`, `src/lib/turnstile/verify-turnstile.ts`, `src/components/turnstile/turnstile-provider.tsx`, `src/components/turnstile/session-verification-gate.tsx`

**Routes verified:** `POST /api/session` only. Chat and LiveKit token rely on session secret (E4) + BFF/agent rate limits — not per-request Turnstile (avoids repeated visible challenges, especially in privacy browsers).

**Client:** `@marsidev/react-turnstile` in managed mode (widget mode configured in Cloudflare dashboard; `appearance: interaction-only` on the client). Shown on an **in-page verification gate** (`phase: "verifying"`) before chat chrome mounts — not as an overlay above the control bar. First visit uses a short human-check prompt; re-bootstrap with a prior/persisted session uses session-expired copy. After the token is consumed the gate unmounts (`loading` → `ready`) and `reset()` is deferred until the next `acquireToken()` (e.g. retry). Optional Cloudflare widget pre-clearance/`cf_clearance` only skips zone WAF Challenge Pages — it does not replace BFF `siteverify`.

**Failure UX:** `403 { "error": "turnstile_failed" }` → shadcn Sonner error toast (top-center): “Verification failed. Please try again.” Bootstrap failures show a generic “Something went wrong. Please try again.” screen with a primary Retry button (technical details only in the console).

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

**Routes:** thin proxies forwarding `X-Session-Secret` + client IP; precise booking RL is on the agent (Postgres action budget).

**UI:** GenUI OTP card (shadcn `input-otp`) — inline in text chat, overlay in voice; rehydrated via `GET /api/bookings/pending` on bootstrap. LiveKit topic `ui_events`.

### Phase 8 — Meetings list + cancel OTP

**Modules:** `meetings-list-card.tsx`, `booking-cancel-otp-card.tsx`, `meetings-list-store.ts`, `booking-cancel-otp-store.ts`, BFF `/api/bookings/cancel-request`, `/api/cancellations/*`, history `parts`

**UI:** `meetings_list` GenUI is part of assistant message history (`parts`); Cancel buttons only while `activeListId` matches (Zustand, cleared on refresh). Cancel OTP cards are ephemeral (multi-stack), rehydrated via `GET /api/cancellations/pending`. Voice: scrollable overlay above chrome (list + cancel OTPs + confirm OTP). Cancel-request **409** `email_suppressed` → toast (OTP email blocked by agent SES suppress list).

### Direct message GenUI

**Modules:** `direct-message-card.tsx`, `direct-message-store.ts`, `direct-message-validation.ts`, BFF `/api/direct-messages`, `/api/direct-messages/cancel`, `agent-client` send/cancel

**Behaviour:**

- Tool `open_direct_message_form` opens an ephemeral form (SSE `ui`/`direct_message` → `data-direct-message`, LiveKit `ui_events`). Not stored in history `parts`; no pending rehydrate.
- Send: FE+BE validation → agent dual-window DM limit (row counts on `direct_messages`) → Telegram notify + insert → system-note with name/email/message.
- Cancel: agent action budget → system-note only (`Private message cancelled`).

### Public access cost guard (early reject + LangSmith webhook)

**Modules:** `src/lib/public-access-config.ts`, `src/lib/public-access.ts`, `src/app/api/public-status/route.ts`, `src/app/api/webhooks/langsmith/route.ts`, `pauseAssistant()` / `fetchAgentConfig()` in `src/lib/agent-client.ts`, `src/lib/stores/public-pause-store.ts`, `src/components/chat/public-pause-modal.tsx`

**Early reject:** `enforcePublicAccess()` runs as the **first** statement of `POST /api/session`, `POST /api/chat` and `POST /api/livekit/token` — before Turnstile / agent proxy work. Edge Upstash may still run in `proxy.ts` before the handler; a paused assistant still avoids agent/LLM cost. Response: **503** `{ "error": "assistant_paused", "message": … }`. Pause state comes from agent `GET /api/v1/config`, cached in-module for **15 s** (failures cached too). Read failures **fail open** — the agent's own turn guard is the hard cap.

Booking / cancellation / direct-message routes are intentionally **not** guarded: they make no LLM call, and blocking them would trap a visitor mid-OTP.

**UI:** bootstrap calls `GET /api/public-status` after store rehydrate and before Turnstile / `POST /api/session`; when paused the session phase becomes `paused` and nothing is created. Mid-session pauses are detected from `useChat` `onError` and a failed LiveKit `start()` via `refreshPublicPauseState()`. Both paths show the same centered warning card (overlay + `OK`), and the control bar (input, send, voice toggle) stays disabled after acknowledging.

**LangSmith webhook:** `POST /api/webhooks/langsmith` verifies `X-Webhook-Secret` against `LANGSMITH_WEBHOOK_SECRET` with `timingSafeEqual` (missing env → **503**, mismatch → **401** without detail). After auth, every delivery calls agent `POST /api/v1/admin/pause` with `X-Admin-Secret` (only wire Cost alerts to this URL). Maps `triggered_metric_value` → `cost_usd` and `triggered_threshold` → `threshold_usd` when LangSmith includes them; empty or minimal test bodies still pause. Invalidates the status cache on success. Agent failure → **500** so LangSmith retries.

**Env:** `LANGSMITH_WEBHOOK_SECRET`, `ADMIN_PAUSE_SECRET` (both server-only; the second must match the agent).

**LangSmith setup (manual, outside the repo):**

1. Settings → Models: confirm a pricing entry exists for `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, otherwise alert `Cost` stays at zero.
2. Tracing project → Alerts → two **Cost** alerts on the same webhook: `sum ≥ $3` over **15 min** (spike) and `sum ≥ $8` over **60 min** (slower burn).
3. Webhook URL `https://<canonical-domain>/api/webhooks/langsmith` (use the final host — e.g. `www` if apex redirects with **308**), header `{"X-Webhook-Secret": "<LANGSMITH_WEBHOOK_SECRET>"}`. Default body is fine; LangSmith merges alert fields when present.
4. `Send Test Notification` → expect a Telegram alert (Path: LangSmith) and `paused = true` in Postgres; then resume manually (SQL runbook in the agent repo `docs/security.md`).
5. Ensure Vercel Deployment Protection does not cover `/api/webhooks/*` in production.

Resume, manual pause and limit changes are SQL-only — see the runbook in the agent API [`security.md`](../../personal-voice-agent/docs/security.md).

---

## Related docs

- [`architecture.md`](architecture.md)
- [`agent_api_contract.md`](agent_api_contract.md)
- [`project_structure.md`](project_structure.md)
