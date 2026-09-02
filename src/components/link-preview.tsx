import type { LinkRecord } from "@/lib/types";

/** Renders a saved link as a card: favicon, readable title and hostname. */
export function LinkPreview({ link }: { link: LinkRecord }) {
  let host = "";
  let path = "";
  try {
    const url = new URL(link.url);
    host = url.hostname.replace(/^www\./, "");
    path = url.pathname === "/" ? "" : decodeURIComponent(url.pathname);
  } catch {
    host = link.url;
  }
  const label = link.title || (path ? path.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") : "") || host;
  const favicon = host ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}` : "";

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-background p-2 transition-colors hover:border-primary/50"
    >
      {favicon ? (
        <img src={favicon} alt="" width={24} height={24} loading="lazy" className="size-6 rounded" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground" dir="ltr">
          {host}
        </span>
      </span>
    </a>
  );
}
