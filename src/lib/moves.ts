import { COL, createRecord, deleteMany, updateMany, updateRecord } from "@/lib/db";
import { ORDER_GAP, bySortOrder, orderAtEnd, orderBetween } from "@/lib/order";
import type { ItemType, Placement } from "@/lib/types";

/**
 * Centralized movement logic. Every function performs the minimum number of
 * Firestore writes on drop (never during pointer movement) and is safe:
 * moving a placement never touches or duplicates the underlying item entity.
 */

type Ordered = { id: string; sortOrder: number };

/** Rank to append inside a target cell. */
export function nextCellOrder(placements: Placement[], tableId: string, rowId: string, columnId: string) {
  return orderAtEnd(
    placements.filter((p) => p.tableId === tableId && p.rowId === rowId && p.columnId === columnId),
  );
}

/**
 * MOVE: relocates an existing placement to a cell (same or another table).
 * Writes: 1 placement update. Never duplicates the task/topic.
 */
export async function moveItemToCell(
  placementId: string,
  target: { tableId: string; rowId: string; columnId: string; sortOrder: number },
): Promise<void> {
  await updateRecord<Placement>(COL.placements, placementId, target);
}

/**
 * ADD PLACEMENT: makes the same item appear in another cell/table.
 * Writes: 1 placement create. The original placement is kept.
 */
export async function copyPlacementToCell(
  userId: string,
  itemType: ItemType,
  itemId: string,
  target: { tableId: string; rowId: string; columnId: string; sortOrder: number },
): Promise<string> {
  return createRecord<Placement>(COL.placements, userId, { itemType, itemId, ...target });
}

/** REMOVE FROM TABLE: deletes only the placement, keeping the item. */
export async function removePlacement(placementId: string): Promise<void> {
  await deleteMany([[COL.placements, placementId]]);
}

/** Reorders one ordered list by index; writes only the moved document. */
export async function reorderTo(
  collection: typeof COL.sections | typeof COL.tables | typeof COL.rows | typeof COL.columns | typeof COL.placements,
  list: Ordered[],
  movedId: string,
  overId: string,
): Promise<void> {
  const sorted = [...list].sort(bySortOrder);
  const from = sorted.findIndex((i) => i.id === movedId);
  const to = sorted.findIndex((i) => i.id === overId);
  if (from < 0 || to < 0 || from === to) return;

  const without = sorted.filter((i) => i.id !== movedId);
  const before = without[to - (from < to ? 0 : 1)];
  const after = without[to - (from < to ? 0 : 1) + 1];
  const sortOrder = orderBetween(before, after);

  if (Number.isFinite(sortOrder) && Math.abs((before?.sortOrder ?? 0) - (after?.sortOrder ?? 0)) > 0.0001) {
    await updateRecord(collection, movedId, { sortOrder } as never);
    return;
  }
  // Ranks collapsed — re-space the whole list atomically.
  const target = without.slice();
  target.splice(to, 0, sorted[from]!);
  await updateMany(
    target.map((item, i) => [collection, item.id, { sortOrder: (i + 1) * ORDER_GAP }] as const) as never,
  );
}

/** Moves a table into another section, keeping all of its content. */
export async function moveTableToSection(
  tableId: string,
  sectionId: string,
  sortOrder: number,
): Promise<void> {
  await updateRecord(COL.tables, tableId, { sectionId, sortOrder } as never);
}

/**
 * Deletes a table and everything table-specific (rows, columns, cells,
 * placements) atomically. Tasks and topics themselves are never deleted.
 */
export async function deleteTableCascade(
  tableId: string,
  data: {
    rows: { id: string; tableId: string }[];
    columns: { id: string; tableId: string }[];
    cells: { id: string; tableId: string }[];
    placements: { id: string; tableId: string }[];
  },
): Promise<void> {
  const entries: Array<[typeof COL.rows | typeof COL.columns | typeof COL.cells | typeof COL.placements | typeof COL.tables, string]> = [];
  data.rows.filter((r) => r.tableId === tableId).forEach((r) => entries.push([COL.rows, r.id]));
  data.columns.filter((c) => c.tableId === tableId).forEach((c) => entries.push([COL.columns, c.id]));
  data.cells.filter((c) => c.tableId === tableId).forEach((c) => entries.push([COL.cells, c.id]));
  data.placements.filter((p) => p.tableId === tableId).forEach((p) => entries.push([COL.placements, p.id]));
  entries.push([COL.tables, tableId]);
  await deleteMany(entries as never);
}

/** Deletes a row (or column) and only the placements pinned to it. */
export async function deleteLineCascade(
  kind: "row" | "column",
  id: string,
  placements: Placement[],
): Promise<void> {
  const affected = placements.filter((p) => (kind === "row" ? p.rowId : p.columnId) === id);
  await deleteMany([
    ...affected.map((p) => [COL.placements, p.id] as [typeof COL.placements, string]),
    [kind === "row" ? COL.rows : COL.columns, id],
  ] as never);
}
