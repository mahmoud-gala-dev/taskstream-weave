import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { optimizeTable } from "@/lib/ai.functions";
import { COL, createRecord } from "@/lib/db";
import { orderAtEnd } from "@/lib/order";
import type { TableColumn, TableRow } from "@/lib/types";

type Suggestion = {
  summary: string;
  rowNames: string[];
  columnNames: string[];
  advice: string[];
};

/**
 * Safe-mode AI: suggestions are always previewed and only written to Firestore
 * when the user explicitly applies them. Nothing is deleted or overwritten —
 * missing rows/columns are appended.
 */
export function AiOptimizer({
  userId,
  tableId,
  tableName,
  rows,
  columns,
  hideHeader,
}: {
  userId: string | null;
  tableId: string | null;
  tableName: string;
  rows: TableRow[];
  columns: TableColumn[];
  hideHeader?: boolean;
}) {
  const t = useT();
  const run = useServerFn(optimizeTable);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Suggestion | null>(null);

  if (!tableId) return null;

  async function suggest() {
    if (goal.trim().length < 3) {
      toast.error(t("optimizer.describeGoal"));
      return;
    }
    setBusy(true);
    try {
      const data = await run({
        data: {
          goal: goal.trim(),
          tableName,
          existingRows: rows.map((r) => r.name),
          existingColumns: columns.map((c) => c.name),
        },
      });
      setResult(data as Suggestion);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("optimizer.requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result || !userId || !tableId) return;
    const newRows = result.rowNames.filter((n) => !rows.some((r) => r.name === n));
    const newCols = result.columnNames.filter((n) => !columns.some((c) => c.name === n));
    try {
      let rowList = [...rows];
      for (const name of newRows) {
        await createRecord(COL.rows, userId, {
          tableId,
          name,
          sortOrder: orderAtEnd(rowList),
        } as never);
        rowList = [...rowList, { sortOrder: orderAtEnd(rowList) } as TableRow];
      }
      let colList = [...columns];
      for (const name of newCols) {
        await createRecord(COL.columns, userId, {
          tableId,
          name,
          sortOrder: orderAtEnd(colList),
        } as never);
        colList = [...colList, { sortOrder: orderAtEnd(colList) } as TableColumn];
      }
      toast.success(
        t("optimizer.appliedDetail", { rows: newRows.length, cols: newCols.length }),
      );
      setResult(null);
    } catch {
      toast.error(t("optimizer.applyFailed"));
    }
  }

  return (
    <section className={hideHeader ? "" : "mt-6 rounded-lg border border-border bg-card p-4"}>
      {!hideHeader ? (
        <>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4" aria-hidden />
            {t("optimizer.structureTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("optimizer.structureSubtitle")}</p>
        </>
      ) : null}
      <div className={`flex flex-wrap gap-2 ${hideHeader ? "" : "mt-3"}`}>
        <Input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={t("optimizer.structureGoalPlaceholder")}
          className="max-w-md"
          aria-label={t("optimizer.structureGoalAriaLabel")}
        />
        <Button onClick={() => void suggest()} disabled={busy}>
          {busy ? t("optimizer.thinking") : t("optimizer.suggest")}
        </Button>
      </div>

      {result ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-muted-foreground">{result.summary}</p>
          <p>
            <strong>{t("optimizer.rows")}</strong>{" "}
            {result.rowNames.join(", ") || t("optimizer.emptyDash")}
          </p>
          <p>
            <strong>{t("optimizer.columns")}</strong>{" "}
            {result.columnNames.join(", ") || t("optimizer.emptyDash")}
          </p>
          {result.advice.length ? (
            <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
              {result.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void apply()}>
              {t("optimizer.applyRowsColumns")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>
              {t("optimizer.dismiss")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
