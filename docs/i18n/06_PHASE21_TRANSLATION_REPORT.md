# Phase 21 — Translation of the dense workspace surfaces

## What was translated

| Surface | Files | Dictionary module | Keys |
| --- | --- | --- | --- |
| Tables workspace (sections, tabs, rows, columns, cells, item cards, menus, toasts) | `src/routes/tables.tsx` | `src/lib/i18n.extra.tables.ts` | 105 |
| Item detail (tabs, cards, sessions, subtasks, docs, links, files) + rich editor | `src/routes/item.$itemId.tsx`, `src/components/rich-doc-editor.tsx`, `src/components/item-documentation.tsx` | `src/lib/i18n.extra.item.ts` | 102 |
| Focus sessions (inline focus table, Pomodoro page, tray, templates) | `src/components/focus-task-table.tsx`, `src/routes/focus.tsx`, `src/components/table-focus-tray.tsx`, `src/components/table-templates.tsx` | `src/lib/i18n.extra.focus.ts` | 73 |
| AI Optimizer, Assistant, Documentation index | `src/routes/optimizer.tsx`, `src/components/ai-optimizer.tsx`, `src/routes/assistant.tsx`, `src/routes/documentation.tsx` | `src/lib/i18n.extra.optimizer.ts` | 75 |

`src/lib/i18n.tsx` now merges the base dictionary with these four modules, so
`MessageKey` stays fully typed and every key exists in both `en` and `ar`
(verified: identical key sets, 355 new keys total).

## Highlight formatting

- Highlights now store a `mode` (`background` | `text`) — the same palette can
  paint the marker background **or** the font colour, anywhere in the app.
- The floating toolbar has a Background/Text switch, seven colours, and a
  Remove action.
- Clicking an existing highlight reopens the toolbar on it: change its colour,
  switch background/text, or remove the formatting for that one highlight.
- The right-click menu gained a "Text colour" submenu next to the marker
  colours; "Clear highlights on this page" still removes every highlight.

## Uploads and screen recording

Uploads were failing with `401` + a blocked CORS preflight from
`firebasestorage.googleapis.com`, which means the Storage bucket for `link-hun`
is not reachable from the app origin (Storage not enabled / rules not deployed /
origin not in the bucket CORS config). Code-side mitigation in
`src/lib/storage.ts`:

- Files ≤ 700 KB (screenshots, small attachments) fall back to an inline data
  URL stored with the Firestore metadata, so they keep working.
- Larger files (screen recordings) raise an actionable error naming the exact
  fix instead of a silent failure.
- `deleteAttachment` skips Storage deletion for inline attachments.

To restore real Storage uploads, run in the Firebase project `link-hun`:

```
firebase deploy --only storage
gsutil cors set cors.json gs://link-hun.firebasestorage.app
```

where `cors.json` allows the app origins (`https://*.lovableproject.com`,
`https://*.lovable.app`) with `GET, POST, PUT, HEAD` and header `*`.

## Intentionally untranslated

- Route `head()` SEO metadata (single canonical language for link previews).
- AI system prompts, Firestore collection names, activity-log action names.
- Template seed content (becomes user-editable table data on insert).
- All user data: titles, notes, documentation HTML, filenames, AI output.
