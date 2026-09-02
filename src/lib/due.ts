/**
 * Automatic colouring by due date, so tasks signal urgency without anyone
 * picking a colour by hand.
 */
export type DueTone = "overdue" | "today" | "soon" | "later" | "none";

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dueTone(dueDate?: number | null, now = Date.now()): DueTone {
  if (!dueDate) return "none";
  const today = startOfDay(now);
  const day = startOfDay(dueDate);
  if (day < today) return "overdue";
  if (day === today) return "today";
  if (day - today <= 7 * 24 * 60 * 60 * 1000) return "soon";
  return "later";
}

/** Border/tint colour per tone, reused by cards and badges. */
export const DUE_COLORS: Record<DueTone, string | null> = {
  overdue: "#ef4444",
  today: "#f59e0b",
  soon: "#3b82f6",
  later: "#64748b",
  none: null,
};
