import { useEffect, useMemo } from "react";

import { completedRoundsForItem } from "@/lib/sessions";
import { useSettings } from "@/lib/settings-store";
import { useWorkspace } from "@/lib/workspace-store";

type Reminder = { id: string; at: number; title: string; body: string; sent: boolean };

/** Mirrors due-task reminders into the service worker and checks while the app is open. */
export function ReminderScheduler() {
  const { items, sessions } = useWorkspace();
  const { settings } = useSettings();
  const reminders = useMemo<Reminder[]>(() => {
    if (!settings.notificationsEnabled) return [];
    const now = Date.now();
    return items.flatMap((item) => {
      if (item.type !== "task" || item.status === "done" || !item.dueDate) return [];
      const done = completedRoundsForItem(sessions, item.id);
      const left = Math.max(0, (item.estimatedRounds ?? 0) - done);
      const body = left
        ? `${left} focus round${left === 1 ? "" : "s"} remaining before the due time.`
        : "This task is due soon.";
      const lead = Math.max(15 * 60_000, Math.min(24 * 60 * 60_000, left * settings.focusMinutes * 60_000));
      return [{ id: `due-${item.id}-${item.dueDate}`, at: Math.max(now, item.dueDate - lead), title: item.title, body, sent: false }];
    });
  }, [items, sessions, settings.notificationsEnabled, settings.focusMinutes]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then(async (registration) => {
      registration.active?.postMessage({ type: "WORK_OS_SCHEDULE", rows: reminders });
      const periodic = registration as ServiceWorkerRegistration & {
        periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
      };
      await periodic.periodicSync?.register("work-os-reminders", { minInterval: 15 * 60_000 }).catch(() => undefined);
    });
  }, [reminders]);

  return null;
}