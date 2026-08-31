# Drag & Drop Architecture

Library: **@dnd-kit** (`core`, `sortable`, `utilities`). Chosen because it is
React 19 compatible, pointer + keyboard accessible, and does not require the
legacy HTML5 drag API. No other drag library is installed.

## Drag sources

- Sections (reorder)
- Tables (reorder in section, move across sections)
- Rows, Columns (reorder)
- Item cards in cells (move, reorder)
- Subtasks in the item workspace
- Active-work cards (display order only)

## Drop targets

- Section bodies (accept tables)
- Table tabs (activate on hover, accept items)
- Cells (accept items)
- Sortable lists (rows, columns, subtasks, placements inside one cell)

## Behaviours

| Action | Effect |
| --- | --- |
| Move | updates the existing placement's tableId/rowId/columnId/sortOrder |
| Copy placement | creates a second placement, item untouched |
| Duplicate entity | creates a new item document (explicit menu action) |
| Remove from table | deletes the placement only |
| Delete item | deletes the item after confirmation |

Dropping never deletes data, and moving a table across sections patches the
existing table document instead of recreating it.

## Ordering

Spaced numeric ordering (`src/lib/order.ts`, gap 1024). Inserting takes the
midpoint of the neighbours, so a normal drop writes exactly one document.
`needsNormalize` detects exhausted gaps and triggers a batched renumber.

## Lifecycle and cost

`dragStart` and `dragOver` are local state only. Firestore is written once, on
drop. No writes occur during pointer movement.

## Optimistic UI and rollback

The realtime store renders the new position immediately. If the write rejects,
the listener snapshot restores the previous placement and a toast reports
"Move failed — Retry". Multi-document moves go through `writeBatch`, so the
database is never partially reordered.

## Undo

After a move a toast offers Undo, which reapplies the captured previous
placement coordinates.

## Accessible alternatives

Every drag has a menu/keyboard equivalent: Move Up/Down, Move Left/Right,
Move to Table, Move to Section, Add to Another Table. dnd-kit's keyboard
sensor also drives the sortable lists.

## Centralized logic

All movement lives in `src/lib/moves.ts`: `moveItemToCell`,
`copyPlacementToTable`, `removePlacement`, `reorderRows`, `reorderColumns`,
`reorderTables`, `reorderSections`, `moveTableToSection`, `reorderCellItems`,
`deleteTableSafely`, `deleteRowSafely`, `deleteColumnSafely`.
