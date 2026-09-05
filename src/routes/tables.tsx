import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  Clock3,
  Columns3,
  Filter,
  EyeOff,
  Copy,
  ChevronDown,
  ChevronRight,
  Edit3,
  FolderInput,
  ListChecks,
  FolderTree,
  GripVertical,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  StickyNote,
  Tag,
  ImagePlus,
  Upload,
  Trash2,
  ZoomIn,
  LayoutTemplate,
  Sparkles,
  SlidersHorizontal,
  Smile,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { InlineName } from "@/components/inline-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiOptimizer } from "@/components/ai-optimizer";
import { TableFocusTray } from "@/components/table-focus-tray";
import { FocusTaskTable } from "@/components/focus-task-table";
import { TABLE_TEMPLATES, TableTemplates, type TableTemplate } from "@/components/table-templates";
import { ImageLightbox } from "@/components/image-lightbox";
import { COL, createRecord, deleteRecord, updateRecord } from "@/lib/db";
import { trackEvent } from "@/lib/firebase";
import {
  copyPlacementToCell,
  deleteLineCascade,
  deleteTableCascade,
  moveItemToCell,
  moveTableToSection,
  nextCellOrder,
  removePlacement,
  reorderTo,
} from "@/lib/moves";
import { bySortOrder, orderAtEnd, orderForIndex } from "@/lib/order";
import { ICONS, PALETTE, tint } from "@/lib/palette";
import { completedRoundsForItem, elapsedSeconds, formatDuration, startSession } from "@/lib/sessions";
import { DUE_COLORS, dueTone, type DueTone } from "@/lib/due";
import { confirmToast } from "@/lib/confirm";
import { useSettings } from "@/lib/settings-store";
import { readSnapshot } from "@/lib/table-snapshot";
import type { ItemStatus, ItemType, Note, Placement, Priority, TableCell, WorkItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-store";
import { playDropSound } from "@/lib/sound";


export const Route = createFileRoute("/tables")({
  head: () => ({
    meta: [
      { title: "Tables — Personal Work OS" },
      {
        name: "description",
        content:
          "Flexible tables of rows and columns where tasks and topics are placed, moved and reorganized with drag and drop.",
      },
      { property: "og:title", content: "Tables — Personal Work OS" },
      {
        property: "og:description",
        content: "Organize your work in sections, tables, rows, columns and cells.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <TablesPage />
    </AppShell>
  ),
});

/** Quick, non-destructive filters applied on top of the open table. */
type QuickFilters = {
  status: ItemStatus | "all";
  priority: Priority | "all";
  due: "all" | "overdue" | "today" | "week" | "none";
  topic: string;
};

type DragData =
  | { kind: "section"; id: string }
  | { kind: "table"; id: string; sectionId: string }
  | { kind: "row"; id: string }
  | { kind: "column"; id: string }
  | { kind: "placement"; id: string; itemId: string; itemType: ItemType }
  | { kind: "cell"; tableId: string; rowId: string; columnId: string };

function TablesPage() {
  const t = useT();
  const store = useWorkspace();
  const { userId, sections, tables, rows, columns, cells, items, placements, sessions } = store;
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [sectionOpenOverrides, setSectionOpenOverrides] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [showFocusSessions, setShowFocusSessions] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("work-os:show-focus-sessions");
    return v !== null ? v === "true" : true;
  });
  const [showTemplates, setShowTemplates] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("work-os:show-templates");
    return v !== null ? v === "true" : true;
  });
  const [showAiOptimizer, setShowAiOptimizer] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("work-os:show-ai-optimizer");
    return v !== null ? v === "true" : true;
  });
  const [filters, setFilters] = useState<QuickFilters>({
    status: "all",
    priority: "all",
    due: "all",
    topic: "all",
  });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [dueColors, setDueColors] = useState(true);
  const { settings } = useSettings();
  const swept = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = window.localStorage.getItem("work-os:sections-open");
    if (saved !== null) setSidebarOpen(saved === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("work-os:sections-open", String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    window.localStorage.setItem("work-os:show-focus-sessions", String(showFocusSessions));
  }, [showFocusSessions]);

  useEffect(() => {
    window.localStorage.setItem("work-os:show-templates", String(showTemplates));
  }, [showTemplates]);

  useEffect(() => {
    window.localStorage.setItem("work-os:show-ai-optimizer", String(showAiOptimizer));
  }, [showAiOptimizer]);


  /**
   * Auto-archive: completed items untouched for longer than the configured
   * window get an `archivedAt` stamp so tables stay light. Runs once per visit
   * and never deletes anything — archived items are one toggle away.
   */
  useEffect(() => {
    const days = settings?.autoArchiveDays ?? 0;
    if (!userId || swept.current || days <= 0 || !items.length) return;
    swept.current = true;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const stale = items.filter(
      (i) =>
        i.status === "done" &&
        !i.archivedAt &&
        (i.completedAt ?? i.updatedAt ?? i.createdAt ?? Date.now()) < cutoff,
    );
    if (!stale.length) return;
    void (async () => {
      const now = Date.now();
      for (const item of stale) {
        await updateRecord<WorkItem>(COL.items, item.id, { archivedAt: now });
      }
      toast.success(t("tables.autoArchived", { count: stale.length, days }));
    })();
  }, [userId, items, settings?.autoArchiveDays, t]);


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const sortedSections = useMemo(() => [...sections].sort(bySortOrder), [sections]);
  const currentTableId =
    activeTableId && tables.some((t) => t.id === activeTableId)
      ? activeTableId
      : ([...tables].sort(bySortOrder)[0]?.id ?? null);
  const table = tables.find((t) => t.id === currentTableId) ?? null;
  const tableRows = useMemo(
    () => rows.filter((r) => r.tableId === currentTableId).sort(bySortOrder),
    [rows, currentTableId],
  );
  const tableColumns = useMemo(
    () => columns.filter((c) => c.tableId === currentTableId).sort(bySortOrder),
    [columns, currentTableId],
  );
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  /** How many placements in this table point at archived items. */
  const archivedCount = useMemo(
    () =>
      placements.filter((p) => p.tableId === currentTableId && itemById.get(p.itemId)?.archivedAt)
        .length,
    [placements, itemById, currentTableId],
  );
  /** Tasks and topics currently placed anywhere in the open table. */
  const tableItems = useMemo(() => {
    const ids = new Set(
      placements.filter((p) => p.tableId === currentTableId).map((p) => p.itemId),
    );
    return items.filter((i) => ids.has(i.id));
  }, [items, placements, currentTableId]);
  const cellByKey = useMemo(
    () => new Map(cells.map((c) => [`${c.rowId}:${c.columnId}`, c])),
    [cells],
  );

  /** Completed Pomodoro rounds per item, used by the per-cell counters. */
  const roundsByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.id, completedRoundsForItem(sessions, item.id));
    return map;
  }, [items, sessions]);

  /** Tracked seconds per item, used by the per-column summary row. */
  const secondsByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions)
      map.set(session.itemId, (map.get(session.itemId) ?? 0) + elapsedSeconds(session));
    return map;
  }, [sessions]);

  const filtersActive =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.due !== "all" ||
    filters.topic !== "all";

  /** Placements of the open table after archive state and quick filters. */
  const visiblePlacements = useMemo(() => {
    const now = Date.now();
    return placements.filter((p) => {
      if (p.tableId !== currentTableId) return false;
      const item = itemById.get(p.itemId);
      if (!item) return false;
      if (!showArchived && item.archivedAt) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.priority !== "all" && item.priority !== filters.priority) return false;
      if (filters.topic !== "all" && (item.parentTopicId ?? "") !== filters.topic) return false;
      if (filters.due !== "all") {
        const tone = dueTone(item.dueDate, now);
        if (filters.due === "none" && tone !== "none") return false;
        if (filters.due === "overdue" && tone !== "overdue") return false;
        if (filters.due === "today" && tone !== "today") return false;
        if (filters.due === "week" && tone !== "today" && tone !== "soon") return false;
      }
      return true;
    });
  }, [placements, currentTableId, itemById, showArchived, filters]);

  /** Columns kept on screen: not hidden manually, and not empty when collapsing. */
  const visibleColumns = useMemo(
    () =>
      tableColumns.filter(
        (c) =>
          !hiddenColumns.includes(c.id) &&
          (!hideEmpty || visiblePlacements.some((p) => p.columnId === c.id)),
      ),
    [tableColumns, hiddenColumns, hideEmpty, visiblePlacements],
  );
  const visibleRows = useMemo(
    () =>
      tableRows.filter((r) => !hideEmpty || visiblePlacements.some((p) => p.rowId === r.id)),
    [tableRows, hideEmpty, visiblePlacements],
  );

  /** Completion and tracked time per visible column. */
  const columnSummary = useMemo(() => {
    const map = new Map<string, { tasks: number; percent: number; seconds: number }>();
    for (const column of visibleColumns) {
      const ids = new Set(
        visiblePlacements.filter((p) => p.columnId === column.id).map((p) => p.itemId),
      );
      const tasks = [...ids].map((id) => itemById.get(id)).filter((i): i is WorkItem => !!i);
      const onlyTasks = tasks.filter((i) => i.type === "task");
      const percent = onlyTasks.length
        ? Math.round(onlyTasks.reduce((sum, i) => sum + (i.progress ?? 0), 0) / onlyTasks.length)
        : 0;
      const seconds = [...ids].reduce((sum, id) => sum + (secondsByItem.get(id) ?? 0), 0);
      map.set(column.id, { tasks: onlyTasks.length, percent, seconds });
    }
    return map;
  }, [visibleColumns, visiblePlacements, itemById, secondsByItem]);

  /** Topics available as a quick-filter dimension. */
  const topicOptions = useMemo(
    () => items.filter((i) => i.type === "topic").sort((a, b) => a.title.localeCompare(b.title)),
    [items],
  );

  /** Cell metadata is created lazily — the first color or icon creates the document. */
  async function setCellStyle(
    rowId: string,
    columnId: string,
    patch: { color?: string | null; icon?: string | null; note?: string | null; noteImage?: string | null },
  ) {

    if (!userId || !currentTableId) return;
    const existing = cellByKey.get(`${rowId}:${columnId}`);
    await guard(async () => {
      if (existing) await updateRecord<TableCell>(COL.cells, existing.id, patch as never);
      else
        await createRecord<TableCell>(COL.cells, userId, {
          tableId: currentTableId,
          rowId,
          columnId,
          ...(patch as object),
        } as never);
    }, t("tables.cellStyleSaveFailed"));
  }

  async function moveCellImage(
    fromRowId: string,
    fromColId: string,
    toRowId: string,
    toColId: string,
    noteImage: string,
  ) {
    if (fromRowId === toRowId && fromColId === toColId) return;
    await Promise.all([
      setCellStyle(fromRowId, fromColId, { noteImage: null }),
      setCellStyle(toRowId, toColId, { noteImage }),
    ]);
    playDropSound();
  }

  async function moveCellNote(
    fromRowId: string,
    fromColId: string,
    toRowId: string,
    toColId: string,
    note: string,
  ) {
    if (fromRowId === toRowId && fromColId === toColId) return;
    const targetCell = cellByKey.get(`${toRowId}:${toColId}`);
    const existingNote = targetCell?.note?.trim();
    const finalNote = existingNote ? `${existingNote}\n\n${note}` : note;
    await Promise.all([
      setCellStyle(fromRowId, fromColId, { note: null }),
      setCellStyle(toRowId, toColId, { note: finalNote }),
    ]);
    playDropSound();
  }



  async function guard(action: () => Promise<void>, failure: string) {
    try {
      await action();
    } catch (e) {
      toast.error(failure, { description: e instanceof Error ? e.message : undefined });
    }
  }

  async function addSection() {
    if (!userId) return;
    await guard(
      () =>
        createRecord(COL.sections, userId, {
          name: "New section",
          sortOrder: orderAtEnd(sections),
        } as never).then(() => undefined),
      t("tables.sectionCreateFailed"),
    );
  }

  async function addTable(sectionId: string) {
    if (!userId) return;
    await guard(async () => {
      const siblings = tables.filter((t) => t.sectionId === sectionId);
      const id = await createRecord(COL.tables, userId, {
        sectionId,
        name: "New table",
        sortOrder: orderAtEnd(siblings),
      } as never);
      const first = await createRecord(COL.rows, userId, {
        tableId: id,
        name: "Row 1",
        sortOrder: 1024,
      } as never);
      void first;
      await createRecord(COL.columns, userId, {
        tableId: id,
        name: "Planning",
        sortOrder: 1024,
      } as never);
      await createRecord(COL.columns, userId, {
        tableId: id,
        name: "Working",
        sortOrder: 2048,
      } as never);
      setActiveTableId(id);
      void trackEvent("table_created");
    }, t("tables.tableCreateFailed"));
  }

  async function addLine(kind: "row" | "column") {
    if (!userId || !currentTableId) return;
    const list = kind === "row" ? tableRows : tableColumns;
    await guard(
      () =>
        createRecord(kind === "row" ? COL.rows : COL.columns, userId, {
          tableId: currentTableId,
          name: kind === "row" ? `Row ${list.length + 1}` : `Column ${list.length + 1}`,
          sortOrder: orderAtEnd(list),
        } as never).then(() => undefined),
      t("tables.addLineFailed", { kind: kind === "row" ? t("tables.row") : t("tables.column") }),
    );
  }

  /** Templates are inserted as ordinary rows, columns and cell notes so they can
   * be edited straight away inside the table. */
  async function applyTemplate(template: TableTemplate) {
    if (!userId || !currentTableId) {
      toast.error(t("tables.openTableFirst"));
      return;
    }
    await guard(async () => {
      let columnOrder = orderAtEnd(tableColumns);
      const newColumns: string[] = [];
      for (const column of template.columns) {
        const id = await createRecord(COL.columns, userId, {
          tableId: currentTableId,
          name: column.name,
          sortOrder: columnOrder,
        } as never);
        newColumns.push(id);
        columnOrder += 1024;
      }
      let rowOrder = orderAtEnd(tableRows);
      const newRows: string[] = [];
      for (const name of template.rows) {
        const id = await createRecord(COL.rows, userId, {
          tableId: currentTableId,
          name,
          sortOrder: rowOrder,
        } as never);
        newRows.push(id);
        rowOrder += 1024;
      }
      const firstRow = newRows[0];
      if (firstRow) {
        await Promise.all(
          template.columns.map((column, index) =>
            column.note && newColumns[index]
              ? createRecord<TableCell>(COL.cells, userId, {
                  tableId: currentTableId,
                  rowId: firstRow,
                  columnId: newColumns[index]!,
                  note: column.note,
                } as never)
              : Promise.resolve(""),
          ),
        );
      }
      toast.success(t("tables.templateInserted", { name: template.name }), {
        description: t("tables.templateInsertedDesc"),
      });
    }, t("tables.templateCreateFailed"));
  }

  async function addItem(type: ItemType, rowId: string, columnId: string, title: string) {
    if (!userId || !currentTableId) return;
    await guard(async () => {
      const itemId = await createRecord<WorkItem>(COL.items, userId, {
        type,
        title,
        status: "todo",
        priority: "normal",
        progress: 0,
      });
      await createRecord<Placement>(COL.placements, userId, {
        itemType: type,
        itemId,
        tableId: currentTableId,
        rowId,
        columnId,
        sortOrder: nextCellOrder(placements, currentTableId, rowId, columnId),
      });
      // Every new topic gets its own documentation note so the Documentation
      // surface always has an entry attached to the topic from the start.
      if (type === "topic") {
        await createRecord<Note>(COL.notes, userId, {
          itemId,
          title: t("report.topicNoteTitle"),
          body: t("report.topicNoteBody", { title }),
          pinned: true,
          color: "#f59e0b",
        });
      }
      void trackEvent(type === "task" ? "task_created" : "topic_created");
      toast.success(type === "task" ? t("tables.taskAdded") : t("tables.topicAdded"), { description: title });
    }, t("tables.itemCreateFailed"));
  }

  function cellPlacements(rowId: string, columnId: string) {
    return visiblePlacements
      .filter((p) => p.rowId === rowId && p.columnId === columnId)
      .sort(bySortOrder);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const a = event.active.data.current as DragData | undefined;
    const o = event.over?.data.current as DragData | undefined;
    if (!a || !o || event.active.id === event.over?.id) return;

    if (a.kind === "section" && o.kind === "section") {
      await guard(() => reorderTo(COL.sections, sections, a.id, o.id), t("tables.moveFailed"));
      playDropSound();
      return;
    }

    if (a.kind === "table") {
      if (o.kind === "section") {
        if (o.id === a.sectionId) return;
        await guard(
          () => moveTableToSection(a.id, o.id, orderAtEnd(tables.filter((tb) => tb.sectionId === o.id))),
          t("tables.moveFailed"),
        );
        playDropSound();
        toast.success(t("tables.tableMovedToSection"));
        return;
      }
      if (o.kind === "table") {
        const target = tables.find((t) => t.id === o.id);
        if (!target) return;
        if (target.sectionId === a.sectionId) {
          await guard(
            () => reorderTo(COL.tables, tables.filter((tb) => tb.sectionId === a.sectionId), a.id, o.id),
            t("tables.moveFailed"),
          );
        } else {
          const siblings = tables.filter((t) => t.sectionId === target.sectionId).sort(bySortOrder);
          const index = siblings.findIndex((t) => t.id === target.id);
          await guard(
            () => moveTableToSection(a.id, target.sectionId, orderForIndex(siblings, index)),
            t("tables.moveFailed"),
          );
        }
        playDropSound();
        return;
      }
    }

    if (a.kind === "row" && o.kind === "row") {
      await guard(() => reorderTo(COL.rows, tableRows, a.id, o.id), t("tables.moveFailed"));
      playDropSound();
      return;
    }

    if (a.kind === "column" && o.kind === "column") {
      await guard(() => reorderTo(COL.columns, tableColumns, a.id, o.id), t("tables.moveFailed"));
      playDropSound();
      return;
    }

    if (a.kind === "placement") {
      const moved = placements.find((p) => p.id === a.id);
      if (!moved) return;

      // Dropped on a table tab → first cell of that table.
      if (o.kind === "table") {
        const targetRow = rows.filter((r) => r.tableId === o.id).sort(bySortOrder)[0];
        const targetCol = columns.filter((c) => c.tableId === o.id).sort(bySortOrder)[0];
        if (!targetRow || !targetCol) {
          toast.error(t("tables.tableHasNoRowsColumns"));
          return;
        }
        await guard(
          () =>
            moveItemToCell(moved.id, {
              tableId: o.id,
              rowId: targetRow.id,
              columnId: targetCol.id,
              sortOrder: nextCellOrder(placements, o.id, targetRow.id, targetCol.id),
            }),
          t("tables.moveFailed"),
        );
        playDropSound();
        toast.success(t("tables.movedToAnotherTable"));
        return;
      }

      if (o.kind === "cell") {
        if (
          o.tableId === moved.tableId &&
          o.rowId === moved.rowId &&
          o.columnId === moved.columnId
        )
          return;
        await guard(
          () =>
            moveItemToCell(moved.id, {
              tableId: o.tableId,
              rowId: o.rowId,
              columnId: o.columnId,
              sortOrder: nextCellOrder(placements, o.tableId, o.rowId, o.columnId),
            }),
          t("tables.moveFailed"),
        );
        playDropSound();
        void trackEvent("item_moved");
        return;
      }

      if (o.kind === "placement") {
        const target = placements.find((p) => p.id === o.id);
        if (!target) return;
        const sameCell =
          target.tableId === moved.tableId &&
          target.rowId === moved.rowId &&
          target.columnId === moved.columnId;
        if (sameCell) {
          const list = cellPlacements(moved.rowId, moved.columnId);
          await guard(() => reorderTo(COL.placements, list, moved.id, target.id), t("tables.moveFailed"));
        } else {
          const list = placements
            .filter(
              (p) =>
                p.tableId === target.tableId &&
                p.rowId === target.rowId &&
                p.columnId === target.columnId,
            )
            .sort(bySortOrder);
          const index = list.findIndex((p) => p.id === target.id);
          await guard(
            () =>
              moveItemToCell(moved.id, {
                tableId: target.tableId,
                rowId: target.rowId,
                columnId: target.columnId,
                sortOrder: orderForIndex(list, index),
              }),
            t("tables.moveFailed"),
          );
        }
        playDropSound();
        void trackEvent("item_moved");
        return;
      }
    }
  }

  const draggingItem =
    dragging?.kind === "placement" ? (itemById.get(dragging.itemId) ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setDragging(e.active.data.current as DragData)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <div
        className={cn(
          "work-os-arabic-surface flex min-h-screen",
          focusMode && "fixed inset-0 z-50 overflow-auto bg-background",
        )}
      >
        <div
          className={cn(
            "shrink-0 border-r border-border transition-all duration-200",
            sidebarOpen && !focusMode ? "w-64 p-4" : "w-0 overflow-hidden border-r-0 p-0",
          )}
          aria-hidden={!sidebarOpen || focusMode}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("tables.sectionsTitle")}</h2>
            <Button variant="ghost" size="icon" onClick={() => void addSection()} aria-label={t("tables.addSection")}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-3 space-y-2">

            {sortedSections.map((section) => (
              <SectionNode
                key={section.id}
                section={section}
                openOverride={sectionOpenOverrides[section.id]}
                tables={tables.filter((t) => t.sectionId === section.id).sort(bySortOrder)}
                activeTableId={currentTableId}
                onSelect={setActiveTableId}
                onAddTable={() => void addTable(section.id)}
                onRename={(name) => void updateRecord(COL.sections, section.id, { name } as never)}
                onDelete={() => void deleteRecord(COL.sections, section.id)}
                onToggle={(open) => {
                  setSectionOpenOverrides((current) => ({ ...current, [section.id]: open }));
                  void updateRecord(COL.sections, section.id, { isCollapsed: !open } as never)
                    .then(() => {
                      setSectionOpenOverrides((current) => {
                        const next = { ...current };
                        delete next[section.id];
                        return next;
                      });
                    })
                    .catch((error) => {
                      setSectionOpenOverrides((current) => {
                        const next = { ...current };
                        delete next[section.id];
                        return next;
                      });
                      toast.error(t("tables.sectionStateSaveFailed"), {
                        description: error instanceof Error ? error.message : undefined,
                      });
                    });
                }}
                onDeleteTable={(id) =>
                  void deleteTableCascade(id, store).then(() => toast.success(t("tables.tableDeletedToast")))
                }
                onMoveTable={(id, sectionId) =>
                  void moveTableToSection(
                    id,
                    sectionId,
                    orderAtEnd(tables.filter((t) => t.sectionId === sectionId)),
                  )
                }
                sections={sortedSections.map((s) => ({ id: s.id, name: s.name }))}
              />
            ))}
            {!sortedSections.length ? (
              <p className="text-sm text-muted-foreground">
                {t("tables.emptySections")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={sidebarOpen && !focusMode ? t("tables.hideSections") : t("tables.showSections")}
              aria-expanded={sidebarOpen && !focusMode}
              onClick={() => {
                 if (focusMode) {
                   setFocusMode(false);
                   setSidebarOpen(true);
                 } else {
                   setSidebarOpen((v) => !v);
                 }
              }}
            >
              {sidebarOpen && !focusMode ? (
                <>
                  <PanelLeftClose className="size-4" /> {t("tables.hideSections")}
                </>
              ) : (
                <>
                  <PanelLeftOpen className="size-4" /> {t("tables.showSections")}
                </>
              )}
            </Button>
            {archivedCount || showArchived ? (
              <Button
                variant={showArchived ? "secondary" : "outline"}
                size="sm"
                aria-pressed={showArchived}
                onClick={() => setShowArchived((v) => !v)}
              >
                <Archive className="size-4" />
                {showArchived ? t("tables.hideArchived") : t("tables.archivedCount", { count: archivedCount })}
              </Button>
            ) : null}
            <Button
              variant={hideEmpty ? "secondary" : "outline"}
              size="sm"
              aria-pressed={hideEmpty}
              onClick={() => setHideEmpty((v) => !v)}
            >
              <EyeOff className="size-4" />
              {hideEmpty ? t("grid.showEmpty") : t("grid.hideEmpty")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={hiddenColumns.length ? "secondary" : "outline"} size="sm">
                  <Columns3 className="size-4" />
                  {hiddenColumns.length
                    ? t("grid.hiddenColumns", { count: hiddenColumns.length })
                    : t("grid.columns")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {tableColumns.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      setHiddenColumns((current) =>
                        current.includes(col.id)
                          ? current.filter((id) => id !== col.id)
                          : [...current, col.id],
                      );
                    }}
                  >
                    <span className="w-4">{hiddenColumns.includes(col.id) ? "" : "✓"}</span>
                    <span className="truncate">{col.name}</span>
                  </DropdownMenuItem>
                ))}
                {hiddenColumns.length ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setHiddenColumns([])}>
                      {t("grid.showAllColumns")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant={dueColors ? "secondary" : "outline"}
              size="sm"
              aria-pressed={dueColors}
              onClick={() => setDueColors((v) => !v)}
            >
              {t("grid.dueColors")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <SlidersHorizontal className="size-4" />
                  <span>{t("tables.panels")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>{t("tables.panels")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowFocusSessions((v) => !v);
                  }}
                >
                  <span className="w-4">{showFocusSessions ? "✓" : ""}</span>
                  <Clock3 className="size-4 text-muted-foreground" />
                  <span className="truncate">{t("tables.showFocusSessions")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowTemplates((v) => !v);
                  }}
                >
                  <span className="w-4">{showTemplates ? "✓" : ""}</span>
                  <LayoutTemplate className="size-4 text-muted-foreground" />
                  <span className="truncate">{t("tables.showTemplates")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setShowAiOptimizer((v) => !v);
                  }}
                >
                  <span className="w-4">{showAiOptimizer ? "✓" : ""}</span>
                  <Sparkles className="size-4 text-muted-foreground" />
                  <span className="truncate">{t("tables.showAiOptimizer")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quick filter bar: narrows the open table without leaving the page. */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/40 p-2">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Filter className="size-3.5" /> {t("grid.filters")}
            </span>
            <FilterSelect
              label={t("grid.filterStatus")}
              value={filters.status}
              onChange={(status) => setFilters((f) => ({ ...f, status: status as QuickFilters["status"] }))}
              options={[
                { value: "all", label: t("grid.all") },
                ...STATUSES.map((st) => ({ value: st.value, label: t(st.labelKey) })),
              ]}
            />
            <FilterSelect
              label={t("grid.filterPriority")}
              value={filters.priority}
              onChange={(priority) =>
                setFilters((f) => ({ ...f, priority: priority as QuickFilters["priority"] }))
              }
              options={[
                { value: "all", label: t("grid.all") },
                { value: "urgent", label: "urgent" },
                { value: "high", label: "high" },
                { value: "normal", label: "normal" },
                { value: "low", label: "low" },
              ]}
            />
            <FilterSelect
              label={t("grid.filterDue")}
              value={filters.due}
              onChange={(due) => setFilters((f) => ({ ...f, due: due as QuickFilters["due"] }))}
              options={[
                { value: "all", label: t("grid.all") },
                { value: "overdue", label: t("grid.dueOverdue") },
                { value: "today", label: t("grid.dueToday") },
                { value: "week", label: t("grid.dueWeek") },
                { value: "none", label: t("grid.dueNone") },
              ]}
            />
            <FilterSelect
              label={t("grid.filterTopic")}
              value={filters.topic}
              onChange={(topic) => setFilters((f) => ({ ...f, topic }))}
              options={[
                { value: "all", label: t("grid.all") },
                ...topicOptions.map((topic) => ({ value: topic.id, label: topic.title })),
              ]}
            />
            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({ status: "all", priority: "all", due: "all", topic: "all" })
                }
              >
                {t("grid.clearFilters")}
              </Button>
            ) : null}
          </div>
          <TableFocusTray userId={userId} items={items} />
          {!table ? (
            <div className="mx-auto mt-24 max-w-md text-center">
              <h1 className="text-xl font-semibold">{t("tables.noTableTitle")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("tables.noTableDesc")}
              </p>
            </div>
          ) : (
            <>
              <header className="mb-6 flex flex-wrap items-center gap-3">
                <InlineName
                  key={table.id}
                  value={table.name}
                  onCommit={(name) =>
                    void updateRecord(COL.tables, table.id, { name } as never)
                  }
                  className="h-9 w-64 flex-none px-2 text-xl font-semibold"
                  ariaLabel={t("tables.tableNameLabel")}
                />

                <p className="ml-auto text-xs text-muted-foreground">
                  {t("tables.rightClickHint")}
                </p>
              </header>

              <ContextMenu>
              <ContextMenuTrigger asChild>
              <div
                tabIndex={0}
                role="group"
                aria-label={table.name}
                className={cn(
                  "work-os-table-scroll overscroll-x-contain rounded-xl border border-border bg-card/40 p-3 pb-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  // In focus mode the grid must not scroll sideways: columns fit the viewport.
                  focusMode ? "overflow-x-hidden" : "overflow-x-auto",
                )}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  const node = event.currentTarget;
                  if (node.scrollWidth <= node.clientWidth) return;
                  const target = event.target as HTMLElement;
                  // Let text inputs keep native caret movement.
                  if (target.closest("input, textarea, [contenteditable='true']")) return;
                  node.scrollLeft += event.key === "ArrowRight" ? 220 : -220;
                  event.preventDefault();
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes("application/work-os-template")) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData("application/work-os-template");
                  if (!id) return;
                  event.preventDefault();
                  const template = TABLE_TEMPLATES.find((candidate) => candidate.id === id);
                  if (template) void applyTemplate(template);
                }}
                onWheel={(event) => {
                  if (focusMode) return;
                  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
                  const node = event.currentTarget;
                  if (node.scrollWidth <= node.clientWidth) return;
                  node.scrollLeft += event.deltaY;
                  event.preventDefault();
                }}
              >
                <div
                  className={cn("grid gap-2", focusMode ? "w-full" : "min-w-fit")}
                  style={{
                    gridTemplateColumns: focusMode
                      ? `minmax(8rem, max-content) repeat(${Math.max(visibleColumns.length, 1)}, minmax(0, 1fr))`
                      : `minmax(11rem, max-content) repeat(${Math.max(visibleColumns.length, 1)}, minmax(15rem, max-content))`,
                  }}
                >
                  <div className="rounded-xl border border-dashed border-border/70 bg-card/30 flex items-center justify-center p-2 text-xs font-semibold text-muted-foreground/50 select-none shadow-xs" />
                  {visibleColumns.map((col) => (
                    <LineHeader
                      key={col.id}
                      kind="column"
                      id={col.id}
                      name={col.name}
                      color={col.color}
                      icon={col.icon}
                      subtitle={col.subtitle}
                      onStyle={(patch) => void updateRecord(COL.columns, col.id, patch as never)}
                      onRename={(name) => void updateRecord(COL.columns, col.id, { name } as never)}
                      onDelete={() => void deleteLineCascade("column", col.id, placements)}
                      onAddAfter={() => void addLine("column")}
                    />
                  ))}

                  {visibleRows.map((row) => (
                    <RowLine
                      key={row.id}
                      rowId={row.id}
                      name={row.name}
                      color={row.color}
                      icon={row.icon}
                      subtitle={row.subtitle}
                      onStyle={(patch) => void updateRecord(COL.rows, row.id, patch as never)}
                      columns={visibleColumns}
                      onRename={(name) => void updateRecord(COL.rows, row.id, { name } as never)}
                      onDelete={() => void deleteLineCascade("row", row.id, placements)}
                      onAddAfter={() => void addLine("row")}
                      renderCell={(columnId) => (
                        <Cell
                          tableId={table.id}
                          rowId={row.id}
                          columnId={columnId}
                          cell={cellByKey.get(`${row.id}:${columnId}`) ?? null}
                          onStyle={(patch) => void setCellStyle(row.id, columnId, patch)}
                          onMoveImage={(fromRowId, fromColId, img) =>
                            void moveCellImage(fromRowId, fromColId, row.id, columnId, img)
                          }
                          onMoveNote={(fromRowId, fromColId, noteText) =>
                            void moveCellNote(fromRowId, fromColId, row.id, columnId, noteText)
                          }
                          placements={cellPlacements(row.id, columnId)}
                          itemById={itemById}
                          roundsByItem={roundsByItem}
                          dueColors={dueColors}
                          onOpen={(itemId) => void navigate({ to: "/item/$itemId", params: { itemId } })}
                          onSetStatus={(itemId, status) =>
                            void updateRecord<WorkItem>(COL.items, itemId, { status })
                          }
                          onSetProgress={(itemId, progress) =>
                            void updateRecord<WorkItem>(COL.items, itemId, { progress })
                          }
                          onSetItemStyle={(itemId, patch) =>
                            void updateRecord<WorkItem>(COL.items, itemId, patch as never)
                          }
                          onFocusItem={(itemId) =>
                             window.dispatchEvent(
                               new CustomEvent("work-os:start-table-focus", { detail: itemId }),
                             )
                          }

                          onAddItem={(type, title) => void addItem(type, row.id, columnId, title)}
                          onRemove={(placementId) =>
                            void removePlacement(placementId).then(() =>
                              toast.success(t("tables.removedFromTable")),
                            )
                          }
                          onDeleteItem={(itemId, placementIds) =>
                            void Promise.all([
                              ...placementIds.map((id) => deleteRecord(COL.placements, id)),
                              deleteRecord(COL.items, itemId),
                            ]).then(() => toast.success(t("tables.itemDeletedToast")))
                          }
                          onStart={(item) =>
                            userId &&
                            void startSession(userId, item).then(() =>
                              toast.success(t("tables.workSessionStarted")),
                            )
                          }
                          onCopyToTable={(placement, targetTableId) => {
                            if (!userId) return;
                            const r = rows.filter((x) => x.tableId === targetTableId).sort(bySortOrder)[0];
                            const c = columns
                              .filter((x) => x.tableId === targetTableId)
                              .sort(bySortOrder)[0];
                            if (!r || !c) {
                              toast.error(t("tables.tableHasNoRowsColumns"));
                              return;
                            }
                            void copyPlacementToCell(userId, placement.itemType, placement.itemId, {
                              tableId: targetTableId,
                              rowId: r.id,
                              columnId: c.id,
                              sortOrder: nextCellOrder(placements, targetTableId, r.id, c.id),
                            }).then(() => toast.success(t("tables.addedToOtherTable")));
                          }}
                          otherTables={tables
                            .filter((t) => t.id !== table.id)
                            .map((t) => ({ id: t.id, name: t.name }))}
                        />
                      )}
                    />
                  ))}

                  {/* Column summary: completion and tracked time per column. */}
                  <div className="mt-1 flex items-center rounded-md bg-muted/50 px-2 py-2 text-xs font-medium text-muted-foreground">
                    {t("grid.summary")}
                  </div>
                  {visibleColumns.map((col) => {
                    const sum = columnSummary.get(col.id);
                    return (
                      <div
                        key={`summary-${col.id}`}
                        className="mt-1 rounded-md bg-muted/30 px-2 py-2 text-xs text-muted-foreground"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{t("grid.summaryDone", { percent: sum?.percent ?? 0 })}</span>
                          <span className="tabular-nums">{formatDuration(sum?.seconds ?? 0)}</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-muted">
                          <div
                            className="h-1 rounded-full bg-primary"
                            style={{ width: `${sum?.percent ?? 0}%` }}
                          />
                        </div>
                        <p className="mt-1">{t("grid.summaryTasks", { count: sum?.tasks ?? 0 })}</p>
                      </div>
                    );
                  })}
                </div>
                {!tableColumns.length || !tableRows.length ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t("tables.needRowColumn")}
                  </p>
                ) : null}
              </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                <ContextMenuLabel>{table.name}</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => void addLine("row")}>
                  <Plus /> {t("tables.row")}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void addLine("column")}>
                  <Plus /> {t("tables.column")}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setFocusMode((v) => !v)}>
                  {focusMode ? <Minimize2 /> : <Maximize2 />} {focusMode ? t("tables.exitFocus") : t("tables.focusTable")}
                </ContextMenuItem>
              </ContextMenuContent>
              </ContextMenu>

              {/* Focus sessions in this table */}
              <div className="mt-6 rounded-xl border border-border bg-card/40 p-4 shadow-sm transition-all">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowFocusSessions((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowFocusSessions((v) => !v);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock3 className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold">{t("tables.focusSessionsTitle")}</h2>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {t("tables.focusSessionsDesc")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={showFocusSessions ? t("tables.collapsePanel") : t("tables.expandPanel")}
                    >
                      {showFocusSessions ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </Button>
                  </div>
                </div>
                {showFocusSessions ? (
                  <div className="mt-3">
                    <FocusTaskTable
                      userId={userId}
                      items={tableItems}
                      sessions={sessions}
                      onSelect={(id) => void navigate({ to: "/item/$itemId", params: { itemId: id } })}
                    />
                  </div>
                ) : null}
              </div>

              {/* Templates */}
              <div className="mt-6 rounded-xl border border-border bg-card/40 p-4 shadow-sm transition-all">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowTemplates((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowTemplates((v) => !v);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <LayoutTemplate className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold">{t("template.heading")}</h2>
                      <p className="text-xs text-muted-foreground line-clamp-1">{t("template.hint")}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={showTemplates ? t("tables.collapsePanel") : t("tables.expandPanel")}
                  >
                    {showTemplates ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </Button>
                </div>
                {showTemplates ? (
                  <div className="mt-3">
                    <TableTemplates
                      onApply={(template) => void applyTemplate(template)}
                      disabled={!currentTableId}
                      hideHeader
                    />
                  </div>
                ) : null}
              </div>

              {/* AI Structure Assistant */}
              <div className="mt-6 rounded-xl border border-border bg-card/40 p-4 shadow-sm transition-all">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowAiOptimizer((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowAiOptimizer((v) => !v);
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold">{t("optimizer.structureTitle")}</h2>
                      <p className="text-xs text-muted-foreground line-clamp-1">{t("optimizer.structureSubtitle")}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={showAiOptimizer ? t("tables.collapsePanel") : t("tables.expandPanel")}
                  >
                    {showAiOptimizer ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </Button>
                </div>
                {showAiOptimizer ? (
                  <div className="mt-3">
                    <AiOptimizer
                      userId={userId}
                      tableId={table.id}
                      tableName={table.name}
                      rows={tableRows}
                      columns={tableColumns}
                      hideHeader
                    />
                  </div>
                ) : null}
              </div>
            </>

          )}
        </div>
      </div>

      <DragOverlay>
        {draggingItem ? (
          <div className="rounded-md border border-primary/40 bg-card px-3 py-2 text-sm shadow-lg">
            {draggingItem.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Compact labelled <select> used by the quick filter bar. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-border bg-background px-1.5 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionNode({
  section,
  openOverride,
  tables,
  sections,
  activeTableId,
  onSelect,
  onAddTable,
  onRename,
  onDelete,
  onToggle,
  onDeleteTable,
  onMoveTable,
}: {
  section: { id: string; name: string; isCollapsed?: boolean };
  openOverride?: boolean | undefined;
  tables: { id: string; name: string; sectionId: string }[];
  sections: { id: string; name: string }[];
  activeTableId: string | null;
  onSelect: (id: string) => void;
  onAddTable: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onToggle: (open: boolean) => void;
  onDeleteTable: (id: string) => void;
  onMoveTable: (id: string, sectionId: string) => void;
}) {
  const t = useT();
  const open = openOverride ?? !section.isCollapsed;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: `section-${section.id}`,
    data: { kind: "section", id: section.id },
  });
  const drop = useDroppable({
    id: `section-drop-${section.id}`,
    data: { kind: "section", id: section.id },
  });

  const sectionBody = (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("rounded-md", isDragging && "opacity-50")}
    >
      <div
        ref={drop.setNodeRef}
        className={cn(
          "flex items-center gap-1 rounded-md px-1 py-1",
          drop.isOver && "ring-2 ring-primary",
        )}
      >
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          aria-label={t("tables.dragSection", { name: section.name })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(!open)}
          aria-label={open ? t("tables.collapseSection", { name: section.name }) : t("tables.expandSection", { name: section.name })}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <input
          value={section.name}
          onChange={(e) => onRename(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          aria-label={t("tables.sectionNameLabel")}
        />
        <Button variant="ghost" size="icon" onClick={onAddTable} aria-label={t("tables.addTable")}>
          <Plus className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("tables.deleteSection")}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {open ? (
        <div className="ml-6 space-y-1">
          {tables.map((tbl) => (
            <TableTab
              key={tbl.id}
              table={tbl}
              active={tbl.id === activeTableId}
              onSelect={() => onSelect(tbl.id)}
              onRename={(name) => void updateRecord(COL.tables, tbl.id, { name } as never)}
              onDelete={() => onDeleteTable(tbl.id)}
              sections={sections.filter((s) => s.id !== section.id)}
              onMoveToSection={(sectionId) => onMoveTable(tbl.id, sectionId)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{sectionBody}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>{section.name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onToggle(!open)}>
          {open ? <ChevronRight /> : <ChevronDown />}
          {open ? t("tables.collapseSectionMenu") : t("tables.expandSectionMenu")}
        </ContextMenuItem>
        <ContextMenuItem onClick={onAddTable}>
          <Plus /> {t("tables.addTable")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const name = window.prompt(t("tables.sectionNamePrompt"), section.name);
          if (name?.trim()) onRename(name.trim());
        }}>
          <Edit3 /> {t("tables.renameSection")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 /> {t("tables.deleteSectionMenu")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function TableTab({
  table,
  active,
  onSelect,
  onRename,
  onDelete,
  sections,
  onMoveToSection,
}: {
  table: { id: string; name: string; sectionId: string };
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  sections: { id: string; name: string }[];
  onMoveToSection: (sectionId: string) => void;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({
    id: `table-${table.id}`,
    data: { kind: "table", id: table.id, sectionId: table.sectionId },
  });

  const tab = (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "flex items-center gap-1 rounded-md px-1",
        isDragging && "opacity-50",
        isOver && "ring-2 ring-primary",
        active && "bg-primary/10",
      )}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground"
        aria-label={t("tables.dragItem", { title: table.name })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={cn("min-w-0 flex-1 truncate py-1.5 text-start text-sm", active && "font-medium")}
      >
        {table.name}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("tables.actionsFor", { name: table.name })}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              const name = window.prompt(t("tables.tableNamePrompt"), table.name);
              if (name) onRename(name);
            }}
          >
            {t("tables.rename")}
          </DropdownMenuItem>
          {sections.length ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>{t("tables.moveToSection")}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {sections.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => onMoveToSection(s.id)}>
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => {
              void confirmToast(t("tables.confirmDeleteTable"), {
                confirmLabel: t("common.delete"),
                cancelLabel: t("common.cancel"),
              }).then((ok) => ok && onDelete());
            }}
          >
            {t("tables.deleteTable")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{tab}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>{table.name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onSelect}><FolderInput /> {t("tables.openTable")}</ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const name = window.prompt(t("tables.tableNamePrompt"), table.name);
          if (name?.trim()) onRename(name.trim());
        }}><Edit3 /> {t("tables.renameTable")}</ContextMenuItem>
        {sections.length ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger><FolderInput className="me-2 size-4" /> {t("tables.moveToSection")}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {sections.map((section) => (
                <ContextMenuItem key={section.id} onClick={() => onMoveToSection(section.id)}>
                  <FolderInput /> {section.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={onDelete}><Trash2 /> {t("tables.deleteTable")}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

type StylePatch = { color?: string | null; icon?: string | null; subtitle?: string | null };
type CellPatch = StylePatch & { note?: string | null; noteImage?: string | null };

/** Reads an image Blob/File and downscales/compresses it to keep within document limits. */
export function fileToDataUrl(file: Blob, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return reject(new Error("Failed to read image file."));
      if (typeof Image === "undefined") return resolve(src);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", quality) || canvas.toDataURL("image/jpeg", quality) || src);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Reads image from clipboard (supports screenshots / copied images). */
export async function readImageFromClipboard(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return null;
  try {
    if (navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          return await fileToDataUrl(blob);
        }
      }
    }
  } catch {
    /* clipboard permissions or unsupported */
  }
  return null;
}

/**
 * Extracts an image (as DataURL or URL) from a DragEvent dataTransfer.
 * Supports:
 * - Direct image file drops (from desktop / file explorer)
 * - Dragging an image from another table cell (custom data type application/x-table-image)
 * - Dragging an image from a web page (html img tag, uri-list, or plain text image url)
 */
export async function extractImageFromDataTransfer(dt: DataTransfer | null): Promise<string | null> {
  if (!dt) return null;

  // 1. Internal cell image drag (from another cell)
  try {
    const internal = dt.getData("application/x-table-image");
    if (internal) return internal;
  } catch {
    /* ignore */
  }

  // 2. Direct file drop from file explorer / desktop
  if (dt.files && dt.files.length > 0) {
    const imageFile = Array.from(dt.files).find((f) => f.type.startsWith("image/"));
    if (imageFile) {
      return await fileToDataUrl(imageFile);
    }
  }

  // 3. Items with files (some browsers prioritize items)
  if (dt.items && dt.items.length > 0) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          return await fileToDataUrl(file);
        }
      }
    }
  }

  // 4. HTML img tag from dragged web content
  try {
    const html = dt.getData("text/html");
    if (html) {
      const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    /* ignore */
  }

  // 5. URI list (links to images dragged from browser)
  try {
    const uri = dt.getData("text/uri-list")?.split("\n")[0]?.trim();
    if (uri && (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("data:image/"))) {
      return uri;
    }
  } catch {
    /* ignore */
  }

  // 6. Plain text if it's a data URL or direct image URL
  try {
    const text = dt.getData("text/plain")?.trim();
    if (
      text &&
      (text.startsWith("data:image/") ||
        ((text.startsWith("http://") || text.startsWith("https://")) &&
          /\.(jpeg|jpg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(text)))
    ) {
      return text;
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Inline cell note: edits save as you type (debounced) and an image
 * can be pasted from clipboard, uploaded, or removed directly.
 */
function CellNote({
  rowId,
  columnId,
  note,
  noteImage,
  editing,
  onEditingChange,
  onStyle,
  onMoveImage,
  onMoveNote,
}: {
  rowId?: string | undefined;
  columnId?: string | undefined;
  note?: string | undefined;
  noteImage?: string | undefined;
  editing: boolean;
  onEditingChange: (next: boolean) => void;
  onStyle: (patch: CellPatch) => void;
  onMoveImage?: ((fromRowId: string, fromColumnId: string, image: string) => void) | undefined;
  onMoveNote?: ((fromRowId: string, fromColumnId: string, note: string) => void) | undefined;
}) {
  const t = useT();
  const [draft, setDraft] = useState(note ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const dirty = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isNoteDragOver, setIsNoteDragOver] = useState(false);
  const [noteDragType, setNoteDragType] = useState<"image" | "note">("note");
  const noteDragCounter = useRef(0);

  useEffect(() => {
    if (!dirty.current) setDraft(note ?? "");
  }, [note]);

  useEffect(() => {
    if (!editing || !dirty.current) return;
    const timeout = window.setTimeout(() => {
      dirty.current = false;
      onStyle({ note: draft.trim() ? draft.trim() : null });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draft, editing, onStyle]);

  const handlePasteImage = async () => {
    const clipboardImg = await readImageFromClipboard();
    if (clipboardImg) {
      onStyle({ noteImage: clipboardImg });
      toast.success(t("tables.imageAdded"));
      return;
    }
    const snapshot = readSnapshot();
    if (snapshot) {
      onStyle({ noteImage: snapshot });
      toast.success(t("tables.snapshotAdded"));
      return;
    }
    toast.info(t("tables.noClipboardImage"));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      onStyle({ noteImage: dataUrl });
      toast.success(t("tables.imageAdded"));
    } catch {
      toast.error("Failed to load image");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          void fileToDataUrl(file).then((dataUrl) => {
            onStyle({ noteImage: dataUrl });
            toast.success(t("tables.imageAdded"));
          });
          return;
        }
      }
    }
  };

  const handleNoteDragEnter = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types || []);
    if (types.includes("application/x-table-image") || types.includes("Files")) {
      setNoteDragType("image");
    } else {
      setNoteDragType("note");
    }
    e.preventDefault();
    noteDragCounter.current += 1;
    setIsNoteDragOver(true);
  };

  const handleNoteDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleNoteDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    noteDragCounter.current = Math.max(0, noteDragCounter.current - 1);
    if (noteDragCounter.current === 0) {
      setIsNoteDragOver(false);
    }
  };

  const handleNoteDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    noteDragCounter.current = 0;
    setIsNoteDragOver(false);

    // 1. Internal Note Move
    const noteSourceKey = e.dataTransfer.getData("application/x-table-note-source");
    const internalNote = e.dataTransfer.getData("application/x-table-note");
    const imageSourceKey = e.dataTransfer.getData("application/x-table-image-source");
    const internalImage = e.dataTransfer.getData("application/x-table-image");

    if (noteSourceKey && internalNote) {
      try {
        const { rowId: srcRowId, columnId: srcColId } = JSON.parse(noteSourceKey) as {
          rowId: string;
          columnId: string;
        };
        if (srcRowId === rowId && srcColId === columnId) {
          return;
        }
        if (onMoveNote) {
          onMoveNote(srcRowId, srcColId, internalNote);
          setDraft((prev) => (prev.trim() ? `${prev.trim()}\n\n${internalNote}` : internalNote));
          if (imageSourceKey && internalImage && onMoveImage) {
            onMoveImage(srcRowId, srcColId, internalImage);
          }
          toast.success(t("tables.noteMoved"));
          return;
        }
      } catch {
        /* fallback below */
      }
    }

    // 2. Internal Image Move
    if (imageSourceKey && internalImage) {
      try {
        const { rowId: srcRowId, columnId: srcColId } = JSON.parse(imageSourceKey) as {
          rowId: string;
          columnId: string;
        };
        if (srcRowId === rowId && srcColId === columnId) {
          return;
        }
        if (onMoveImage) {
          onMoveImage(srcRowId, srcColId, internalImage);
          toast.success(t("tables.imageMoved"));
          return;
        }
      } catch {
        /* fallback below */
      }
    }

    // 3. External Image Drop
    const dataUrl = await extractImageFromDataTransfer(e.dataTransfer);
    if (dataUrl) {
      onStyle({ noteImage: dataUrl });
      playDropSound();
      toast.success(t("tables.imageAdded"));
      return;
    }

    // 4. External Text Drop
    const plainText = e.dataTransfer.getData("text/plain");
    if (plainText && plainText.trim()) {
      const existing = draft?.trim() || note?.trim();
      const finalNote = existing ? `${existing}\n\n${plainText.trim()}` : plainText.trim();
      setDraft(finalNote);
      onStyle({ note: finalNote });
      playDropSound();
      toast.success(t("tables.noteAdded"));
    }
  };

  if (!editing) {
    if (!note && !noteImage) return null;
    return (
      <div className="group/note relative w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onEditingChange(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEditingChange(true);
            }
          }}
          className="group/card flex w-full flex-col gap-1.5 rounded-lg border border-amber-500/25 border-s-4 border-s-amber-500/70 bg-amber-500/[0.08] p-2 text-start text-[11px] leading-relaxed text-foreground/80 shadow-sm transition hover:border-amber-500/45 hover:bg-amber-500/[0.14] cursor-pointer"
        >
          {note ? (
            <div
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData("application/x-table-note", note);
                if (rowId && columnId) {
                  e.dataTransfer.setData(
                    "application/x-table-note-source",
                    JSON.stringify({ rowId, columnId }),
                  );
                }
                e.dataTransfer.setData("text/plain", note);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="group/notedrag flex items-start gap-1.5 rounded p-1 -m-1 transition-all cursor-grab active:cursor-grabbing hover:bg-amber-500/15 hover:ring-1 hover:ring-amber-500/30 select-none"
              title={`${t("tables.dragNoteToMove")} · ${t("tables.clickToEdit")}`}
            >
              <GripVertical className="mt-0.5 size-3.5 shrink-0 text-amber-600/60 group-hover/notedrag:text-amber-700 dark:group-hover/notedrag:text-amber-400 transition-colors" aria-hidden />
              <StickyNote className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <span className="line-clamp-3 whitespace-pre-wrap break-words flex-1 text-foreground/90 font-normal">
                {note}
              </span>
            </div>
          ) : null}
          {noteImage ? (
            <div className="relative group/img mt-0.5 w-full overflow-hidden rounded-md border border-amber-500/25 bg-background/50">
              <img
                src={noteImage}
                alt={t("tables.noteSnapshotAlt")}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData("application/x-table-image", noteImage);
                  if (rowId && columnId) {
                    e.dataTransfer.setData(
                      "application/x-table-image-source",
                      JSON.stringify({ rowId, columnId }),
                    );
                  }
                  e.dataTransfer.setData("text/plain", noteImage);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="max-h-28 w-full object-contain cursor-grab active:cursor-grabbing transition hover:opacity-95"
                title={`${t("tables.viewImage")} · ${t("tables.dragImageToMove")}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(true);
                }}
              />
              <div className="absolute top-1 end-1 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                <button
                  type="button"
                  title={t("tables.viewImage")}
                  aria-label={t("tables.viewImage")}
                  className="rounded-full bg-background/80 p-1 text-foreground shadow-md transition hover:bg-background transform hover:scale-110 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxOpen(true);
                  }}
                >
                  <ZoomIn className="size-3" />
                </button>
                <button
                  type="button"
                  title={t("tables.deleteCellImage")}
                  aria-label={t("tables.deleteCellImage")}
                  className="rounded-full bg-destructive p-1 text-destructive-foreground shadow-md transition hover:bg-destructive/90 transform hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStyle({ noteImage: null });
                    toast.success(t("tables.imageDeleted"));
                  }}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <ImageLightbox
          src={noteImage ?? null}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onDelete={() => {
            onStyle({ noteImage: null });
            toast.success(t("tables.imageDeleted"));
          }}
          title={note || t("tables.cellNoteLabel")}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-md border border-border bg-background p-1.5 transition-all",
        isNoteDragOver && "border-amber-500 ring-2 ring-amber-500/60 bg-amber-500/10",
      )}
      onPaste={handleContainerPaste}
      onDragEnter={handleNoteDragEnter}
      onDragOver={handleNoteDragOver}
      onDragLeave={handleNoteDragLeave}
      onDrop={handleNoteDrop}
    >
      {isNoteDragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded bg-amber-500/20 backdrop-blur-[1px] border border-dashed border-amber-500 text-amber-600 dark:text-amber-400 animate-in fade-in duration-150">
          {noteDragType === "image" ? (
            <>
              <ImagePlus className="size-5 me-1.5 animate-bounce text-primary" />
              <span className="text-xs font-semibold">{t("tables.dropImageHere")}</span>
            </>
          ) : (
            <>
              <StickyNote className="size-5 me-1.5 animate-bounce text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold">{t("tables.dropNoteHere")}</span>
            </>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Textarea
        autoFocus
        value={draft}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
        }}
        onBlur={() => {
          if (!dirty.current) return;
          dirty.current = false;
          onStyle({ note: draft.trim() ? draft.trim() : null });
        }}
        rows={3}
        placeholder={t("tables.notePlaceholder")}
        className="min-h-16 text-xs"
        aria-label={t("tables.cellNoteLabel")}
      />
      {noteImage ? (
        <div className="relative group/editimg mt-1.5 overflow-hidden rounded border border-border bg-muted/20">
          <img
            src={noteImage}
            alt={t("tables.noteSnapshotAlt")}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData("application/x-table-image", noteImage);
              if (rowId && columnId) {
                e.dataTransfer.setData(
                  "application/x-table-image-source",
                  JSON.stringify({ rowId, columnId }),
                );
              }
              e.dataTransfer.setData("text/plain", noteImage);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="max-h-44 w-full object-contain cursor-grab active:cursor-grabbing"
            title={`${t("tables.viewImage")} · ${t("tables.dragImageToMove")}`}
            onClick={() => setLightboxOpen(true)}
          />
          <div className="absolute top-1.5 end-1.5 flex items-center gap-1">
            <button
              type="button"
              className="rounded bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground shadow backdrop-blur transition hover:bg-background flex items-center gap-1"
              onClick={() => setLightboxOpen(true)}
            >
              <ZoomIn className="size-3" />
              <span>{t("tables.viewImage")}</span>
            </button>
            <button
              type="button"
              className="rounded bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground shadow transition hover:bg-destructive/90 flex items-center gap-1"
              onClick={() => {
                onStyle({ noteImage: null });
                toast.success(t("tables.imageDeleted"));
              }}
            >
              <Trash2 className="size-3" />
              <span>{t("tables.deleteCellImage")}</span>
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={handlePasteImage}
        >
          <ImagePlus className="size-3.5" /> {t("tables.pasteClipboardImage")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3.5" /> {t("tables.uploadImage")}
        </Button>
        {noteImage ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              onStyle({ noteImage: null });
              toast.success(t("tables.imageDeleted"));
            }}
          >
            <Trash2 className="size-3.5" /> {t("tables.deleteCellImage")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ms-auto h-7 text-[11px]"
          onClick={() => onEditingChange(false)}
        >
          {t("tables.done")}
        </Button>
      </div>
      <ImageLightbox
        src={noteImage ?? null}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onDelete={() => {
          onStyle({ noteImage: null });
          toast.success(t("tables.imageDeleted"));
        }}
        title={note || t("tables.cellNoteLabel")}
      />
    </div>
  );
}


function LineHeader({
  kind,
  id,
  name,
  color,
  icon,
  subtitle,
  onRename,
  onDelete,
  onStyle,
  onAddAfter,
}: {
  kind: "row" | "column";
  id: string;
  name: string;
  color?: string | undefined;
  icon?: string | undefined;
  subtitle?: string | undefined;
  onRename: (name: string) => void;
  onDelete: () => void;
  onStyle?: ((patch: StylePatch) => void) | undefined;
  onAddAfter?: (() => void) | undefined;
}) {
  const t = useT();
  const kindLabel = kind === "row" ? t("tables.row") : t("tables.column");
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({
    id: `${kind}-${id}`,
    data: { kind, id },
  });

  function confirmDelete() {
    void confirmToast(t("tables.confirmDeleteLine", { kind: kindLabel }), {
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    }).then((ok) => ok && onDelete());
  }

  function promptSubtitle() {
    if (!onStyle) return;
    const next = window.prompt(t("tables.subtitlePrompt", { kind: kindLabel }), subtitle ?? "");
    if (next !== null) {
      onStyle({ subtitle: next.trim() ? next.trim() : null });
    }
  }

  const isCol = kind === "column";

  const menuButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 opacity-40 hover:opacity-100 group-hover/line:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          aria-label={t("tables.actionsFor", { name })}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-56">
        <DropdownMenuItem
          onSelect={() => {
            const next = window.prompt(t("tables.lineNamePrompt", { kind: kindLabel }), name);
            if (next) onRename(next);
          }}
        >
          <Edit3 className="size-4" />
          {t("tables.rename")}
        </DropdownMenuItem>
        {onStyle ? (
          <DropdownMenuItem onSelect={promptSubtitle}>
            <Bookmark className="size-4" />
            {subtitle ? t("tables.editSubtitle") : t("tables.addSubtitle")}
          </DropdownMenuItem>
        ) : null}
        {onStyle && subtitle ? (
          <DropdownMenuItem
            className="text-xs text-muted-foreground"
            onSelect={() => onStyle({ subtitle: null })}
          >
            {t("tables.clearSubtitle")}
          </DropdownMenuItem>
        ) : null}
        {onStyle ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Smile className="size-4" />
              {t("tables.icon")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="grid max-h-72 grid-cols-6 gap-0.5 overflow-y-auto p-1">
              {ICONS.map((i) => (
                <DropdownMenuItem
                  key={i}
                  onSelect={() => onStyle({ icon: i })}
                  className="flex size-9 items-center justify-center text-xl p-0 cursor-pointer hover:bg-muted"
                >
                  {i}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="col-span-6 my-1" />
              <DropdownMenuItem
                className="col-span-6 text-xs text-destructive"
                onSelect={() => onStyle({ icon: null })}
              >
                {t("tables.clearIcon")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        {onStyle ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tag className="size-4" />
              {t("tables.color")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {PALETTE.map((c) => (
                <DropdownMenuItem key={c.value} onSelect={() => onStyle({ color: c.value })}>
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: c.value }}
                    aria-hidden
                  />
                  {c.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onStyle({ color: null, icon: null, subtitle: null })}>
                {t("tables.clearStyle")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onSelect={confirmDelete}>
          <Trash2 className="size-4" />
          {t("tables.deleteLineMenu", { kind: kindLabel })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const iconTrigger = onStyle ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group/icon relative flex shrink-0 items-center justify-center select-none transition-all",
            "focus:outline-none focus:ring-1 focus:ring-ring active:scale-95",
            icon
              ? "text-2xl sm:text-3xl leading-none hover:scale-110"
              : "size-6 rounded-md border border-dashed border-border/70 text-muted-foreground/30 opacity-0 group-hover/line:opacity-100 hover:!opacity-100 hover:border-primary hover:text-primary transition-all",
          )}
          title={icon ? t("tables.icon") : t("tables.icon")}
          aria-label={t("tables.icon")}
        >
          {icon ? (
            <span className="leading-none transition-transform group-hover/icon:scale-110">
              {icon}
            </span>
          ) : (
            <Smile className="size-3.5" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1.5">
        <DropdownMenuLabel className="text-xs font-semibold">{t("tables.icon")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid max-h-60 grid-cols-6 gap-1 overflow-y-auto p-1">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onStyle({ icon: i })}
              className="flex size-8 items-center justify-center rounded-md text-xl hover:bg-muted transition"
            >
              {i}
            </button>
          ))}
        </div>
        {icon ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-destructive"
              onSelect={() => onStyle({ icon: null })}
            >
              {t("tables.clearIcon")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : icon ? (
    <span className="shrink-0 text-2xl sm:text-3xl leading-none select-none" aria-hidden>
      {icon}
    </span>
  ) : null;

  const subtitleBadge = subtitle ? (
    <div className="mt-0.5 flex items-center">
      <span
        onClick={(e) => {
          e.stopPropagation();
          promptSubtitle();
        }}
        className="inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium leading-tight border border-primary/25 bg-primary/[0.08] text-primary/95 break-words cursor-pointer hover:bg-primary/[0.16] hover:border-primary/40 transition shadow-2xs select-none"
        style={{
          borderColor: color ? `${color}55` : undefined,
          backgroundColor: color ? `${color}18` : undefined,
          color: color ?? undefined,
        }}
        title={t("tables.editSubtitle")}
      >
        {subtitle}
      </span>
    </div>
  ) : null;

  const header = isCol ? (
    // COLUMN HEADER: Sleek top lane tab, auto-expanding to fit text, bottom accent line
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        backgroundColor: tint(color, 0.12),
        borderBottomColor: color ?? "var(--border)",
      }}
      className={cn(
        "group/line flex items-center gap-2 rounded-xl border border-border/70 border-b-2 bg-card/65 px-3 py-2.5 shadow-xs transition-all",
        "hover:bg-card/90 hover:shadow-sm hover:border-border",
        isDragging && "opacity-50",
        isOver && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        aria-label={t("tables.dragLine", { name })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {iconTrigger}

      <div className="flex-1 min-w-0">
        <InlineName
          key={id}
          value={name}
          onCommit={onRename}
          multiline
          className="text-sm font-bold tracking-tight text-foreground block leading-snug break-words"
          ariaLabel={t("tables.lineNameLabel", { kind: kindLabel })}
        />
        {subtitleBadge}
      </div>

      {menuButton}
    </div>
  ) : (
    // ROW HEADER: Swimlane anchor card, flexible height and auto-expanding width, vertical colored start border
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        backgroundColor: tint(color, 0.12),
        borderInlineStartColor: color ?? "var(--primary)",
      }}
      className={cn(
        "group/line flex h-full min-h-14 items-center gap-2.5 rounded-xl border border-border/70 border-s-4 bg-card/55 px-3 py-2.5 shadow-xs transition-all",
        "hover:bg-card/85 hover:shadow-sm hover:border-border",
        isDragging && "opacity-50",
        isOver && "ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        aria-label={t("tables.dragLine", { name })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      {iconTrigger}

      <div className="flex-1 min-w-0">
        <InlineName
          key={id}
          value={name}
          onCommit={onRename}
          multiline
          className="text-sm font-semibold text-foreground/95 block leading-snug break-words"
          ariaLabel={t("tables.lineNameLabel", { kind: kindLabel })}
        />
        {subtitleBadge}
      </div>

      {menuButton}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{header}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="capitalize">{t("tables.lineLabel", { kind: kindLabel, name })}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            const next = window.prompt(t("tables.lineNamePrompt", { kind: kindLabel }), name);
            if (next) onRename(next);
          }}
        >
          {t("tables.rename")}
        </ContextMenuItem>
        {onStyle ? (
          <ContextMenuItem onClick={promptSubtitle}>
            <Bookmark className="size-4" />
            {subtitle ? t("tables.editSubtitle") : t("tables.addSubtitle")}
          </ContextMenuItem>
        ) : null}
        {onStyle && subtitle ? (
          <ContextMenuItem
            className="text-xs text-muted-foreground"
            onClick={() => onStyle({ subtitle: null })}
          >
            {t("tables.clearSubtitle")}
          </ContextMenuItem>
        ) : null}
        {onAddAfter ? (
          <ContextMenuItem onClick={onAddAfter}>{t("tables.addAnotherLine", { kind: kindLabel })}</ContextMenuItem>
        ) : null}
        {onStyle ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t("tables.icon")}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="grid max-h-72 grid-cols-6 gap-0.5 overflow-y-auto">
              {ICONS.map((i) => (
                <ContextMenuItem
                  key={i}
                  onClick={() => onStyle({ icon: i })}
                  className="flex size-9 items-center justify-center text-xl p-0 cursor-pointer hover:bg-muted"
                >
                  {i}
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onStyle({ color: null, icon: null, subtitle: null })}>
                {t("tables.clearIcon")}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        {onStyle ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t("tables.color")}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {PALETTE.map((c) => (
                <ContextMenuItem key={c.value} onClick={() => onStyle({ color: c.value })}>
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: c.value }}
                    aria-hidden
                  />
                  {c.name}
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onStyle({ color: null, icon: null, subtitle: null })}>
                {t("tables.clearStyle")}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={confirmDelete}>
          {t("tables.deleteLineMenu", { kind: kindLabel })}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function RowLine({
  rowId,
  name,
  color,
  icon,
  subtitle,
  columns,
  onRename,
  onDelete,
  onStyle,
  onAddAfter,
  renderCell,
}: {
  rowId: string;
  name: string;
  color?: string | undefined;
  icon?: string | undefined;
  subtitle?: string | undefined;
  columns: { id: string }[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onStyle?: ((patch: StylePatch) => void) | undefined;
  onAddAfter?: (() => void) | undefined;
  renderCell: (columnId: string) => React.ReactNode;
}) {
  return (
    <>
      <LineHeader
        kind="row"
        id={rowId}
        name={name}
        color={color}
        icon={icon}
        subtitle={subtitle}
        onRename={onRename}
        onDelete={onDelete}
        onStyle={onStyle}
        onAddAfter={onAddAfter}
      />
      {columns.map((c) => (
        <div key={c.id}>{renderCell(c.id)}</div>
      ))}
    </>
  );
}

const STATUSES: { value: ItemStatus; labelKey: "tables.statusTodo" | "tables.statusInProgress" | "tables.statusBlocked" | "tables.statusReview" | "tables.statusDone" }[] = [
  { value: "todo", labelKey: "tables.statusTodo" },
  { value: "in_progress", labelKey: "tables.statusInProgress" },
  { value: "blocked", labelKey: "tables.statusBlocked" },
  { value: "review", labelKey: "tables.statusReview" },
  { value: "done", labelKey: "tables.statusDone" },
];

function Cell({
  tableId,
  rowId,
  columnId,
  cell,
  onStyle,
  placements,
  itemById,
  roundsByItem,
  dueColors,
  onOpen,
  onAddItem,
  onRemove,
  onDeleteItem,
  onStart,
  onSetStatus,
  onSetProgress,
  onSetItemStyle,
  onFocusItem,
  onCopyToTable,
  otherTables,
  onMoveImage,
  onMoveNote,
}: {
  tableId: string;
  rowId: string;
  columnId: string;
  cell: TableCell | null;
  onStyle: (patch: CellPatch) => void;
  onMoveImage?: ((fromRowId: string, fromColumnId: string, image: string) => void) | undefined;
  onMoveNote?: ((fromRowId: string, fromColumnId: string, note: string) => void) | undefined;
  placements: Placement[];
  itemById: Map<string, WorkItem>;
  roundsByItem: Map<string, number>;
  dueColors: boolean;
  onOpen: (itemId: string) => void;
  onAddItem: (type: ItemType, title: string) => void;
  onRemove: (placementId: string) => void;
  onDeleteItem: (itemId: string, placementIds: string[]) => void;
  onStart: (item: { id: string; type: ItemType; title: string }) => void;
  onSetStatus: (itemId: string, status: ItemStatus) => void;
  onSetProgress: (itemId: string, progress: number) => void;
  onSetItemStyle: (itemId: string, patch: StylePatch) => void;
  onFocusItem: (itemId: string) => void;
  onCopyToTable: (placement: Placement, targetTableId: string) => void;
  otherTables: { id: string; name: string }[];
}) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${tableId}-${rowId}-${columnId}`,
    data: { kind: "cell", tableId, rowId, columnId },
  });
  const [editingNote, setEditingNote] = useState(false);
  const [adding, setAdding] = useState<ItemType | null>(null);
  const [draft, setDraft] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const cellFileInputRef = useRef<HTMLInputElement>(null);
  const [cellDragType, setCellDragType] = useState<"image" | "note" | null>(null);
  const cellDragCounter = useRef(0);

  /** Tasks in this cell plus the Pomodoro rounds still owed on them. */
  const cellCount = useMemo(() => {
    let tasks = 0;
    let rounds = 0;
    for (const p of placements) {
      const item = itemById.get(p.itemId);
      if (!item || item.type !== "task") continue;
      tasks += 1;
      const planned = item.estimatedRounds ?? 0;
      rounds += Math.max(0, planned - (roundsByItem.get(item.id) ?? 0));
    }
    return { tasks, rounds };
  }, [placements, itemById, roundsByItem]);

  function submitNew() {
    const title = draft.trim();
    if (!adding || !title) {
      setAdding(null);
      setDraft("");
      return;
    }
    onAddItem(adding, title);
    setDraft("");
    setAdding(null);
  }

  const handleCellPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          e.stopPropagation();
          void fileToDataUrl(file).then((dataUrl) => {
            onStyle({ noteImage: dataUrl });
            toast.success(t("tables.imageAdded"));
          });
          return;
        }
      }
    }
  };

  const handleCellDragEnter = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types || []);
    if (types.includes("application/x-table-note")) {
      e.preventDefault();
      cellDragCounter.current += 1;
      setCellDragType("note");
      return;
    }
    const isImageTransfer = types.some(
      (type) =>
        type === "Files" ||
        type === "application/x-table-image" ||
        type === "text/uri-list",
    );
    if (isImageTransfer) {
      e.preventDefault();
      cellDragCounter.current += 1;
      setCellDragType("image");
      return;
    }
    if (types.includes("text/plain")) {
      e.preventDefault();
      cellDragCounter.current += 1;
      setCellDragType("note");
      return;
    }
  };

  const handleCellDragOver = (e: React.DragEvent) => {
    if (cellDragType) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleCellDragLeave = (e: React.DragEvent) => {
    if (cellDragType) {
      e.preventDefault();
      cellDragCounter.current = Math.max(0, cellDragCounter.current - 1);
      if (cellDragCounter.current === 0) {
        setCellDragType(null);
      }
    }
  };

  const handleCellDrop = async (e: React.DragEvent) => {
    cellDragCounter.current = 0;
    setCellDragType(null);

    // 1. Internal Note Move
    const noteSourceKey = e.dataTransfer.getData("application/x-table-note-source");
    const internalNote = e.dataTransfer.getData("application/x-table-note");
    const imageSourceKey = e.dataTransfer.getData("application/x-table-image-source");
    const internalImage = e.dataTransfer.getData("application/x-table-image");

    if (noteSourceKey && internalNote) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const { rowId: srcRowId, columnId: srcColId } = JSON.parse(noteSourceKey) as {
          rowId: string;
          columnId: string;
        };
        if (srcRowId === rowId && srcColId === columnId) {
          return;
        }
        if (onMoveNote) {
          onMoveNote(srcRowId, srcColId, internalNote);
          if (imageSourceKey && internalImage && onMoveImage) {
            onMoveImage(srcRowId, srcColId, internalImage);
          }
          toast.success(t("tables.noteMoved"));
          return;
        }
      } catch {
        /* fallback below */
      }
    }

    // 2. Internal Image Move
    if (imageSourceKey && internalImage) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const { rowId: srcRowId, columnId: srcColId } = JSON.parse(imageSourceKey) as {
          rowId: string;
          columnId: string;
        };
        if (srcRowId === rowId && srcColId === columnId) {
          return;
        }
        if (onMoveImage) {
          onMoveImage(srcRowId, srcColId, internalImage);
          toast.success(t("tables.imageMoved"));
          return;
        }
      } catch {
        /* fallback below */
      }
    }

    // 3. External Image Drop
    const imgData = await extractImageFromDataTransfer(e.dataTransfer);
    if (imgData) {
      e.preventDefault();
      e.stopPropagation();
      onStyle({ noteImage: imgData });
      playDropSound();
      toast.success(t("tables.imageAdded"));
      return;
    }

    // 4. External Text Drop
    const plainText = e.dataTransfer.getData("text/plain");
    if (plainText && plainText.trim()) {
      e.preventDefault();
      e.stopPropagation();
      const existingNote = cell?.note?.trim();
      const finalNote = existingNote ? `${existingNote}\n\n${plainText.trim()}` : plainText.trim();
      onStyle({ note: finalNote });
      playDropSound();
      toast.success(t("tables.noteAdded"));
      return;
    }
  };

  const handleMenuPasteImage = async () => {
    const clipboardImg = await readImageFromClipboard();
    if (clipboardImg) {
      onStyle({ noteImage: clipboardImg });
      toast.success(t("tables.imageAdded"));
      return;
    }
    const snapshot = readSnapshot();
    if (snapshot) {
      onStyle({ noteImage: snapshot });
      toast.success(t("tables.snapshotAdded"));
      return;
    }
    toast.info(t("tables.noClipboardImage"));
  };

  const handleCellFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      onStyle({ noteImage: dataUrl });
      toast.success(t("tables.imageAdded"));
    } catch {
      toast.error("Failed to load image");
    } finally {
      if (cellFileInputRef.current) cellFileInputRef.current.value = "";
    }
  };

  const body = (
    <div
      ref={setNodeRef}
      onPaste={handleCellPaste}
      onDragEnter={handleCellDragEnter}
      onDragOver={handleCellDragOver}
      onDragLeave={handleCellDragLeave}
      onDrop={handleCellDrop}
      style={{
        backgroundColor: tint(cell?.color, 0.1),
        borderColor: cell?.color ?? undefined,
      }}
      className={cn(
        "relative flex min-h-28 flex-col gap-2 rounded-md border border-dashed border-border bg-card/30 p-2 transition-all",
        isOver && "border-primary bg-primary/10",
        cellDragType === "image" && "border-primary ring-2 ring-primary/60 bg-primary/15 shadow-md scale-[1.01]",
        cellDragType === "note" && "border-amber-500 ring-2 ring-amber-500/60 bg-amber-500/15 shadow-md scale-[1.01]",
      )}
    >
      {cellDragType === "image" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-md bg-primary/20 backdrop-blur-[1px] border-2 border-dashed border-primary text-primary animate-in fade-in zoom-in-95 duration-150">
          <ImagePlus className="size-8 mb-1.5 animate-bounce text-primary" />
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-background/90 shadow-sm text-foreground border border-primary/30">
            {t("tables.dropImageHere")}
          </span>
        </div>
      )}
      {cellDragType === "note" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-md bg-amber-500/20 backdrop-blur-[1px] border-2 border-dashed border-amber-500 text-amber-600 dark:text-amber-400 animate-in fade-in zoom-in-95 duration-150">
          <StickyNote className="size-8 mb-1.5 animate-bounce text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-background/90 shadow-sm text-foreground border border-amber-500/30">
            {t("tables.dropNoteHere")}
          </span>
        </div>
      )}
      <input
        ref={cellFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCellFileUpload}
      />
      {cell?.icon ? (
        <p className="flex items-center gap-1 text-2xl leading-none">
          <span aria-hidden>{cell.icon}</span>
        </p>
      ) : null}

      {placements.length ? (
        <p className="text-[11px] font-medium text-muted-foreground">
          {t("grid.cellCounter", { tasks: cellCount.tasks, rounds: cellCount.rounds })}
        </p>
      ) : null}

      <CellNote
        rowId={rowId}
        columnId={columnId}
        note={cell?.note}
        noteImage={cell?.noteImage}
        editing={editingNote}
        onEditingChange={setEditingNote}
        onStyle={onStyle}
        onMoveImage={onMoveImage}
        onMoveNote={onMoveNote}
      />

      {placements.map((p) => {
        const item = itemById.get(p.itemId);
        if (!item) return null;
        return (
          <ItemCard
            key={p.id}
            placement={p}
            item={item}
            onOpen={() => onOpen(item.id)}
            onRemove={() => onRemove(p.id)}
            onDelete={() => onDeleteItem(item.id, [p.id])}
            onStart={() => onStart({ id: item.id, type: item.type, title: item.title })}
            onSetStatus={(status) => onSetStatus(item.id, status)}
            onSetProgress={(progress) => onSetProgress(item.id, progress)}
            onSetStyle={(patch) => onSetItemStyle(item.id, patch)}
            onFocus={() => onFocusItem(item.id)}
            dueColor={dueColors ? dueTone(item.dueDate) : "none"}
            onArchive={() =>
              void updateRecord<WorkItem>(COL.items, item.id, {
                archivedAt: item.archivedAt ? null : Date.now(),
              })
            }
            onCopyToTable={(tid) => onCopyToTable(p, tid)}
            otherTables={otherTables}
          />
        );
      })}

      {adding ? (
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            submitNew();
          }}
        >
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitNew}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(null);
                setDraft("");
              }
            }}
            placeholder={adding === "task" ? t("tables.newTaskTitle") : t("tables.newTopicTitle")}
            className="h-8 text-xs"
          />
        </form>
      ) : null}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{body}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>{t("tables.cellLabel")}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            setDraft("");
            setAdding("task");
          }}
        >
          <Plus /> {t("tables.addTaskHere")}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            setDraft("");
            setAdding("topic");
          }}
        >
          <Plus /> {t("tables.addTopicHere")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>{t("tables.cellColor")}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {PALETTE.map((c) => (
              <ContextMenuItem key={c.value} onClick={() => onStyle({ color: c.value })}>
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: c.value }}
                  aria-hidden
                />
                {c.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>{t("tables.cellIcon")}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="grid max-h-72 grid-cols-6 gap-0.5 overflow-y-auto">
            {ICONS.map((i) => (
              <ContextMenuItem key={i} onClick={() => onStyle({ icon: i })}>
                {i}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setEditingNote(true)}>
          <StickyNote /> {cell?.note || cell?.noteImage ? t("tables.editCellNote") : t("tables.addCellNote")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMenuPasteImage}>
          <ImagePlus /> {t("tables.pasteClipboardImage")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => cellFileInputRef.current?.click()}>
          <Upload /> {t("tables.uploadImage")}
        </ContextMenuItem>
        {cell?.noteImage ? (
          <ContextMenuItem onClick={() => setLightboxOpen(true)}>
            <ZoomIn /> {t("tables.viewImage")}
          </ContextMenuItem>
        ) : null}
        {cell?.noteImage ? (
          <ContextMenuItem
            className="text-destructive"
            onClick={() => {
              onStyle({ noteImage: null });
              toast.success(t("tables.imageDeleted"));
            }}
          >
            <Trash2 /> {t("tables.deleteCellImage")}
          </ContextMenuItem>
        ) : null}
        {cell?.note ? (
          <ContextMenuItem onClick={() => onStyle({ note: null })}>
            <Trash2 /> {t("tables.removeNote")}
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onStyle({ color: null, icon: null })}>
          {t("tables.clearCellStyle")}
        </ContextMenuItem>
      </ContextMenuContent>
      {cell?.noteImage ? (
        <ImageLightbox
          src={cell.noteImage}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onDelete={() => {
            onStyle({ noteImage: null });
            toast.success(t("tables.imageDeleted"));
          }}
          title={cell.note || t("tables.cellNoteLabel")}
        />
      ) : null}
    </ContextMenu>
  );
}

function ItemCard({
  placement,
  item,
  onOpen,
  onRemove,
  onDelete,
  onStart,
  onSetStatus,
  onSetProgress,
  onSetStyle,
  onFocus,
  onArchive,
  dueColor,
  onCopyToTable,
  otherTables,
}: {
  placement: Placement;
  item: WorkItem;
  onOpen: () => void;
  onRemove: () => void;
  onDelete: () => void;
  onStart: () => void;
  onSetStatus: (status: ItemStatus) => void;
  onSetProgress: (progress: number) => void;
  onSetStyle: (patch: StylePatch) => void;
  onFocus: () => void;
  onArchive: () => void;
  dueColor: DueTone;
  onCopyToTable: (tableId: string) => void;
  otherTables: { id: string; name: string }[];
}) {
  const t = useT();
  const isTask = item.type === "task";
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({
    id: `placement-${placement.id}`,
    data: {
      kind: "placement",
      id: placement.id,
      itemId: placement.itemId,
      itemType: placement.itemType,
    },
  });

  const card = (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        // Due date wins over the manual colour so urgency is always visible.
        borderColor: DUE_COLORS[dueColor] ?? item.color ?? undefined,
        backgroundColor: tint(DUE_COLORS[dueColor] ?? item.color, 0.08),
      }}
      className={cn(
        "rounded-md border bg-card p-2 shadow-sm transition-shadow",
        item.archivedAt && "opacity-60 saturate-50",
        isTask
          ? "rounded-md border-border border-s-4 hover:shadow-md"
          : "rounded-lg border-2 border-dashed border-primary/45 bg-primary/[0.06] shadow-none",
        isDragging && "opacity-40",
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="mt-0.5 cursor-grab text-muted-foreground"
          aria-label={t("tables.dragItem", { title: item.title })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
          <span
            className={cn(
              "block text-sm leading-snug",
              isTask ? "" : "font-semibold uppercase tracking-wide text-primary",
            )}
          >
            <span aria-hidden>{item.icon ?? (isTask ? "✓" : "◫")} </span>
            {item.title}
          </span>
          <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
            {isTask ? t("tables.taskCard") : t("tables.topicCard")}
            {isTask ? ` · ${item.status.replace("_", " ")} · ${item.progress}%` : ""}
            {dueColor === "overdue" ? ` · ${t("grid.overdue")}` : ""}
            {dueColor === "today" ? ` · ${t("grid.today")}` : ""}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("tables.actionsFor", { name: item.title })}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>{t("tables.openWorkspace")}</DropdownMenuItem>
            {isTask ? <DropdownMenuItem onClick={onStart}>{t("tables.startWork")}</DropdownMenuItem> : null}
            {isTask ? <DropdownMenuItem onClick={onFocus}>{t("tables.pomodoroFocus")}</DropdownMenuItem> : null}
            {otherTables.length ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t("tables.addToAnotherTable")}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {otherTables.map((ot) => (
                    <DropdownMenuItem key={ot.id} onClick={() => onCopyToTable(ot.id)}>
                      {ot.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive}>
              {item.archivedAt ? (
                <>
                  <ArchiveRestore className="size-4" /> {t("tables.restoreItem")}
                </>
              ) : (
                <>
                  <Archive className="size-4" /> {t("tables.archiveItem")}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove}>{t("tables.removeFromTable")}</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                void confirmToast(t("tables.confirmDeleteItem", { title: item.title }), {
                  confirmLabel: t("common.delete"),
                  cancelLabel: t("common.cancel"),
                }).then((ok) => ok && onDelete());
              }}
            >
              {t("tables.deleteItem")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isTask ? <div className="mt-2 h-1 rounded-full bg-muted">
        <div
          className="h-1 rounded-full bg-primary"
          style={{ width: `${item.progress}%`, backgroundColor: item.color ?? undefined }}
        />
      </div> : null}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel className="truncate">{item.title}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onOpen}>
          {isTask ? <ListChecks /> : <FolderTree />} {isTask ? t("tables.openTask") : t("tables.openTopic")}
        </ContextMenuItem>
        {isTask ? <ContextMenuItem onClick={onStart}><Clock3 /> {t("tables.startWorkSession")}</ContextMenuItem> : null}
        {isTask ? <ContextMenuItem onClick={onFocus}><Clock3 /> {t("tables.pomodoroFocusOnThis")}</ContextMenuItem> : null}
        {isTask ? <ContextMenuSub>
          <ContextMenuSubTrigger>{t("tables.status")}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {STATUSES.map((s) => (
              <ContextMenuItem key={s.value} onClick={() => onSetStatus(s.value)}>
                {t(s.labelKey)}
                {item.status === s.value ? " ✓" : ""}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub> : null}
        {isTask ? <ContextMenuSub>
          <ContextMenuSubTrigger>{t("tables.progress")}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {[0, 25, 50, 75, 100].map((p) => (
              <ContextMenuItem key={p} onClick={() => onSetProgress(p)}>
                {p}%
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub> : null}
        <ContextMenuSub>
          <ContextMenuSubTrigger>{t("tables.color")}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {PALETTE.map((c) => (
              <ContextMenuItem key={c.value} onClick={() => onSetStyle({ color: c.value })}>
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: c.value }}
                  aria-hidden
                />
                {c.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>{t("tables.icon")}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="grid max-h-72 grid-cols-6 gap-0.5 overflow-y-auto">
            {ICONS.map((i) => (
              <ContextMenuItem key={i} onClick={() => onSetStyle({ icon: i })}>
                {i}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={() => onSetStyle({ color: null, icon: null })}>
          {t("tables.clearCellStyle")}
        </ContextMenuItem>
        {otherTables.length ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t("tables.addToAnotherTable")}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {otherTables.map((ot) => (
                <ContextMenuItem key={ot.id} onClick={() => onCopyToTable(ot.id)}>
                  {ot.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onRemove}><Copy /> {t("tables.removeFromTable")}</ContextMenuItem>
        <ContextMenuItem
          className="text-destructive"
          onClick={() => {
            void confirmToast(t("tables.confirmDeleteItem", { title: item.title }), {
              confirmLabel: t("common.delete"),
              cancelLabel: t("common.cancel"),
            }).then((ok) => ok && onDelete());
          }}
        >
          <Trash2 /> {t("tables.deleteItem")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
