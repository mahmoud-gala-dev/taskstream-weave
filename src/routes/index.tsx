import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { useTick } from "@/hooks/useTick";
import { elapsedSeconds, formatDuration, startOfToday } from "@/lib/sessions";
import { useWorkspace } from "@/lib/workspace-store";
import { useT, type MessageKey } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Personal Work OS" },
      {
        name: "description",
        content:
          "See today's work at a glance: time tracked, active sessions, progress per topic and what is waiting for you.",
      },
      { property: "og:title", content: "Dashboard — Personal Work OS" },
      {
        property: "og:description",
        content: "Your personal work operating system: tables, tasks, topics, sessions and progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  const { items, sessions, tables, sections, loading } = useWorkspace();
  const t = useT();
  const now = useTick(1000);

  const stats = useMemo(() => {
    const dayStart = startOfToday(new Date(now));
    const today = sessions.filter((s) => (s.stoppedAt ?? now) >= dayStart);
    const secondsToday = today.reduce((acc, s) => acc + elapsedSeconds(s, now), 0);
    const running = sessions.filter((s) => s.status === "running");
    const done = items.filter((i) => i.status === "done").length;
    const avg = items.length
      ? Math.round(items.reduce((a, i) => a + (i.progress || 0), 0) / items.length)
      : 0;
    return { secondsToday, running: running.length, done, avg };
  }, [items, sessions, now]);

  const focus = useMemo(
    () =>
      items
        .filter((i) => i.status !== "done")
        .sort((a, b) => (b.progress || 0) - (a.progress || 0))
        .slice(0, 8),
    [items],
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {loading
          ? t("dashboard.syncing")
          : t("dashboard.counts", { sections: sections.length, tables: tables.length })}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("dashboard.trackedToday")} value={formatDuration(stats.secondsToday)} mono />
        <Stat label={t("dashboard.runningSessions")} value={String(stats.running)} />
        <Stat label={t("dashboard.averageProgress")} value={`${stats.avg}%`} />
        <Stat label={t("dashboard.completedItems")} value={String(stats.done)} />
      </div>

      <h2 className="mt-10 text-sm font-semibold">{t("dashboard.byStatus")}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {(["todo", "in_progress", "blocked", "review", "done"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t(`status.${s}` as MessageKey)}
            </p>
            <p className="mt-1 text-xl font-semibold">
              {items.filter((i) => i.status === s).length}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link to="/focus" className="text-primary hover:underline">
          {t("dashboard.startFocus")}
        </Link>
        <Link to="/assistant" className="text-primary hover:underline">
          {t("dashboard.seePlan")}
        </Link>
      </div>

      <h2 className="mt-10 text-sm font-semibold">{t("dashboard.closestToDone")}</h2>

      <div className="mt-3 space-y-2">
        {focus.map((i) => (
          <Link
            key={i.id}
            to="/item/$itemId"
            params={{ itemId: i.id }}
            className="block rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm">{i.title}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(`status.${i.status}` as MessageKey)}
              </span>
              <span className="w-10 text-end text-xs text-muted-foreground">{i.progress}%</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-muted">
              <div className="h-1 rounded-full bg-primary" style={{ width: `${i.progress}%` }} />
            </div>
          </Link>
        ))}
        {!focus.length && !loading ? (
          <p className="text-sm text-muted-foreground">
            {t("dashboard.emptyPrefix")}{" "}
            <Link to="/tables" className="text-primary hover:underline">
              {t("nav.tables")}
            </Link>{" "}
            {t("dashboard.emptySuffix")}
          </p>
        ) : null}
      </div>
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
