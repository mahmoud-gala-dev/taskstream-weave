import type { ChangeEvent, KeyboardEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Click-to-edit name field. Keeps the typed value in local state so the caret
 * never jumps while realtime snapshots arrive, and persists it debounced
 * (plus immediately on blur / Enter). Escape restores the stored value.
 */
export function InlineName({
  value,
  onCommit,
  className,
  ariaLabel,
  delay = 500,
  multiline = false,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  ariaLabel: string;
  delay?: number;
  /** Wrap long names over several lines instead of clipping them. */
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const area = useRef<HTMLTextAreaElement | null>(null);

  // Keep the textarea exactly as tall as its wrapped content.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, multiline]);

  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function commit(next: string) {
    dirty.current = false;
    if (timer.current) window.clearTimeout(timer.current);
    const trimmed = next.trim();
    if (!trimmed || trimmed === value) {
      setDraft(value);
      return;
    }
    onCommit(trimmed);
  }

  const Tag = multiline ? "textarea" : "input";

  return (
    <Tag
      ref={multiline ? (area as never) : undefined}
      rows={multiline ? 1 : undefined}
      value={draft}
      aria-label={ariaLabel}
      onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const next = event.target.value;
        dirty.current = true;
        setDraft(next);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(next), delay);
      }}
      onBlur={() => commit(draft)}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(draft);
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          dirty.current = false;
          setDraft(value);
          event.currentTarget.blur();
        }
        // Keep arrow keys inside the field instead of scrolling the grid.
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.stopPropagation();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "min-w-0 flex-1 cursor-text rounded-sm bg-transparent px-1 outline-none transition-colors hover:bg-muted/60 focus:bg-background focus:ring-1 focus:ring-ring",
        multiline && "resize-none overflow-hidden break-words whitespace-pre-wrap leading-snug",
        className,
      )}
    />
  );
}
