import { COL, createRecord, logActivity, updateRecord } from "@/lib/db";
import { trackEvent } from "@/lib/firebase";
import type { ItemType, WorkItem, WorkSession } from "@/lib/types";

/**
 * Timers are derived from stored timestamps, never from setInterval state, so
 * they survive refresh, navigation and browser restarts. Multiple sessions can
 * run at the same time; starting one never stops another.
 */
export function elapsedSeconds(s: WorkSession, now = Date.now()): number {
  const base = s.accumulatedSeconds ?? 0;
  if (s.status !== "running" || !s.lastResumedAt) return Math.max(0, Math.round(base));
  return Math.max(0, Math.round(base + (now - s.lastResumedAt) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function isPomodoroRound(s: Pick<WorkSession, "sessionKind" | "title">): boolean {
  return s.sessionKind === "pomodoroRound" || s.title.endsWith("— focus round");
}

/** A manual session this long (or longer) counts as one finished focus round. */
export const MANUAL_ROUND_SECONDS = 20 * 60;

/**
 * Finished rounds for a task: Pomodoro rounds plus manual sessions started from
 * the task page, so time tracked there also moves the round and goal progress.
 */
export function completedRoundsForItem(sessions: WorkSession[], itemId: string): number {
  return sessions
    .filter((s) => s.itemId === itemId)
    .reduce((total, s) => {
      if (isPomodoroRound(s)) return total + 1;
      if (s.status !== "stopped") return total;
      return total + Math.floor(elapsedSeconds(s) / MANUAL_ROUND_SECONDS);
    }, 0);
}

export async function startSession(
  userId: string,
  item: { id: string; type: ItemType; title: string },
): Promise<string> {
  const now = Date.now();
  const id = await createRecord<WorkSession>(COL.workSessions, userId, {
    itemId: item.id,
    itemType: item.type,
    title: item.title,
    status: "running",
    startedAt: now,
    lastResumedAt: now,
    pausedAt: null,
    stoppedAt: null,
    accumulatedSeconds: 0,
    sessionKind: "manual",
  });
  void trackEvent("session_started", { item_type: item.type });
  void logActivity(userId, "Started work", item.title, item.id);
  return id;
}

export async function pauseSession(s: WorkSession): Promise<void> {
  if (s.status !== "running") return;
  await updateRecord<WorkSession>(COL.workSessions, s.id, {
    status: "paused",
    accumulatedSeconds: elapsedSeconds(s),
    lastResumedAt: null,
    pausedAt: Date.now(),
  });
}

export async function resumeSession(s: WorkSession): Promise<void> {
  if (s.status === "running") return;
  await updateRecord<WorkSession>(COL.workSessions, s.id, {
    status: "running",
    lastResumedAt: Date.now(),
    pausedAt: null,
    stoppedAt: null,
  });
}

export async function stopSession(s: WorkSession): Promise<void> {
  if (s.status === "stopped") return;
  await updateRecord<WorkSession>(COL.workSessions, s.id, {
    status: "stopped",
    accumulatedSeconds: elapsedSeconds(s),
    lastResumedAt: null,
    stoppedAt: Date.now(),
  });
  void trackEvent("session_stopped");
}

export function startOfToday(now = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Seconds worked today for a session, approximated by clamping to today. */
export function secondsToday(s: WorkSession, now = Date.now()): number {
  const dayStart = startOfToday(new Date(now));
  const end = s.stoppedAt ?? now;
  if (end < dayStart) return 0;
  return elapsedSeconds(s, now);
}

/**
 * Records a finished Pomodoro round as a completed work session so the time
 * shows up in the Dashboard's time-tracked totals for that task.
 */
export async function logCompletedRound(
  userId: string,
  item: { id: string; type: ItemType; title: string },
  seconds: number,
): Promise<string> {
  const now = Date.now();
  const total = Math.max(0, Math.round(seconds));
  const id = await createRecord<WorkSession>(COL.workSessions, userId, {
    itemId: item.id,
    itemType: item.type,
    title: `${item.title} — focus round`,
    status: "stopped",
    startedAt: now - total * 1000,
    lastResumedAt: null,
    pausedAt: null,
    stoppedAt: now,
    accumulatedSeconds: total,
    sessionKind: "pomodoroRound",
  });
  void trackEvent("pomodoro_round_completed");
  void logActivity(userId, "Completed focus round", `${Math.round(total / 60)} min`, item.id);
  return id;
}

/**
 * Credits a finished Pomodoro round to the task itself: progress advances by
 * one step and a fresh task moves to "in progress", so rounds show up in the
 * task's own stats and not only in the time totals.
 */
export async function creditRoundToItem(
  item: Pick<WorkItem, "id" | "progress" | "status">,
  step = 10,
): Promise<void> {
  const progress = Math.min(100, Math.max(0, Math.round((item.progress ?? 0) + step)));
  const patch: Partial<WorkItem> = { progress };
  if (item.status === "todo") patch.status = "in_progress";
  if (progress >= 100 && item.status !== "done") patch.status = "review";
  await updateRecord<WorkItem>(COL.items, item.id, patch);
}
