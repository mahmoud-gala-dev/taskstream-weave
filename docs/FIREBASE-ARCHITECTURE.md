# Firebase Architecture

Project: `link-hun`. The web config is served by the server function
`src/lib/firebase-config.functions.ts`; the API key lives in the `GOOGLE_API_KEY`
server secret. Admin/service-account credentials are never used client-side.

## Services

| Service | Usage |
| --- | --- |
| Auth | email/password, sign-up, reset, `browserLocalPersistence` |
| Firestore | all application data |
| Storage | screenshots, screen recordings, file attachments |
| Analytics | product events only, never task content |

Initialization is lazy and browser-only (`src/lib/firebase.ts`), so SSR never
touches the SDK.

## Collections

Flat, top-level collections; every document carries `userId`, `createdAt`,
`updatedAt` (`Base` in `src/lib/types.ts`).

- `sections` — name, color, icon, sortOrder, isArchived
- `tables` — sectionId, name, color, icon, sortOrder, density
- `rows`, `columns` — tableId, name, color, icon, sortOrder
- `cells` — tableId, rowId, columnId, note, color, icon
- `items` — tasks and topics (`itemType`), title, status, priority, progress,
  dueDate, parentTopicId, favorite/archive fields
- `placements` — itemType, itemId, tableId, rowId, columnId, sortOrder
- `subtasks`, `notes`, `links`, `attachments` — parent item reference
- `workSessions` — status, startedAt, lastResumedAt, pausedAt, stoppedAt,
  accumulatedSeconds
- `activityLogs` — action, detail, itemId
- `settings` — one document per user (language, theme, density, defaults)

### Entity vs placement

Items are independent of tables. Appearing in three tables means three
`placements` documents pointing at one `items` document. Moving updates a
placement; deleting a table or row deletes placements only.

## Query patterns

Reads are user-scoped realtime listeners, one per collection
(`watchUserCollection` in `src/lib/db.ts`, wired in
`src/lib/workspace-store.tsx`). All filtering, joining and ordering happens in
memory, which keeps reads low and avoids composite indexes for most views.

## Indexes

The single-field `userId` index Firestore creates automatically covers the
listeners. Add these composite indexes only if server-side filtering is
introduced later:

- `placements`: userId ASC, tableId ASC, sortOrder ASC
- `placements`: userId ASC, itemType ASC, itemId ASC
- `rows` / `columns`: userId ASC, tableId ASC, sortOrder ASC
- `tables`: userId ASC, sectionId ASC, sortOrder ASC
- `items`: userId ASC, status ASC, updatedAt DESC
- `workSessions`: userId ASC, status ASC, startedAt DESC

## Batching and transactions

`updateMany` and `deleteMany` (`src/lib/db.ts`) chunk into `writeBatch`
commits of 400 operations, used for reordering, cross-table moves, safe table
deletion and AI apply.

## Storage

Objects live at `users/{uid}/items/{itemType}/{itemId}/{fileId}`. Firestore
stores only metadata. Rules in `storage.rules` restrict access to the owning
uid and cap objects at 200 MB.

## Security rules

`firestore.rules` requires an authenticated uid equal to `userId` for read,
create, update and delete, and forbids changing `userId` on update.

## Deployment

```
firebase deploy --only firestore:rules,storage
```
