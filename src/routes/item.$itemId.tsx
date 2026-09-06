import { createFileRoute, Link } from "@tanstack/react-router";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowUpRight, Check, GripVertical, Highlighter, Pause, Pin, PinOff, Play, Plus, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ItemAiSummary } from "@/components/item-ai-summary";
import { ItemDocumentation } from "@/components/item-documentation";
import { ItemPlacements } from "@/components/item-placements";
import { ItemRelations } from "@/components/item-relations";
import { ItemStickyBar } from "@/components/item-sticky-bar";
import { ItemTimeline } from "@/components/item-timeline";
import { LinkPreview } from "@/components/link-preview";
import { RichDocEditor } from "@/components/rich-doc-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTick } from "@/hooks/useTick";
import { COL, createRecord, deleteRecord, updateRecord, watchUserCollection } from "@/lib/db";
import { bySortOrder, orderAtEnd, orderForIndex } from "@/lib/order";
import {
  MANUAL_ROUND_SECONDS,
  completedRoundsForItem,
  creditRoundToItem,
  elapsedSeconds,
  formatDuration,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
} from "@/lib/sessions";

import type {
  Attachment,
  ItemStatus,
  LinkRecord,
  Note,
  Priority,
  Subtask,
  WorkItem,
} from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { useT, type MessageKey } from "@/lib/i18n";
import { playDropSound } from "@/lib/sound";

