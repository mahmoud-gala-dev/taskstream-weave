import { useCallback, useEffect, useState, type RefObject } from "react";

export type CellLink = { id: string; from: string; to: string };

type Geometry = { id: string; main: string; ghost: string; head: string; midX: number; midY: number };

/** Deterministic 0..1 pseudo-random generator so a link always wobbles the same way. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a wobbly poly-line between two points so the stroke reads like a
 * pencil sketch instead of a perfect vector curve.
 */
function sketchPath(x1: number, y1: number, x2: number, y2: number, rand: () => number, amp: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Unit normal: the arc bows sideways like a drawn-by-hand connector.
  const nx = -dy / len;
  const ny = dx / len;
  const bow = Math.min(90, len * 0.22);
  const steps = 8;
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const curve = Math.sin(Math.PI * t) * bow;
    const jitter = (rand() - 0.5) * amp;
    const px = x1 + dx * t + nx * (curve + jitter);
    const py = y1 + dy * t + ny * (curve + jitter);
    d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
  }
  const midT = 0.5;
  const midCurve = bow;
  return {
    d,
    midX: x1 + dx * midT + nx * midCurve,
    midY: y1 + dy * midT + ny * midCurve,
  };
}

/** Two short strokes forming a hand-drawn arrow head at the end point. */
function sketchHead(x1: number, y1: number, x2: number, y2: number, rand: () => number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 13;
  const spread = 0.42;
  const a1 = angle + Math.PI - spread + (rand() - 0.5) * 0.2;
  const a2 = angle + Math.PI + spread + (rand() - 0.5) * 0.2;
  return (
    `M ${x2 + Math.cos(a1) * size} ${y2 + Math.sin(a1) * size} L ${x2} ${y2} ` +
    `L ${x2 + Math.cos(a2) * size} ${y2 + Math.sin(a2) * size}`
  );
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

      const main = sketchPath(sx, sy, ex, ey, seeded(link.id), 3.5);
      const ghost = sketchPath(sx, sy, ex, ey, seeded(`${link.id}-ghost`), 5);
      next.push({
        id: link.id,
        main: main.d,
        ghost: ghost.d,
        head: sketchHead(sx, sy, ex, ey, seeded(`${link.id}-head`)),
        midX: main.midX,
        midY: main.midY,
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
        <filter id="work-os-sketch" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={7} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {paths.map((p) => (
        <g key={p.id} filter="url(#work-os-sketch)">
          {/* Faint second pass: the "twice drawn" pencil feel. */}
          <path
            d={p.ghost}
            className="stroke-primary/35"
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={p.main}
            className="stroke-primary"
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          <path
            d={p.head}
            className="stroke-primary"
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
