import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { COL, createRecord } from "@/lib/db";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-store";
import type { ItemType, PageNote, Priority, WorkItem } from "@/lib/types";

type Kind = ItemType | "note";

/**
 * Global quick capture. Alt+N opens it from any page so a thought is stored in
 * two seconds and classified later, which is the main reason personal systems
 * get abandoned.
 */
export function QuickCapture() {
  const t = useT();
  const { userId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("task");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [due, setDue] = useState("");
  const [estimate, setEstimate] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function save() {
    const value = text.trim();
    if (!value || !userId || saving) return;
    setSaving(true);
    try {
      if (kind === "note") {
        await createRecord<PageNote>(COL.pageNotes, userId, {
          body: value,
          x: 24 + Math.round(Math.random() * 80),
          y: 96 + Math.round(Math.random() * 80),
        });
      } else {
        await createRecord<WorkItem>(COL.items, userId, {
          type: kind,
          title: value,
          status: "todo",
          priority,
          progress: 0,
          dueDate: due ? new Date(`${due}T12:00:00`).getTime() : null,
          estimatedRounds: estimate ? Math.max(1, Number(estimate)) : null,
        });
      }
      toast.success(t("capture.saved"));
      setText("");
      setDue("");
      setEstimate("");
      setOpen(false);
    } catch {
      toast.error(t("capture.failed"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 end-5 z-40 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
      >
        {t("capture.open")} · Alt+N
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label={t("capture.title")}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{t("capture.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("capture.hint")}</p>

        <div className="mt-3 flex gap-2">
          {(["task", "topic", "note"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                kind === k
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {t(`capture.kind.${k}` as "capture.kind.task")}
            </button>
          ))}
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          }}
          rows={3}
          aria-label={t("capture.text")}
          placeholder={t("capture.placeholder")}
          className="mt-3 w-full rounded-md border border-input bg-background p-2 text-sm outline-none focus:border-primary"
        />

        {kind !== "note" ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              {t("plan.priority")}
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-sm text-foreground"
              >
                {(["low", "normal", "high", "urgent"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}` as "priority.low")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t("plan.due")}
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              {t("plan.estimate")}
              <input
                type="number"
                min={1}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background p-1.5 text-sm text-foreground"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" disabled={!text.trim() || saving} onClick={() => void save()}>
            {t("capture.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