export const Route = createFileRoute("/item/$itemId")({
  head: () => ({
    meta: [
      { title: "Workspace — Personal Work OS" },
      {
        name: "description",
        content:
          "A focused workspace for one task or topic: progress, subtasks, notes, links and work sessions in one view.",
      },
      { property: "og:title", content: "Workspace — Personal Work OS" },
      {
        property: "og:description",
        content: "Work on a single task or topic with documentation and timers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <ItemWorkspace />
    </AppShell>
  ),
});

const STATUSES: ItemStatus[] = ["todo", "in_progress", "blocked", "review", "done"];
const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];
const TABS = ["overview", "timeline", "sessions", "subtasks", "docs", "files", "links"] as const;

function useItemChildren(itemId: string) {
  const { userId } = useWorkspace();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const unsubs: Array<() => void> = [];
    const add = (p: Promise<() => void>) =>
      void p.then((u) => (active ? unsubs.push(u) : u())).catch(() => undefined);

    add(
      watchUserCollection<Subtask>(COL.subtasks, userId, (rows) =>
        active ? setSubtasks(rows.filter((r) => r.parentId === itemId).sort(bySortOrder)) : undefined,
      ),
    );
    add(
      watchUserCollection<Note>(COL.notes, userId, (rows) =>
        active ? setNotes(rows.filter((r) => r.itemId === itemId)) : undefined,
      ),
    );
    add(
      watchUserCollection<LinkRecord>(COL.links, userId, (rows) =>
        active ? setLinks(rows.filter((r) => r.itemId === itemId)) : undefined,
      ),
    );
    add(
      watchUserCollection<Attachment>(COL.attachments, userId, (rows) =>
        active
          ? setAttachments(
              rows
                .filter((r) => r.itemId === itemId)
                .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
            )
          : undefined,
      ),
    );

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [userId, itemId]);

  return { subtasks, notes, links, attachments };
}

function ItemWorkspace() {
  const t = useT();
  const { itemId } = Route.useParams();
  const { userId, items, sessions, placements, tables, rows, columns } = useWorkspace();
  const item = items.find((i) => i.id === itemId) ?? null;
  const { subtasks, notes, links, attachments } = useItemChildren(itemId);

  const now = useTick(1000);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteColor, setNoteColor] = useState("#f59e0b");
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  const titleRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const subtaskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function reorderSubtask(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const from = subtasks.findIndex((s) => s.id === activeId);
    const to = subtasks.findIndex((s) => s.id === overId);
    if (from < 0 || to < 0) return;
    const without = subtasks.filter((s) => s.id !== activeId);
    void updateRecord<Subtask>(COL.subtasks, activeId, { sortOrder: orderForIndex(without, to) });
    playDropSound();
  }

  const itemSessions = sessions
    .filter((s) => s.itemId === itemId)
    .sort((a, b) => b.startedAt - a.startedAt);
  const totalSeconds = itemSessions.reduce((acc, s) => acc + elapsedSeconds(s, now), 0);
  const open = itemSessions.find((s) => s.status !== "stopped") ?? null;
  const doneSubtasks = subtasks.filter((s) => s.done).length;
  const itemPlacements = useMemo(
    () => placements.filter((p) => p.itemId === itemId),
    [placements, itemId],
  );
  const doneRounds = completedRoundsForItem(sessions, itemId);

  const toggleTimer = useCallback(() => {
    if (!item) return;
    if (!open) {
      if (userId) void startSession(userId, { id: item.id, type: item.type, title: item.title });
      return;
    }
    if (open.status === "running") void pauseSession(open);
    else void resumeSession(open);
  }, [item, open, userId]);

  // Auto progress: mirror the share of completed subtasks unless overridden manually.
  useEffect(() => {
    if (!item?.autoProgress || !subtasks.length) return;
    const next = Math.round((doneSubtasks / subtasks.length) * 100);
    if (next !== item.progress) {
      void updateRecord<WorkItem>(COL.items, item.id, { progress: next });
    }
  }, [item?.autoProgress, item?.progress, item?.id, doneSubtasks, subtasks.length]);

  // In-page keyboard shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        toggleTimer();
      } else if (key === "n") {
        event.preventDefault();
        setTab("subtasks");
        setTimeout(() => subtaskInputRef.current?.focus(), 50);
      } else if (key === "e") {
        event.preventDefault();
        titleRef.current?.focus();
      } else if (/^[1-7]$/.test(event.key)) {
        event.preventDefault();
        setTab(TABS[Number(event.key) - 1]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleTimer]);

  if (!item) {
    return (
      <div className="p-6">
        <Link to="/tables" className="text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 inline size-4" /> {t("item.backToTables")}
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">{t("item.notFound")}</p>
      </div>
    );
  }

  const patch = (changes: Partial<WorkItem>) =>
    void updateRecord<WorkItem>(COL.items, item.id, changes).catch(() =>
      toast.error(t("item.saveFailed")),
    );

  return (
    <div className="work-os-arabic-surface mx-auto max-w-4xl p-6">
      <Link to="/tables" className="text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 inline size-4" /> {t("item.backToTables")}
      </Link>

      <ItemStickyBar item={item} userId={userId} open={open} totalSeconds={totalSeconds} now={now} />

      <header className="mt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.type}</p>
        <Input
          ref={titleRef}
          value={item.title}
          onChange={(e) => patch({ title: e.target.value })}
          aria-label={t("item.titleLabel")}
          className="mt-1 h-auto border-transparent bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:border-input focus-visible:px-3"
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("item.shortcuts.hint")}</p>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as (typeof TABS)[number])} className="mt-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">{t("item.tab.overview")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("item.tab.timeline")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("item.tab.sessions")}</TabsTrigger>
          <TabsTrigger value="subtasks">{t("item.tab.subtasks", { done: subtasks.filter((s) => s.done).length, total: subtasks.length })}</TabsTrigger>
          <TabsTrigger value="docs">{t("item.tab.docs")}</TabsTrigger>
          <TabsTrigger value="files">{t("item.tab.files", { count: attachments.length })}</TabsTrigger>
          <TabsTrigger value="links">{t("item.tab.links", { count: links.length })}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="status">{t("item.status")}</Label>
          <select
            id="status"
            value={item.status}
            onChange={(e) => patch({ status: e.target.value as ItemStatus })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priority">{t("item.priority")}</Label>
          <select
            id="priority"
            value={item.priority}
            onChange={(e) => patch({ priority: e.target.value as Priority })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`item.priority.${p}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">{t("plan.due")}</Label>
          <input
            id="dueDate"
            type="date"
            value={item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : ""}
            onChange={(e) =>
              patch({ dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).getTime() : null })
            }
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dueTime">{t("item.due.time")}</Label>
          <input
            id="dueTime"
            type="time"
            value={item.dueTime ?? ""}
            onChange={(e) => patch({ dueTime: e.target.value || null })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recurrence">{t("item.due.repeat")}</Label>
          <select
            id="recurrence"
            value={item.recurrence ?? "none"}
            onChange={(e) => patch({ recurrence: e.target.value as "none" | "daily" | "weekly" })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="none">{t("item.repeat.none")}</option>
            <option value="daily">{t("item.repeat.daily")}</option>
            <option value="weekly">{t("item.repeat.weekly")}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estimatedRounds">{t("plan.estimate")}</Label>
          <input
            id="estimatedRounds"
            type="number"
            min={0}
            value={item.estimatedRounds ?? ""}
            onChange={(e) => patch({ estimatedRounds: e.target.value ? Number(e.target.value) : null })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="progress">{t("item.progress", { value: item.progress })}</Label>
          <input
            id="progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={item.progress}
            disabled={!!item.autoProgress}
            onChange={(e) => patch({ progress: Number(e.target.value) })}
            className="w-full"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={!!item.autoProgress}
              onChange={(e) => patch({ autoProgress: e.target.checked })}
            />
            {t("item.autoProgress")}
          </label>
          {item.autoProgress ? (
            <p className="text-xs text-muted-foreground">{t("item.autoProgressHint")}</p>
          ) : null}
        </div>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label={t("item.summary.timeTracked")} value={formatDuration(totalSeconds)} mono />
        <SummaryCard label={t("item.summary.sessions")} value={String(itemSessions.length)} />
        <SummaryCard
          label={t("item.summary.subtasksDone")}
          value={`${doneSubtasks}/${subtasks.length}`}
        />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("item.estimate.title")}</h2>
        {item.estimatedRounds ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("item.estimate.line", {
                planned: item.estimatedRounds,
                done: doneRounds,
                left: formatDuration(Math.max(0, item.estimatedRounds - doneRounds) * 25 * 60),
              })}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.round((doneRounds / item.estimatedRounds) * 100))}%` }}
              />
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("item.estimate.noPlan")}</p>
        )}
      </section>

      <ItemRelations item={item} items={items} />
      <ItemPlacements placements={itemPlacements} tables={tables} rows={rows} columns={columns} />
      <ItemAiSummary item={item} subtasks={subtasks} sessions={itemSessions} now={now} />
      <div className="pb-10" />
        </TabsContent>

        <TabsContent value="timeline">
          <ItemTimeline
            userId={userId}
            item={item}
            sessions={itemSessions}
            subtasks={subtasks}
            notes={notes}
            links={links}
            attachments={attachments}
            now={now}
          />
        </TabsContent>

        <TabsContent value="sessions">
      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("item.sessions.timeTracked")}</p>
            <p className="font-mono text-2xl" dir="ltr">
              {formatDuration(totalSeconds)}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            {!open ? (
              <Button
                size="sm"
                onClick={() =>
                  userId &&
                  void startSession(userId, { id: item.id, type: item.type, title: item.title })
                }
              >
                <Play className="size-4" /> {t("item.sessions.start")}
              </Button>
            ) : (
              <>
                {open.status === "running" ? (
                  <Button size="sm" variant="outline" onClick={() => void pauseSession(open)}>
                    <Pause className="size-4" /> {t("item.sessions.pause")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void resumeSession(open)}>
                    <Play className="size-4" /> {t("item.sessions.resume")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void stopSession(open).then(() => {
                      // A full-length session also advances the task's own progress.
                      if (elapsedSeconds(open, Date.now()) >= MANUAL_ROUND_SECONDS) {
                        void creditRoundToItem(item);
                      }
                    })
                  }
                >
                  <Square className="size-4" /> {t("item.sessions.stop")}
                </Button>

              </>
            )}
          </div>
        </div>
        {itemSessions.length ? (
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            {itemSessions.slice(0, 6).map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{new Date(s.startedAt).toLocaleString()}</span>
                <span className="font-mono" dir="ltr">
                  {formatDuration(elapsedSeconds(s, now))} · {s.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
        </TabsContent>

        <TabsContent value="subtasks">
      <section className="mt-6">
        <div className="mt-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("item.subtasks.title")}</h2>
          <span className="text-xs text-muted-foreground">
            {t("item.subtasks.doneCount", { done: subtasks.filter((s) => s.done).length, total: subtasks.length })}
          </span>
        </div>
        {subtasks.length ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{
                width: `${Math.round((subtasks.filter((s) => s.done).length / subtasks.length) * 100)}%`,
              }}
            />
          </div>
        ) : null}
        <DndContext sensors={subtaskSensors} collisionDetection={closestCenter} onDragEnd={reorderSubtask}>
          <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-3 space-y-2">
              {subtasks.map((st) => (
                <SortableSubtask key={st.id} subtask={st} parent={item} userId={userId} />
              ))}
          {!subtasks.length ? (
            <li className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              {t("item.subtasks.empty")}
            </li>
          ) : null}
            </ul>
          </SortableContext>
        </DndContext>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = subtaskDraft.trim();
            if (!title || !userId) return;
            void createRecord<Subtask>(COL.subtasks, userId, {
              parentId: item.id,
              title,
              done: false,
              sortOrder: orderAtEnd(subtasks),
            });
            setSubtaskDraft("");
          }}
        >
          <Input
            ref={subtaskInputRef}
            value={subtaskDraft}
            onChange={(e) => setSubtaskDraft(e.target.value)}
            placeholder={t("item.subtasks.addPlaceholder")}
            aria-label={t("item.subtasks.newAria")}
          />
          <Button type="submit" variant="outline">
            <Plus className="size-4" />
          </Button>
        </form>
      </section>

        </TabsContent>

        <TabsContent value="docs">
      <section className="mt-6">
        <h2 className="text-sm font-semibold">{t("item.docs.title")}</h2>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">
          {t("item.docs.hint")}
        </p>
        <RichDocEditor
          value={item.descriptionHtml ?? (item.description ? `<p>${item.description}</p>` : "")}
          onSave={(html) => patch({ descriptionHtml: html })}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned)).map((note) => (
            <StickyNoteCard key={note.id} note={note} />
          ))}
        </div>
        <form
          className="mt-3 rounded-lg border border-border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const body = noteDraft.trim();
            if (!body || !userId) return;
            const selection = highlight && highlight.end > highlight.start
              ? [{ ...highlight, color: noteColor }]
              : undefined;
            void createRecord<Note>(COL.notes, userId, {
              itemId: item.id,
              body,
              ...(noteTitle.trim() ? { title: noteTitle.trim() } : {}),
              color: noteColor,
              pinned: true,
              ...(selection ? { highlights: selection } : {}),
            });
            setNoteDraft("");
            setNoteTitle("");
            setHighlight(null);
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder={t("item.docs.noteTitlePlaceholder")} className="h-8 flex-1" aria-label={t("item.docs.noteTitleAria")} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">{t("item.docs.color")} <input type="color" value={noteColor} onChange={(e) => setNoteColor(e.target.value)} className="size-7 rounded border border-border bg-transparent" /></label>
          </div>
          <Textarea
            ref={noteRef}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onSelect={(e) => {
              const target = e.currentTarget;
              setHighlight(target.selectionEnd > target.selectionStart ? { start: target.selectionStart, end: target.selectionEnd } : null);
            }}
            placeholder={t("item.docs.notePlaceholder")}
            className="mt-2 min-h-24"
            aria-label={t("item.docs.newNoteAria")}
          />
          {highlight && highlight.end > highlight.start ? (
            <p className="mt-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
              {t("item.docs.selected")} <mark className="rounded-sm bg-accent px-0.5 text-accent-foreground">{noteDraft.slice(highlight.start, highlight.end)}</mark>
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" variant={highlight ? "secondary" : "outline"} onPointerDown={(event) => event.preventDefault()} onClick={() => {
              const field = noteRef.current;
              if (field && field.selectionEnd > field.selectionStart) {
                setHighlight({ start: field.selectionStart, end: field.selectionEnd });
                toast.success(t("item.docs.highlightWillApply"));
              } else {
                toast.info(t("item.docs.selectTextFirst"));
              }
            }}><Highlighter className="size-4" /> {t("item.docs.highlightSelection")}</Button>
            <Button type="submit" size="sm" className="ml-auto"><Plus className="size-4" /> {t("item.docs.addStickyNote")}</Button>
          </div>
        </form>
      </section>
        </TabsContent>

        <TabsContent value="files">
      <ItemDocumentation
        userId={userId}
        item={{ id: item.id, type: item.type }}
        attachments={attachments}
      />
        </TabsContent>

        <TabsContent value="links">
      <section className="mt-6 pb-10">
        <h2 className="text-sm font-semibold">{t("item.links.title")}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <LinkPreview link={l} />
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => void deleteRecord(COL.links, l.id)}
              >
                {t("item.links.remove")}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const url = linkDraft.trim();
            if (!url || !userId) return;
            void createRecord<LinkRecord>(COL.links, userId, { itemId: item.id, url });
            setLinkDraft("");
          }}
        >
          <Input
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder={t("item.links.placeholder")}
            type="url"
            aria-label={t("item.links.newAria")}
          />
          <Button type="submit" variant="outline">
            <Plus className="size-4" />
          </Button>
        </form>
      </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-1 text-lg font-semibold " + (mono ? "font-mono" : "")} dir={mono ? "ltr" : undefined}>
        {value}
      </p>
    </div>
  );
}

