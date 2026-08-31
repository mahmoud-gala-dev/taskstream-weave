import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { COL, updateRecord } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-store";
import type { WorkItem } from "@/lib/types";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals & preferences — Personal Work OS" },
      {
        name: "description",
        content:
          "Link every task to a bigger goal and compare goal progress with the tasks that feed it.",
      },
      { property: "og:title", content: "Goals & preferences — Personal Work OS" },
      {
        property: "og:description",
        content: "Connect tasks to goals and track how each goal really progresses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <GoalsPage />
    </AppShell>
  ),
});

/**
 * Preferences surface for planning: every open task gets a "goal" (a topic),
 * which is the same link the weekly report uses for goal-vs-tasks comparison.
 */
function GoalsPage() {
  const t = useT();
  const { items } = useWorkspace();

  const topics = useMemo(
    () => items.filter((i) => i.type === "topic").sort((a, b) => a.title.localeCompare(b.title)),
    [items],
  );
  const tasks = useMemo(
    () =>
      items
        .filter((i) => i.type === "task" && i.status !== "done")
        .sort((a, b) => (a.parentTopicId ?? "").localeCompare(b.parentTopicId ?? "") || a.title.localeCompare(b.title)),
    [items],
  );

  const groups = useMemo(() => {
    return topics
      .map((topic) => ({ topic, rows: tasks.filter((task) => task.parentTopicId === topic.id) }))
      .filter((g) => g.rows.length);
  }, [topics, tasks]);

  async function link(task: WorkItem, topicId: string) {
    try {
      await updateRecord<WorkItem>(COL.items, task.id, { parentTopicId: topicId || null });
      toast.success(t("goals.saved"));
    } catch {
      toast.error(t("goals.saveFailed"));
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">{t("goals.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("goals.subtitle")}</p>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("goals.task")}</h2>
        {tasks.length ? (
          <ul className="mt-3 space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2">
                <Link
                  to="/item/$itemId"
                  params={{ itemId: task.id }}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {task.title}
                </Link>
                <select
                  aria-label={t("goals.goal")}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  value={task.parentTopicId ?? ""}
                  onChange={(e) => void link(task, e.target.value)}
                >
                  <option value="">{t("goals.none")}</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </select>
                <span className="w-10 text-end text-xs text-muted-foreground">{task.progress ?? 0}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t("goals.empty")}</p>
        )}
      </section>

      {groups.length ? (
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{t("goals.byGoal")}</h2>
          <ul className="mt-3 space-y-3">
            {groups.map(({ topic, rows }) => {
              const avg = Math.round(rows.reduce((n, r) => n + (r.progress ?? 0), 0) / rows.length);
              return (
                <li key={topic.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to="/item/$itemId"
                      params={{ itemId: topic.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    >
                      {topic.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {t("goals.taskCount", { count: rows.length })}
                    </span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {topic.progress ?? 0}% / {avg}%
                    </span>
                  </div>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, avg)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-6 text-sm">
        <Link to="/report" className="text-primary underline-offset-4 hover:underline">
          {t("report.goals")}
        </Link>
      </p>
    </div>
  );
}
