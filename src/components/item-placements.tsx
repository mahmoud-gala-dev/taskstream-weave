import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { COL, updateRecord } from "@/lib/db";
import type { Placement, TableColumn, TableRow, WorkTable } from "@/lib/types";
import { useT } from "@/lib/i18n";

/** Shows every table/row/column the item sits in, with inline quick moves. */
export function ItemPlacements({
  placements,
  tables,
  rows,
  columns,
}: {
  placements: Placement[];
  tables: WorkTable[];
  rows: TableRow[];
  columns: TableColumn[];
}) {
  const t = useT();
  if (!placements.length) {
    return (
      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("item.placements.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("item.placements.empty")}</p>
      </section>
    );
  }

  const move = (placement: Placement, changes: Partial<Placement>) =>
    void updateRecord<Placement>(COL.placements, placement.id, changes)
      .then(() => toast.success(t("item.placements.moved")))
      .catch(() => toast.error(t("item.saveFailed")));

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{t("item.placements.title")}</h2>
      <ul className="mt-3 space-y-3">
        {placements.map((p) => {
          const table = tables.find((x) => x.id === p.tableId);
          const tableRows = rows.filter((r) => r.tableId === p.tableId);
          const tableCols = columns.filter((c) => c.tableId === p.tableId);
          return (
            <li key={p.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{table?.name ?? "—"}</span>
                <Link
                  to="/tables"
                  search={{ table: p.tableId } as never}
                  className="shrink-0 text-xs text-primary hover:underline"
                >
                  {t("item.placements.open")}
                </Link>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  {t("item.placements.row")}
                  <select
                    value={p.rowId}
                    onChange={(e) => move(p, { rowId: e.target.value })}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  >
                    {tableRows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  {t("item.placements.column")}
                  <select
                    value={p.columnId}
                    onChange={(e) => move(p, { columnId: e.target.value })}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  >
                    {tableCols.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