function SortableSubtask({
  subtask,
  parent,
  userId,
}: {
  subtask: Subtask;
  parent: WorkItem;
  userId: string | null;
}) {
  const t = useT();

  async function promote() {
    if (!userId) return;
    const id = await createRecord<WorkItem>(COL.items, userId, {
      type: "task",
      title: subtask.title,
      status: subtask.done ? "done" : "todo",
      priority: parent.priority,
      progress: subtask.done ? 100 : 0,
      parentTopicId: parent.type === "topic" ? parent.id : (parent.parentTopicId ?? null),
      promotedFromSubtaskId: subtask.id,
      relatedTo: [parent.id],
    } as never);
    await updateRecord<WorkItem>(COL.items, parent.id, {
      relatedTo: Array.from(new Set([...(parent.relatedTo ?? []), id])),
    });
    toast.success(t("item.subtasks.promoted"));
  }

  const sortable = useSortable({ id: subtask.id });
  return (
    <li ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className="group">
      <div className={"flex items-center gap-3 rounded-lg border p-2.5 transition-colors " + (subtask.done ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-card hover:border-primary/50")}>
        <button type="button" className="cursor-grab text-muted-foreground" aria-label={t("item.subtasks.dragAria", { title: subtask.title })} {...sortable.attributes} {...sortable.listeners}><GripVertical className="size-4" /></button>
        <button type="button" aria-pressed={subtask.done} aria-label={subtask.done ? t("item.subtasks.markNotDone", { title: subtask.title }) : t("item.subtasks.markDone", { title: subtask.title })} onClick={() => void updateRecord<Subtask>(COL.subtasks, subtask.id, { done: !subtask.done })} className="flex min-w-0 flex-1 items-center gap-3 text-start">
          <span aria-hidden className={"flex size-5 shrink-0 items-center justify-center rounded-full border transition-all " + (subtask.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 text-transparent group-hover:border-primary")}><Check className="size-3.5" /></span>
          <span className={"min-w-0 truncate text-sm " + (subtask.done ? "text-muted-foreground line-through" : "")}>{subtask.title}</span>
        </button>
        <Button variant="ghost" size="icon" aria-label={t("item.subtasks.promote")} title={t("item.subtasks.promote")} onClick={() => void promote()}><ArrowUpRight className="size-4" /></Button>
        <Button variant="ghost" size="icon" aria-label={t("item.subtasks.deleteAria", { title: subtask.title })} onClick={() => void deleteRecord(COL.subtasks, subtask.id)}><Trash2 className="size-4" /></Button>
      </div>
    </li>
  );
}

function StickyNoteCard({ note }: { note: Note }) {
  const t = useT();
  const segments: Array<{ text: string; color?: string }> = [];
  let cursor = 0;
  for (const mark of [...(note.highlights ?? [])].sort((a, b) => a.start - b.start)) {
    const start = Math.max(cursor, Math.min(note.body.length, mark.start));
    const end = Math.max(start, Math.min(note.body.length, mark.end));
    if (start > cursor) segments.push({ text: note.body.slice(cursor, start) });
    if (end > start) segments.push({ text: note.body.slice(start, end), color: mark.color });
    cursor = end;
  }
  if (cursor < note.body.length) segments.push({ text: note.body.slice(cursor) });
  return (
    <article className="relative min-h-36 rounded-md border border-border bg-card p-4 shadow-sm" style={{ borderTopColor: note.color, borderTopWidth: 4 }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{note.title ? <h3 className="font-semibold">{note.title}</h3> : null}<p className="mt-1 whitespace-pre-wrap text-sm">{segments.length ? segments.map((part, index) => part.color ? <mark key={index} style={{ backgroundColor: part.color }} className="rounded-sm px-0.5 text-inherit">{part.text}</mark> : <span key={index}>{part.text}</span>) : note.body}</p></div>
        <Button variant="ghost" size="icon" aria-label={note.pinned ? t("item.docs.unpinNote") : t("item.docs.pinNote")} onClick={() => void updateRecord<Note>(COL.notes, note.id, { pinned: !note.pinned })}>{note.pinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}</Button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</span><Button variant="ghost" size="icon" className="ml-auto" aria-label={t("item.docs.deleteNote")} onClick={() => void deleteRecord(COL.notes, note.id)}><Trash2 className="size-4" /></Button></div>
    </article>
  );
}
