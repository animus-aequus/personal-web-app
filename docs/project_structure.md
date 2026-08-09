# Project structure

Next.js UI + BFF repository. Agent reasoning and voice processing run in a **separate agent API service** (see [`agent_api_contract.md`](agent_api_contract.md)).

## Repository layout

```
personal-website/                 # this repo
├── src/
│   ├── app/                      # App Router pages and API routes
│   ├── components/               # React UI (chat, agents-ui, shadcn ui)
│   └── lib/                      # clients, LiveKit helpers, Zustand store
├── docs/                         # agent-oriented reference
├── .cursor/rules/                # Cursor agent rules (scoped by topic)
├── package.json
└── README.md                     # human-facing setup
```

## `src/` module map

| Path | Responsibility |
|------|----------------|
| `app/(site)/layout.tsx` | Shared site shell — Turnstile, i18n, session bootstrap, AppShell |
| `app/(site)/page.tsx` | Chat route (UI owned by `SiteShell`; page is empty) |
| `app/(site)/terms/page.tsx` | Terms of use (sidebar + session preserved) |
| `app/layout.tsx` | Root layout, fonts, global styles |
| `app/api/session/route.ts` | Proxy session bootstrap → agent API |
| `app/api/chat/route.ts` | Proxy text chat (`{ sessionId, message }`); AI SDK SSE adapter (`delta` + GenUI data parts) |
| `app/api/bookings/*/route.ts` | Proxy booking confirm / cancel / pending / cancel-request |
| `app/api/direct-messages/route.ts` | Proxy private-message send |
| `app/api/direct-messages/cancel/route.ts` | Proxy private-message cancel |
| `app/api/cancellations/*/route.ts` | Proxy cancel OTP confirm / abort / pending (E8) |
| `app/api/livekit/token/route.ts` | Mint LiveKit JWT + agent dispatch |
| `app/api/public-status/route.ts` | Public access pause state for the UI |
| `app/api/webhooks/langsmith/route.ts` | LangSmith cost alert → pause the assistant |
| `components/layout/site-shell.tsx` | Persistent Turnstile + session + AppShell across chat/terms |
| `components/layout/app-shell.tsx` | Sidebar settings chrome |
| `components/chat/chat-panel.tsx` | Chat surface (`TextChatArea`, voice, merge); mounted by SiteShell |
| `components/chat/message-list.tsx` | Renders merged message list |
| `components/chat/message-input.tsx` | Text input + send |
| `components/agents-ui/*` | Thin LiveKit Agents UI wrappers |
| `components/visualizer/agent-aura.tsx` | three.js/R3F background aura (reasoning + streaming) |
| `components/visualizer/greeting-blob.tsx` | three.js/R3F 3D water blob behind empty-state greeting |
| `components/visualizer/greeting-radial-aura.tsx` | Low-tier radial aura fallback (fullscreen shader quad) |
| `lib/device-profile.ts` | Client device form-factor + performance-tier inference |
| `lib/stores/device-profile-store.ts` | Ephemeral device profile (`formFactor`, `tier`) for UI LOD |
| `hooks/use-prefers-reduced-motion.ts` | Shared `prefers-reduced-motion` subscription |
| `components/visualizer/voice-aura-bridge.tsx` | Voice agent state + TTS volume → aura phase |
| `lib/stores/agent-activity-store.ts` | Ephemeral aura `phase` + transient `audioLevel` |
| `components/ui/*` | shadcn/ui primitives |
| `lib/agent-client.ts` | Server-side agent API client |
| `lib/session-cookie.ts` | httpOnly session secret cookie helpers (E4) |
| `lib/rate-limit-config.ts` | Edge Upstash IP shield parameters |
| `lib/rate-limit.ts` | Coarse per-IP limiter + `getClientIp` / 429 helpers |
| `proxy.ts` | Next.js Proxy: edge rate limit for `/api/*` (excl. public-status, webhooks) |
| `lib/public-access-config.ts` | Shared pause contract (error code, status path, default copy) |
| `lib/public-access.ts` | Cached pause status + `enforcePublicAccess()` early reject |
| `lib/stores/public-pause-store.ts` | Pause state for the UI + `refreshPublicPauseState()` |
| `components/chat/public-pause-modal.tsx` | Full-screen pause notice (overlay + OK) |
| `lib/livekit/room.ts` | LiveKit room naming helpers |
| `lib/livekit/voice-languages.ts` | Voice STT language catalog + TTS-fallback helpers |
| `lib/livekit/voice-chat-sync.ts` | `chat_sync` data channel → Zustand |
| `lib/stores/chat-store.ts` | Persisted `sessionId` + `voiceLanguage` |
| `lib/chat/chat-message-validation.ts` | Chat turn limits (`CHAT_MESSAGE_MAX` 1000, input ceiling 1500, body 10 KiB) |
| `lib/chat/chat-message-errors.ts` | Message-too-long toast + BFF 400 handling |
| `lib/chat/chat-user-text.ts` | Extract last user text from `useChat` messages for transport |
| `lib/utils.ts` | `cn()` and shared utilities |

