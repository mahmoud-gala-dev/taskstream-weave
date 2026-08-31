import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { optimizeWorkspace } from "@/lib/ai.functions";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/optimizer")({
  head: () => ({
    meta: [
      { title: "AI Optimizer — Personal Work OS" },
      {
        name: "description",
        content:
          "Analyze your tasks, topics and cell notes and get concrete suggestions on what to do first, what to drop and how to reorganize the day.",
      },
      { property: "og:title", content: "AI Optimizer — Personal Work OS" },
      {
        property: "og:description",
        content: "Actionable optimization suggestions built from your own tasks, topics and notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <OptimizerPage />
    </AppShell>
  ),
});

type Suggestion = {
  summary: string;
  rowNames: string[];
  columnNames: string[];
  advice: string[];
};

function OptimizerPage() {
  const t = useT();
  const { items, cells, placements, loading } = useWorkspace();
  const run = useServerFn(optimizeWorkspace);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Suggestion | null>(null);

  const snapshot = useMemo(() => {
    const open = items.filter((i) => i.status !== "done" && !i.archivedAt);
    return {
      openTasks: open
        .filter((i) => i.type === "task")
        .map((i) => ({
          title: i.title,
          status: i.status,
          priority: i.priority,
          progress: i.progress,
        })),
      topics: open.filter((i) => i.type === "topic").map((i) => i.title),
      cellNotes: cells.map((c) => c.note ?? "").filter((n) => n.length > 0),
    };
  }, [items, cells]);

  /** Local, offline analysis so the page is useful even without an AI key. */
  const local = useMemo(() => {
    const open = items.filter((i) => i.status !== "done" && !i.archivedAt);
    const placedIds = new Set(placements.map((p) => p.itemId));
    return {
      blocked: open.filter((i) => i.status === "blocked"),
      stalled: open.filter((i) => i.progress === 0 && i.status !== "todo"),
      nearlyDone: open.filter((i) => i.progress >= 70),
      unplaced: open.filter((i) => !placedIds.has(i.id)),
      overloaded: open.filter((i) => i.priority === "urgent").length,
    };
  }, [items, placements]);

  async function analyze() {
    setBusy(true);
    try {
      const data = await run({ data: { goal: goal.trim(), ...snapshot } });
      setResult(data as Suggestion);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("optimizer.requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Sparkles className="size-5" aria-hidden /> {t("optimizer.title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("optimizer.subtitlePrefix")}{" "}
        <Link to="/assistant" className="underline">
          {t("optimizer.subtitleLink")}
        </Link>
        .
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={t("optimizer.goalPlaceholder")}
          className="max-w-md"
          aria-label={t("optimizer.goalAriaLabel")}
        />
        <Button onClick={() => void analyze()} disabled={busy || loading}>
          {busy ? t("optimizer.analyzing") : t("optimizer.analyzeMyWork")}
        </Button>
      </div>

      {result ? (
        <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{result.summary}</p>
          <div>
            <h2 className="text-sm font-semibold">{t("optimizer.doFirst")}</h2>
            <ol className="mt-1 list-decimal space-y-1 ps-5 text-sm">
              {result.rowNames.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {!result.rowNames.length ? <li>{t("optimizer.nothingUrgent")}</li> : null}
            </ol>
            {result.rowNames.length ? (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/assistant" search={{ order: result.rowNames.join("|") }}>
                  {t("optimizer.useOrderInAssistant")}
                </Link>
              </Button>
            ) : null}
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("optimizer.dropDeferDelegate")}</h2>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
              {result.columnNames.map((c) => (
                <li key={c}>{c}</li>
              ))}
              {!result.columnNames.length ? <li>{t("optimizer.nothingToCut")}</li> : null}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("optimizer.suggestions")}</h2>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              {result.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">{t("optimizer.signalsTitle")}</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <Signal label={t("optimizer.signalBlocked")} list={local.blocked.map((i) => i.title)} />
          <Signal
            label={t("optimizer.signalNearlyDone")}
            list={local.nearlyDone.map((i) => i.title)}
          />
          <Signal label={t("optimizer.signalStalled")} list={local.stalled.map((i) => i.title)} />
          <Signal
            label={t("optimizer.signalUnplaced")}
            list={local.unplaced.map((i) => i.title)}
          />
        </ul>
        {local.overloaded > 3 ? (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            {t("optimizer.overloadedWarning", { count: local.overloaded })}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Signal({ label, list }: { label: string; list: string[] }) {
  const t = useT();
  return (
    <li>
      <span className="font-medium">{label}:</span>{" "}
      <span className="text-muted-foreground">
        {list.length ? list.slice(0, 6).join(", ") : t("optimizer.none")}
      </span>
    </li>
  );
}
