# Remaining Hardcoded Strings (Phase 20 re-scan)

Re-scan command used: `rg -n '>[A-Z][a-z]+' src/routes src/components`.

## INTENTIONAL
- Route `head()` titles, descriptions and OG/Twitter metadata in every route file:
  kept in English so published link previews and SEO stay stable in one canonical language.
- `dir="ltr"` on duration/timer values: digits must stay left-to-right in both languages.
- Brand strings `Cairo`, `Work OS` inside metadata.

## NEEDS_TRANSLATION (tracked follow-up, dense workspace surfaces)
- `src/routes/tables.tsx` — section/table toolbars, row/column menus, cell menus, template strip.
- `src/routes/item.$itemId.tsx` — tab labels, overview cards, sessions/subtasks/files/links copy.
- `src/components/focus-task-table.tsx` — focus round controls, reminder labels, notifications.
- `src/components/rich-doc-editor.tsx` — formatting toolbar tooltips.
- `src/routes/optimizer.tsx`, `src/routes/assistant.tsx`, `src/routes/documentation.tsx` — page copy.
- `src/hooks/useAuth.tsx` — Firebase auth error messages (to become `errors.*` keys).
These are additive: all of them can be migrated by swapping literals for `useT()` keys,
with no logic change, using the key naming convention already established.

## INTERNAL_ONLY
- `src/lib/ai-prompt.ts`, `src/lib/ai.server.ts` — SYSTEM_PROMPT / MODEL_INSTRUCTION text.
- `src/lib/db.ts` activity log action names, Firestore collection names, console/error logs.

## THIRD_PARTY
- shadcn/ui primitives' internal aria strings, Sonner's `Notifications alt+T` region label.

## DYNAMIC_CONTENT
- User data: section/table/row/column names, task and topic titles, notes, documentation HTML,
  filenames and AI-generated output. Never translated.
