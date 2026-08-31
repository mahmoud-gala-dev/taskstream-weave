import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { StatStrip } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { elapsedSeconds, formatDuration } from "@/lib/sessions";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-store";
import { cn } from "@/lib/utils";
import type { WorkSession } from "@/lib/types";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Personal Work OS" },
      {
        name: "description",
        content:
          "A month view of every Pomodoro round and tracked minute, with per-day details linked to the weekly report.",
      },
      { property: "og:title", content: "Calendar — Personal Work OS" },
      {
        property: "og:description",
        content: "Month view of Pomodoro rounds and tracked time, day by day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <CalendarPage />
    </AppShell>
  ),
});

const isRound = (s: WorkSession) => s.title.endsWith("— focus round");
const dayKey = (ms: number) => new Date(ms).toDateString();

function CalendarPage() {
  const t = useT();
  const { sessions } = useWorkspace();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string>(() => new Date().toDateString());

  const view = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    base.setHours(0, 0, 0, 0);
    return base;
  }, [monthOffset]);

  const byDay = useMemo(() => {
    const map = new Map<string, { rounds: number; seconds: number; list: WorkSession[] }>();
    for (const s of sessions) {
      const key = dayKey(s.stoppedAt ?? s.startedAt);
      const entry = map.get(key) ?? { rounds: 0, seconds: 0, list: [] };
      entry.seconds += elapsedSeconds(s);
      if (isRound(s)) entry.rounds += 1;
      entry.list.push(s);
      map.set(key, entry);
    }
    return map;
  }, [sessions]);

  const cells = useMemo(() => {
    const first = new Date(view);
    const lead = first.getDay();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const out: Array<Date | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push(new Date(view.getFullYear(), view.getMonth(), d));
    }
    return out;
  }, [view]);

  const monthStats = useMemo(() => {
    let rounds = 0;
    let seconds = 0;
    for (const date of cells) {
      if (!date) continue;
      const entry = byDay.get(date.toDateString());
      if (!entry) continue;
      rounds += entry.rounds;
      seconds += entry.seconds;
    }
    return { rounds, seconds };
  }, [cells, byDay]);

  const day = byDay.get(selected);
  const weekdays = useMemo(() => {
    const ref = new Date(2024, 8, 1); // a Sunday
    return Array.from({ length: 7 }, (_, i) =>
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + i).toLocaleDateString(undefined, {
        weekday: "short",
      }),
    );
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("calendar.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("calendar.subtitle")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label={t("calendar.prev")}
          onClick={() => setMonthOffset((m) => m - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium">
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("calendar.next")}
          onClick={() => setMonthOffset((m) => m + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMonthOffset(0)}>
          {t("calendar.today")}
        </Button>
        <span className="ms-auto flex gap-4">
          <Link
            to="/daily"
            search={{ date: selected }}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("calendar.openDaily")}
          </Link>
          <Link to="/report" className="text-sm text-primary underline-offset-4 hover:underline">
            {t("calendar.openReport")}
          </Link>
        </span>
      </div>

      <StatStrip
        stats={[
          { label: t("calendar.monthRounds"), value: monthStats.rounds },
          { label: t("calendar.monthTracked"), value: formatDuration(monthStats.seconds) },
        ]}
      />

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} />;
          const key = date.toDateString();
          const entry = byDay.get(key);
          const isToday = key === new Date().toDateString();
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "flex min-h-16 flex-col items-start rounded-lg border p-1.5 text-start text-xs transition-colors",
                key === selected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50",
                isToday && "ring-1 ring-primary/40",
              )}
            >
              <span className="font-medium">{date.getDate()}</span>
              {entry ? (
                <>
                  <span className="mt-auto text-[11px] text-primary">
                    {entry.rounds} · {formatDuration(entry.seconds)}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">
          {t("calendar.details", { date: new Date(selected).toLocaleDateString() })}
        </h2>
        {!day ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("calendar.emptyDay")}</p>
        ) : (
          <>
            <StatStrip
              stats={[
                { label: t("calendar.dayRounds"), value: day.rounds },
                { label: t("calendar.dayTracked"), value: formatDuration(day.seconds) },
              ]}
            />
            <ul className="mt-3 space-y-2">
              {[...day.list]
                .sort((a, b) => (b.stoppedAt ?? b.startedAt) - (a.stoppedAt ?? a.startedAt))
                .map((s) => (
                  <li key={s.id}>
                    <Link
                      to="/item/$itemId"
                      params={{ itemId: s.itemId }}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2 text-sm transition-colors hover:border-primary/50"
                    >
                      <span className="min-w-0 flex-1 truncate">{s.title}</span>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {new Date(s.startedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-mono text-xs" dir="ltr">
                        {formatDuration(elapsedSeconds(s))}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
