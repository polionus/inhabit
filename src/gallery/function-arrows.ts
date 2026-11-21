/**
 * Pure logic for the Function arrows exhibit: a function between two small finite sets, given as
 * `map[i] = j` (domain dot i goes to codomain dot j), with injective/surjective analysis, images and
 * preimages, and the Lean source that states and proves the verdicts (checked by the engine in
 * function-arrows-lean.ts, never taken on trust).
 */
export interface Fn {
  nA: number;
  nB: number;
  /** map[i] in [0, nB) for every domain index i. */
  map: number[];
}

export const MIN_SIZE = 1;
export const MAX_SIZE = 6;

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => String(n).split('').map((d) => SUB[+d]).join('');
/** Display names: a₁, b₂ (1-based). */
export const aName = (i: number) => 'a' + sub(i + 1);
export const bName = (j: number) => 'b' + sub(j + 1);
/** Lean identifiers: Dom.a1, Cod.b2. */
const aLean = (i: number) => `Dom.a${i + 1}`;
const bLean = (j: number) => `Cod.b${j + 1}`;

const clampSize = (n: number) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, n));

export function makeFn(nA: number, nB: number, map: number[]): Fn {
  nA = clampSize(nA);
  nB = clampSize(nB);
  return { nA, nB, map: Array.from({ length: nA }, (_, i) => (map[i] ?? i) % nB) };
}

export const setArrow = (f: Fn, i: number, j: number): Fn => ({ ...f, map: f.map.map((v, k) => (k === i ? j : v)) });
export const resize = (f: Fn, nA: number, nB: number): Fn => makeFn(nA, nB, f.map.map((v) => (v < clampSize(nB) ? v : clampSize(nB) - 1)));

/** How many arrows land on each codomain dot. */
export const indegrees = (f: Fn): number[] => {
  const d = Array<number>(f.nB).fill(0);
  for (const j of f.map) d[j]++;
  return d;
};

/** First pair i < k with f i = f k, or null when injective. */
export function collision(f: Fn): { i: number; k: number; j: number } | null {
  for (let i = 0; i < f.nA; i++) for (let k = i + 1; k < f.nA; k++) if (f.map[i] === f.map[k]) return { i, k, j: f.map[i] };
  return null;
}
/** First codomain dot that no arrow reaches, or null when surjective. */
export const missed = (f: Fn): number | null => {
  const d = indegrees(f);
  const j = d.findIndex((c) => c === 0);
  return j < 0 ? null : j;
};

export const isInjective = (f: Fn): boolean => collision(f) === null;
export const isSurjective = (f: Fn): boolean => missed(f) === null;

export const image = (f: Fn, s: ReadonlySet<number>): Set<number> => new Set([...s].map((i) => f.map[i]));
export const preimage = (f: Fn, t: ReadonlySet<number>): Set<number> => new Set(f.map.map((v, i) => (t.has(v) ? i : -1)).filter((i) => i >= 0));

const list = (xs: string[]) => (xs.length === 0 ? '∅' : '{' + xs.join(', ') + '}');
export const showDom = (s: ReadonlySet<number>) => list([...s].sort().map(aName));
export const showCod = (s: ReadonlySet<number>) => list([...s].sort().map(bName));

export interface Analysis {
  injective: boolean;
  surjective: boolean;
  bijective: boolean;
  injReason: string;
  surjReason: string;
  /** Pigeonhole remark when the sizes force a failure, else ''. */
  pigeon: string;
}

export function analyze(f: Fn): Analysis {
  const c = collision(f);
  const m = missed(f);
  const injective = c === null;
  const surjective = m === null;
  const injReason = c
    ? `${aName(c.i)} and ${aName(c.k)} both go to ${bName(c.j)}`
    : 'different dots never share a target';
  const surjReason = m !== null ? `${bName(m)} is never hit` : 'every codomain dot is hit';
  let pigeon = '';
  if (f.nA > f.nB) pigeon = `Pigeonhole: ${f.nA} dots on the left can't each get their own target among ${f.nB}, so no function here is injective.`;
  else if (f.nA < f.nB) pigeon = `${f.nA} arrows can reach at most ${f.nA} of the ${f.nB} dots on the right, so no function here is surjective.`;
  return { injective, surjective, bijective: injective && surjective, injReason, surjReason, pigeon };
}

