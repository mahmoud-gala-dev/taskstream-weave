import { GripVertical, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { COL, createRecord, deleteRecord, updateRecord, watchUserCollection } from "@/lib/db";
import type { PageNote } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";

const ADD_EVENT = "work-os:add-page-note";

export function requestPageNote() {
  window.dispatchEvent(new Event(ADD_EVENT));
}

/** Draggable notes are fixed to the viewport and persist for the signed-in user. */
export function PageStickyNotes() {
  const { userId } = useWorkspace();
  const [notes, setNotes] = useState<PageNote[]>([]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void watchUserCollection<PageNote>(COL.pageNotes, userId, (rows) => {
      if (active) setNotes(rows);
    }, () => toast.error("Could not load page notes."))
      .then((next) => (active ? (unsubscribe = next) : next()))
      .catch(() => toast.error("Could not load page notes."));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [userId]);

  useEffect(() => {
    const add = () => {
      if (!userId) return;
      const offset = notes.length % 6;
      void createRecord<PageNote>(COL.pageNotes, userId, {
        body: "",
        x: Math.max(16, window.innerWidth - 336 - offset * 18),
        y: 80 + offset * 24,
      }).catch(() => toast.error("Could not create the sticky note."));
    };
    window.addEventListener(ADD_EVENT, add);
    return () => window.removeEventListener(ADD_EVENT, add);
  }, [notes.length, userId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-label="Page sticky notes">
      {notes.map((note) => <DraggableNote key={note.id} note={note} />)}
      <Button
        type="button"
        size="icon"
        className="pointer-events-auto fixed bottom-5 end-5 shadow-lg"
        aria-label="Add page sticky note"
        title="Add page sticky note"
        onClick={requestPageNote}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function DraggableNote({ note }: { note: PageNote }) {
  const [position, setPosition] = useState({ x: note.x, y: note.y });
  const [body, setBody] = useState(note.body);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const positionRef = useRef(position);

  useEffect(() => {
    const next = { x: note.x, y: note.y };
    positionRef.current = next;
    setPosition(next);
  }, [note.x, note.y]);
  useEffect(() => setBody(note.body), [note.body]);

  function clamp(x: number, y: number) {
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - 296)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 190)),
    };
  }

  return (
    <article
      className="pointer-events-auto fixed w-72 rounded-md border border-border bg-card shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      <header
        className="flex h-9 cursor-grab touch-none items-center gap-2 border-b border-border px-2 text-xs font-medium active:cursor-grabbing"
        onPointerDown={(event) => {
          drag.current = {
            pointerId: event.pointerId,
            dx: event.clientX - position.x,
            dy: event.clientY - position.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          const next = clamp(event.clientX - drag.current.dx, event.clientY - drag.current.dy);
          positionRef.current = next;
          setPosition(next);
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          void updateRecord<PageNote>(COL.pageNotes, note.id, positionRef.current).catch(() =>
            toast.error("Could not save the note position."),
          );
        }}
      >
        <GripVertical className="size-4 text-muted-foreground" />
        <StickyNote className="size-3.5" />
        <span className="flex-1">Sticky note</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Delete sticky note"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => void deleteRecord(COL.pageNotes, note.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </header>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onBlur={() => {
          if (body !== note.body) {
            void updateRecord<PageNote>(COL.pageNotes, note.id, { body }).catch(() =>
              toast.error("Could not save the sticky note."),
            );
          }
        }}
        placeholder="Write a note…"
        aria-label="Sticky note text"
        className="min-h-32 resize-none rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
    </article>
  );
}