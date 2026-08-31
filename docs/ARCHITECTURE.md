# Architecture

## Data model (Firestore, one collection per entity)

Every document carries `userId`, `createdAt`, `updatedAt`.

- `sections` — name, sortOrder
- `tables` — sectionId, name, sortOrder
- `rows`, `columns` — tableId, name, sortOrder
- `cells` — optional per-cell metadata (tableId, rowId, columnId)
- `items` — **independent** tasks and topics: type, title, description, status, priority,
  progress, colour/icon, archived/favorite, optional topicId
- `placements` — where an item appears: itemId, itemType, tableId, rowId, columnId, sortOrder
- `subtasks`, `notes`, `links`, `attachments` — children of an item
- `workSessions` — itemId, startedAt, pausedAt, accumulatedMs, endedAt
- `activityLogs` — audit trail of mutations
- `settings` — one document per user (language/direction, theme, density, timer display)

Key invariant: deleting a table, row or column deletes only its **placements**; items live on
(`src/lib/moves.ts` → `deleteTableCascade`, `deleteLineCascade`).

## Ordering

`src/lib/order.ts` uses spaced numeric ordering (`ORDER_GAP = 1024`) with midpoint insertion, so
a move writes a single document instead of renumbering siblings.

## Drag & drop

`@dnd-kit` in `src/routes/tables.tsx`; every drop resolves to a mutation in `src/lib/moves.ts`:

- item card → another cell (same or different table/section) = update placement
- item card → same cell = reorder via midpoint order
- copy to another table = create an additional placement (the item is now in both)
- rows, columns, tables and sections reorder through their `sortOrder`

Every drop persists immediately; failures surface as a toast and the realtime listener restores
the server state, so the UI never keeps an unsaved position.

## Timers

`src/lib/sessions.ts` never counts in memory. Elapsed time is derived from stored timestamps
(`startedAt`, `pausedAt`, `accumulatedMs`), so reloads, sleep and multi-device use stay correct.
Any number of sessions can run at once; `useTick` only triggers re-render.

## Documentation & storage

`src/lib/storage.ts` uploads to `users/{uid}/items/{type}/{id}/...` and stores metadata only in
Firestore. `src/hooks/useScreenRecorder.tsx` records the screen via `getDisplayMedia` +
`MediaRecorder`; `src/components/item-documentation.tsx` adds file upload, Ctrl+V screenshot
paste, previews and deletion (Storage object + metadata).

## AI safe mode

`src/lib/ai.functions.ts` (thin server-function wrapper) → `src/lib/ai-prompt.ts` (prompt) →
`src/lib/ai.server.ts` (provider call, 25s timeout, schema-validated JSON). The API key stays on
the server. Suggestions are previewed; applying only **appends** missing rows/columns and never
deletes or rewrites existing structure.

## Providers

`src/routes/__root.tsx` wraps the app in `AuthProvider` → `SettingsProvider` →
`WorkspaceProvider`. The workspace store holds realtime user-scoped collections; the settings
provider applies `lang`/`dir` and the dark class to `<html>`.
