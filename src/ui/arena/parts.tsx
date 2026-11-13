/** Small pieces shared by the Arena screens. */
import { useEffect, useRef, useState } from 'react';
import type { Puzzle } from '../../arena/types.ts';
import { Lean } from '../components/Markdown.tsx';
import { Icon, motionReduced } from '../components/kit.tsx';

/** Re-renders every `ms`; returns `Date.now()`. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const nextUtcMidnight = (now: number): number => Math.floor(now / 86_400_000) * 86_400_000 + 86_400_000;

/** `h:mm:ss` for the "come back in" line. */
export function hms(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}

/** Tiny line chart of the rating history (inline SVG). */
export function Sparkline({ points, width = 220, height = 56 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return <div className="spark-empty muted small">Your rating chart appears after two rated puzzles.</div>;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = Math.max(1, hi - lo);
  const pad = 4;
  const xy = points.map((p, i) => [pad + (i / (points.length - 1)) * (width - 2 * pad), height - pad - ((p - lo) / span) * (height - 2 * pad)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Rating over your last ${points.length} puzzles, from ${points[0]} to ${points[points.length - 1]}`} preserveAspectRatio="none">
      <path d={`${d} L${lx.toFixed(1)} ${height} L${xy[0][0].toFixed(1)} ${height} Z`} className="spark-fill" />
      <path d={d} className="spark-line" fill="none" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3.5" className="spark-dot" />
    </svg>
  );
}

/** A number that counts from `from` to `to` (instant under reduced motion). */
export function CountUp({ from, to, ms = 700 }: { from: number; to: number; ms?: number }) {
  const [v, setV] = useState(motionReduced() ? to : from);
  const raf = useRef(0);
  useEffect(() => {
    if (motionReduced() || from === to) {
      setV(to);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [from, to, ms]);
  return <span className="tnum">{v}</span>;
}

/** The reference solution of a puzzle, collapsed by default. */
export function Reference({ puzzle, open = false }: { puzzle: Puzzle; open?: boolean }) {
  if (puzzle.kind === 'quick') {
    const right = puzzle.options.find((o) => o.correct);
    return right ? <p className="small"><strong>Answer:</strong> {right.why}</p> : null;
  }
  return (
    <details className="pz-ref" open={open}>
      <summary><Icon name="eye" size={16} /> Reference solution</summary>
      <Lean code={(puzzle.setup ? puzzle.setup + '\n' : '') + puzzle.header + '\n' + puzzle.solution} />
    </details>
  );
}
