import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { COL, watchUserCollection } from "@/lib/db";
import type { Attachment, LinkRecord, Note } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { useT, type MessageKey } from "@/lib/i18n";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Personal Work OS" },
      {
        name: "description",
        content:
          "Search across sections, tables, rows, columns, tasks, topics, notes, links and attachments at once.",
      },
      { property: "og:title", content: "Search — Personal Work OS" },
      { property: "og:description", content: "One search across your whole workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <SearchPage />
    </AppShell>
  ),
});

type Hit = { key: string; kind: string; label: string; itemId?: string };

function SearchPage() {
  const { userId, sections, tables, rows, columns, items } = useWorkspace();
  const [q, setQ] = useState("");
  const t = useT();
  const [notes, setNotes] = useState<Note[]>([]);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const unsubs: Array<() => void> = [];
    const add = (p: Promise<() => void>) =>
      void p.then((u) => (active ? unsubs.push(u) : u())).catch(() => undefined);
    add(watchUserCollection<Note>(COL.notes, userId, (r) => active && setNotes(r)));
    add(watchUserCollection<LinkRecord>(COL.links, userId, (r) => active && setLinks(r)));
    add(watchUserCollection<Attachment>(COL.attachments, userId, (r) => active && setAttachments(r)));
    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [userId]);

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const match = (s?: string) => !!s && s.toLowerCase().includes(term);
    const out: Hit[] = [];
    sections.filter((s) => match(s.name)).forEach((s) => out.push({ key: `sec-${s.id}`, kind: "Section", label: s.name }));
    tables.filter((t) => match(t.name)).forEach((t) => out.push({ key: `tab-${t.id}`, kind: "Table", label: t.name }));
    rows.filter((r) => match(r.name)).forEach((r) => out.push({ key: `row-${r.id}`, kind: "Row", label: r.name }));
    columns.filter((c) => match(c.name)).forEach((c) => out.push({ key: `col-${c.id}`, kind: "Column", label: c.name }));
    items
      .filter((i) => match(i.title) || match(i.description))
      .forEach((i) =>
        out.push({ key: `item-${i.id}`, kind: i.type === "task" ? "Task" : "Topic", label: i.title, itemId: i.id }),
      );
    notes.filter((n) => match(n.body)).forEach((n) => out.push({ key: `note-${n.id}`, kind: "Note", label: n.body.slice(0, 90), itemId: n.itemId }));
    links
      .filter((l) => match(l.url) || match(l.title))
      .forEach((l) => out.push({ key: `link-${l.id}`, kind: "Link", label: l.title || l.url, itemId: l.itemId }));
    attachments
      .filter((a) => match(a.filename))
      .forEach((a) => out.push({ key: `att-${a.id}`, kind: "Attachment", label: a.filename, itemId: a.itemId }));
    return out.slice(0, 100);
  }, [q, sections, tables, rows, columns, items, notes, links, attachments]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{t("search.title")}</h1>
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search.placeholder")}
        className="mt-4 max-w-lg"
        aria-label={t("search.placeholder")}
      />

      <ul className="mt-5 max-w-2xl space-y-1">
        {hits.map((h) => (
          <li key={h.key} className="rounded-md border border-border p-2 text-sm">
            <span className="me-2 text-xs uppercase tracking-wide text-muted-foreground">
              {t(`kind.${h.kind}` as MessageKey)}
            </span>
            {h.itemId ? (
              <Link to="/item/$itemId" params={{ itemId: h.itemId }} className="hover:underline">
                {h.label}
              </Link>
            ) : (
              <span>{h.label}</span>
            )}
          </li>
        ))}
        {q.trim().length >= 2 && !hits.length ? (
          <p className="text-sm text-muted-foreground">{t("search.noMatches")}</p>
        ) : null}
      </ul>
    </div>
  );
}
