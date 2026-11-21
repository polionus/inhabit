/** Pure logic for the Cantor diagonal exhibit: a finite f : α → Set α as a boolean matrix, α = {0,…,n−1}. */

/** `f[x][y]` is true when `y ∈ f x`. Square, n × n. */
export type Rel = boolean[][];

export const MIN_N = 3;
export const MAX_N = 6;

export const emptyRel = (n: number): Rel => Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

/** The diagonal set D = {x | x ∉ f x}, as a membership row. */
export const diagonalSet = (f: Rel): boolean[] => f.map((row, x) => !row[x]);

/** Do two membership rows describe the same set? */
export const sameSet = (a: boolean[], b: boolean[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/** D and `f x` disagree at position x (always true). */
export const differsAt = (f: Rel, x: number): boolean => diagonalSet(f)[x] !== f[x][x];

/** Is some row of f equal to the set s? (s is in the range of f) */
export const inRange = (f: Rel, s: boolean[]): boolean => f.some((row) => sameSet(row, s));

/** Indices a with f a = s. */
export const preimages = (f: Rel, s: boolean[]): number[] => f.flatMap((row, a) => (sameSet(row, s) ? [a] : []));

/** The two sides of `a ∈ f a ↔ a ∈ D`, whose truth values always differ: that's `P ↔ ¬P`. */
export function clash(f: Rel, a: number): { inFa: boolean; inD: boolean; iffHolds: boolean } {
  const inFa = f[a][a];
  const inD = diagonalSet(f)[a];
  return { inFa, inD, iffHolds: inFa === inD };
}

/** Resize, keeping the top-left corner. */
export function resize(f: Rel, n: number): Rel {
  return Array.from({ length: n }, (_, x) => Array.from({ length: n }, (_, y) => f[x]?.[y] ?? false));
}

export const toggle = (f: Rel, x: number, y: number): Rel => f.map((row, i) => (i === x ? row.map((v, j) => (j === y ? !v : v)) : row));

/** A pseudo-random f from a seed (deterministic, so tests can pin it). */
export function randomRel(n: number, rnd: () => number = Math.random): Rel {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() < 0.5));
}

export type RelPreset = { id: string; label: string; make: (n: number) => Rel };

export const relPresets: RelPreset[] = [
  { id: 'single', label: 'f x = {x}', make: (n) => Array.from({ length: n }, (_, x) => Array.from({ length: n }, (_, y) => x === y)) },
  { id: 'all', label: 'f x = everything', make: (n) => Array.from({ length: n }, () => new Array<boolean>(n).fill(true)) },
  { id: 'none', label: 'f x = ∅', make: (n) => emptyRel(n) },
  { id: 'below', label: 'f x = {y | y < x}', make: (n) => Array.from({ length: n }, (_, x) => Array.from({ length: n }, (_, y) => y < x)) },
  { id: 'shift', label: 'f x = {x+1}', make: (n) => Array.from({ length: n }, (_, x) => Array.from({ length: n }, (_, y) => y === (x + 1) % n)) },
];

/** Render a membership row as `{0, 2}`. */
export const showSet = (row: boolean[]): string => '{' + row.flatMap((v, i) => (v ? [String(i)] : [])).join(', ') + '}';
