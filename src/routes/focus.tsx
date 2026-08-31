import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Bell, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { FocusTaskTable } from "@/components/focus-task-table";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { creditRoundToItem, formatDuration, logCompletedRound } from "@/lib/sessions";
import { useSettings } from "@/lib/settings-store";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-store";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ item: z.string().optional() });

export const Route = createFileRoute("/focus")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Pomodoro Focus — Personal Work OS" },
      {
        name: "description",
        content:
          "Run focus rounds on any task with a live progress bar, automatic breaks and browser notifications before a round ends.",
      },
      { property: "og:title", content: "Pomodoro Focus — Personal Work OS" },
      {
        property: "og:description",
        content: "Focus rounds, breaks and notifications for the task you are working on.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <FocusPage />
    </AppShell>
  ),
});

function FocusPage() {
  const { settings } = useSettings();
  const t = useT();
  const { items, sessions, userId } = useWorkspace();
  const search = Route.useSearch();
  const {
    phase,
    round,
    taskId,
    setTaskId,
    remaining,
    totalSeconds,
    percent,
    running,
    completedRounds,
    start,
    pause,
    reset,
    skip,
  } = usePomodoro();

  // A Pomodoro launched from a table cell preselects that task.
  useEffect(() => {
    if (search.item) setTaskId(search.item);
  }, [search.item, setTaskId]);

  const open = useMemo(() => items.filter((i) => i.status !== "done"), [items]);


  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">{t("focus.page.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("focus.page.subtitle", {
          round,
          phase:
            phase === "focus"
              ? t("focus.phase.focus")
              : phase === "break"
                ? t("focus.phase.break")
                : t("focus.phase.longBreak"),
        })}
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="focus-task">
          {t("focus.page.taskLabel")}
        </label>
        <select
          id="focus-task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">{t("focus.page.noItem")}</option>
          {open.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>

        <p className="mt-6 text-center font-mono text-5xl tabular-nums" dir="ltr">
          {formatDuration(remaining)}
        </p>

        <div className="mt-5">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                phase === "focus" ? "bg-primary" : "bg-emerald-500",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            {[0, 25, 50, 75, 100].map((m) => (
              <span key={m} className={cn(percent >= m && m > 0 && "font-semibold text-primary")}>
                {m}%
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {running ? (
            <Button onClick={pause}>
              <Pause className="size-4" /> {t("focus.actions.pause")}
            </Button>
          ) : (
            <Button onClick={() => void start()}>
              <Play className="size-4" />{" "}
              {remaining === totalSeconds ? t("focus.actions.start") : t("focus.actions.resume")}
            </Button>
          )}
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="size-4" /> {t("focus.actions.reset")}
          </Button>
          <Button variant="outline" onClick={skip}>
            <SkipForward className="size-4" /> {t("focus.actions.skip")}
          </Button>
          {settings.notificationsEnabled ? (
            <Button
              variant="ghost"
              onClick={() => void Notification?.requestPermission?.()}
              className="ml-auto"
            >
              <Bell className="size-4" /> {t("focus.actions.allowNotifications")}
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("focus.page.roundsRecordedTitle")}</h2>
        {completedRounds.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {completedRounds.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{r.title}</span>
                <span className="text-muted-foreground">{t("focus.page.minutesTracked", { minutes: r.minutes })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t("focus.page.roundsRecordedEmpty")}</p>
        )}
      </section>

      <FocusTaskTable
        userId={userId}
        items={open}
        sessions={sessions}
        activeItemId={taskId}
        onSelect={setTaskId}
      />
    </div>
  );
}
