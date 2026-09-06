import { useNavigate } from "@tanstack/react-router";
import { ArchiveRestore, ExternalLink, RotateCcw, Timer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmToast } from "@/lib/confirm";
import { COL, deleteRecord, updateRecord } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { completedRoundsForItem, elapsedSeconds, formatDuration, isPomodoroRound } from "@/lib/sessions";
import type { WorkItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-store";

type Tab = "all" | "tasks" | "rounds" | "archived";
const TABS: Tab[] = ["all", "tasks", "rounds", "archived"];

/**
 * Completed tasks, finished focus rounds and archived items. When `lockedTableId`
 * is set the panel only shows what belongs to that table, so the grid filters
 * and the archive stay in sync.
 */
export function ArchivePanel({ lockedTableId }: { lockedTableId?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const { items, placements, sessions, tables, rows, columns } = useWorkspace();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [pickedTable, setPickedTable] = useState<string>("all");
  const tableId = lockedTableId ?? pickedTable;

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((x) => map.set(x.id, x.name));
    rows.forEach((x) => map.set(x.id, x.name));
    columns.forEach((x) => map.set(x.id, x.name));
    return map;
  }, [tables, rows, columns]);

  const spotsByItem = useMemo(() => {
    const map = new Map<string, { tableId: string; label: string }[]>();
    placements.forEach((p) => {
      const list = map.get(p.itemId) ?? [];
      list.push({
        tableId: p.tableId,
        label: t("archive.location", {
          table: nameById.get(p.tableId) ?? "—",
          row: nameById.get(p.rowId) ?? "—",
          column: nameById.get(p.columnId) ?? "—",
        }),
      });
      map.set(p.itemId, list);
    });
    return map;
  }, [placements, nameById, t]);

  const inTable = (itemId: string) =>
    tableId === "all" || (spotsByItem.get(itemId) ?? []).some((s) => s.tableId === tableId);

  const q = query.trim().toLowerCase();

  const archivedItems = useMemo(
    () =>
      items
        .filter((i) => i.archivedAt)
        .filter((i) => !q || i.title.toLowerCase().includes(q))
        .filter((i) => inTable(i.id))
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [items, q, tableId, spotsByItem],
  );

  const completedTasks = useMemo(
    () =>
      items
        .filter((i) => !i.archivedAt && i.status === "done")
        .filter((i) => !q || i.title.toLowerCase().includes(q))
        .filter((i) => inTable(i.id))
        .sort((a, b) => (b.completedAt ?? b.updatedAt ?? 0) - (a.completedAt ?? a.updatedAt ?? 0)),
    [items, q, tableId, spotsByItem],
  );

  const rounds = useMemo(
    () =>
      sessions
        .filter((s) => isPomodoroRound(s) && s.status === "stopped")
        .filter((s) => !q || s.title.toLowerCase().includes(q))
        .filter((s) => inTable(s.itemId))
        .sort((a, b) => (b.stoppedAt ?? 0) - (a.stoppedAt ?? 0)),
    [sessions, q, tableId, spotsByItem],
  );

  const trackedSeconds = useMemo(
    () => rounds.reduce((sum, s) => sum + elapsedSeconds(s), 0),
    [rounds],
  );

  async function restore(item: WorkItem) {
    await updateRecord<WorkItem>(COL.items, item.id, { archivedAt: null });
    toast.success(t("archive.restored"), { description: item.title });
  }

  async function reopen(item: WorkItem) {
    await updateRecord<WorkItem>(COL.items, item.id, {
      status: "in_progress",
      completedAt: null,
      archivedAt: null,
    });
    toast.success(t("archive.reopened"), { description: item.title });
  }

  async function purge(item: WorkItem) {
    const ok = await confirmToast(t("tables.confirmDeleteItem", { title: item.title }), {
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    await Promise.all([
      ...placements.filter((p) => p.itemId === item.id).map((p) => deleteRecord(COL.placements, p.id)),
      deleteRecord(COL.items, item.id),
    ]);
    toast.success(t("archive.deleted"), { description: item.title });
  }

  const showTasks = tab === "all" || tab === "tasks";
  const showRounds = tab === "all" || tab === "rounds";
  const showArchived = tab === "all" || tab === "archived";
  const nothing =
    (!showTasks || !completedTasks.length) &&
    (!showRounds || !rounds.length) &&
    (!showArchived || !archivedItems.length);

  function ItemRow({ item, archived }: { item: WorkItem; archived: boolean }) {
    const isTask = item.type === "task";
    const done = completedRoundsForItem(sessions, item.id);
    const planned = item.estimatedRounds ?? 0;
    const spots = spotsByItem.get(item.id) ?? [];
    const seconds = sessions
      .filter((s) => s.itemId === item.id)
      .reduce((sum, s) => sum + elapsedSeconds(s), 0);
    return (
      <li
        className={cn(
          "rounded-xl border bg-card/70 p-3 shadow-sm",
          isTask ? "border-s-4 border-s-emerald-500/70" : "border-s-4 border-s-primary bg-accent/30",
        )}
      >
        <div className="flex flex-wrap items-start gap-2">
          <span aria-hidden className="text-base">{item.icon ?? (isTask ? "✓" : "◫")}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge variant={isTask ? "secondary" : "outline"} className="text-[10px]">
                {isTask ? t("archive.type.task") : t("archive.type.topic")}
              </Badge>
              <span>
                {archived
                  ? t("archive.archivedOn", {
                      date: new Date(item.archivedAt ?? Date.now()).toLocaleDateString(),
                    })
                  : t("archive.completedOn", {
                      date: new Date(item.completedAt ?? item.updatedAt ?? Date.now()).toLocaleDateString(),
                    })}
              </span>
              {isTask ? (
                <span>
                  ·{" "}
                  {planned
                    ? t("archive.rounds", { done, planned })
                    : t("archive.roundsDone", { done })}
                </span>
              ) : null}
              {seconds ? <span>· {t("archive.tracked", { duration: formatDuration(seconds) })}</span> : null}
            </div>
            {spots.length ? (
              <p className="mt-1 truncate text-[11px] text-muted-foreground/80">{spots[0]?.label}</p>
            ) : null}
            {item.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate({ to: "/item/$itemId", params: { itemId: item.id } })}
            >
              <ExternalLink className="size-4" /> {t("archive.open")}
            </Button>
            {archived ? (
              <Button variant="outline" size="sm" onClick={() => void restore(item)}>
                <ArchiveRestore className="size-4" /> {t("archive.restore")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void reopen(item)}>
                <RotateCcw className="size-4" /> {t("archive.reopen")}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void purge(item)}>
              <Trash2 className="size-4" /> {t("archive.delete")}
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t("archive.summary", {
          tasks: completedTasks.length,
          rounds: rounds.length,
          hours: formatDuration(trackedSeconds),
        })}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((key) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {t(`archive.tab.${key}` as "archive.tab.all")}
          </Button>
        ))}
        {lockedTableId ? null : (
          <Select value={pickedTable} onValueChange={setPickedTable}>
            <SelectTrigger className="h-9 w-44" aria-label={t("archive.filterTable")}>
              <SelectValue placeholder={t("archive.filterTable")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("archive.allTables")}</SelectItem>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("archive.searchPlaceholder")}
          className="h-9 max-w-xs"
          aria-label={t("archive.searchPlaceholder")}
        />
      </div>

      {nothing ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {query || tableId !== "all" ? t("archive.emptyFiltered") : t("archive.empty")}
        </p>
      ) : null}

      {showTasks && completedTasks.length ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("archive.tab.tasks")}</h3>
          <ul className="space-y-2">
            {completedTasks.map((item) => (
              <ItemRow key={item.id} item={item} archived={false} />
            ))}
          </ul>
        </section>
      ) : null}

      {showRounds && rounds.length ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("archive.tab.rounds")}</h3>
          <ul className="space-y-2">
            {rounds.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-s-4 border-s-amber-500/70 bg-card/70 p-3 shadow-sm"
              >
                <Timer className="size-4 text-amber-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("archive.roundOn", {
                      date: new Date(session.stoppedAt ?? session.startedAt).toLocaleString(),
                      duration: formatDuration(elapsedSeconds(session)),
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void navigate({ to: "/item/$itemId", params: { itemId: session.itemId } })
                  }
                >
                  <ExternalLink className="size-4" /> {t("archive.open")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showArchived && archivedItems.length ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t("archive.tab.archived")} · {t("archive.count", { count: archivedItems.length })}
          </h3>
          <ul className="space-y-2">
            {archivedItems.map((item) => (
              <ItemRow key={item.id} item={item} archived />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
