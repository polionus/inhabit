/** Pure logic for the Induction dominoes exhibit: statements P n, which links hold, and how the row falls. */

export interface DominoPreset {
  id: string;
  label: string;
  /** The Lean statement about `n : Nat`. */
  stmt: string;
  /** The statement evaluated on a concrete number (a plain TS mirror of `stmt`). */
  pred: (n: number) => boolean;
  /** Tactic for the `zero` case, or null if the base case is false. */
  base: string[] | null;
  /** Tactic lines for the `succ k ih` case, or null if the step can't be proved. */
  step: string[] | null;
  /** A short note shown under the presets. */
  note: string;
}

export const DOMINO_COUNT = 10;

export const presets: DominoPreset[] = [
  {
    id: 'zero-add', label: '0 + n = n', stmt: '0 + n = n', pred: (n) => 0 + n === n,
    base: ['rfl'], step: ['rw [Nat.add_succ, ih]'],
    note: "The classic. The base case is by definition, and the step needs the induction hypothesis.",
  },
  {
    id: 'add-zero', label: 'n + 0 = n', stmt: 'n + 0 = n', pred: (n) => n + 0 === n,
    base: ['rfl'], step: ['rfl'],
    note: "Contrast with 0 + n = n. Here the step is true by definition, so `ih` isn't even used.",
  },
  {
    id: 'two-mul', label: '2 * n = n + n', stmt: '2 * n = n + n', pred: (n) => 2 * n === n + n,
    base: ['rfl'], step: ['rw [Nat.mul_succ, ih, Nat.succ_add, Nat.add_succ]', 'rfl'],
    note: 'The step leans on `ih` to replace `2 * k`, then both sides count the same successors.',
  },
  {
    id: 'succ-self', label: 'n + 1 = n', stmt: 'n + 1 = n', pred: (n) => n + 1 === n,
    base: null, step: ['exact congrArg Nat.succ ih'],
    note: "False, yet the step is provable: if k + 1 = k then adding one to both sides keeps it true. Only the base case is missing.",
  },
  {
    id: 'mul-zero-one', label: 'n * 0 = 1', stmt: 'n * 0 = 1', pred: (n) => n * 0 === 1,
    base: null, step: ['rw [Nat.mul_zero] at ih', 'rw [Nat.mul_zero]', 'exact ih'],
    note: "False at 0. The step is provable because `ih` is already absurd, but nothing pushes the first domino.",
  },
  {
    id: 'mul-self', label: 'n * n = n', stmt: 'n * n = n', pred: (n) => n * n === n,
    base: ['rfl'], step: null,
    note: "True at 0 and at 1, false at 2. The base case holds, but a link in the middle of the row breaks.",
  },
];

export const presetById = (id: string): DominoPreset => presets.find((p) => p.id === id) ?? presets[0];

/** Does P 0 hold? */
export const baseHolds = (p: DominoPreset): boolean => p.pred(0);

/** The first k with P k true and P (k+1) false, searched up to `limit`: a counterexample to the step. */
export function brokenLink(p: DominoPreset, limit = 200): number | null {
  for (let k = 0; k < limit; k++) if (p.pred(k) && !p.pred(k + 1)) return k;
  return null;
}

/** Does the step `P k → P (k+1)` hold for every k we can try? (The engine proof settles it for all k.) */
export const stepHolds = (p: DominoPreset, limit = 200): boolean => {
  for (let k = 0; k < limit; k++) if (p.pred(k) && !p.pred(k + 1)) return false;
  return true;
};

export type Fate = 'falls' | 'wobbles' | 'standing' | 'blocked';

export interface Cascade {
  /** Per domino 0..count-1. */
  fates: Fate[];
  /** Domino index that did not fall because the link before it broke (null if none within the row). */
  blockedAt: number | null;
  /** The k of the broken link `P k → P (k+1)`, when the step fails. */
  brokenK: number | null;
  summary: string;
}

/**
 * What happens when domino 0 is pushed. Domino 0 falls iff P 0 holds (otherwise it wobbles);
 * domino i+1 falls iff domino i fell and the link P i → P (i+1) holds.
 */
export function cascade(p: DominoPreset, count = DOMINO_COUNT): Cascade {
  const fates: Fate[] = new Array(count).fill('standing');
  if (!baseHolds(p)) {
    fates[0] = 'wobbles';
    return {
      fates, blockedAt: 0, brokenK: null,
      summary: `Domino 0 wobbles and stays up: P 0 is false (${instance(p, 0)}), so there's nothing to push the rest.`,
    };
  }
  fates[0] = 'falls';
  for (let i = 1; i < count; i++) {
    if (!p.pred(i - 1) || p.pred(i)) fates[i] = 'falls';
    else {
      fates[i] = 'blocked';
      return {
        fates, blockedAt: i, brokenK: i - 1,
        summary: `The cascade stops at domino ${i}. P ${i - 1} is true, but P ${i} is false (${instance(p, i)}), so the link from ${i - 1} to ${i} broke.`,
      };
    }
  }
  return { fates, blockedAt: null, brokenK: null, summary: `All ${count} dominoes fall, and the same two proofs cover every n, not only these ${count}.` };
}

/** `stmt` with a number plugged in, e.g. `2 * 3 = 3 + 3`. */
export function instantiate(stmt: string, n: number): string {
  return stmt.replace(/\bn\b/g, String(n));
}

/** The instance with its evaluated truth, e.g. `1 * 1 = 1` or `0 + 1 = 0 is false`. */
export function instance(p: DominoPreset, n: number): string {
  return `${instantiate(p.stmt, n)}${p.pred(n) ? '' : ' fails'}`;
}

/** Lean source: the induction skeleton with `sorry` in both cases (for reading the goals off the engine). */
export function skeletonSource(stmt: string): string {
  return `theorem P_all (n : Nat) : ${stmt} := by\n  induction n with\n  | zero => sorry\n  | succ k ih => sorry`;
}

const arm = (lines: string[] | null): string => {
  if (!lines) return 'sorry';
  return lines.length === 1 ? lines[0] : '\n    ' + lines.join('\n    ');
};

/** Lean source with the given case proofs filled in (`sorry` for the rest). `base`/`step` null means sorry. */
export function proofSource(stmt: string, base: string[] | null, step: string[] | null): string {
  return `theorem P_all (n : Nat) : ${stmt} := by\n  induction n with\n  | zero => ${arm(base)}\n  | succ k ih => ${arm(step)}`;
}

/** Just the proof body (what the learner would type after `by`). */
export function bodyOf(stmt: string, base: string[] | null, step: string[] | null): string {
  return proofSource(stmt, base, step).split('\n').slice(1).join('\n');
}
