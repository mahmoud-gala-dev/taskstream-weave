import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { StatStrip } from "@/components/list-pagination";
import { elapsedSeconds, formatDuration } from "@/lib/sessions";
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
  const { items, sessions } = useWorkspace();

  const report = useMemo(() => {
    const now = Date.now();
    const from = now - 7 * DAY;
    const recent = sessions.filter((s) => (s.stoppedAt ?? s.startedAt) >= from);

    const perItem = new Map<string, { rounds: number; seconds: number }>();
    for (const s of recent) {
      const entry = perItem.get(s.itemId) ?? { rounds: 0, seconds: 0 };
      entry.seconds += elapsedSeconds(s, now);
      if (s.title.endsWith("— focus round")) entry.rounds += 1;
      perItem.set(s.itemId, entry);
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(now - (6 - i) * DAY);
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + DAY;
      const rounds = recent.filter(
        (s) =>
          s.title.endsWith("— focus round") &&
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
      tasks: rows("task"),
      topics: rows("topic"),
      updatedAt: now,
    };
  }, [items, sessions]);

  const maxRounds = Math.max(1, ...report.days.map((d) => d.rounds));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">{t("report.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("report.subtitle")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("report.updated", { time: new Date(report.updatedAt).toLocaleTimeString() })}
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
