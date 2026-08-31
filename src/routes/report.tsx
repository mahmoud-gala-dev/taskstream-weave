import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { StatStrip } from "@/components/list-pagination";
import { elapsedSeconds, formatDuration, isPomodoroRound } from "@/lib/sessions";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-store";
import type { ItemType } from "@/lib/types";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Weekly report — Personal Work OS" },
      {
        name: "description",
        content:
          "Last seven days at a glance: Pomodoro rounds, tracked time and progress for every task and topic.",
      },
      { property: "og:title", content: "Weekly report — Personal Work OS" },
      {
        property: "og:description",
        content: "Pomodoro rounds, tracked time and progress per task and topic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ReportPage />
    </AppShell>
  ),
});

const DAY = 86_400_000;

/**
 * Weekly report. Everything is derived from the live workspace listeners, so the
 * numbers are recomputed on every visit without an explicit refresh action.
 */
function ReportPage() {
  const t = useT();
  const { items, sessions, placements, tables } = useWorkspace();

  const report = useMemo(() => {
    const now = Date.now();
    const from = now - 7 * DAY;
    const recent = sessions.filter((s) => (s.stoppedAt ?? s.startedAt) >= from);

    const perItem = new Map<string, { rounds: number; seconds: number }>();
    for (const s of recent) {
      const entry = perItem.get(s.itemId) ?? { rounds: 0, seconds: 0 };
      entry.seconds += elapsedSeconds(s, now);
      if (isPomodoroRound(s)) entry.rounds += 1;
      perItem.set(s.itemId, entry);
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(now - (6 - i) * DAY);
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + DAY;
      const rounds = recent.filter(
        (s) =>
          isPomodoroRound(s) &&
          (s.stoppedAt ?? s.startedAt) >= start.getTime() &&
          (s.stoppedAt ?? s.startedAt) < end,
      ).length;
      return { label: start.toLocaleDateString(undefined, { weekday: "short" }), rounds };
    });

    const rounds = [...perItem.values()].reduce((n, e) => n + e.rounds, 0);
    const seconds = [...perItem.values()].reduce((n, e) => n + e.seconds, 0);
    const avg = items.length
      ? Math.round(items.reduce((sum, i) => sum + (i.progress ?? 0), 0) / items.length)
      : 0;

    const rows = (type: ItemType) =>
      items
        .filter((i) => i.type === type)
        .map((i) => ({ item: i, ...(perItem.get(i.id) ?? { rounds: 0, seconds: 0 }) }))
        .sort((a, b) => b.seconds - a.seconds || b.item.progress - a.item.progress);

    return {
      rounds,
      seconds,
      touched: perItem.size,
      avg,
      days,
      estimates: items
        .filter((i) => i.type === "task" && (i.estimatedRounds ?? 0) > 0)
        .map((i) => ({
          item: i,
          estimated: i.estimatedRounds ?? 0,
          actual: perItem.get(i.id)?.rounds ?? 0,
        }))
        .sort((a, b) => Math.abs(b.actual - b.estimated) - Math.abs(a.actual - a.estimated))
        .slice(0, 12),
      docs: items
        .filter((i) => (i.descriptionHtml ?? "").replace(/<[^>]*>/g, "").trim().length > 0)
        .map((i) => {
          const text = (i.descriptionHtml ?? "").replace(/<[^>]*>/g, " ");
          const placement = placements.find((pl) => pl.itemId === i.id);
          const table = placement ? tables.find((tb) => tb.id === placement.tableId) : undefined;
          return {
            item: i,
            words: text.split(/\s+/).filter(Boolean).length,
            table: table?.name ?? null,
            updatedAt: i.updatedAt ?? i.createdAt ?? 0,
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12),
      goals: items
        .filter((i) => i.type === "topic")
        .map((topic) => {
          const children = items.filter((i) => i.type === "task" && i.parentTopicId === topic.id);
          const estimated = children.reduce((n, child) => n + (child.estimatedRounds ?? 0), 0);
          const actual = children.reduce((n, child) => n + (perItem.get(child.id)?.rounds ?? 0), 0);
          return {
            topic,
            count: children.length,
            roundProgress: estimated ? Math.min(100, Math.round((actual / estimated) * 100)) : 0,
            avg: children.length
              ? Math.round(children.reduce((n, c) => n + (c.progress ?? 0), 0) / children.length)
              : 0,
          };
        })
        .filter((g) => g.count > 0)
        .sort((a, b) => Math.abs(b.topic.progress - b.avg) - Math.abs(a.topic.progress - a.avg)),
      tasks: rows("task"),
      topics: rows("topic"),
      updatedAt: now,
    };
  }, [items, sessions, placements, tables]);

  const maxRounds = Math.max(1, ...report.days.map((d) => d.rounds));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">{t("report.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("report.subtitle")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("report.updated", { time: new Date(report.updatedAt).toLocaleTimeString() })}
      </p>

      <p className="mt-2">
        <Link to="/calendar" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("calendar.openCalendar")}
        </Link>
      </p>

      <StatStrip
        stats={[
          { label: t("report.rounds"), value: report.rounds },
          { label: t("report.tracked"), value: formatDuration(report.seconds) },
          { label: t("report.tasksTouched"), value: report.touched },
          { label: t("report.avgProgress"), value: `${report.avg}%` },
        ]}
      />

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("report.byDay")}</h2>
        <div className="mt-4 flex h-32 items-end gap-2">
          {report.days.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{d.rounds}</span>
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${(d.rounds / maxRounds) * 100}%`, minHeight: 2 }}
              />
              <span className="text-[11px] text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("report.estimateVsActual")}</h2>
        {report.estimates.length ? (
          <ul className="mt-3 space-y-2">
            {report.estimates.map(({ item, estimated, actual }) => {
              const accuracy = Math.round((Math.min(estimated, actual) / Math.max(estimated, actual || 1)) * 100);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {t("report.estimated")} {estimated} · {t("report.actual")} {actual}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("report.accuracy")} {accuracy}% ·{" "}
                    {actual <= estimated ? t("report.overEstimate") : t("report.underEstimate")}
                  </span>
                  <span className="w-32">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full ${actual > estimated ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, (actual / Math.max(1, estimated)) * 100)}%` }}
                      />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("report.noEstimates")}</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("report.goals")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("report.goalsHint")}</p>
        {report.goals.length ? (
          <ul className="mt-3 space-y-2">
            {report.goals.map(({ topic, count, avg, roundProgress }) => (
              <li key={topic.id} className="rounded-lg border border-border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Link to="/item/$itemId" params={{ itemId: topic.id }} className="min-w-0 flex-1 truncate hover:underline">
                    {topic.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">{t("goals.taskCount", { count })}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                     {t("report.goalProgress")} {roundProgress}% · {t("report.subtaskAvg")} {avg}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                     {roundProgress >= avg ? t("report.gapAhead") : t("report.gapBehind")}
                  </span>
                </div>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${roundProgress}%` }} />
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary/50" style={{ width: `${Math.min(100, avg)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("report.goalsNone")}</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("report.docs")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("report.docsHint")}</p>
        {report.docs.length ? (
          <ul className="mt-3 space-y-2">
            {report.docs.map(({ item, words, table, updatedAt }) => (
              <li key={item.id}>
                <Link
                  to="/item/$itemId"
                  params={{ itemId: item.id }}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2 text-sm transition-colors hover:border-primary/50"
                >
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {table ? (
                    <span className="text-xs text-muted-foreground">{t("report.docsTable", { table })}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{t("report.docsWords", { count: words })}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {t("report.docsUpdated", { date: new Date(updatedAt).toLocaleDateString() })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("report.docsNone")}</p>
        )}
      </section>

      <Breakdown title={t("report.tasks")} rows={report.tasks} />
      <Breakdown title={t("report.topics")} rows={report.topics} />

      {!report.rounds ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("report.empty")}</p>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ item: { id: string; title: string; progress: number }; rounds: number; seconds: number }>;
}) {
  const t = useT();
  if (!rows.length) return null;
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.map(({ item, rounds, seconds }) => (
          <li key={item.id}>
            <Link
              to="/item/$itemId"
              params={{ itemId: item.id }}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2 text-sm transition-colors hover:border-primary/50"
            >
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {rounds} · {formatDuration(seconds)}
              </span>
              <span className="w-32">
                <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, item.progress ?? 0)}%` }}
                  />
                </span>
              </span>
              <span className="w-10 text-end text-xs text-muted-foreground">
                {item.progress ?? 0}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <span className="sr-only">{t("report.progress")}</span>
    </section>
  );
}
