import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { useTick } from "@/hooks/useTick";
import { useT } from "@/lib/i18n";
import { elapsedSeconds, formatDuration, startOfToday } from "@/lib/sessions";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/assistant")({
  validateSearch: z.object({ order: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Daily Assistant — Personal Work OS" },
      {
        name: "description",
        content:
          "A daily briefing built from your real data: what to finish first, what is stalled, what is overdue and how your time was spent.",
      },
      { property: "og:title", content: "Daily Assistant — Personal Work OS" },
      {
        property: "og:description",
        content: "Your suggested order of work for today, derived from your own tasks and sessions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <AssistantPage />
    </AppShell>
  ),
});

const PRIORITY_WEIGHT = { urgent: 40, high: 28, normal: 14, low: 6 } as const;

function AssistantPage() {
  const t = useT();
  const { items, sessions, loading } = useWorkspace();
  const search = Route.useSearch();
  const now = useTick(30_000);

  const plan = useMemo(() => {
    const open = items.filter((i) => i.status !== "done" && !i.archivedAt);
    const aiOrder = (search.order ?? "").split("|").filter(Boolean);
    const aiRank = new Map(aiOrder.map((title, index) => [title.toLocaleLowerCase(), index]));
    const scored = open
      .map((i) => {
        const overdue = i.dueDate && i.dueDate < now;
        const dueSoon = i.dueDate && i.dueDate >= now && i.dueDate - now < 86_400_000;
        const score =
          PRIORITY_WEIGHT[i.priority] +
          (overdue ? 50 : 0) +
          (dueSoon ? 25 : 0) +
          (i.status === "blocked" ? -10 : 0) +
          (i.progress >= 60 ? 20 : 0);
        const reason = overdue
          ? t("assistant.reasonOverdue")
          : dueSoon
            ? t("assistant.reasonDueSoon")
            : i.progress >= 60
              ? t("assistant.reasonCloseToDone")
              : i.priority === "urgent" || i.priority === "high"
                ? t("assistant.reasonPriority", { priority: t(`assistant.priority.${i.priority}`) })
                : t("assistant.reasonKeepMoving");
        const optimizedIndex = aiRank.get(i.title.toLocaleLowerCase());
        return {
          item: i,
          score: optimizedIndex === undefined ? score : score + 1_000 - optimizedIndex,
          reason: optimizedIndex === undefined ? reason : t("assistant.reasonAiOptimizer"),
        };
      })
      .sort((a, b) => b.score - a.score);

    const dayStart = startOfToday(new Date(now));
    const todaySeconds = sessions
      .filter((s) => (s.stoppedAt ?? now) >= dayStart)
      .reduce((acc, s) => acc + elapsedSeconds(s, now), 0);

    return {
      next: scored.slice(0, 5),
      blocked: open.filter((i) => i.status === "blocked"),
      stalled: open.filter((i) => i.progress === 0 && i.status === "todo").slice(0, 5),
      running: sessions.filter((s) => s.status === "running"),
      todaySeconds,
      openCount: open.length,
    };
  }, [items, sessions, now, search.order, t]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">{t("assistant.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {loading
          ? t("assistant.readingWorkspace")
          : t("assistant.summary", {
              open: plan.openCount,
              tracked: formatDuration(plan.todaySeconds),
              running: plan.running.length,
            })}
      </p>
      {search.order ? (
        <p className="mt-2 text-xs text-primary">{t("assistant.usingAiOrder")}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/optimizer"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          {t("assistant.openOptimizer")}
        </Link>
        <Link
          to="/focus"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          {t("assistant.startPomodoro")}
        </Link>
      </div>

      <Block title={t("assistant.doTheseNext")}>
        {plan.next.length ? (
          <ol className="space-y-2">
            {plan.next.map(({ item, reason }, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <Link
                  to="/item/$itemId"
                  params={{ itemId: item.id }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{reason}</span>
                  <span className="w-10 text-end text-xs text-muted-foreground">
                    {item.progress}%
                  </span>
                </Link>
                <Link
                  to="/focus"
                  search={{ item: item.id }}
                  className="shrink-0 rounded-md border border-input px-2.5 py-2 text-xs hover:bg-accent"
                >
                  {t("assistant.focus")}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Empty />
        )}
      </Block>

      <Block title={t("assistant.blockedTitle")}>
        {plan.blocked.length ? (
          <ItemList items={plan.blocked} />
        ) : (
          <Empty text={t("assistant.nothingBlocked")} />
        )}
      </Block>

      <Block title={t("assistant.notStartedTitle")}>
        {plan.stalled.length ? (
          <ItemList items={plan.stalled} />
        ) : (
          <Empty text={t("assistant.everythingHasProgress")} />
        )}
      </Block>
    </div>
  );
}

function ItemList({ items }: { items: { id: string; title: string; progress: number }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id}>
          <Link
            to="/item/$itemId"
            params={{ itemId: i.id }}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:border-primary/50"
          >
            <span className="min-w-0 flex-1 truncate">{i.title}</span>
            <span className="text-xs text-muted-foreground">{i.progress}%</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text?: string }) {
  const t = useT();
  return <p className="text-sm text-muted-foreground">{text ?? t("assistant.emptyDefault")}</p>;
}
