import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useTick } from "@/hooks/useTick";
import { creditRoundToItem, logCompletedRound } from "@/lib/sessions";
import { useSettings } from "@/lib/settings-store";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-store";

export type Phase = "focus" | "break" | "longBreak";

const POMODORO_KEY = "work-os:pomodoro";

export type CompletedRound = { id: number; title: string; minutes: number };

type Ctx = {
  phase: Phase;
  round: number;
  taskId: string;
  setTaskId: (id: string) => void;
  remaining: number;
  totalSeconds: number;
  percent: number;
  running: boolean;
  completedRounds: CompletedRound[];
  start: () => Promise<void>;
  pause: () => void;
  reset: () => void;
  skip: () => void;
};

const PomodoroContext = createContext<Ctx | null>(null);

/**
 * App-level Pomodoro engine. Because it lives above the router, the timer keeps
 * counting (and keeps recording finished rounds) while the user browses other
 * pages, and because only timestamps are persisted it also survives a refresh
 * or a closed tab without needing a reload to catch up.
 */
export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const t = useT();
  const { items, userId } = useWorkspace();
  const now = useTick(1000);

  const [phase, setPhase] = useState<Phase>("focus");
  const [round, setRound] = useState(1);
  const [taskId, setTaskId] = useState("");
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainingWhenPaused, setRemainingWhenPaused] = useState<number | null>(null);
  const [completedRounds, setCompletedRounds] = useState<CompletedRound[]>([]);
  const [restored, setRestored] = useState(false);
  const notifiedRef = useRef<{ warn: boolean; end: boolean }>({ warn: false, end: false });

  useEffect(() => {
    try {
      // Prefer whichever snapshot is newer: this browser's local copy or the
      // one stored on the account (so the timer follows you to another
      // browser or device even if this tab was never open there).
      const local = window.localStorage.getItem(POMODORO_KEY);
      const remote = settings.pomodoroState || null;
      const at = (raw: string | null) => {
        try {
          return raw ? ((JSON.parse(raw) as { savedAt?: number }).savedAt ?? 0) : -1;
        } catch {
          return -1;
        }
      };
      const saved = at(remote) > at(local) ? remote : local;
      if (saved) {
        const state = JSON.parse(saved) as Partial<{
          phase: Phase;
          round: number;
          endsAt: number | null;
          remainingWhenPaused: number | null;
          taskId: string;
        }>;
        if (state.phase) setPhase(state.phase);
        if (state.round) setRound(state.round);
        if (typeof state.endsAt === "number") setEndsAt(state.endsAt);
        if (typeof state.remainingWhenPaused === "number") setRemainingWhenPaused(state.remainingWhenPaused);
        if (state.taskId) setTaskId(state.taskId);
      }
    } catch {
      window.localStorage.removeItem(POMODORO_KEY);
    } finally {
      setRestored(true);
    }
    // Restoring once on mount is intentional; later remote changes must not
    // clobber a timer the user is actively running in this tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pomodoroState !== ""]);

  useEffect(() => {
    if (!restored) return;
    const snapshot = JSON.stringify({
      phase,
      round,
      endsAt,
      remainingWhenPaused,
      taskId,
      savedAt: Date.now(),
    });
    window.localStorage.setItem(POMODORO_KEY, snapshot);
    // Only timestamps are stored, so writes happen on transitions, not ticks.
    update({ pomodoroState: snapshot });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, phase, round, endsAt, remainingWhenPaused, taskId]);

  // Local heartbeat: a lightweight snapshot is refreshed on this device every
  // 15s while a round runs, so an offline phone, a killed browser or a reboot
  // still restores an accurate timer without depending on the cloud.
  useEffect(() => {
    if (!restored || endsAt === null) return;
    const write = () => {
      try {
        window.localStorage.setItem(
          POMODORO_KEY,
          JSON.stringify({ phase, round, endsAt, remainingWhenPaused, taskId, savedAt: Date.now() }),
        );
      } catch {
        /* storage is best-effort */
      }
    };
    write();
    const id = setInterval(write, 15_000);
    return () => clearInterval(id);
  }, [restored, phase, round, endsAt, remainingWhenPaused, taskId]);

  const task = useMemo(() => items.find((i) => i.id === taskId) ?? null, [items, taskId]);

  const totalSeconds =
    (phase === "focus"
      ? settings.focusMinutes
      : phase === "break"
        ? settings.breakMinutes
        : settings.longBreakMinutes) * 60;

  const remaining =
    remainingWhenPaused !== null
      ? remainingWhenPaused
      : endsAt
        ? Math.max(0, Math.round((endsAt - now) / 1000))
        : totalSeconds;

  const elapsed = Math.min(totalSeconds, totalSeconds - remaining);
  const percent = totalSeconds ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0;
  const running = endsAt !== null && remainingWhenPaused === null;

  function chime() {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.25);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.25 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.25);
        osc.stop(now + i * 0.25 + 0.25);
      });
      setTimeout(() => void ctx.close().catch(() => undefined), 1200);
    } catch {
      /* sound is best-effort */
    }
  }

  function notify(title: string, body: string, sound = false) {
    toast.info(title, { description: body });
    if (sound) chime();
    if (!settings.notificationsEnabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, tag: "work-os-focus" });
    } catch {
      /* notifications are best-effort */
    }
  }

  useEffect(() => {
    if (!running) return;
    const label = task ? `“${task.title}”` : t("focus.notify.thisRound");
    if (!notifiedRef.current.warn && remaining <= settings.notifyBeforeEndSeconds && remaining > 0) {
      notifiedRef.current.warn = true;
      notify(
        phase === "focus" ? t("focus.notify.endingSoonTitle") : t("focus.notify.breakEndingSoon"),
        t("focus.notify.minLeftOn", { minutes: Math.max(1, Math.round(remaining / 60)), label }),
      );
    }
    if (!notifiedRef.current.end && remaining === 0) {
      notifiedRef.current.end = true;
      const nextPhase: Phase =
        phase === "focus"
          ? round % Math.max(1, settings.roundsBeforeLongBreak) === 0
            ? "longBreak"
            : "break"
          : "focus";
      notify(
        phase === "focus" ? t("focus.notify.roundCompleteTitle") : t("focus.notify.breakOver"),
        phase === "focus"
          ? t("focus.notify.timeForBreak", { label })
          : t("focus.notify.backTo", { label }),
        true,
      );
      if (phase === "focus") {
        setRound((r) => r + 1);
        if (task && userId) {
          const minutes = Math.max(1, settings.focusMinutes);
          void logCompletedRound(userId, { id: task.id, type: task.type, title: task.title }, minutes * 60)
            .then(() => {
              void creditRoundToItem(task).catch(() => undefined);
              setCompletedRounds((list) => [...list, { id: Date.now(), title: task.title, minutes }]);
            })
            .catch(() => toast.error(t("focus.notify.roundRecordFailed")));
        }
      }
      setPhase(nextPhase);
      setEndsAt(null);
      setRemainingWhenPaused(null);
      notifiedRef.current = { warn: false, end: false };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running, phase, round, settings, task, userId]);

  // Tab title mirrors the countdown so the remaining time stays visible on any
  // page and even when the tab is in the background.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = document.title.replace(/^\[[^\]]+\]\s*/, "");
    if (!running && remaining === totalSeconds) {
      document.title = base;
      return;
    }
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    const icon = phase === "focus" ? "\u25B6" : "\u2615";
    document.title = `[${icon} ${mm}:${ss}] ${base}`;
    return () => {
      document.title = base;
    };
  }, [remaining, running, totalSeconds, phase]);

  const value = useMemo<Ctx>(
    () => ({
      phase,
      round,
      taskId,
      setTaskId,
      remaining,
      totalSeconds,
      percent,
      running,
      completedRounds,
      start: async () => {
        if (settings.notificationsEnabled && typeof Notification !== "undefined") {
          if (Notification.permission === "default") await Notification.requestPermission();
        }
        notifiedRef.current = { warn: false, end: false };
        setRemainingWhenPaused(null);
        setEndsAt(Date.now() + remaining * 1000);
      },
      pause: () => {
        setRemainingWhenPaused(remaining);
        setEndsAt(null);
      },
      reset: () => {
        notifiedRef.current = { warn: false, end: false };
        setEndsAt(null);
        setRemainingWhenPaused(null);
      },
      skip: () => {
        notifiedRef.current = { warn: false, end: false };
        setEndsAt(null);
        setRemainingWhenPaused(null);
        if (phase === "focus") {
          setRound((r) => r + 1);
          setPhase(round % Math.max(1, settings.roundsBeforeLongBreak) === 0 ? "longBreak" : "break");
        } else {
          setPhase("focus");
        }
      },
    }),
    [phase, round, taskId, remaining, totalSeconds, percent, running, completedRounds, settings],
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

/** Inert timer used when a component renders before/outside the provider
 *  (e.g. while the provider module is hot-reloaded) — never throws, so the
 *  sidebar and pages keep rendering instead of blanking the screen. */
const IDLE: Ctx = {
  phase: "focus",
  round: 1,
  taskId: "",
  setTaskId: () => undefined,
  remaining: 0,
  totalSeconds: 0,
  percent: 0,
  running: false,
  completedRounds: [],
  start: async () => undefined,
  pause: () => undefined,
  reset: () => undefined,
  skip: () => undefined,
};

export function usePomodoro(): Ctx {
  return useContext(PomodoroContext) ?? IDLE;
}
