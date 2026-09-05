import { GripVertical, LayoutTemplate, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export type TableTemplate = {
  id: string;
  name: string;
  description: string;
  columns: Array<{ name: string; note?: string }>;
  rows: string[];
};

/** Editable starting points — once dropped, every column, row and note is just
 * normal table content you can rename or delete inline. */
export const TABLE_TEMPLATES: TableTemplate[] = [
  {
    id: "daily",
    name: "Daily plan",
    description: "Morning → Afternoon → Evening lanes with a review row.",
    columns: [
      { name: "Morning", note: "Deep work — hardest task first." },
      { name: "Afternoon", note: "Meetings, reviews and follow-ups." },
      { name: "Evening", note: "Wrap up, document and plan tomorrow." },
    ],
    rows: ["Priorities", "In progress", "Done today"],
  },
  {
    id: "kanban",
    name: "Kanban flow",
    description: "Backlog → Doing → Review → Done.",
    columns: [
      { name: "Backlog" },
      { name: "Doing", note: "Keep max 2 items here." },
      { name: "Review" },
      { name: "Done" },
    ],
    rows: ["Work items"],
  },
  {
    id: "study",
    name: "Study / research",
    description: "Read, summarize, practice and document per topic.",
    columns: [
      { name: "Sources" },
      { name: "Notes", note: "Summarize in your own words." },
      { name: "Practice" },
      { name: "Documented" },
    ],
    rows: ["Topic 1", "Topic 2"],
  },
  {
    id: "focus",
    name: "Focus rounds",
    description: "Plan pomodoro rounds per task with results.",
    columns: [
      { name: "Planned rounds" },
      { name: "Running" },
      { name: "Results", note: "Tracked minutes appear in the Dashboard." },
    ],
    rows: ["Today", "This week"],
  },
];

export function TableTemplates({
  onApply,
  disabled,
  hideHeader,
}: {
  onApply: (template: TableTemplate) => void;
  disabled?: boolean;
  hideHeader?: boolean;
}) {
  const t = useT();
  const templateLabels: Record<string, { name: string; description: string }> = {
    daily: { name: t("template.daily.name"), description: t("template.daily.description") },
    kanban: { name: t("template.kanban.name"), description: t("template.kanban.description") },
    study: { name: t("template.study.name"), description: t("template.study.description") },
    focus: { name: t("template.focus.name"), description: t("template.focus.description") },
  };
  return (
    <section className={hideHeader ? "" : "mt-6"} aria-label={t("template.ariaLabel")}>
      {!hideHeader ? (
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LayoutTemplate className="size-4" /> {t("template.heading")}
          <span className="text-xs font-normal text-muted-foreground">{t("template.hint")}</span>
        </h2>
      ) : null}
      <div className={`grid gap-2 sm:grid-cols-2 xl:grid-cols-4 ${hideHeader ? "" : "mt-2"}`}>
        {TABLE_TEMPLATES.map((template) => (
          <article
            key={template.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/work-os-template", template.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm active:cursor-grabbing"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <GripVertical className="size-4 text-muted-foreground" />
              {templateLabels[template.id]?.name ?? template.name}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {templateLabels[template.id]?.description ?? template.description}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("template.columnsRows", { columns: template.columns.length, rows: template.rows.length })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={disabled}
              onClick={() => onApply(template)}
            >
              <Plus className="size-4" /> {t("template.insert")}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
