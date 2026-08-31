import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { ItemStatus, ItemType } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { useT, type MessageKey } from "@/lib/i18n";

const STATUSES: Array<ItemStatus | "all"> = [
  "all",
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done",
];

/** Shared list view for the Tasks and Topics pages. */
export function ItemLibrary({
  type,
  titleKey,
  subtitleKey,
}: {
  type: ItemType;
  titleKey: MessageKey;
  subtitleKey: MessageKey;
}) {
  const t = useT();
  const title = t(titleKey);
  const { items, placements, tables } = useWorkspace();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ItemStatus | "all">("all");

  const tableName = useMemo(() => new Map(tables.map((t) => [t.id, t.name])), [tables]);

  const list = useMemo(
    () =>
      items
        .filter((i) => i.type === type)
        .filter((i) => (status === "all" ? true : i.status === status))
        .filter((i) =>
          q.trim() ? `${i.title} ${i.description ?? ""}`.toLowerCase().includes(q.toLowerCase()) : true,
        )
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [items, type, status, q],
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(subtitleKey)}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("library.filterPlaceholder")}
          className="max-w-xs"
          aria-label={t("library.filterPlaceholder")}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ItemStatus | "all")}
          aria-label={t("library.filterByStatus")}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("status.all") : t(`status.${s}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-5 space-y-2">
        {list.map((i) => {
          const where = placements
            .filter((p) => p.itemId === i.id)
            .map((p) => tableName.get(p.tableId))
            .filter(Boolean) as string[];
          return (
            <li key={i.id}>
              <Link
                to="/item/$itemId"
                params={{ itemId: i.id }}
                className="block rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.title}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t(`status.${i.status}` as MessageKey)} · {i.priority}
                  </span>
                  <span className="w-10 text-end text-xs text-muted-foreground">{i.progress}%</span>
                </div>
                {where.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("library.in", { tables: where.join(", ") })}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{t("library.notPlaced")}</p>
                )}
              </Link>
            </li>
          );
        })}
        {!list.length ? (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        ) : null}
      </ul>
    </div>
  );
}
