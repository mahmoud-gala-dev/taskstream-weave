import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { StatStrip } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { elapsedSeconds, formatDuration } from "@/lib/sessions";
import { useTick } from "@/hooks/useTick";
import { useWorkspace } from "@/lib/workspace-store";
import type { ItemType, WorkSession } from "@/lib/types";

export const Route = createFileRoute("/daily")({
  validateSearch: (search: Record<string, unknown>): { date?: string } =>
    typeof search["date"] === "string" ? { date: search["date"] } : {},
  head: () => ({
    meta: [
      { title: "Daily report — Personal Work OS" },
      {
        name: "description",
        content:
          "Today at a glance: Pomodoro rounds and tracked time per topic and per task, refreshed every time you open it.",
      },
      { property: "og:title", content: "Daily report — Personal Work OS" },
      {
        property: "og:description",
        content: "Pomodoro rounds and tracked time per topic and task, day by day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <DailyPage />
    </AppShell>
  ),
});

const DAY = 86_400_000;
const isRound = (s: WorkSession) => s.title.endsWith("— focus round");

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

/**
 * Daily report. Numbers come from the live workspace listeners and a one-minute
 * tick, so the page is always current on open without a refresh button.
 */
function DailyPage() {
  const t = useT();
  const { items, sessions } = useWorkspace();
  const search = Route.useSearch();
  const now = useTick(60_000);

  const [offset, setOffset] = useState(0);
  const base = useMemo(() => {
    const fromSearch = search.date ? new Date(search.date) : null;
    const valid = fromSearch && !Number.isNaN(fromSearch.getTime()) ? fromSearch : new Date();
    return new Date(startOfDay(valid) + offset * DAY);
  }, [search.date, offset]);

  const dayStart = startOfDay(base);
  const dayEnd = dayStart + DAY;

  const report = useMemo(() => {
    const inDay = sessions.filter((s) => {
      const at = s.stoppedAt ?? s.startedAt;
      return at >= dayStart && at < dayEnd;
    });

    const per = new Map<string, { rounds: number; seconds: number }>();
    for (const s of inDay) {
      const e = per.get(s.itemId) ?? { rounds: 0, seconds: 0 };
      e.seconds += elapsedSeconds(s, now);
      if (isRound(s)) e.rounds += 1;
      per.set(s.itemId, e);
    }

    const rows = (type: ItemType) =>
      items
        .filter((i) => i.type === type && per.has(i.id))
        .map((i) => ({ item: i, ...(per.get(i.id) ?? { rounds: 0, seconds: 0 }) }))
        .sort((a, b) => b.seconds - a.seconds);

    const rounds = [...per.values()].reduce((n, e) => n + e.rounds, 0);
    const seconds = [...per.values()].reduce((n, e) => n + e.seconds, 0);

    return {
      rounds,
      seconds,
      touched: per.size,
      topics: rows("topic"),
      tasks: rows("task"),
      list: [...inDay].sort((a, b) => (b.stoppedAt ?? b.startedAt) - (a.stoppedAt ?? a.startedAt)),
    };
  }, [sessions, items, dayStart, dayEnd, now]);

  const isToday = dayStart === startOfDay(new Date());

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("daily.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("daily.subtitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("report.updated", { time: new Date(now).toLocaleTimeString() })}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" aria-label={t("daily.prev")} onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-56 text-center text-sm font-medium">
          {base.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        <Button size="icon" variant="outline" aria-label={t("daily.next")} onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight className="size-4" />
        </Button>
        {!isToday ? (
          <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>
            {t("calendar.today")}
          </Button>
        ) : null}
        <span className="ms-auto flex gap-4">
          <Link to="/calendar" className="text-sm text-primary underline-offset-4 hover:underline">
            {t("calendar.openCalendar")}
          </Link>
          <Link to="/report" className="text-sm text-primary underline-offset-4 hover:underline">
            {t("calendar.openReport")}
          </Link>
        </span>
      </div>

      <StatStrip
        stats={[
          { label: t("report.rounds"), value: report.rounds },
          { label: t("report.tracked"), value: formatDuration(report.seconds) },
          { label: t("daily.itemsTouched"), value: report.touched },
          { label: t("daily.topicsTouched"), value: report.topics.length },
        ]}
      />

      <Breakdown title={t("daily.byTopic")} rows={report.topics} />
      <Breakdown title={t("daily.byTask")} rows={report.tasks} />

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("daily.timeline")}</h2>
        {!report.list.length ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("daily.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {report.list.map((s) => (
              <li key={s.id}>
                <Link
                  to="/item/$itemId"
                  params={{ itemId: s.itemId }}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2 text-sm transition-colors hover:border-primary/50"
                >
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-mono text-xs" dir="ltr">
                    {formatDuration(elapsedSeconds(s, now))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
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
    <section className="rounded-xl border border-border bg-card p-4">
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
              <span className="w-10 text-end text-xs text-muted-foreground">{item.progress ?? 0}%</span>
            </Link>
          </li>
        ))}
      </ul>
      <span className="sr-only">{t("report.progress")}</span>
    </section>
  );
}
