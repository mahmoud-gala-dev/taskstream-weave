import { useEffect, useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getPushPublicKey, savePushSubscription } from "@/lib/push.functions";
import { completedRoundsForItem } from "@/lib/sessions";
import { useSettings } from "@/lib/settings-store";
import { useWorkspace } from "@/lib/workspace-store";

/** Applies the optional clock time and repeat cadence to a due date. */
function nextOccurrence(
  dueDate: number,
  dueTime: string | null,
  recurrence: "none" | "daily" | "weekly" | null,
  now: number,
): number {
  const target = new Date(dueDate);
  if (dueTime && /^\d{2}:\d{2}$/.test(dueTime)) {
    const [h, m] = dueTime.split(":").map(Number);
    target.setHours(h ?? 0, m ?? 0, 0, 0);
  }
  let at = target.getTime();
  if (recurrence === "daily" || recurrence === "weekly") {
    const step = (recurrence === "daily" ? 1 : 7) * 24 * 60 * 60_000;
    while (at < now) at += step;
  }
  return at;
}

type Reminder = { id: string; at: number; title: string; body: string; sent: boolean };

function urlBase64ToUint8Array(value: string): Uint8Array {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}


/** Mirrors due-task reminders into the service worker and checks while the app is open. */
export function ReminderScheduler() {
  const { items, sessions } = useWorkspace();
  const { settings } = useSettings();
  const { user } = useAuth();

  const reminders = useMemo<Reminder[]>(() => {
    if (!settings.notificationsEnabled) return [];
    const now = Date.now();
    return items.flatMap((item) => {
      if (item.type !== "task" || item.status === "done" || !item.dueDate) return [];
      const due = nextOccurrence(item.dueDate, item.dueTime ?? null, item.recurrence ?? "none", now);
      const done = completedRoundsForItem(sessions, item.id);
      const left = Math.max(0, (item.estimatedRounds ?? 0) - done);
      const body = left
        ? `${left} focus round${left === 1 ? "" : "s"} remaining before the due time.`
        : "This task is due soon.";
      const lead = Math.max(15 * 60_000, Math.min(24 * 60 * 60_000, left * settings.focusMinutes * 60_000));
      return [{ id: `due-${item.id}-${due}`, at: Math.max(now, due - lead), title: item.title, body, sent: false }];
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

  // Real Web Push: register this device so the server can wake it while the app is closed.
  useEffect(() => {
    const ownerKey = user?.uid;
    if (!ownerKey || !settings.notificationsEnabled) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    let cancelled = false;
    void (async () => {
      try {
        const { publicKey } = await getPushPublicKey();
        if (!publicKey || cancelled) return;
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
          }));
        const json = subscription.toJSON();
        if (cancelled || !json.endpoint || !json.keys?.['p256dh'] || !json.keys?.['auth']) return;
        await savePushSubscription({
          data: {
            ownerKey,
            endpoint: json.endpoint,
            p256dh: json.keys['p256dh'],
            auth: json.keys['auth'],
          },
        });
      } catch {
        /* push unsupported or blocked — the in-tab scheduler still runs */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, settings.notificationsEnabled]);


  return null;
}