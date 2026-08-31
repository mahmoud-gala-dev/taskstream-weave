import { Fragment } from "react";

/** Renders `text` with every case-insensitive occurrence of `term` marked. */
export function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim();
  if (needle.length < 2) return <>{text}</>;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={index} className="rounded bg-primary/25 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
