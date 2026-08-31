import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { COL, updateRecord, watchUserCollection } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { usePomodoro } from "@/lib/pomodoro-store";
import { elapsedSeconds, formatDuration, startOfToday } from "@/lib/sessions";
import { useWorkspace } from "@/lib/workspace-store";
import type { PageNote, Priority, WorkItem } from "@/lib/types";

const DAY = 86_400_000;

/**
 * The single home surface: what is due, the running focus timer and the notes
 * captured today — so the day starts on one page instead of four reports.
 */
export function TodayView() {
  const t = useT();
  const { items, sessions, userId } = useWorkspace();
  const now = useTick(1000);
  const pomodoro = usePomodoro();
  const [notes, setNotes] = useState<PageNote[]>([]);

  useEffect(() => {
    if (!userId) return;
    let stop: (() => void) | undefined;
    void watchUserCollection<PageNote>(COL.pageNotes, userId, setNotes).then((fn) => {
      stop = fn;
    });
    return () => stop?.();
  }, [userId]);

  const dayStart = startOfToday(new Date(now));

  const buckets = useMemo(() => {
    const open = items.filter((i) => i.type === "task" && i.status !== "done");
    const rank: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const by = (a: WorkItem, b: WorkItem) =>
      (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) ||
      rank[a.priority ?? "normal"] - rank[b.priority ?? "normal"];
    return {
      overdue: open.filter((i) => i.dueDate && i.dueDate < dayStart).sort(by),
      today: open.filter((i) => i.dueDate && i.dueDate >= dayStart && i.dueDate < dayStart + DAY).sort(by),
      upcoming: open
        .filter((i) => !i.dueDate || i.dueDate >= dayStart + DAY)
        .sort(by)
        .slice(0, 6),
    };
  }, [items, dayStart]);

  const todaysSessions = sessions.filter((s) => (s.stoppedAt ?? now) >= dayStart);
  const trackedToday = todaysSessions.reduce((acc, s) => acc + elapsedSeconds(s, now), 0);
  const roundsToday = todaysSessions.filter((s) => s.title.endsWith("— focus round")).length;
  const todayNotes = notes.filter((n) => (n.createdAt ?? 0) >= dayStart);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">{t("today.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("today.subtitle")}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t("today.tracked")} value={formatDuration(trackedToday)} mono />
        <Stat label={t("today.roundsToday")} value={String(roundsToday)} />
        <Stat label={t("dashboard.runningSessions")} value={String(sessions.filter((s) => s.status === "running").length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("today.due")}</h2>
          <Group title={t("today.overdue")} rows={buckets.overdue} tone="text-destructive" />
          <Group title={t("today.dueToday")} rows={buckets.today} />
          <Group title={t("today.upcoming")} rows={buckets.upcoming} />
          {!buckets.overdue.length && !buckets.today.length && !buckets.upcoming.length ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("today.noDue")}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("today.timer")}</h2>
          <p className="mt-3 font-mono text-4xl" dir="ltr">
            {formatDuration(pomodoro.remaining)}
          </p>
          <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${pomodoro.percent}%` }} />
          </span>
          <div className="mt-3 flex flex-wrap gap-2">
            {pomodoro.running ? (
              <Button size="sm" variant="outline" onClick={pomodoro.pause}>
                {t("today.pause")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => void pomodoro.start()}>
                {t("today.start")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={pomodoro.reset}>
              {t("today.reset")}
            </Button>
          </div>

          <h3 className="mt-6 text-sm font-semibold">{t("today.notes")}</h3>
          <ul className="mt-2 space-y-2">
            {todayNotes.map((n) => (
              <li key={n.id} className="rounded-md border border-border p-2 text-sm whitespace-pre-wrap">
                {n.body || "…"}
              </li>
            ))}
          </ul>
          {!todayNotes.length ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("today.noNotes")}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link to="/report" className="text-primary hover:underline">
              {t("nav.report")}
            </Link>
            <Link to="/daily" className="text-primary hover:underline">
              {t("nav.daily")}
            </Link>
            <Link to="/calendar" className="text-primary hover:underline">
              {t("nav.calendar")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Group({ title, rows, tone }: { title: string; rows: WorkItem[]; tone?: string }) {
  const t = useT();
  const pomodoro = usePomodoro();
  if (!rows.length) return null;
  return (
    <div className="mt-4">
      <p className={`text-xs uppercase tracking-wide ${tone ?? "text-muted-foreground"}`}>{title}</p>
      <ul className="mt-2 space-y-2">
        {rows.map((i) => (
          <li key={i.id} className="rounded-lg border border-border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/item/$itemId" params={{ itemId: i.id }} className="min-w-0 flex-1 truncate text-sm hover:underline">
                {i.title}
              </Link>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t(`priority.${i.priority ?? "normal"}` as "priority.low")}
              </span>
              {i.dueDate ? (
                <span className="text-[11px] text-muted-foreground" dir="ltr">
                  {new Date(i.dueDate).toLocaleDateString()}
                </span>
              ) : null}
              {i.estimatedRounds ? (
                <span className="text-[11px] text-muted-foreground">
                  {t("plan.estimateShort", { rounds: i.estimatedRounds })}
                </span>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => pomodoro.setTaskId(i.id)}>
                {t("today.focusOn")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void updateRecord<WorkItem>(COL.items, i.id, {
                    status: "done",
                    progress: 100,
                    completedAt: Date.now(),
                  }).catch(() => toast.error(t("plan.saveFailed")))
                }
              >
                {t("today.markDone")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl ${mono ? "font-mono" : "font-semibold"}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}
