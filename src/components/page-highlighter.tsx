import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { COL, createRecord, deleteRecord, updateRecord, watchUserCollection } from "@/lib/db";
import { useT } from "@/lib/i18n";
import type { HighlightMode, PageHighlight } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";

const ADD_EVENT = "work-os:highlight-selection";
const CLEAR_EVENT = "work-os:clear-highlights";
const TOOLBAR_COLORS = ["#fde047", "#86efac", "#93c5fd", "#f9a8d4", "#fdba74", "#ef4444", "#111827"];

/**
 * Marker-pen highlight for the current selection. `mode` decides whether the
 * colour is applied to the background (marker) or to the text itself (font).
 */
export function requestHighlight(color = "#fde047", mode: HighlightMode = "background") {
  window.dispatchEvent(new CustomEvent(ADD_EVENT, { detail: { color, mode } }));
}

export function requestClearHighlights() {
  window.dispatchEvent(new Event(CLEAR_EVENT));
}

type HighlighterInstance = {
  fromRange: (range: Range) => unknown;
  fromStore: (start: unknown, end: unknown, text: string, id: string) => void;
  remove: (id: string) => void;
  removeAll: () => void;
  dispose: () => void;
  on: (event: string, handler: (data: { sources: HighlightSource[] }) => void) => void;
};

type HighlightSource = {
  id: string;
  text: string;
  startMeta: unknown;
  endMeta: unknown;
};

