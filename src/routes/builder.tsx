import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { InlineName } from "@/components/inline-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COL, createRecord, deleteMany, deleteRecord, updateRecord } from "@/lib/db";
import { confirmToast } from "@/lib/confirm";
import { useT } from "@/lib/i18n";
import { bySortOrder, orderAtEnd } from "@/lib/order";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/builder")({
  head: () => ({
    meta: [
      { title: "Table structure — Personal Work OS" },
      {
        name: "description",
        content:
          "Inspect every data table in detail and add rows or columns without editing the grid directly.",
      },
      { property: "og:title", content: "Table structure — Personal Work OS" },
      {
        property: "og:description",
        content: "A detailed builder view for the rows and columns of your work tables.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <BuilderPage />
    </AppShell>
  ),
});

/**
 * Structure-first view of the workspace: pick a table, read its rows, columns
 * and fill rate, then add or rename structure here instead of in the grid.
 */
function BuilderPage() {
  const t = useT();
  const { userId, sections, tables, rows, columns, cells, placements } = useWorkspace();
  const [tableId, setTableId] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState("");
  const [colDraft, setColDraft] = useState("");

  const sortedTables = useMemo(() => [...tables].sort(bySortOrder), [tables]);
  const current = sortedTables.find((tb) => tb.id === (tableId ?? sortedTables[0]?.id)) ?? null;
  const section = sections.find((s) => s.id === current?.sectionId) ?? null;

  const tableRows = useMemo(
    () => rows.filter((r) => r.tableId === current?.id).sort(bySortOrder),
    [rows, current],
  );
  const tableColumns = useMemo(
    () => columns.filter((c) => c.tableId === current?.id).sort(bySortOrder),
    [columns, current],
  );
  const tableCells = useMemo(
    () => cells.filter((c) => c.tableId === current?.id && (c.note || c.noteImage || c.icon || c.color)),
    [cells, current],
  );
  const tablePlacements = useMemo(
    () => placements.filter((p) => p.tableId === current?.id),
    [placements, current],
  );

  function countFor(kind: "row" | "column", id: string) {
    return tablePlacements.filter((p) => (kind === "row" ? p.rowId : p.columnId) === id).length;
  }

  async function addRow() {
    if (!userId || !current) return;
    const name = rowDraft.trim();
    if (!name) return;
    try {
      await createRecord(COL.rows, userId, {
        tableId: current.id,
        name,
        sortOrder: orderAtEnd(tableRows),
      } as never);
      setRowDraft("");
      toast.success(t("builder.rowAdded"));
    } catch {
      toast.error(t("builder.failed"));
    }
  }

  async function addColumn() {
    if (!userId || !current) return;
    const name = colDraft.trim();
    if (!name) return;
    try {
      await createRecord(COL.columns, userId, {
        tableId: current.id,
        name,
        sortOrder: orderAtEnd(tableColumns),
      } as never);
      setColDraft("");
      toast.success(t("builder.columnAdded"));
    } catch {
      toast.error(t("builder.failed"));
    }
  }

  async function remove(kind: "row" | "column", id: string, name: string) {
    const ok = await confirmToast(t("builder.confirmDelete", { name }));
    if (!ok) return;
    try {
      const related = tablePlacements.filter((p) => (kind === "row" ? p.rowId : p.columnId) === id);
      if (related.length) {
        await deleteMany(related.map((p) => [COL.placements, p.id] as [typeof COL.placements, string]));
      }
      await deleteRecord(kind === "row" ? COL.rows : COL.columns, id);
      toast.success(t("builder.deleted"));
    } catch {
      toast.error(t("builder.failed"));
    }
  }

  async function rename(kind: "row" | "column", id: string, name: string) {
    try {
      await updateRecord(kind === "row" ? COL.rows : COL.columns, id, { name } as never);
      toast.success(t("builder.renamed"));
    } catch {
      toast.error(t("builder.failed"));
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">{t("builder.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("builder.subtitle")}</p>

      {!sortedTables.length ? (
        <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t("builder.noTables")}
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted-foreground" htmlFor="builder-table">
              {t("builder.pickTable")}
            </label>
            <select
              id="builder-table"
              className="h-9 min-w-56 rounded-md border border-border bg-background px-2 text-sm"
              value={current?.id ?? ""}
              onChange={(e) => setTableId(e.target.value)}
            >
              {sortedTables.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.name}
                </option>
              ))}
            </select>
            <Link to="/tables" className="text-sm text-primary hover:underline">
              {t("builder.openTable")}
            </Link>
          </div>

          {current ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: t("builder.section"), value: section?.name ?? "—" },
                  { label: t("builder.rows"), value: String(tableRows.length) },
                  { label: t("builder.columns"), value: String(tableColumns.length) },
                  { label: t("builder.cellsFilled"), value: String(tableCells.length) },
                  { label: t("builder.items"), value: String(tablePlacements.length) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border bg-card p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 truncate text-lg font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <StructureList
                  title={t("builder.rows")}
                  placeholder={t("builder.newRowName")}
                  addLabel={t("builder.addRow")}
                  deleteLabel={t("builder.deleteRow")}
                  draft={rowDraft}
                  onDraft={setRowDraft}
                  onAdd={() => void addRow()}
                  entries={tableRows.map((r) => ({
                    id: r.id,
                    name: r.name,
                    icon: r.icon ?? null,
                    count: countFor("row", r.id),
                  }))}
                  countLabel={(n) => t("builder.itemsIn", { count: n })}
                  onRename={(id, name) => void rename("row", id, name)}
                  onRemove={(id, name) => void remove("row", id, name)}
                />
                <StructureList
                  title={t("builder.columns")}
                  placeholder={t("builder.newColumnName")}
                  addLabel={t("builder.addColumn")}
                  deleteLabel={t("builder.deleteColumn")}
                  draft={colDraft}
                  onDraft={setColDraft}
                  onAdd={() => void addColumn()}
                  entries={tableColumns.map((c) => ({
                    id: c.id,
                    name: c.name,
                    icon: c.icon ?? null,
                    count: countFor("column", c.id),
                  }))}
                  countLabel={(n) => t("builder.itemsIn", { count: n })}
                  onRename={(id, name) => void rename("column", id, name)}
                  onRemove={(id, name) => void remove("column", id, name)}
                />
              </div>

              <section className="mt-6 rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">{t("builder.matrix")}</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-border bg-muted/40 p-2 text-start text-xs font-medium" />
                        {tableColumns.map((c) => (
                          <th
                            key={c.id}
                            className="border border-border bg-muted/40 p-2 text-start text-xs font-medium"
                          >
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r) => (
                        <tr key={r.id}>
                          <th className="border border-border bg-muted/20 p-2 text-start text-xs font-medium">
                            {r.name}
                          </th>
                          {tableColumns.map((c) => {
                            const n = tablePlacements.filter(
                              (p) => p.rowId === r.id && p.columnId === c.id,
                            ).length;
                            return (
                              <td
                                key={c.id}
                                className="border border-border p-2 text-center text-xs text-muted-foreground"
                              >
                                {n ? t("builder.itemsIn", { count: n }) : t("builder.empty")}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function StructureList({
  title,
  placeholder,
  addLabel,
  deleteLabel,
  draft,
  onDraft,
  onAdd,
  entries,
  countLabel,
  onRename,
  onRemove,
}: {
  title: string;
  placeholder: string;
  addLabel: string;
  deleteLabel: string;
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  entries: { id: string; name: string; icon: string | null; count: number }[];
  countLabel: (count: number) => string;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string, name: string) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">
        {title} <span className="text-muted-foreground">({entries.length})</span>
      </h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd();
        }}
      >
        <Input value={draft} onChange={(e) => onDraft(e.target.value)} placeholder={placeholder} className="h-9" />
        <Button type="submit" size="sm" className="shrink-0">
          <Plus className="size-4" /> {addLabel}
        </Button>
      </form>
      <ul className="mt-3 space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
            {entry.icon ? <span aria-hidden>{entry.icon}</span> : null}
            <InlineName
              value={entry.name}
              ariaLabel={entry.name}
              onCommit={(next) => onRename(entry.id, next)}
              className="text-sm"
              multiline
            />
            <span className="shrink-0 text-xs text-muted-foreground">{countLabel(entry.count)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={deleteLabel}
              title={deleteLabel}
              className="shrink-0 text-destructive"
              onClick={() => onRemove(entry.id, entry.name)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
