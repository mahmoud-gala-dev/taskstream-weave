import { Bell, ExternalLink, Pause, Play, RotateCcw, Timer, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { formatDuration, logCompletedRound } from "@/lib/sessions";
import { useSettings } from "@/lib/settings-store";
import { useT } from "@/lib/i18n";
import type { WorkItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type TimerState = {
  item: WorkItem;
  endsAt: number | null;
  pausedRemaining: number | null;
  warned: boolean;
};

const STORAGE_KEY = "work-os:table-focus-timers";

export function TableFocusTray({ userId, items }: { userId: string | null; items: WorkItem[] }) {
  const { settings } = useSettings();
  const t = useT();
  const now = useTick(1000);
  const [timers, setTimers] = useState<TimerState[]>([]);
  const [restored, setRestored] = useState(false);
  const restoredOnce = useRef(false);
  const completing = useRef(new Set<string>());
  const total = settings.focusMinutes * 60;

  useEffect(() => {
    if (restoredOnce.current || !items.length) return;
    restoredOnce.current = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<Omit<TimerState, "item"> & { itemId: string }>;
        setTimers(
          parsed.flatMap((timer) => {
            const item = items.find((candidate) => candidate.id === timer.itemId);
            return item ? [{ item, endsAt: timer.endsAt, pausedRemaining: timer.pausedRemaining, warned: timer.warned }] : [];
          }),
        );
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setRestored(true);
    }
  }, [items]);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        timers.map((timer) => ({
          itemId: timer.item.id,
          endsAt: timer.endsAt,
          pausedRemaining: timer.pausedRemaining,
          warned: timer.warned,
        })),
      ),
    );
  }, [restored, timers]);

  useEffect(() => {
    for (const timer of timers) {
      if (!timer.endsAt || timer.pausedRemaining !== null) continue;
      const remaining = Math.max(0, Math.round((timer.endsAt - now) / 1000));
      if (!timer.warned && remaining > 0 && remaining <= settings.notifyBeforeEndSeconds) {
        setTimers((current) => current.map((t) => (t.item.id === timer.item.id ? { ...t, warned: true } : t)));
        toast.info(t("focus.notify.endingSoonTitle"), {
          description: t("focus.notify.endingSoonDesc", {
            title: timer.item.title,
            minutes: Math.max(1, Math.ceil(remaining / 60)),
          }),
        });
        if (settings.notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(t("focus.notify.endingSoonTitle"), { body: timer.item.title, tag: `focus-${timer.item.id}` });
        }
      }
      if (remaining === 0 && !completing.current.has(timer.item.id)) {
        completing.current.add(timer.item.id);
        // Real Chrome notification when the round ends; the round time is also
        // written as a work session so it shows in the Dashboard totals.
        if (settings.notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(t("focus.notify.roundCompleteTitle"), {
            body: settings.focusDoneMessage
              .replace("{task}", timer.item.title)
              .replace("{minutes}", String(Math.round(total / 60))),
            tag: `focus-done-${timer.item.id}`,
          });
        }
        if (userId) {
          void logCompletedRound(userId, timer.item, total)
            .then(() => toast.success(t("focus.notify.roundRecorded"), { description: timer.item.title }))
            .catch(() => toast.error(t("focus.notify.roundRecordFailedTray")))
            .finally(() => completing.current.delete(timer.item.id));
        }
        setTimers((current) => current.filter((t) => t.item.id !== timer.item.id));
      }
    }
  }, [now, settings.notifyBeforeEndSeconds, settings.notificationsEnabled, timers, total, userId]);

  function add(item: WorkItem) {
    setTimers((current) =>
      current.some((timer) => timer.item.id === item.id)
        ? current
        : [...current, { item, endsAt: null, pausedRemaining: null, warned: false }],
    );
  }

  useEffect(() => {
    function onStart(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      const item = items.find((candidate) => candidate.id === id);
      if (item) add(item);
    }
    window.addEventListener("work-os:start-table-focus", onStart);
    return () => window.removeEventListener("work-os:start-table-focus", onStart);
  }, [items]);

  if (!timers.length) return null;

  return (
    <section className="mb-4 border-y border-border bg-card/70 px-4 py-3" aria-label={t("focus.tray.ariaLabel")}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Timer className="size-4" /> {t("focus.tray.title")} <span className="text-xs text-muted-foreground">{timers.length}</span>
        {settings.notificationsEnabled ? <Bell className="ml-auto size-3.5 text-muted-foreground" /> : null}
      </div>
      <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {timers.map((timer) => {
          const remaining = timer.pausedRemaining ?? (timer.endsAt ? Math.max(0, Math.round((timer.endsAt - now) / 1000)) : total);
          const percent = total ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;
          const running = timer.endsAt !== null && timer.pausedRemaining === null;
          return (
            <div key={timer.item.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{timer.item.icon} {timer.item.title}</span>
                <span className="font-mono text-sm tabular-nums" dir="ltr">{formatDuration(remaining)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                {[0, 25, 50, 75, 100].map((mark) => <span key={mark} className={cn(percent >= mark && mark > 0 && "font-semibold text-primary")}>{mark}%</span>)}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Button size="icon" variant="ghost" aria-label={running ? t("focus.tray.pauseAria", { title: timer.item.title }) : t("focus.tray.startAria", { title: timer.item.title })} onClick={() => {
                  if (running) setTimers((list) => list.map((entry) => entry.item.id === timer.item.id ? { ...entry, endsAt: null, pausedRemaining: remaining } : entry));
                   else {
                     if (settings.notificationsEnabled && typeof Notification !== "undefined" && Notification.permission === "default") {
                       void Notification.requestPermission();
                     }
                     setTimers((list) => list.map((entry) => entry.item.id === timer.item.id ? { ...entry, endsAt: Date.now() + remaining * 1000, pausedRemaining: null } : entry));
                   }
                }}>{running ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
                <Button size="icon" variant="ghost" aria-label={t("focus.tray.resetAria", { title: timer.item.title })} onClick={() => setTimers((list) => list.map((entry) => entry.item.id === timer.item.id ? { ...entry, endsAt: null, pausedRemaining: null, warned: false } : entry))}><RotateCcw className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={t("focus.tray.removeAria", { title: timer.item.title })} onClick={() => setTimers((list) => list.filter((entry) => entry.item.id !== timer.item.id))}><Trash2 className="size-4" /></Button>
                <Button asChild size="icon" variant="ghost"><Link to="/focus" search={{ item: timer.item.id }} aria-label={t("focus.tray.openInFocusAria", { title: timer.item.title })}><ExternalLink className="size-4" /></Link></Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}