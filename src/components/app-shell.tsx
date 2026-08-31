import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarClock,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Table2,

  Tags,
  Timer,
  Wand2,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { GlobalContextMenu } from "@/components/global-context-menu";
import { PageHighlighter } from "@/components/page-highlighter";
import { PageStickyNotes } from "@/components/page-sticky-notes";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePomodoro } from "@/lib/pomodoro-store";
import { useSettings } from "@/lib/settings-store";
import { useWorkspace } from "@/lib/workspace-store";
import { elapsedSeconds, formatDuration } from "@/lib/sessions";
import { useTick } from "@/hooks/useTick";
import { cn } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";

const NAV = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/tables", key: "nav.tables", icon: Table2 },
  { to: "/focus", key: "nav.focus", icon: Timer },
  { to: "/report", key: "nav.report", icon: BarChart3 },
  { to: "/assistant", key: "nav.assistant", icon: Sparkles },
  { to: "/optimizer", key: "nav.optimizer", icon: Wand2 },
  { to: "/active", key: "nav.active", icon: CalendarClock },
  { to: "/tasks", key: "nav.tasks", icon: CheckSquare },
  { to: "/topics", key: "nav.topics", icon: Tags },
  { to: "/documentation", key: "nav.documentation", icon: FileText },
  { to: "/search", key: "nav.search", icon: Search },
  { to: "/settings", key: "nav.settings", icon: Settings },
] as const satisfies ReadonlyArray<{ to: string; key: MessageKey; icon: typeof Timer }>;



export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut, error } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Global shortcuts: Alt+F/T/P/D/S jump between the main surfaces. They are
  // ignored while typing so they never swallow real text input.
  useEffect(() => {
    const targets: Record<string, string> = {
      f: "/focus",
      t: "/tasks",
      p: "/topics",
      d: "/documentation",
      s: "/search",
    };
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const el = event.target as HTMLElement | null;
      if (el?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el?.tagName ?? "")) return;
      const to = targets[event.key.toLowerCase()];
      if (!to) return;
      event.preventDefault();
      void navigate({ to });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <GlobalContextMenu>
    <div className="flex min-h-screen bg-background text-foreground">

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card/60 p-4 md:flex">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("common.appKicker")}</p>
          <p className="text-lg font-semibold leading-tight">{t("common.appTitle")}</p>
        </div>
        <nav className="space-y-1">
          {NAV.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === to
                  ? "bg-primary/15 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t(key)}
            </Link>
          ))}
        </nav>
        <PomodoroSummary />
        <RunningSummary />
        <div className="mt-auto space-y-2 pt-4">
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <DarkModeToggle />
          <Button variant="outline" size="sm" className="w-full" onClick={() => void signOut()}>
            <LogOut className="size-4" /> {t("nav.signOut")}
          </Button>
        </div>

      </aside>
      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
          {NAV.map(({ to, key }) => (
            <Link key={to} to={to} className="text-sm text-muted-foreground">
              {t(key)}
            </Link>
          ))}
        </div>
        {children}
      </main>
      <PageStickyNotes />
      <PageHighlighter />
    </div>
    </GlobalContextMenu>
  );
}


function RunningSummary() {
  const { sessions } = useWorkspace();
  const t = useT();
  const now = useTick(1000);
  const running = sessions.filter((s) => s.status === "running");
  if (!running.length) return null;
  const total = running.reduce((acc, s) => acc + elapsedSeconds(s, now), 0);
  return (
    <div className="mt-6 rounded-lg border border-border bg-background/60 p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" /> {t("nav.running", { count: running.length })}
      </p>
      <p className="mt-1 font-mono text-lg" dir="ltr">
        {formatDuration(total)}
      </p>
    </div>
  );
}

/**
 * Dark-mode switch. The choice is written to settings, which persists it both
 * to the account and to local storage so it survives leaving the app.
 */
function DarkModeToggle() {
  const { settings, update } = useSettings();
  const t = useT();
  const isDark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      aria-label={t("appearance.toggleDark")}
      onClick={() => update({ theme: isDark ? "light" : "dark" })}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {isDark ? t("common.lightTheme") : t("common.darkTheme")}
    </Button>
  );
}

/** Sidebar readout of the app-wide Pomodoro so it stays visible on every page. */
function PomodoroSummary() {
  const { settings } = useSettings();
  const t = useT();
  const { remaining, running, phase, round, percent } = usePomodoro();
  if (!settings.timerInSidebar || (!running && percent === 0)) return null;
  return (
    <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Timer className="size-3.5" />
        {phase === "focus"
          ? t("focus.phase.focus")
          : phase === "break"
            ? t("focus.phase.break")
            : t("focus.phase.longBreak")}{" "}
        · {round}
      </p>
      <p className="mt-1 font-mono text-lg" dir="ltr">
        {formatDuration(remaining)}
      </p>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}