## Where to add changes

| Task | Touch these files |
|------|-------------------|
| Chat UI / voice toggle / merge logic | `src/components/chat/chat-panel.tsx`, `src/components/layout/site-shell.tsx` |
| Message list / input styling | `src/components/chat/message-*.tsx` |
| LiveKit session UI (audio, visualizer) | `src/components/agents-ui/*` |
| Background aura / agent activity state | `src/components/visualizer/*`, `src/lib/stores/agent-activity-store.ts` |
| Empty-state greeting blob | `src/components/visualizer/greeting-blob.tsx`, `src/components/visualizer/greeting-radial-aura.tsx`, `src/components/chat/chat-greeting.tsx` |
| Device form / performance tier | `src/lib/device-profile.ts`, `src/lib/stores/device-profile-store.ts` (bootstrapped in `site-shell.tsx`) |
| Voice transcript sync | `src/lib/livekit/voice-chat-sync.ts` |
| LiveKit room naming | `src/lib/livekit/room.ts` |
| Voice language select options | `src/lib/livekit/voice-languages.ts` |
| Agent API REST proxy | `src/lib/agent-client.ts`, `src/app/api/session/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/bookings/*`, `src/app/api/direct-messages/*` |
| LiveKit token / agent dispatch | `src/app/api/livekit/token/route.ts` |
| Message persistence / session store | `src/lib/stores/chat-store.ts` |
| Page shell / routing | `src/app/(site)/layout.tsx`, `src/app/(site)/page.tsx`, `src/app/(site)/terms/page.tsx`, `src/app/layout.tsx` |
| Styling / design tokens | `src/app/globals.css`, `src/components/ui/*` |
| Public access pause (early reject, status, modal) | `src/lib/public-access.ts`, `src/lib/stores/public-pause-store.ts`, `src/components/chat/public-pause-modal.tsx` |
| Agent API contract / cross-service behaviour | `docs/agent_api_contract.md`, then agent API repo if in workspace |

## Layering rules (do not break)

```
Browser UI          Route Handlers (BFF)       Agent API (external)
──────────          ────────────────────       ─────────────────────
ChatPanel / SiteShell ──►    /api/session, /api/chat  ──►  /api/v1/*
useSession   ──►    /api/livekit/token       ──►  LiveKit Cloud → worker
useVoiceChatSync ◄── chat_sync ◄──────────────  worker data channel
```

- UI must not call the agent API or Bedrock directly from the browser.
- Route Handlers proxy only — no scheduling or LLM logic.
- Voice rows: worker `chat_sync` → Zustand, not client-side inference.

## Dependency and runtime conventions

- **Package manager:** npm (`npm install`, `npm run dev`)
- **Framework:** Next.js 16 App Router, React 19, TypeScript
- **Local dev:** `npm run dev` on `:3000`; set `AGENT_API_BASE_URL` to a running compatible agent API
- **Lint:** `npm run lint`
- **Tests:** none yet — do not add test scaffolding unless requested

## Conventions

- Minimal diffs; match existing style; no drive-by refactors
- Do not commit unless explicitly asked
- Do not add tests or markdown files unless requested (except updating `docs/` when architecture changes)
- After architectural changes, update the relevant `docs/` file in the same session

## Related docs

- System design and ADRs: [`architecture.md`](architecture.md)
- Security rollout: [`security.md`](security.md)
- Opt-in agent working notes: [`tmp/`](tmp/) (only when `docs/tmp/.active` exists)
- Outbound agent API contract: [`agent_api_contract.md`](agent_api_contract.md)
- Human onboarding: [`README.md`](README.md)
