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
| Turnstile | Not implemented |
| Session secret cookie | Not implemented |
| Booking confirm / cancel proxy routes | Not implemented |

---

## Rollout index (phases touching this repo)

| Phase | Topic | Status |
|-------|-------|--------|
| 0 | Doc scaffold | **Done** |
| 1 | Rate limiting (`/api/session`, `/api/chat`, `/api/session/messages`, `/api/livekit/token`) | **Done** |
| 3 | Turnstile on session create + chat | Pending |
| 4 | httpOnly session secret cookie; forward `X-Session-Secret` | Pending |
| 7 | `POST /api/bookings/confirm` proxy (optional) | Pending |
| 8 | `/cancel` page + cancel proxy | Pending |
| 12 | Clerk (optional) | Future |

Backend-only phases (2, 5–6, 9–11) are documented in the agent API [`security.md`](../../personal-voice-agent/docs/security.md).

---

## Route Handler requirements (target)

| Route | Rate limit (E1) | Turnstile (E3) | Session secret (E4) |
|-------|-----------------|----------------|---------------------|
| `POST /api/session` | yes | yes | sets cookie |
| `POST /api/chat` | yes | yes | required |
| `GET /api/session/messages` | yes | — | required |
| `POST /api/livekit/token` | yes | — | required |

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
| `RATE_LIMIT_ABUSE_STRIKE_WINDOW_SECONDS` | Strike TTL (86400) |
| `RATE_LIMIT_ABUSE_STRIKES_MODERATE` / `_STRICT` | Tier thresholds (2 / 5) |
| `RATE_LIMIT_ABUSE_MODERATE_FACTOR` / `_STRICT_FACTOR` | Limit multipliers (0.5 / 0.25) |

---

## Related docs

- [`architecture.md`](architecture.md)
- [`agent_api_contract.md`](agent_api_contract.md)
- [`project_structure.md`](project_structure.md)
