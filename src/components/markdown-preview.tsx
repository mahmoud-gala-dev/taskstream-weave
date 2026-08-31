import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useState } from "react";

/**
 * Renders a Markdown attachment as selectable, sanitised HTML so users can
 * read, select and copy its content directly inside the preview dialog.
 */
export function MarkdownPreview({ url, label }: { url: string; label: string }) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    void fetch(url)
      .then((response) => response.text())
      .then(async (text) => {
        const parsed = await marked.parse(text, { async: true });
        if (active) setHtml(DOMPurify.sanitize(parsed));
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [url]);

  if (error) return <p className="text-sm text-destructive">{label}</p>;
  return (
    <div
      aria-label={label}
      className="prose-doc max-h-[80vh] w-[min(90vw,900px)] select-text overflow-auto rounded-md bg-card p-5 text-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** True for Markdown attachments (mime type is often empty for .md files). */
export function isMarkdown(mimeType: string, filename: string) {
  return (
    mimeType === "text/markdown" ||
    mimeType === "text/x-markdown" ||
    /\.(md|markdown)$/i.test(filename)
  );
}
