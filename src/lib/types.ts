export type ID = string;

export type Base = {
  id: ID;
  userId: string;
  createdAt?: number;
  updatedAt?: number;
};

export type Section = Base & {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isArchived?: boolean;
  isFavorite?: boolean;
  isCollapsed?: boolean;
};

export type WorkTable = Base & {
  sectionId: ID;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  density?: "compact" | "comfortable" | "large";
  sortOrder: number;
  isArchived?: boolean;
  isFavorite?: boolean;
};

export type TableRow = Base & {
  tableId: ID;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
};

export type TableColumn = Base & {
  tableId: ID;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
};

/** Optional per-cell metadata. Cells exist logically as row × column. */
export type TableCell = Base & {
  tableId: ID;
  rowId: ID;
  columnId: ID;
  note?: string;
  /** Optional inline image (e.g. a focus-table snapshot) stored as a data URL. */
  noteImage?: string;
  color?: string;
  icon?: string;
};


export type ItemStatus = "todo" | "in_progress" | "blocked" | "review" | "done";
export type Priority = "low" | "normal" | "high" | "urgent";
export type ItemType = "task" | "topic";

export type WorkItem = Base & {
  type: ItemType;
  title: string;
  description?: string;
  /** Rich documentation HTML written in the workspace editor. */
  descriptionHtml?: string;
  status: ItemStatus;
  priority: Priority;
  progress: number;
  dueDate?: number | null;
  /** Planned number of Pomodoro rounds, compared with actual in the report. */
  estimatedRounds?: number | null;
  icon?: string;
  color?: string;
  parentTopicId?: ID | null;
  isFavorite?: boolean;
  completedAt?: number | null;
  archivedAt?: number | null;
};

/** Where an item appears. Entities are independent from placements. */
export type Placement = Base & {
  itemType: ItemType;
  itemId: ID;
  tableId: ID;
  rowId: ID;
  columnId: ID;
  sortOrder: number;
};

export type Subtask = Base & {
  parentId: ID;
  title: string;
  done: boolean;
  sortOrder: number;
};

export type Note = Base & {
  itemId: ID;
  body: string;
  title?: string;
  pinned?: boolean;
  color?: string;
  highlights?: Array<{
    start: number;
    end: number;
    color: string;
  }>;
};

/** A draggable note that floats above every authenticated page. */
export type PageNote = Base & {
  body: string;
  color?: string;
  x: number;
  y: number;
};

/** Marker-pen highlight of plain text on a given route. */
export type HighlightMode = "background" | "text";

export type PageHighlight = Base & {
  route: string;
  text: string;
  color?: string;
  /** Whether the colour paints the background (marker) or the text itself. */
  mode?: HighlightMode;
  /** web-highlighter serialized source (JSON) so the exact range is restored. */
  hid?: string;
  startMeta?: string;
  endMeta?: string;
};


export type LinkRecord = Base & {
  itemId: ID;
  url: string;
  title?: string;
  category?: string;
};

export type Attachment = Base & {
  itemId: ID;
  storagePath: string;
  downloadURL: string;
  filename: string;
  mimeType: string;
  kind: "screenshot" | "video" | "file";
  size?: number;
};

export type SessionStatus = "running" | "paused" | "stopped";

export type WorkSession = Base & {
  itemId: ID;
  itemType: ItemType;
  title: string;
  status: SessionStatus;
  startedAt: number;
  lastResumedAt: number | null;
  pausedAt?: number | null;
  stoppedAt?: number | null;
  accumulatedSeconds: number;
};

export type ActivityLog = Base & {
  itemId?: ID;
  action: string;
  detail?: string;
};