/* ------------------------------------------------------------------ Lean */

/** Declarations: two enumeration types and `f` by cases. Names are ASCII (Dom.a1, Cod.b2). */
export function leanDecls(f: Fn): string {
  const dom = 'inductive Dom | ' + Array.from({ length: f.nA }, (_, i) => `a${i + 1}`).join(' | ');
  const cod = 'inductive Cod | ' + Array.from({ length: f.nB }, (_, j) => `b${j + 1}`).join(' | ');
  const def = 'def f : Dom → Cod\n' + f.map.map((j, i) => `  | .a${i + 1} => .b${j + 1}`).join('\n');
  return [dom, cod, def].join('\n');
}

export interface LeanClaim {
  /** What the claim says, in words. */
  label: string;
  source: string;
}

/** The theorems to check, one per verdict: either the property or its negation, with a proof. */
export function leanClaims(f: Fn): { injective: LeanClaim; surjective: LeanClaim } {
  const c = collision(f);
  const m = missed(f);
  const injective: LeanClaim = c
    ? {
        label: 'not injective',
        source: `theorem not_inj : ¬ Function.Injective f := by
  intro h
  have := h (show f ${aLean(c.i)} = f ${aLean(c.k)} from rfl)
  cases this`,
      }
    : {
        label: 'injective',
        source: `theorem inj : Function.Injective f := by
  intro a b h
  cases a <;> cases b <;> first | rfl | cases h`,
      };
  const surjective: LeanClaim =
    m !== null
      ? {
          label: 'not surjective',
          source: `theorem not_surj : ¬ Function.Surjective f := by
  intro h
  obtain ⟨a, ha⟩ := h ${bLean(m)}
  cases a <;> cases ha`,
        }
      : {
          label: 'surjective',
          source:
            `theorem surj : Function.Surjective f := by
  intro b
  cases b\n` + Array.from({ length: f.nB }, (_, j) => `  · exact ⟨${aLean(f.map.indexOf(j))}, rfl⟩`).join('\n'),
        };
  return { injective, surjective };
}

/* ------------------------------------------------------------------ presets */

export interface Preset {
  id: string;
  label: string;
  fn: Fn;
  /** Which view to open in. */
  mode: 'draw' | 'image' | 'preimage';
  /** Pre-selected dots (domain for image mode, codomain for preimage mode). */
  select?: number[];
  note: string;
}

export const PRESETS: Preset[] = [
  { id: 'bijection', label: 'A bijection', fn: makeFn(4, 4, [2, 0, 3, 1]), mode: 'draw', note: 'Every dot on the right is hit exactly once, so f is injective and surjective.' },
  { id: 'collapse', label: 'Collapse', fn: makeFn(4, 4, [1, 1, 2, 3]), mode: 'draw', note: 'Two arrows land on the same dot, so f is not injective. (One dot is then left over, so it is not surjective either.)' },
  { id: 'miss', label: 'Miss a dot', fn: makeFn(3, 5, [0, 2, 4]), mode: 'draw', note: 'Injective but not surjective: no two arrows share a target, yet some dots are never hit.' },
  { id: 'pigeon', label: 'Pigeonhole', fn: makeFn(5, 3, [0, 1, 2, 0, 1]), mode: 'draw', note: 'More dots on the left than on the right. Try to rearrange the arrows so no two share a target: you can’t.' },
  { id: 'empty', label: 'Empty preimage', fn: makeFn(4, 5, [0, 1, 1, 2]), mode: 'preimage', select: [4], note: 'b₅ is selected on the right: nothing maps to it, so its preimage is empty. Image and preimage are not inverse to each other.' },
];
