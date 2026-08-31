/**
 * Ordering strategy: spaced numeric ranks (gap = 1024) with midpoint insertion.
 *
 * Rationale: a drop only ever writes ONE document (the moved item) instead of
 * rewriting the whole list, keeping Firestore writes cheap. Doubles give ~50
 * consecutive midpoint insertions between two neighbours before precision
 * matters; `needsNormalize` detects that and callers may re-space the list.
 */
export const ORDER_GAP = 1024;

type Ordered = { sortOrder: number };

export function orderAtEnd(items: Ordered[]): number {
  if (!items.length) return ORDER_GAP;
  return Math.max(...items.map((i) => i.sortOrder)) + ORDER_GAP;
}

export function orderAtStart(items: Ordered[]): number {
  if (!items.length) return ORDER_GAP;
  return Math.min(...items.map((i) => i.sortOrder)) / 2;
}

/** Rank that places an item between `before` and `after` (either may be undefined). */
export function orderBetween(before?: Ordered, after?: Ordered): number {
  if (!before && !after) return ORDER_GAP;
  if (!before) return after!.sortOrder / 2;
  if (!after) return before.sortOrder + ORDER_GAP;
  return (before.sortOrder + after.sortOrder) / 2;
}

export function needsNormalize(a?: Ordered, b?: Ordered): boolean {
  if (!a || !b) return false;
  return Math.abs(a.sortOrder - b.sortOrder) < 0.0001;
}

export function bySortOrder<T extends Ordered>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder;
}

/** Compute the rank for moving an item to `toIndex` of an ordered list. */
export function orderForIndex(list: Ordered[], toIndex: number): number {
  const sorted = [...list].sort(bySortOrder);
  const before = sorted[toIndex - 1];
  const after = sorted[toIndex];
  return orderBetween(before, after);
}
