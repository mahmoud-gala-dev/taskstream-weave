import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { COL, createRecord, updateRecord, watchUserCollection } from "@/lib/db";
import type { Base } from "@/lib/types";

export type ReminderStyle = "toast" | "browser" | "both" | "off";

export type Settings = Base & {
  language: "en" | "ar";
  /** "auto" follows local clock (night hours), "system" follows the OS setting. */
  theme: "light" | "dark" | "system" | "auto";
  /** Hours (0-23) that count as night for the auto theme. */
  nightStartHour: number;
  nightEndHour: number;
  density: "compact" | "comfortable" | "large";
  /** Global UI font family and scale, applied to <html>. */
  fontFamily: "sans" | "serif" | "mono";
  fontScale: number;
  timerInSidebar: boolean;
  /** Pomodoro focus preferences. */
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
  notifyBeforeEndSeconds: number;
  notificationsEnabled: boolean;
  /** Target number of focus rounds per task in the focus table. */
  focusRoundsTarget: number;
  /** How the pre-end reminder is delivered. */
  reminderStyle: ReminderStyle;
  /** Chrome notification body shown when a focus round ends. */
  focusDoneMessage: string;
};

const DEFAULTS: Omit<Settings, "id" | "userId"> = {
  language: "en",
  theme: "system",
  density: "comfortable",
  nightStartHour: 18,
  nightEndHour: 6,
  fontFamily: "sans",
  fontScale: 100,
  timerInSidebar: true,
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  notifyBeforeEndSeconds: 60,
  notificationsEnabled: true,
  focusRoundsTarget: 4,
  reminderStyle: "both",
  focusDoneMessage: "Focus round complete on {task} — {minutes} min tracked.",
};

/**
 * Appearance preferences are mirrored to localStorage so theme, font and size
 * survive sign-out, a closed tab or a slow Firestore load and are applied on the
 * very first paint of the next visit.
 */
const LOCAL_KEY = "work-os:appearance";
type Appearance = Pick<
  Settings,
  "language" | "theme" | "density" | "fontFamily" | "fontScale" | "nightStartHour" | "nightEndHour"
>;

/** True when the local clock is inside the configured night window. */
export function isNightHour(start: number, end: number, at = new Date()): boolean {
  const h = at.getHours();
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

function readLocalAppearance(): Partial<Appearance> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}") as Partial<Appearance>;
  } catch {
    return {};
  }
}

function writeLocalAppearance(a: Appearance) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(a));
  } catch {
    /* storage is best-effort */
  }
}





type Ctx = {
  settings: Omit<Settings, "id" | "userId">;
  update: (patch: Partial<Omit<Settings, "id" | "userId">>) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

/**
 * One settings document per user, kept in Firestore so preferences follow the
 * account. Theme and direction are applied to <html> on change.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const [doc, setDoc] = useState<Settings | null>(null);
  const [local, setLocal] = useState<Partial<Appearance>>({});

  // Restore the locally cached appearance before Firestore answers.
  useEffect(() => setLocal(readLocalAppearance()), []);

  // Re-evaluate the auto (night) theme once a minute without a page reload.
  const [minuteTick, setMinuteTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMinuteTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setDoc(null);
    if (!userId) return;
    let active = true;
    let unsub: (() => void) | undefined;
    void watchUserCollection<Settings>(COL.settings, userId, (rows) => {
      if (!active) return;
      setDoc(rows[0] ?? null);
      if (!rows.length) void createRecord<Settings>(COL.settings, userId, DEFAULTS);
    })
      .then((u) => (active ? (unsub = u) : u()))
      .catch(() => undefined);
    return () => {
      active = false;
      unsub?.();
    };
  }, [userId]);

  const settings = useMemo(
    () => ({ ...DEFAULTS, ...local, ...(doc ? { ...doc } : {}) }),
    [doc, local],
  ) as Omit<Settings, "id" | "userId">;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.lang = settings.language;
    root.dir = settings.language === "ar" ? "rtl" : "ltr";
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "auto" &&
        isNightHour(settings.nightStartHour, settings.nightEndHour, new Date(minuteTick))) ||
      (settings.theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    root.style.fontSize = `${Math.min(140, Math.max(80, settings.fontScale))}%`;
    root.dataset["font"] = settings.fontFamily;
    writeLocalAppearance({
      language: settings.language,
      theme: settings.theme,
      density: settings.density,
      fontFamily: settings.fontFamily,
      fontScale: settings.fontScale,
      nightStartHour: settings.nightStartHour,
      nightEndHour: settings.nightEndHour,
    });
  }, [
    settings.language,
    settings.theme,
    settings.density,
    settings.fontFamily,
    settings.fontScale,
    settings.nightStartHour,
    settings.nightEndHour,
    minuteTick,
  ]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      update: (patch) => {
        setLocal((prev) => ({ ...prev, ...patch }));
        if (!doc) return;
        void updateRecord<Settings>(COL.settings, doc.id, patch);
      },
    }),
    [settings, doc],
  );


  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  // Fall back to defaults instead of crashing when a component renders outside
  // the provider (e.g. during a hot reload of the provider module).
  return ctx ?? { settings: DEFAULTS, update: () => undefined };
}
