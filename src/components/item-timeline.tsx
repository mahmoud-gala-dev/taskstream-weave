import { useEffect, useState } from "react";
import { Clock, FileText, Link2, ListChecks, Paperclip, StickyNote } from "lucide-react";

import { COL, watchUserCollection } from "@/lib/db";
import { elapsedSeconds, formatDuration } from "@/lib/sessions";
import type { ActivityLog, Attachment, LinkRecord, Note, Subtask, WorkItem, WorkSession } from "@/lib/types";
import { useT } from "@/lib/i18n";

type Entry = { id: string; at: number; icon: "session" | "log" | "file" | "subtask" | "note" | "link"; text: string };

const ICONS = {
  session: Clock,
  log: FileText,
  file: Paperclip,
  subtask: ListChecks,
  note: StickyNote,
  link: Link2,
} as const;

/** Merges sessions, activity logs, files, subtasks, notes and links into one chronological log. */
export function ItemTimeline({
  userId,
  item,
  sessions,
  subtasks,
  notes,
  links,
  attachments,
  now,
}: {
  userId: string | null;
  item: WorkItem;
  sessions: WorkSession[];
  subtasks: Subtask[];
  notes: Note[];
  links: LinkRecord[];
  attachments: Attachment[];
  now: number;
}) {
  const t = useT();
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let unsub: (() => void) | null = null;
    void watchUserCollection<ActivityLog>(COL.activityLogs, userId, (rows) => {
      if (!active) return;
      setLogs(rows.filter((r) => r.itemId === item.id));
    })
      .then((u) => (active ? (unsub = u) : u()))
      .catch(() => undefined);
    return () => {
      active = false;
      unsub?.();
    };
  }, [userId, item.id]);

  const entries: Entry[] = [
    ...sessions.map((s) => ({
      id: `s-${s.id}`,
      at: s.startedAt,
      icon: "session" as const,
      text: t("item.timeline.session", { duration: formatDuration(elapsedSeconds(s, now)) }),
    })),
    ...logs.map((l) => ({
      id: `l-${l.id}`,
      at: l.createdAt ?? 0,
      icon: "log" as const,
      text: l.detail ? `${l.action} — ${l.detail}` : l.action,
    })),
    ...attachments.map((a) => ({
      id: `a-${a.id}`,
      at: a.createdAt ?? 0,
      icon: "file" as const,
      text: t("item.timeline.attachment", { name: a.filename }),
    })),
    ...subtasks.map((s) => ({
      id: `st-${s.id}`,
      at: s.createdAt ?? 0,
      icon: "subtask" as const,
      text: t("item.timeline.subtaskAdded", { title: s.title }),
    })),
    ...notes.map((n) => ({
      id: `n-${n.id}`,
      at: n.createdAt ?? 0,
      icon: "note" as const,
      text: t("item.timeline.note", { title: n.title || n.body.slice(0, 60) }),
    })),
    ...links.map((l) => ({
      id: `lk-${l.id}`,
      at: l.createdAt ?? 0,
      icon: "link" as const,
      text: t("item.timeline.link", { url: l.title || l.url }),
    })),
    ...(item.createdAt ? [{ id: "created", at: item.createdAt, icon: "log" as const, text: t("item.timeline.created") }] : []),
  ].sort((a, b) => b.at - a.at);

  if (!entries.length) {
    return <p className="mt-6 text-sm text-muted-foreground">{t("item.timeline.empty")}</p>;
  }

  return (
    <ol className="mt-6 space-y-2 pb-10">
      {entries.map((entry) => {
        const Icon = ICONS[entry.icon];
        return (
          <li key={entry.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm">{entry.text}</p>
              <p className="text-xs text-muted-foreground">
                {entry.at ? new Date(entry.at).toLocaleString() : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