/** Readable ink for a highlight background, picked from its relative luminance. */
export function readableInk(color: string): string {
  const hex = color.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return "#111827";
  const channel = (start: number) => {
    const value = parseInt(full.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.45 ? "#111827" : "#f8fafc";
}

function tint(id: string, color: string, mode: HighlightMode) {
  document.querySelectorAll<HTMLElement>(`[data-highlight-id="${id}"]`).forEach((node) => {
    node.style.backgroundColor = mode === "text" ? "transparent" : color;
    node.style.color = mode === "text" ? color : readableInk(color);
    node.style.borderRadius = "2px";
    node.style.padding = mode === "text" ? "0" : "0 1px";
    node.style.cursor = "pointer";
  });
}

/**
 * Page-wide highlighter built on the `web-highlighter` library: selections are
 * serialized per route for the signed-in user and restored exactly, even inside
 * rich documentation content. Clicking an existing highlight reopens the
 * toolbar so its colour/mode can be changed or the formatting removed.
 */
export function PageHighlighter() {
  const { userId } = useWorkspace();
  const t = useT();
  const [highlights, setHighlights] = useState<PageHighlight[]>([]);
  const [toolbar, setToolbar] = useState<{ x: number; y: number; hid?: string | undefined } | null>(
    null,
  );
  const [mode, setMode] = useState<HighlightMode>("background");
  const engine = useRef<HighlighterInstance | null>(null);
  const pending = useRef<{ color: string; mode: HighlightMode }>({
    color: "#fde047",
    mode: "background",
  });
  const savedRange = useRef<Range | null>(null);
  const rendered = useRef(new Set<string>());
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const highlightsRef = useRef<PageHighlight[]>(highlights);
  highlightsRef.current = highlights;

  // Boot the library on the client only.
  useEffect(() => {
    let disposed = false;
    void import("web-highlighter").then((mod) => {
      if (disposed) return;
      const Highlighter = (mod.default ?? mod) as unknown as new (options: {
        exceptSelectors?: string[];
        style?: { className?: string };
      }) => HighlighterInstance;
      const instance = new Highlighter({
        exceptSelectors: ["input", "textarea", "script", "style", "[data-no-highlight]"],
        style: { className: "work-os-highlight" },
      });
      instance.on("selection:create", ({ sources }) => {
        const owner = userIdRef.current;
        const { color, mode: appliedMode } = pending.current;
        for (const source of sources) {
          tint(source.id, color, appliedMode);
          rendered.current.add(source.id);
          if (!owner) {
            toast.error(t("highlight.signIn"));
            continue;
          }
          void createRecord<PageHighlight>(COL.pageHighlights, owner, {
            route: window.location.pathname,
            text: source.text,
            color,
            mode: appliedMode,
            hid: source.id,
            startMeta: JSON.stringify(source.startMeta),
            endMeta: JSON.stringify(source.endMeta),
          })
            .then(() => toast.success(t("highlight.saved")))
            .catch(() => toast.error(t("highlight.saveFailed")));
        }
      });
      engine.current = instance;
    });
    return () => {
      disposed = true;
      engine.current?.dispose();
      engine.current = null;
      rendered.current.clear();
    };
  }, [t]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void watchUserCollection<PageHighlight>(
      COL.pageHighlights,
      userId,
      (rows) => {
        if (active) setHighlights(rows);
      },
      () => toast.error(t("highlight.loadFailed")),
    )
      .then((next) => (active ? (unsubscribe = next) : next()))
      .catch(() => toast.error(t("highlight.loadFailed")));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [userId, t]);

  // Restore stored highlights for this route once the content is on screen.
  useEffect(() => {
    const route = window.location.pathname;
    const mine = highlights.filter((h) => h.route === route && h.startMeta && h.endMeta && h.hid);
    const apply = () => {
      const instance = engine.current;
      if (!instance) return;
      for (const h of mine) {
        if (!h.hid) continue;
        if (!rendered.current.has(h.hid)) {
          try {
            instance.fromStore(JSON.parse(h.startMeta!), JSON.parse(h.endMeta!), h.text, h.hid);
            rendered.current.add(h.hid);
          } catch {
            continue; // the underlying text changed — skip this highlight
          }
        }
        tint(h.hid, h.color ?? "#fde047", h.mode ?? "background");
      }
    };
    const timers = [80, 600, 1500].map((delay) => window.setTimeout(apply, delay));
    return () => timers.forEach((t2) => window.clearTimeout(t2));
  }, [highlights]);

  const save = useCallback(
    (color: string, appliedMode: HighlightMode) => {
      const instance = engine.current;
      const range =
        savedRange.current ??
        (window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null);
      if (!instance) {
        toast.error(t("highlight.loading"));
        return;
      }
      if (!range || range.collapsed || !range.toString().trim()) {
        toast.error(t("highlight.selectFirst"));
        return;
      }
      pending.current = { color, mode: appliedMode };
      instance.fromRange(range);
      window.getSelection()?.removeAllRanges();
      savedRange.current = null;
      setToolbar(null);
    },
    [t],
  );

  /** Re-colour or re-mode an existing highlight. */
  const recolor = useCallback(
    (hid: string, color: string, appliedMode: HighlightMode) => {
      tint(hid, color, appliedMode);
      const record = highlightsRef.current.find((h) => h.hid === hid);
      if (!record) return;
      void updateRecord<PageHighlight>(COL.pageHighlights, record.id, {
        color,
        mode: appliedMode,
      }).catch(() => toast.error(t("highlight.saveFailed")));
      setToolbar(null);
    },
    [t],
  );

  /** Remove the formatting of one highlight (and its stored record). */
  const removeOne = useCallback(
    (hid: string) => {
      engine.current?.remove(hid);
      rendered.current.delete(hid);
      const record = highlightsRef.current.find((h) => h.hid === hid);
      setToolbar(null);
      if (!record) return;
      void deleteRecord(COL.pageHighlights, record.id)
        .then(() => toast.success(t("highlight.removed")))
        .catch(() => toast.error(t("highlight.removeFailed")));
    },
    [t],
  );

  // Keep the latest selection so the marker still works after the selection is
  // dropped (right-click menus, toolbar clicks, keyboard shortcut).
  useEffect(() => {
    function place(rect: DOMRect, hid?: string | undefined) {
      setToolbar({
        x: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 300)),
        y: Math.max(8, rect.top - 46),
        hid,
      });
    }
    function remember(event?: MouseEvent) {
      const target = event?.target as HTMLElement | null;
      const marked = target?.closest?.("[data-highlight-id]") as HTMLElement | null;
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (marked && !text) {
        savedRange.current = null;
        place(marked.getBoundingClientRect(), marked.dataset['highlightId']);
        return;
      }
      if (!selection || !text || selection.rangeCount === 0) {
        setToolbar(null);
        return;
      }
      savedRange.current = selection.getRangeAt(0).cloneRange();
      place(selection.getRangeAt(0).getBoundingClientRect());
    }
    function onKey(event: KeyboardEvent) {
      if (event.altKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        save(pending.current.color, pending.current.mode);
        return;
      }
      remember();
    }
    document.addEventListener("mouseup", remember);
    document.addEventListener("keyup", onKey);
    return () => {
      document.removeEventListener("mouseup", remember);
      document.removeEventListener("keyup", onKey);
    };
  }, [save]);

  useEffect(() => {
    function onAdd(event: Event) {
      const detail = (event as CustomEvent<{ color?: string; mode?: HighlightMode } | string>)
        .detail;
      if (typeof detail === "string") save(detail || "#fde047", "background");
      else save(detail?.color ?? "#fde047", detail?.mode ?? "background");
    }
    function onClear() {
      const route = window.location.pathname;
      const mine = highlights.filter((h) => h.route === route);
      if (!mine.length) {
        toast.info(t("highlight.noneOnPage"));
        return;
      }
      engine.current?.removeAll();
      rendered.current.clear();
      void Promise.all(mine.map((h) => deleteRecord(COL.pageHighlights, h.id)))
        .then(() => toast.success(t("highlight.cleared")))
        .catch(() => toast.error(t("highlight.clearFailed")));
    }
    window.addEventListener(ADD_EVENT, onAdd);
    window.addEventListener(CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(ADD_EVENT, onAdd);
      window.removeEventListener(CLEAR_EVENT, onClear);
    };
  }, [highlights, save, t]);

  if (!toolbar) return null;

  return (
    <div
      className="fixed z-50 flex items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-lg"
      style={{ left: toolbar.x, top: toolbar.y }}
      role="toolbar"
      aria-label={t("highlight.toolbar")}
      data-no-highlight
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="rounded-sm px-1.5 py-0.5 text-[11px] font-semibold hover:bg-accent"
        title={t("highlight.modeHint")}
        onClick={() => setMode(mode === "background" ? "text" : "background")}
      >
        {mode === "background" ? t("highlight.modeBackground") : t("highlight.modeText")}
      </button>
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      {TOOLBAR_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${t("highlight.apply")} ${color}`}
          title={t("highlight.apply")}
          className="size-5 rounded-sm border border-border"
          style={{ backgroundColor: color }}
          onClick={() => (toolbar.hid ? recolor(toolbar.hid, color, mode) : save(color, mode))}
        />
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      <button
        type="button"
        className="rounded-sm px-1.5 py-0.5 text-[11px] hover:bg-accent"
        title={t("highlight.remove")}
        onClick={() => {
          if (toolbar.hid) removeOne(toolbar.hid);
          else requestClearHighlights();
        }}
      >
        {t("highlight.remove")}
      </button>
    </div>
  );
}
