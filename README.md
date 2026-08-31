# Personal Work Operating System

A personal work OS: sections → tables → rows/columns/cells → tasks & topics → work
sessions → documentation → progress → dashboard → AI optimization.

Not a to-do list: tasks and topics are independent entities that can be *placed* in
many cells and tables at once. Removing a placement never deletes the work item.

## Stack

- React 19 + TypeScript, TanStack Start (Router + server functions), Vite 7
- Tailwind CSS v4 (`src/styles.css`) + shadcn/Radix primitives
- Firebase: Auth, Firestore, Storage, Analytics (`firebase@12`)
- Drag & drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- AI: server-side Gemini call through a TanStack server function (key never reaches the browser)

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: today's tracked time, active sessions, progress, near-complete work |
| `/tables` | Sections, tables, rows, columns, cells, universal drag & drop, AI assistant |
| `/active` | All running/paused sessions with durable timers |
| `/tasks`, `/topics` | Independent item libraries with filters and placement info |
| `/item/$itemId` | Item workspace: progress, subtasks, notes, links, documentation |
| `/search` | One search across the whole workspace |
| `/settings` | Language/RTL, theme, density, timer preference |
| `/auth` | Sign in, sign up, password reset |

## Configuration

The Firebase web config is served by `src/lib/firebase-config.functions.ts` and needs the
server secret `GOOGLE_API_KEY` (also used for the AI assistant). Client Firebase
initialization is lazy and browser-only (`src/lib/firebase.ts`).

## Security rules

Deploy the rules in this repository to the Firebase project before real use:

```bash
firebase deploy --only firestore:rules,storage
```

`firestore.rules` allows access only to documents whose `userId` equals the caller's uid and
makes `userId` immutable. `storage.rules` scopes objects to `users/{uid}/...` with a 200 MB cap.

## Development

```bash
bun install
bun run dev        # http://localhost:8080
bun run build      # production build
bunx tsgo --noEmit # typecheck
```

## Troubleshooting

- "AI is not configured" — the `GOOGLE_API_KEY` server secret is missing.
- `permission-denied` from Firestore — rules are not deployed, or you are signed out.
- Screen recording errors — the browser blocked `getDisplayMedia`; use Chrome over HTTPS.

## Documentation

- `docs/ARCHITECTURE.md` — data flow, timers, AI safe mode
- `docs/FIREBASE-ARCHITECTURE.md` — collections, queries, indexes, rules, storage
- `docs/DRAG-DROP-ARCHITECTURE.md` — drag sources, targets, ordering, rollback, undo
- `docs/IMPLEMENTATION-REPORT.md` — feature-by-feature implementation and limits
- `docs/TEST-REPORT.md` — verification results and known issues

