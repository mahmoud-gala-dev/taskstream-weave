import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { summarizeItem } from "@/lib/ai.functions";
import type { Subtask, WorkItem, WorkSession } from "@/lib/types";
import { elapsedSeconds } from "@/lib/sessions";
import { useT } from "@/lib/i18n";

/** One-click AI recap of documentation + sessions + subtasks with next steps. */
export function ItemAiSummary({
  item,
  subtasks,
  sessions,
  now,
}: {
  item: WorkItem;
  subtasks: Subtask[];
  sessions: WorkSession[];
  now: number;
}) {
  const t = useT();
  const run = useServerFn(summarizeItem);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; advice: string[] } | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const totalMinutes = Math.round(
        sessions.reduce((acc, s) => acc + elapsedSeconds(s, now), 0) / 60,
      );
      const documentation = (item.descriptionHtml ?? item.description ?? "").replace(/<[^>]+>/g, " ");
      const res = await run({
        data: {
          title: item.title,
          status: item.status,
          priority: item.priority,
          due: item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "",
          documentation: documentation.slice(0, 6000),
          totalMinutes,
          sessionCount: sessions.length,
          subtasks: subtasks.slice(0, 60).map((s) => ({ title: s.title, done: s.done })),
        },
      });
      setResult({ summary: res.summary, advice: res.advice });
    } catch {
      toast.error(t("item.ai.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("item.ai.title")}</h2>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void generate()}>
          <Sparkles className="size-4" /> {loading ? t("item.ai.running") : t("item.ai.run")}
        </Button>
      </div>
      {result ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm">{result.summary}</p>
          {result.advice.length ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("item.ai.next")}</p>
              <ul className="list-disc space-y-1 ps-5 text-sm">
                {result.advice.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
