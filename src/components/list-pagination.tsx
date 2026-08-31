import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

/** Client-side pagination shared by the list surfaces. */
export function usePagination<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  return { page, setPage, pageCount, pageRows, total: rows.length };
}

export function Pagination({
  page,
  pageCount,
  onChange,
  total,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  total: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
      <span className="text-xs text-muted-foreground">
        Page {page} of {pageCount} · {total} items
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        {Array.from({ length: pageCount }, (_, index) => index + 1)
          .filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1)
          .map((n, index, visible) => (
            <span key={n} className="flex items-center gap-1">
              {index > 0 && n - (visible[index - 1] ?? 0) > 1 ? (
                <span className="px-1 text-xs text-muted-foreground">…</span>
              ) : null}
              <Button
                variant={n === page ? "secondary" : "ghost"}
                size="icon"
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                onClick={() => onChange(n)}
              >
                {n}
              </Button>
            </span>
          ))}
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
    </nav>
  );
}

/** Compact stats strip used above paginated lists. */
export function StatStrip({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
