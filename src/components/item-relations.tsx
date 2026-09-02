import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { COL, updateRecord } from "@/lib/db";
import type { WorkItem } from "@/lib/types";
import { useT } from "@/lib/i18n";

type Field = "blockedBy" | "blocks" | "relatedTo";

const FIELDS: Array<{ key: Field; label: "item.relations.blockedBy" | "item.relations.blocks" | "item.relations.related" }> = [
  { key: "blockedBy", label: "item.relations.blockedBy" },
  { key: "blocks", label: "item.relations.blocks" },
  { key: "relatedTo", label: "item.relations.related" },
];

/** Blocking / blocked-by / related links plus the parent topic and its siblings. */
export function ItemRelations({ item, items }: { item: WorkItem; items: WorkItem[] }) {
  const t = useT();
  const byId = new Map(items.map((i) => [i.id, i]));
  const parent = item.parentTopicId ? (byId.get(item.parentTopicId) ?? null) : null;
  const siblings = item.parentTopicId
    ? items.filter((i) => i.parentTopicId === item.parentTopicId && i.id !== item.id)
    : [];

  const setField = (field: Field, ids: string[]) =>
    void updateRecord<WorkItem>(COL.items, item.id, { [field]: ids } as Partial<WorkItem>);

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{t("item.relations.title")}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {FIELDS.map(({ key, label }) => {
          const ids = item[key] ?? [];
          return (
            <div key={key} className="space-y-1.5">
              <Label>{t(label)}</Label>
              <ul className="space-y-1">
                {ids.map((id) => {
                  const target = byId.get(id);
                  if (!target) return null;
                  return (
                    <li key={id} className="flex items-center gap-1 text-sm">
                      <Link
                        to="/item/$itemId"
                        params={{ itemId: id }}
                        className="min-w-0 flex-1 truncate text-primary hover:underline"
                      >
                        {target.title}
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("item.relations.remove")}
                        onClick={() => setField(key, ids.filter((x) => x !== id))}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
                {!ids.length ? <li className="text-xs text-muted-foreground">{t("item.relations.none")}</li> : null}
              </ul>
              <select
                value=""
                aria-label={t("item.relations.add")}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setField(key, Array.from(new Set([...ids, e.target.value])));
                  e.currentTarget.value = "";
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">{t("item.relations.add")}</option>
                {items
                  .filter((i) => i.id !== item.id && !ids.includes(i.id))
                  .slice(0, 200)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("item.relations.parent")}</p>
          {parent ? (
            <Link to="/item/$itemId" params={{ itemId: parent.id }} className="text-sm text-primary hover:underline">
              {parent.title}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">{t("item.relations.none")}</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("item.relations.siblings")}</p>
          {siblings.length ? (
            <ul className="space-y-0.5">
              {siblings.slice(0, 10).map((s) => (
                <li key={s.id}>
                  <Link to="/item/$itemId" params={{ itemId: s.id }} className="text-sm text-primary hover:underline">
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("item.relations.none")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
