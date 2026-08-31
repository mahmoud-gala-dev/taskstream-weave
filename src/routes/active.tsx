import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, Play, Square } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { elapsedSeconds, formatDuration, pauseSession, resumeSession, stopSession } from "@/lib/sessions";
import { useWorkspace } from "@/lib/workspace-store";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/active")({
  head: () => ({
    meta: [
      { title: "Active work — Personal Work OS" },
      {
        name: "description",
        content:
          "Every running and paused work session in one place, with durable timers that keep counting across refreshes.",
      },
      { property: "og:title", content: "Active work — Personal Work OS" },
      {
        property: "og:description",
        content: "Track concurrent work sessions with durable timers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <ActivePage />
    </AppShell>
  ),
});

function ActivePage() {
  const { sessions } = useWorkspace();
  const t = useT();
  const now = useTick(1000);
  const open = sessions
    .filter((s) => s.status !== "stopped")
    .sort((a, b) => b.startedAt - a.startedAt);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{t("active.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("active.subtitle")}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {open.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t(s.itemType === "task" ? "kind.Task" : "kind.Topic")} ·{" "}
              {s.status === "running" ? t("active.resume") : t("active.pause")}
            </p>
            <Link
              to="/item/$itemId"
              params={{ itemId: s.itemId }}
              className="mt-1 block font-medium hover:underline"
            >
              {s.title}
            </Link>
            <p className="mt-3 font-mono text-2xl" dir="ltr">
              {formatDuration(elapsedSeconds(s, now))}
            </p>
            <div className="mt-3 flex gap-2">
              {s.status === "running" ? (
                <Button size="sm" variant="outline" onClick={() => void pauseSession(s)}>
                  <Pause className="size-4" /> {t("active.pause")}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void resumeSession(s)}>
                  <Play className="size-4" /> {t("active.resume")}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => void stopSession(s)}>
                <Square className="size-4" /> {t("active.stop")}
              </Button>
            </div>
          </div>
        ))}
        {!open.length ? (
          <p className="text-sm text-muted-foreground">
            {t("active.empty")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
