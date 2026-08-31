import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoveVertical,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import React, { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { requestHighlight } from "@/components/page-highlighter";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TEXT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#111827"];

/**
 * Full documentation editor: rich formatting toolbar over a contentEditable
 * surface. HTML is saved on blur, and marker highlights work inside it because
 * the page highlighter serializes real DOM ranges.
 */
export function RichDocEditor({
  value,
  onSave,
  placeholder,
  label,
  minHeight = 240,
}: {
  value: string;
  onSave: (html: string) => void;
  placeholder?: string;
  label?: string;
  minHeight?: number;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [blockSpacing, setBlockSpacing] = useState(8);
  const resolvedPlaceholder = placeholder ?? t("doc.placeholder");
  const resolvedLabel = label ?? t("doc.toolbar.label");

  useEffect(() => {
    if (ref.current && !dirty && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value, dirty]);

  function run(command: string, argument?: string) {
    ref.current?.focus();
    document.execCommand(command, false, argument);
    setDirty(true);
  }

  function commit() {
    const html = ref.current?.innerHTML ?? "";
    setDirty(false);
    if (html !== value) onSave(html);
  }

  return (
    <section aria-label={resolvedLabel}>
      <div
        className="flex flex-wrap items-center gap-1 rounded-t-lg border border-border bg-muted/40 p-1.5"
        role="toolbar"
        aria-label={t("doc.toolbar.tools")}
        data-no-highlight
        onMouseDown={(event) => event.preventDefault()}
      >
        <Tool label={t("doc.toolbar.bold")} onClick={() => run("bold")}><Bold className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.italic")} onClick={() => run("italic")}><Italic className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.underline")} onClick={() => run("underline")}><Underline className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.strikethrough")} onClick={() => run("strikeThrough")}><Strikethrough className="size-4" /></Tool>
        <Divider />
        <Tool label={t("doc.toolbar.heading1")} onClick={() => run("formatBlock", "<h1>")}><Heading1 className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.heading2")} onClick={() => run("formatBlock", "<h2>")}><Heading2 className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.heading3")} onClick={() => run("formatBlock", "<h3>")}><Heading3 className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.paragraph")} onClick={() => run("formatBlock", "<p>")}><Type className="size-4" /></Tool>
        <Divider />
        <Tool label={t("doc.toolbar.bulletedList")} onClick={() => run("insertUnorderedList")}><List className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.numberedList")} onClick={() => run("insertOrderedList")}><ListOrdered className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.quote")} onClick={() => run("formatBlock", "<blockquote>")}><Quote className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.codeBlock")} onClick={() => run("formatBlock", "<pre>")}><Code2 className="size-4" /></Tool>
        <Divider />
        <Tool label={t("doc.toolbar.alignStart")} onClick={() => run("justifyLeft")}><AlignLeft className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.alignCenter")} onClick={() => run("justifyCenter")}><AlignCenter className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.alignEnd")} onClick={() => run("justifyRight")}><AlignRight className="size-4" /></Tool>
        <Divider />
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={t("doc.toolbar.textColor", { color })}
            title={t("doc.toolbar.textColor", { color })}
            className="size-5 rounded-full border border-border"
            style={{ backgroundColor: color }}
            onClick={() => run("foreColor", color)}
          />
        ))}
        <Divider />
        <Tool label={t("doc.toolbar.highlightText")} onClick={() => run("hiliteColor", "#fde047")}>
          <Highlighter className="size-4" />
        </Tool>
        <Tool label={t("doc.toolbar.saveHighlight")} onClick={() => requestHighlight("#fde047")}>
          <Highlighter className="size-4 text-primary" />
        </Tool>
        <Tool
          label={t("doc.toolbar.insertLink")}
          onClick={() => {
            const url = window.prompt(t("doc.toolbar.insertLinkPrompt"));
            if (url) run("createLink", url);
          }}
        >
          <Link2 className="size-4" />
        </Tool>
        <Divider />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <AlignJustify className="size-4" aria-hidden />
          <select
            aria-label={t("ui.editor.lineSpacing")}
            title={t("ui.editor.lineSpacing")}
            value={lineHeight}
            onChange={(event) => setLineHeight(Number(event.target.value))}
            className="h-7 rounded-md border border-input bg-background px-1 text-xs"
          >
            {[1.3, 1.6, 1.9, 2.2, 2.6].map((value) => (
              <option key={value} value={value}>{value.toFixed(1)}×</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <MoveVertical className="size-4" aria-hidden />
          <select
            aria-label={t("ui.editor.paragraphSpacing")}
            title={t("ui.editor.paragraphSpacing")}
            value={blockSpacing}
            onChange={(event) => setBlockSpacing(Number(event.target.value))}
            className="h-7 rounded-md border border-input bg-background px-1 text-xs"
          >
            {[0, 4, 8, 14, 20].map((value) => (
              <option key={value} value={value}>{value}px</option>
            ))}
          </select>
        </label>
        <Divider />
        <Tool label={t("doc.toolbar.clearFormatting")} onClick={() => run("removeFormat")}><Eraser className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.undo")} onClick={() => run("undo")}><Undo2 className="size-4" /></Tool>
        <Tool label={t("doc.toolbar.redo")} onClick={() => run("redo")}><Redo2 className="size-4" /></Tool>
        <span className="ms-auto pe-1 text-xs text-muted-foreground">
          {dirty ? t("doc.toolbar.unsaved") : t("doc.toolbar.saved")}
        </span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={resolvedLabel}
        data-placeholder={resolvedPlaceholder}
        onInput={() => setDirty(true)}
        onBlur={commit}
        style={
          {
            minHeight,
            lineHeight,
            "--doc-block-spacing": `${blockSpacing}px`,
          } as React.CSSProperties
        }
        className={cn(
          "prose-doc rounded-b-lg border border-t-0 border-border bg-card p-4 text-sm outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "[&_p]:mb-[var(--doc-block-spacing)] [&_li]:mb-[var(--doc-block-spacing)]",
          "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
        )}
      />
    </section>
  );
}

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="size-8"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}
