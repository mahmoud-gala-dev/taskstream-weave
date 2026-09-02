export type OptimizeInput = {
  goal: string;
  tableName: string;
  existingRows: string[];
  existingColumns: string[];
};

/** Builds the optimization prompt. Kept out of the server-fn module so the
 * server function file stays a thin wrapper. */
export function buildPrompt(input: OptimizeInput): string {
  return [
    "You help a professional structure a work table in a personal work operating system.",
    "Rows are stages or streams of work; columns are states or categories.",
    "Reply as JSON only, matching the requested schema. Keep names under 4 words.",
    "",
    `Goal: ${input.goal}`,
    `Table name: ${input.tableName || "(unnamed)"}`,
    `Existing rows: ${input.existingRows.join(", ") || "(none)"}`,
    `Existing columns: ${input.existingColumns.join(", ") || "(none)"}`,
    "",
    "Suggest an improved set of rowNames and columnNames (include useful existing ones),",
    "a one-paragraph summary, and 3-5 short pieces of advice for working this table daily.",
  ].join("\n");
}

export type WorkspaceInput = {
  goal: string;
  openTasks: { title: string; status: string; priority: string; progress: number }[];
  topics: string[];
  cellNotes: string[];
};

/** Builds the workspace-wide optimization prompt (tasks, topics and cell notes). */
export function buildWorkspacePrompt(input: WorkspaceInput): string {
  const tasks = input.openTasks
    .slice(0, 40)
    .map((t) => `- ${t.title} [${t.status}, ${t.priority}, ${t.progress}%]`)
    .join("\n");
  return [
    "You are an operations coach inside a personal work operating system.",
    "Analyze the user's open tasks, topics and cell notes and reply as JSON only.",
    "",
    `Focus for today: ${input.goal || "(not specified)"}`,
    "Open tasks:",
    tasks || "(none)",
    `Topics: ${input.topics.slice(0, 30).join(", ") || "(none)"}`,
    `Cell notes: ${input.cellNotes.slice(0, 30).join(" | ") || "(none)"}`,
    "",
    "Return: summary (one paragraph on the state of the workload),",
    "rowNames = up to 6 task titles to do first in order,",
    "columnNames = up to 6 things to drop, defer or delegate,",
    "advice = 3-6 short, concrete, actionable suggestions.",
  ].join("\n");
}

export type ItemSummaryInput = {
  title: string;
  status: string;
  priority: string;
  due: string;
  documentation: string;
  totalMinutes: number;
  sessionCount: number;
  subtasks: { title: string; done: boolean }[];
};

/** Builds a per-item summary prompt (documentation + sessions + subtasks). */
export function buildItemSummaryPrompt(input: ItemSummaryInput): string {
  const subtasks = input.subtasks
    .slice(0, 40)
    .map((s) => `- [${s.done ? "x" : " "}] ${s.title}`)
    .join("\n");
  return [
    "You are an assistant inside a personal work operating system.",
    "Summarize one work item and propose the next steps. Reply as JSON only.",
    "Answer in the same language as the item content.",
    "",
    `Title: ${input.title}`,
    `Status: ${input.status} · Priority: ${input.priority} · Due: ${input.due || "(none)"}`,
    `Tracked: ${input.totalMinutes} minutes across ${input.sessionCount} sessions`,
    "Subtasks:",
    subtasks || "(none)",
    "Documentation:",
    input.documentation.slice(0, 4000) || "(empty)",
    "",
    "Return: summary (one short paragraph on where this item stands),",
    "rowNames = [] , columnNames = [],",
    "advice = 3-5 concrete next steps, most important first.",
  ].join("\n");
}
