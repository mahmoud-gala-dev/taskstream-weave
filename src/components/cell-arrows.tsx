import { useCallback, useEffect, useState, type RefObject } from "react";

export type CellLink = { id: string; from: string; to: string };

type Geometry = { id: string; path: string; head: string; midX: number; midY: number };

/**
 * Smooth cubic curve between two points: control points are pushed along the
 * direction of travel and bowed sideways, which reads as an elegant flowing
 * connector rather than a straight line.
 */
function curvePath(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = Math.min(70, len * 0.18);
  const c1x = x1 + dx * 0.3 + nx * bow;
  const c1y = y1 + dy * 0.3 + ny * bow;
  const c2x = x1 + dx * 0.7 + nx * bow;
  const c2y = y1 + dy * 0.7 + ny * bow;
  // Point on the curve at t = 0.5 (for the delete dot) and the tangent at the end.
  const midX = 0.125 * x1 + 0.375 * c1x + 0.375 * c2x + 0.125 * x2;
  const midY = 0.125 * y1 + 0.375 * c1y + 0.375 * c2y + 0.125 * y2;
  return {
    d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    midX,
    midY,
    tangent: Math.atan2(y2 - c2y, x2 - c2x),
  };
}

/** Slim filled triangle aligned with the curve tangent. */
function arrowHead(x: number, y: number, angle: number) {
  const size = 12;
  const spread = 0.34;
  const ax = x - Math.cos(angle - spread) * size;
  const ay = y - Math.sin(angle - spread) * size;
  const bx = x - Math.cos(angle + spread) * size;
  const by = y - Math.sin(angle + spread) * size;
  const cx = x - Math.cos(angle) * size * 0.55;
  const cy = y - Math.sin(angle) * size * 0.55;
  return `M ${x.toFixed(1)} ${y.toFixed(1)} L ${ax.toFixed(1)} ${ay.toFixed(1)} L ${cx.toFixed(1)} ${cy.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)} Z`;
}

/**
 * Draws hand-drawn looking arrows between two cells of the same grid.
 * Positions come from the DOM (`data-cell-key`) so the arrows follow
 * scrolling, resizing and any layout change of the table. The layer never
 * intercepts pointer events except on the small delete dot.
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

      // Stop the stroke on the border of the target cell so the arrow head
      // never lands on top of the cell content.
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const inset = Math.min(rb.width, rb.height) / 2 - 4;
      const ex = x2 - Math.cos(angle) * inset;
      const ey = y2 - Math.sin(angle) * inset;
      const sx = x1 + Math.cos(angle) * (Math.min(ra.width, ra.height) / 2 - 4);
      const sy = y1 + Math.sin(angle) * (Math.min(ra.width, ra.height) / 2 - 4);

      const curve = curvePath(sx, sy, ex, ey);
      next.push({
        id: link.id,
        path: curve.d,
        head: arrowHead(ex, ey, curve.tangent),
        midX: curve.midX,
        midY: curve.midY,
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
    container.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      container.removeEventListener("scroll", measure);
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
        <linearGradient id="work-os-arrow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" className="text-primary" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" className="text-primary" />
        </linearGradient>
        <filter id="work-os-arrow-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="currentColor" floodOpacity="0.25" />
        </filter>
      </defs>
      {paths.map((p) => (
        <g key={p.id} className="text-primary" filter="url(#work-os-arrow-glow)">
          {/* Soft halo so the curve stays readable over any cell colour. */}
          <path
            d={p.path}
            className="stroke-background"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            opacity={0.75}
          />
          <path
            d={p.path}
            stroke="url(#work-os-arrow-grad)"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d={p.head} className="fill-primary" stroke="none" />
        </g>
      ))}
      {paths.map((p) => (
        <g
          key={`${p.id}-dot`}
          className="pointer-events-auto cursor-pointer opacity-60 transition hover:opacity-100"
          onClick={() => onRemove(p.id)}
        >
          <circle cx={p.midX} cy={p.midY} r={7} className="fill-background stroke-primary" strokeWidth={1.6} />
          <path
            d={`M ${p.midX - 3} ${p.midY - 3} L ${p.midX + 3} ${p.midY + 3} M ${p.midX + 3} ${p.midY - 3} L ${p.midX - 3} ${p.midY + 3}`}
            className="stroke-primary"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}
