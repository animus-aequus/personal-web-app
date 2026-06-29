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
| `app/page.tsx` | Main page — renders `ChatPanel` |
| `app/layout.tsx` | Root layout, fonts, global styles |
| `app/api/session/route.ts` | Proxy session bootstrap → agent API |
| `app/api/chat/route.ts` | Proxy text chat; AI SDK SSE adapter |
| `app/api/livekit/token/route.ts` | Mint LiveKit JWT + agent dispatch |
| `components/chat/chat-panel.tsx` | Chat UI, voice toggle, `useSession`, merge |
| `components/chat/message-list.tsx` | Renders merged message list |
| `components/chat/message-input.tsx` | Text input + send |
| `components/agents-ui/*` | Thin LiveKit Agents UI wrappers |
| `components/visualizer/agent-aura.tsx` | three.js/R3F background aura (reasoning + streaming) |
| `components/visualizer/voice-aura-bridge.tsx` | Voice agent state + TTS volume → aura phase |
| `lib/stores/agent-activity-store.ts` | Ephemeral aura `phase` + transient `audioLevel` |
| `components/ui/*` | shadcn/ui primitives |
| `lib/agent-client.ts` | Server-side agent API client |
| `lib/livekit/room.ts` | LiveKit room naming helpers |
| `lib/livekit/voice-chat-sync.ts` | `chat_sync` data channel → Zustand |
| `lib/stores/chat-store.ts` | Persisted `sessionId` + unified messages |
| `lib/utils.ts` | `cn()` and shared utilities |

## Where to add changes

| Task | Touch these files |
|------|-------------------|
| Chat UI / voice toggle / merge logic | `src/components/chat/chat-panel.tsx` |
| Message list / input styling | `src/components/chat/message-*.tsx` |
| LiveKit session UI (audio, visualizer) | `src/components/agents-ui/*` |
| Background aura / agent activity state | `src/components/visualizer/*`, `src/lib/stores/agent-activity-store.ts` |
| Voice transcript sync | `src/lib/livekit/voice-chat-sync.ts` |
| LiveKit room naming | `src/lib/livekit/room.ts` |
| Agent API REST proxy | `src/lib/agent-client.ts`, `src/app/api/session/route.ts`, `src/app/api/chat/route.ts` |
| LiveKit token / agent dispatch | `src/app/api/livekit/token/route.ts` |
| Message persistence / session store | `src/lib/stores/chat-store.ts` |
| Page shell / routing | `src/app/page.tsx`, `src/app/layout.tsx` |
| Styling / design tokens | `src/app/globals.css`, `src/components/ui/*` |
| Agent API contract / cross-service behaviour | `docs/agent_api_contract.md`, then agent API repo if in workspace |

## Layering rules (do not break)

```
Browser UI          Route Handlers (BFF)       Agent API (external)
──────────          ────────────────────       ─────────────────────
ChatPanel    ──►    /api/session, /api/chat  ──►  /api/v1/*
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
- Outbound agent API contract: [`agent_api_contract.md`](agent_api_contract.md)
- Human onboarding: [`README.md`](README.md)
