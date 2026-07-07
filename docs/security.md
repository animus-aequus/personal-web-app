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
| Rate limiting on Route Handlers | Not implemented |
| Turnstile | Not implemented |
| Session secret cookie | Not implemented |
| Booking confirm / cancel proxy routes | Not implemented |

---

## Rollout index (phases touching this repo)

| Phase | Topic | Status |
|-------|-------|--------|
| 0 | Doc scaffold | **Done** |
| 1 | Rate limiting (`/api/session`, `/api/chat`, `/api/session/messages`, `/api/livekit/token`) | Pending |
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

_Document each shipped phase here (env vars, files, behaviour). Empty until phase 1+._

---

## Related docs

- [`architecture.md`](architecture.md)
- [`agent_api_contract.md`](agent_api_contract.md)
- [`project_structure.md`](project_structure.md)
