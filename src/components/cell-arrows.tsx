import { useCallback, useEffect, useState, type RefObject } from "react";

export type CellLink = { id: string; from: string; to: string };

type Geometry = { id: string; path: string; midX: number; midY: number };

/**
 * Draws curved arrows between two cells of the same grid. Positions are read
 * from the DOM (`data-cell-key`) so the arrows follow scrolling, resizing and
 * any layout change of the table.
 */
export function CellArrows({
  containerRef,
  links,
  onRemove,
}: {
  containerRef: RefObject<HTMLElement | null>;
  links: CellLink[];
  onRemove: (id: string) => void;
}) {
  const [paths, setPaths] = useState<Geometry[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const base = container.getBoundingClientRect();
    setSize({ width: container.scrollWidth, height: container.scrollHeight });
    const next: Geometry[] = [];
    for (const link of links) {
      const a = container.querySelector<HTMLElement>(`[data-cell-key="${link.from}"]`);
      const b = container.querySelector<HTMLElement>(`[data-cell-key="${link.to}"]`);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.left - base.left + container.scrollLeft + ra.width / 2;
      const y1 = ra.top - base.top + container.scrollTop + ra.height / 2;
      const x2 = rb.left - base.left + container.scrollLeft + rb.width / 2;
      const y2 = rb.top - base.top + container.scrollTop + rb.height / 2;
      const cx = (x1 + x2) / 2 + (y2 - y1) * 0.18;
      const cy = (y1 + y2) / 2 - (x2 - x1) * 0.18;
      next.push({
        id: link.id,
        path: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
        midX: (x1 + 2 * cx + x2) / 4,
        midY: (y1 + 2 * cy + y2) / 4,
      });
    }
    setPaths(next);
  }, [containerRef, links]);

  useEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    container.querySelectorAll("[data-cell-key]").forEach((node) => observer.observe(node));
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, containerRef]);

  if (!paths.length) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      width={size.width}
      height={size.height}
      style={{ width: size.width, height: size.height }}
      aria-hidden
    >
      <defs>
        <marker id="work-os-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
        </marker>
      </defs>
      {paths.map((p) => (
        <g key={p.id} className="pointer-events-auto cursor-pointer" onClick={() => onRemove(p.id)}>
          <path d={p.path} className="stroke-primary/25" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path
            d={p.path}
            className="stroke-primary"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            markerEnd="url(#work-os-arrow)"
          />
          <circle cx={p.midX} cy={p.midY} r={6} className="fill-background stroke-primary" strokeWidth={2} />
        </g>
      ))}
    </svg>
  );
}
