import { COL, createRecord, deleteMany, type CollectionName } from "./db";
import type {
  Placement,
  Section,
  TableCell,
  TableColumn,
  TableRow,
  WorkItem,
  WorkTable,
} from "./types";

const KEY = "work-os:demo-records";

type Ref = [CollectionName, string];

function readRefs(): Ref[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Ref[]) : [];
  } catch {
    return [];
  }
}

function writeRefs(refs: Ref[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(refs));
}

export function hasDemoData(): boolean {
  return readRefs().length > 0;
}

/**
 * Creates one demo section with two tables, rows/columns, notes, tasks and topics.
 * Every created document id is remembered locally so it can be removed again.
 */
export async function seedDemoData(userId: string): Promise<number> {
  const refs: Ref[] = [];
  const track = async (col: CollectionName, id: Promise<string>) => {
    const value = await id;
    refs.push([col, value]);
    return value;
  };

  const sectionId = await track(
    COL.sections,
    createRecord<Section>(COL.sections, userId, {
      name: "Demo — Sample workspace",
      description: "Generated sample data you can safely delete from Settings.",
      icon: "🧪",
      sortOrder: Date.now(),
    }),
  );

  const plans: Array<{
    table: string;
    icon: string;
    rows: string[];
    columns: string[];
    items: Array<{ type: "task" | "topic"; title: string; row: number; column: number }>;
  }> = [
    {
      table: "Demo — Daily plan",
      icon: "📅",
      rows: ["Morning", "Afternoon", "Evening"],
      columns: ["To do", "In progress", "Done"],
      items: [
        { type: "task", title: "Review yesterday's notes", row: 0, column: 0 },
        { type: "task", title: "Write the weekly report", row: 0, column: 1 },
        { type: "topic", title: "Client onboarding", row: 1, column: 0 },
        { type: "task", title: "Inbox zero", row: 2, column: 2 },
      ],
    },
    {
      table: "Demo — Learning board",
      icon: "📚",
      rows: ["Reading", "Practice"],
      columns: ["Queued", "Active", "Reviewed"],
      items: [
        { type: "topic", title: "TypeScript deep dive", row: 0, column: 1 },
        { type: "task", title: "Build a small demo app", row: 1, column: 0 },
      ],
    },
  ];

  for (const [index, plan] of plans.entries()) {
    const tableId = await track(
      COL.tables,
      createRecord<WorkTable>(COL.tables, userId, {
        sectionId,
        name: plan.table,
        icon: plan.icon,
        sortOrder: (index + 1) * 1024,
      }),
    );

    const rowIds: string[] = [];
    for (const [i, name] of plan.rows.entries()) {
      rowIds.push(
        await track(
          COL.rows,
          createRecord<TableRow>(COL.rows, userId, {
            tableId,
            name,
            sortOrder: (i + 1) * 1024,
          }),
        ),
      );
    }

    const columnIds: string[] = [];
    for (const [i, name] of plan.columns.entries()) {
      columnIds.push(
        await track(
          COL.columns,
          createRecord<TableColumn>(COL.columns, userId, {
            tableId,
            name,
            sortOrder: (i + 1) * 1024,
          }),
        ),
      );
    }

    if (rowIds[0] && columnIds[0]) {
      await track(
        COL.cells,
        createRecord<TableCell>(COL.cells, userId, {
          tableId,
          rowId: rowIds[0],
          columnId: columnIds[0],
          note: "Sample cell note — edit or delete freely.",
        }),
      );
    }

    for (const [i, spec] of plan.items.entries()) {
      const rowId = rowIds[spec.row];
      const columnId = columnIds[spec.column];
      if (!rowId || !columnId) continue;
      const itemId = await track(
        COL.items,
        createRecord<WorkItem>(COL.items, userId, {
          type: spec.type,
          title: spec.title,
          status: spec.column === 2 ? "done" : spec.column === 1 ? "in_progress" : "todo",
          priority: "normal",
          progress: spec.column === 2 ? 100 : spec.column === 1 ? 40 : 0,
        }),
      );
      await track(
        COL.placements,
        createRecord<Placement>(COL.placements, userId, {
          itemType: spec.type,
          itemId,
          tableId,
          rowId,
          columnId,
          sortOrder: (i + 1) * 1024,
        }),
      );
    }
  }

  writeRefs([...readRefs(), ...refs]);
  return refs.length;
}

/** Deletes every document created by seedDemoData on this browser. */
export async function clearDemoData(): Promise<number> {
  const refs = readRefs();
  if (!refs.length) return 0;
  await deleteMany(refs);
  writeRefs([]);
  return refs.length;
}
