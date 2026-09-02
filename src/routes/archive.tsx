import { createFileRoute } from "@tanstack/react-router";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmToast } from "@/lib/confirm";
import { COL, deleteRecord, updateRecord } from "@/lib/db";
import { useT } from "@/lib/i18n";
import type { WorkItem } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [
      { title: "Archive — Personal Work OS" },
      {
        name: "description",
        content:
          "Review archived tasks and topics, restore them to your tables or delete them for good.",
      },
      { property: "og:title", content: "Archive — Personal Work OS" },
      {
        property: "og:description",
        content: "Everything auto-archived from your tables, one click away from coming back.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ArchivePage />
    </AppShell>
  ),
});

/** Read-and-restore surface for everything the tables auto-archive sweep hid. */
function ArchivePage() {
  const t = useT();
  const { items, placements } = useWorkspace();
  const [query, setQuery] = useState("");

  const archived = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => i.archivedAt)
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  }, [items, query]);

  async function restore(item: WorkItem) {
    await updateRecord<WorkItem>(COL.items, item.id, { archivedAt: null });
    toast.success(t("archive.restored"), { description: item.title });
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("archive.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("archive.subtitle")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("archive.searchPlaceholder")}
          className="h-9 max-w-xs"
          aria-label={t("archive.searchPlaceholder")}
        />
        <span className="text-xs text-muted-foreground">
          {t("archive.count", { count: archived.length })}
        </span>
      </div>

      {!archived.length ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("archive.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {archived.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-3"
            >
              <span aria-hidden>{item.icon ?? (item.type === "task" ? "✓" : "◫")}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t("archive.archivedOn", {
                    date: new Date(item.archivedAt ?? Date.now()).toLocaleDateString(),
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void restore(item)}>
                <ArchiveRestore className="size-4" /> {t("archive.restore")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => void purge(item)}
              >
                <Trash2 className="size-4" /> {t("archive.delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
