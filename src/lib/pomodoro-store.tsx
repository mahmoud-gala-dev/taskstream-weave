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
  const { settings } = useSettings();
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
      const saved = window.localStorage.getItem(POMODORO_KEY);
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
  }, []);

  useEffect(() => {
    if (!restored) return;
    window.localStorage.setItem(
      POMODORO_KEY,
      JSON.stringify({ phase, round, endsAt, remainingWhenPaused, taskId }),
    );
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

  function notify(title: string, body: string) {
    toast.info(title, { description: body });
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

export function usePomodoro(): Ctx {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoro must be used inside <PomodoroProvider>");
  return ctx;
}
