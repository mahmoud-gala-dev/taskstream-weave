# Implementation Report

## Overview

A Personal Work Operating System: sections → tables → rows/columns → cells →
tasks/topics → workspace → sessions → documentation → dashboard → AI. React 19
+ TypeScript + Vite + Tailwind on the TanStack Start template, with Firebase as
the only backend.

## Features

- Email/password auth with sign-up, reset and persisted sessions
- Sections, tables, rows, columns, cells with create/rename/delete/reorder
- Independent tasks and topics with a separate placements collection
- Universal drag & drop, including cross-cell, cross-table and cross-section
- Item workspace: overview, progress, sessions, subtasks, notes, links,
  documentation
- Documentation: file upload, Ctrl+V screenshot paste, screen recording
- Durable concurrent work sessions computed from stored timestamps
- Dashboard with today's tracked time, active work and near-complete items
- Global search, settings (language/RTL, theme, density, defaults)
- Server-side AI table optimizer with preview / apply / reject

## Firebase implementation

Lazy browser-only init (`src/lib/firebase.ts`); config delivered by a server
function so the key stays in a server secret. Generic data layer in
`src/lib/db.ts`; user-scoped realtime store in `src/lib/workspace-store.tsx`.

## Drag & drop implementation

dnd-kit with spaced numeric ordering, local drag state, single write on drop,
batched multi-document moves, optimistic UI with listener-based rollback and
undo. Details in `docs/DRAG-DROP-ARCHITECTURE.md`.

## Collections

sections, tables, rows, columns, cells, items, placements, subtasks, notes,
links, attachments, workSessions, activityLogs, settings.

## Security rules

`firestore.rules`: ownership on every operation, immutable `userId`.
`storage.rules`: `users/{uid}/**` only, 200 MB limit.

## Storage

`users/{uid}/items/{itemType}/{itemId}/{fileId}`; Firestore holds metadata only.

## AI

`src/lib/ai.functions.ts` (validated server function) → `src/lib/ai.server.ts`
(Gemini via REST, 25s timeout, JSON schema response, normalized output). The
provider key never reaches the browser, and suggestions are previewed before
being applied.

## Known limitations

- Firestore and Storage rules must be deployed manually with the Firebase CLI.
- Multi-select drag is architecturally supported but not exposed in the UI.
- Offline write-pending indication relies on Firestore defaults.
- Cloud Functions are not used; batched client writes cover current deletions.
