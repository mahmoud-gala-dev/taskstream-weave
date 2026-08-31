import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Link2, Paperclip, StickyNote, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { COL, watchUserCollection } from "@/lib/db";
import { formatDuration } from "@/lib/sessions";
import type { ActivityLog, Attachment, LinkRecord, Note, WorkSession } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documentation")({
  head: () => ({
    meta: [
      { title: "Documentation timeline — Work OS" },
      {
        name: "description",
        content:
          "One chronological record of every note, screenshot, recording, link and work session across your topics and tasks.",
      },
      { property: "og:title", content: "Documentation timeline — Work OS" },
      {
        property: "og:description",
        content: "Every note, attachment, link and work session in one chronological record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentationPage,
});

type Range = "today" | "yesterday" | "week" | "month" | "all";

const RANGES: Array<{ id: Range; key: `docs.range.${Range}` }> = [
  { id: "today", key: "docs.range.today" },
  { id: "yesterday", key: "docs.range.yesterday" },
  { id: "week", key: "docs.range.week" },
  { id: "month", key: "docs.range.month" },
  { id: "all", key: "docs.range.all" },
];

function rangeStart(range: Range): { from: number; to: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  switch (range) {
    case "today":
      return { from: start.getTime(), to: Infinity };
    case "yesterday":
      return { from: start.getTime() - day, to: start.getTime() };
    case "week":
      return { from: start.getTime() - 6 * day, to: Infinity };
    case "month":
      return { from: start.getTime() - 29 * day, to: Infinity };
    default:
      return { from: 0, to: Infinity };
  }
}

type Entry = {
  id: string;
  at: number;
  kind: "note" | "link" | "attachment" | "session" | "activity";
  title: string;
  detail?: string | undefined;
  itemId?: string | undefined;
};

/**
 * Unified documentation timeline. Reads notes, links, attachments, sessions and
 * activity logs through user-scoped realtime listeners and merges them in memory
 * (no extra Firestore writes, no composite index required).
 */
function DocumentationPage() {
  const t = useT();
  const { userId, items } = useWorkspace();
  const [range, setRange] = useState<Range>("today");
  const [notes, setNotes] = useState<Note[]>([]);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const unsubs: Array<() => void> = [];
    const fail = (e: unknown) =>
      active && setError(e instanceof Error ? e.message : t("docs.loadFailed"));

    const wire = <T,>(name: Parameters<typeof watchUserCollection>[0], set: (rows: T[]) => void) =>
      watchUserCollection<T>(name, userId, (rows) => active && set(rows), fail)
        .then((u) => (active ? unsubs.push(u) : u()))
        .catch(fail);

    void wire<Note>(COL.notes, setNotes);
    void wire<LinkRecord>(COL.links, setLinks);
    void wire<Attachment>(COL.attachments, setAttachments);
    void wire<WorkSession>(COL.workSessions, setSessions);
    void wire<ActivityLog>(COL.activityLogs, setLogs);

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const titleOf = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i.title]));
    return (id?: string) => (id ? (map.get(id) ?? t("docs.item")) : "");
  }, [items, t]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...notes.map((n) => ({
        id: `note-${n.id}`,
        at: n.createdAt ?? 0,
        kind: "note" as const,
        title: t("docs.noteOn", { title: titleOf(n.itemId) }),
        detail: n.body.slice(0, 200),
        itemId: n.itemId,
      })),
      ...links.map((l) => ({
        id: `link-${l.id}`,
        at: l.createdAt ?? 0,
        kind: "link" as const,
        title: t("docs.linkOn", { title: titleOf(l.itemId) }),
        detail: l.title ? `${l.title} — ${l.url}` : l.url,
        itemId: l.itemId,
      })),
      ...attachments.map((a) => ({
        id: `att-${a.id}`,
        at: a.createdAt ?? 0,
        kind: "attachment" as const,
        title:
          a.kind === "video"
            ? t("docs.recordingOn", { title: titleOf(a.itemId) })
            : a.kind === "screenshot"
              ? t("docs.screenshotOn", { title: titleOf(a.itemId) })
              : t("docs.fileOn", { title: titleOf(a.itemId) }),
        detail: a.filename,
        itemId: a.itemId,
      })),
      ...sessions.map((s) => ({
        id: `ses-${s.id}`,
        at: s.startedAt,
        kind: "session" as const,
        title: t("docs.workedOn", { title: s.title }),
        detail: `${formatDuration(s.accumulatedSeconds)} · ${s.status}`,
        itemId: s.itemId,
      })),
      ...logs.map((l) => ({
        id: `log-${l.id}`,
        at: l.createdAt ?? 0,
        kind: "activity" as const,
        title: l.action,
        detail: l.detail,
        itemId: l.itemId,
      })),
    ];
    const { from, to } = rangeStart(range);
    return list.filter((e) => e.at >= from && e.at < to).sort((a, b) => b.at - a.at);
  }, [notes, links, attachments, sessions, logs, range, titleOf, t]);

  const icon = {
    note: StickyNote,
    link: Link2,
    attachment: Paperclip,
    session: Timer,
    activity: FileText,
  } as const;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("docs.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("docs.subtitle")}</p>
        </header>

        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={range === r.id ? "default" : "outline"}
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
            >
              {t(r.key)}
            </Button>
          ))}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("docs.emptyPeriod")}
          </p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e) => {
              const Icon = icon[e.kind];
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-3"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{e.title}</p>
                    {e.detail ? (
                      <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <time
                      className={cn("font-mono text-xs text-muted-foreground")}
                      dir="ltr"
                      dateTime={new Date(e.at).toISOString()}
                    >
                      {new Date(e.at).toLocaleString()}
                    </time>
                    {e.itemId ? (
                      <Link
                        to="/item/$itemId"
                        params={{ itemId: e.itemId }}
                        className="text-xs text-primary hover:underline"
                      >
                        {t("docs.open")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </AppShell>
  );
}
