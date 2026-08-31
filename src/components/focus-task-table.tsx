import { Link } from "@tanstack/react-router";
import { Camera, CheckCircle2, ExternalLink, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { useT } from "@/lib/i18n";
import { elapsedSeconds, formatDuration, logCompletedRound } from "@/lib/sessions";
import { useSettings, type ReminderStyle } from "@/lib/settings-store";
import { captureElement, saveSnapshot, snapshotTooLarge } from "@/lib/table-snapshot";
import type { WorkItem, WorkSession } from "@/lib/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "work-os:focus-page-timers";

type Timers = Record<string, { endsAt: number | null; pausedRemaining: number | null; warned: boolean }>;

/**
 * Inline table on the Focus page: every open task with its own live timer,
 * progress bar and recorded results — no need to jump back to /tables.
 */
export function FocusTaskTable({
  userId,
  items,
  sessions,
  activeItemId,
  onSelect,
}: {
  userId: string | null;
  items: WorkItem[];
  sessions: WorkSession[];
  activeItemId?: string;
  onSelect?: (itemId: string) => void;
}) {
  const { settings, update } = useSettings();
  const t = useT();
  const now = useTick(1000);
  const tableRef = useRef<HTMLElement | null>(null);
  const [capturing, setCapturing] = useState(false);
  const total = Math.max(1, settings.focusMinutes) * 60;
  const [timers, setTimers] = useState<Timers>({});
  const [restored, setRestored] = useState(false);
  const completing = useRef(new Set<string>());

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setTimers(JSON.parse(saved) as Timers);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }, [restored, timers]);

  // Per-item results derived from the realtime sessions collection.
  const results = useMemo(() => {
    const map = new Map<string, { rounds: number; seconds: number }>();
    for (const session of sessions) {
      const entry = map.get(session.itemId) ?? { rounds: 0, seconds: 0 };
      entry.seconds += elapsedSeconds(session, now);
      if (session.title.endsWith("— focus round")) entry.rounds += 1;
      map.set(session.itemId, entry);
    }
    return map;
  }, [sessions, now]);

  function remainingFor(id: string): number {
    const timer = timers[id];
    if (!timer) return total;
    if (timer.pausedRemaining !== null) return timer.pausedRemaining;
    if (timer.endsAt) return Math.max(0, Math.round((timer.endsAt - now) / 1000));
    return total;
  }

  // Warn near the end and record the round the moment a timer reaches zero.
  useEffect(() => {
    for (const [id, timer] of Object.entries(timers)) {
      if (!timer.endsAt || timer.pausedRemaining !== null) continue;
      const item = items.find((candidate) => candidate.id === id);
      const remaining = Math.max(0, Math.round((timer.endsAt - now) / 1000));

      if (!timer.warned && remaining > 0 && remaining <= settings.notifyBeforeEndSeconds) {
        setTimers((current) => ({ ...current, [id]: { ...current[id]!, warned: true } }));
        const style = settings.reminderStyle;
        if (style === "toast" || style === "both") {
          toast.info(t("focus.notify.endingSoonTitle"), {
            description: t("focus.notify.endingSoonDesc", {
              title: item?.title ?? "Task",
              minutes: Math.max(1, Math.ceil(remaining / 60)),
            }),
          });
        }
        if (
          (style === "browser" || style === "both") &&
          settings.notificationsEnabled &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(t("focus.notify.endingSoonTitle"), {
              body: item?.title ?? "Focus round",
              tag: `focus-${id}`,
            });
          } catch {
            /* best effort */
          }
        }
      }

      if (remaining === 0 && !completing.current.has(id)) {
        completing.current.add(id);
        setTimers((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        if (item && settings.notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(t("focus.notify.roundCompleteTitle"), {
            body: settings.focusDoneMessage
              .replace("{task}", item.title)
              .replace("{minutes}", String(Math.round(total / 60))),
            tag: `focus-done-${id}`,
          });
        }
        if (userId && item) {
          void logCompletedRound(userId, { id: item.id, type: item.type, title: item.title }, total)
            .then(() => toast.success(t("focus.notify.roundRecorded"), { description: item.title }))
            .catch(() => toast.error(t("focus.notify.roundRecordFailed")))
            .finally(() => completing.current.delete(id));
        } else {
          completing.current.delete(id);
        }
      }
    }
  }, [
    now,
    timers,
    items,
    settings.notifyBeforeEndSeconds,
    settings.notificationsEnabled,
    settings.reminderStyle,
    settings.focusDoneMessage,
    total,
    userId,
  ]);

  async function captureTable() {
    if (!tableRef.current) return;
    setCapturing(true);
    try {
      const dataUrl = await captureElement(tableRef.current);
      if (snapshotTooLarge(dataUrl)) {
        toast.error(t("focus.table.snapshotTooLarge"));
        return;
      }
      saveSnapshot(dataUrl);
      toast.success(t("focus.table.snapshotReady"), {
        description: t("focus.table.snapshotReadyDesc"),
      });
    } catch {
      toast.error(t("focus.table.snapshotFailed"));
    } finally {
      setCapturing(false);
    }
  }

  async function start(id: string) {
    if (settings.notificationsEnabled && typeof Notification !== "undefined") {
      if (Notification.permission === "default") await Notification.requestPermission();
    }
    const remaining = remainingFor(id);
    setTimers((current) => ({
      ...current,
      [id]: { endsAt: Date.now() + remaining * 1000, pausedRemaining: null, warned: false },
    }));
    onSelect?.(id);
  }

  function pause(id: string) {
    const remaining = remainingFor(id);
    setTimers((current) => ({
      ...current,
      [id]: { endsAt: null, pausedRemaining: remaining, warned: current[id]?.warned ?? false },
    }));
  }

  function reset(id: string) {
    setTimers((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  if (!items.length) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("focus.table.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("focus.table.empty")}</p>
      </section>
    );
  }

  return (
    <section ref={tableRef} className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Timer className="size-4" />
        <h2 className="text-sm font-semibold">{t("focus.table.title")}</h2>
        <span className="text-xs text-muted-foreground">{t("focus.table.openCount", { count: items.length })}</span>
        <Button
          size="sm"
          variant="outline"
          className="ms-auto"
          disabled={capturing}
          onClick={() => void captureTable()}
        >
          <Camera className="size-3.5" /> {capturing ? t("focus.table.capturing") : t("focus.table.snapshot")}
        </Button>
      </header>
      <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/30 px-4 py-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">{t("focus.table.roundsPerTask")}</span>
          <input
            type="number"
            min={1}
            max={20}
            value={settings.focusRoundsTarget}
            onChange={(e) => update({ focusRoundsTarget: Math.max(1, Number(e.target.value) || 1) })}
            className="h-8 w-20 rounded-md border border-input bg-background px-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">{t("focus.table.minutesPerRound")}</span>
          <input
            type="number"
            min={1}
            max={180}
            value={settings.focusMinutes}
            onChange={(e) => update({ focusMinutes: Math.max(1, Number(e.target.value) || 1) })}
            className="h-8 w-20 rounded-md border border-input bg-background px-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">{t("focus.table.reminderBeforeEnd")}</span>
          <select
            value={settings.reminderStyle}
            onChange={(e) => update({ reminderStyle: e.target.value as ReminderStyle })}
            className="h-8 rounded-md border border-input bg-background px-2"
          >
            <option value="both">{t("focus.table.reminderBoth")}</option>
            <option value="toast">{t("focus.table.reminderToast")}</option>
            <option value="browser">{t("focus.table.reminderBrowser")}</option>
            <option value="off">{t("focus.table.reminderOff")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">{t("focus.table.remindSecondsEarly")}</span>
          <input
            type="number"
            min={5}
            max={900}
            step={5}
            value={settings.notifyBeforeEndSeconds}
            onChange={(e) =>
              update({ notifyBeforeEndSeconds: Math.max(5, Number(e.target.value) || 5) })
            }
            className="h-8 w-24 rounded-md border border-input bg-background px-2"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-start font-medium">{t("focus.table.colTask")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("focus.table.colTimer")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("focus.table.colProgress")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("focus.table.colRounds")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("focus.table.colTracked")}</th>
              <th className="px-4 py-2 text-end font-medium">{t("focus.table.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const timer = timers[item.id];
              const running = !!timer?.endsAt && timer.pausedRemaining === null;
              const remaining = remainingFor(item.id);
              const percent = Math.min(100, Math.round(((total - remaining) / total) * 100));
              const result = results.get(item.id);
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-t border-border/70 align-middle",
                    activeItemId === item.id && "bg-primary/5",
                  )}
                >
                  <td className="max-w-[22rem] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] uppercase text-muted-foreground">
                        {item.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums" dir="ltr">
                    {formatDuration(remaining)}
                  </td>
                  <td className="w-48 px-3 py-2.5">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-500",
                          running ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{percent}%</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="size-3.5" />
                      {result?.rounds ?? 0} / {settings.focusRoundsTarget}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground" dir="ltr">
                    {formatDuration(Math.round(result?.seconds ?? 0))}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {running ? (
                        <Button size="sm" variant="outline" onClick={() => pause(item.id)}>
                          <Pause className="size-3.5" /> {t("focus.actions.pause")}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => void start(item.id)}>
                          <Play className="size-3.5" />
                          {remaining === total ? t("focus.actions.start") : t("focus.actions.resume")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reset(item.id)}
                        aria-label={t("focus.table.resetAria", { title: item.title })}
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/item/$itemId" params={{ itemId: item.id }} aria-label={t("focus.table.openAria", { title: item.title })}>
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
