/**
 * Quantifier game logic: a statement `Q₁ v₁, Q₂ v₂, R x y` over the domain 0..N-1 and a relation R
 * given as a boolean matrix. The player takes a side (claims true or false); the player picks the
 * values of the quantifiers that belong to that side (∃ for "true", ∀ for "false"), the computer
 * picks the others by minimax. Pure and deterministic (ties go to the smallest value).
 */
export const N = 6;

export type Quant = '∀' | '∃';
export type Var = 'x' | 'y';
export interface Binder {
  q: Quant;
  v: Var;
}
/** R[x][y] */
export type Matrix = boolean[][];
export type Side = 'true' | 'false';
export type Who = 'player' | 'computer';

export const emptyMatrix = (): Matrix => Array.from({ length: N }, () => Array<boolean>(N).fill(false));

export type RelationId = 'gt' | 'le' | 'next' | 'custom';
export const RELATIONS: Record<Exclude<RelationId, 'custom'>, { name: string; test: (x: number, y: number) => boolean }> = {
  gt: { name: 'y > x', test: (x, y) => y > x },
  le: { name: 'x ≤ y', test: (x, y) => x <= y },
  next: { name: 'y is the next number after x, wrapping 5 to 0', test: (x, y) => y === (x + 1) % N },
};

export function matrixOf(rel: Exclude<RelationId, 'custom'>): Matrix {
  const m = emptyMatrix();
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) m[x][y] = RELATIONS[rel].test(x, y);
  return m;
}

/** Lean source of the statement, e.g. `∀ x, ∃ y, R x y`. */
export const leanOf = (bs: Binder[]): string => bs.map((b) => `${b.q} ${b.v}, `).join('') + 'R x y';

/** Value of the body `R x y` once every variable is fixed. `vals[i]` is the value given to `bs[i]`. */
export function holds(bs: Binder[], M: Matrix, vals: number[]): boolean {
  const env: Record<Var, number> = { x: 0, y: 0 };
  bs.forEach((b, i) => (env[b.v] = vals[i]));
  return M[env.x][env.y];
}

/** Brute-force truth of the remaining quantifiers given the first `vals.length` values. */
export function solve(bs: Binder[], M: Matrix, vals: number[] = []): boolean {
  if (vals.length === bs.length) return holds(bs, M, vals);
  const b = bs[vals.length];
  const ok = (v: number) => solve(bs, M, [...vals, v]);
  const dom = Array.from({ length: N }, (_, v) => v);
  return b.q === '∀' ? dom.every(ok) : dom.some(ok);
}

/** Who picks the value for this quantifier when the player takes `side`. */
export const ownerOf = (q: Quant, side: Side): Who => ((q === '∃') === (side === 'true') ? 'player' : 'computer');

/** Values for `bs[vals.length]` that keep the mover's side winning, given the values so far. */
export function goodMoves(bs: Binder[], M: Matrix, vals: number[]): number[] {
  const b = bs[vals.length];
  const wantTrue = b.q === '∃';
  const out: number[] = [];
  for (let v = 0; v < N; v++) if (solve(bs, M, [...vals, v]) === wantTrue) out.push(v);
  return out;
}

/** The computer's choice: the smallest winning value, or the smallest value when none wins. */
export function computerMove(bs: Binder[], M: Matrix, vals: number[]): number {
  const good = goodMoves(bs, M, vals);
  return good.length ? good[0] : 0;
}

/** Let the computer move until it is the player's turn or the round is over. */
export function advance(bs: Binder[], M: Matrix, side: Side, vals: number[]): number[] {
  const out = [...vals];
  while (out.length < bs.length && ownerOf(bs[out.length].q, side) === 'computer') out.push(computerMove(bs, M, out));
  return out;
}

export interface Outcome {
  /** The final R x y holds. */
  holds: boolean;
  /** Which claim won: 'true' when R holds. */
  winnerSide: Side;
  playerWon: boolean;
}

export function outcome(bs: Binder[], M: Matrix, side: Side, vals: number[]): Outcome {
  const h = holds(bs, M, vals);
  const winnerSide: Side = h ? 'true' : 'false';
  return { holds: h, winnerSide, playerWon: winnerSide === side };
}

export interface LogLine {
  who: Who;
  text: string;
}

/** Plain-English narration of each pick: "You chose y = 3 for x = 2." */
export function narrate(bs: Binder[], vals: number[], side: Side): LogLine[] {
  return vals.map((val, i) => {
    const b = bs[i];
    const who = ownerOf(b.q, side);
    const earlier = bs.slice(0, i).map((e, j) => `${e.v} = ${vals[j]}`);
    const subject = who === 'player' ? 'You' : 'The computer';
    return { who, text: `${subject} chose ${b.v} = ${val}${earlier.length ? ' for ' + earlier.join(', ') : ''}. (${b.q} ${b.v})` };
  });
}

export function relationText(bs: Binder[], vals: number[]): string {
  const env: Record<Var, number> = { x: 0, y: 0 };
  bs.forEach((b, i) => (env[b.v] = vals[i]));
  return `R ${env.x} ${env.y}`;
}

export interface StrategyRow {
  /** Values of earlier variables, e.g. `x = 2`; empty for the first move. */
  given: string;
  /** The winner's move, or null when the winner owns no quantifier here (none exists). */
  move: number;
}
export interface Strategy {
  /** True when ∃ wins (the statement is true), false when ∀ wins. */
  winner: Side;
  /** One table per quantifier owned by the winner. */
  tables: { binder: Binder; rows: StrategyRow[] }[];
}

/**
 * A winning strategy for whichever side wins (∃-player if the statement is true, ∀-player if false):
 * for each of that side's quantifiers, the move to play after each reachable choice of earlier values.
 */
export function strategy(bs: Binder[], M: Matrix): Strategy {
  const truth = solve(bs, M);
  const winner: Side = truth ? 'true' : 'false';
  const wq: Quant = truth ? '∃' : '∀';
  const tables = bs.map((binder) => ({ binder, rows: [] as StrategyRow[] }));
  // walk every history the winner can face when it follows its (smallest-move) strategy
  const walk = (vals: number[]) => {
    const i = vals.length;
    if (i === bs.length) return;
    if (bs[i].q === wq) {
      const good = goodMoves(bs, M, vals);
      const mv = good[0];
      tables[i].rows.push({ given: bs.slice(0, i).map((e, j) => `${e.v} = ${vals[j]}`).join(', '), move: mv });
      walk([...vals, mv]);
    } else {
      for (let v = 0; v < N; v++) walk([...vals, v]);
    }
  };
  walk([]);
  return { winner, tables: tables.filter((t) => t.binder.q === wq) };
}

export interface Preset {
  id: string;
  label: string;
  binders: Binder[];
  relation: Exclude<RelationId, 'custom'>;
  blurb: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'succ',
    label: 'Everything has a bigger one',
    binders: [{ q: '∀', v: 'x' }, { q: '∃', v: 'y' }],
    relation: 'gt',
    blurb: 'For every x there is a y with y > x. On the numbers 0 to 5 it fails at x = 5.',
  },
  {
    id: 'least',
    label: 'A smallest number',
    binders: [{ q: '∃', v: 'x' }, { q: '∀', v: 'y' }],
    relation: 'le',
    blurb: 'Some x is at most every y. Pick x = 0.',
  },
  {
    id: 'forall-exists',
    label: 'Everyone has a next',
    binders: [{ q: '∀', v: 'x' }, { q: '∃', v: 'y' }],
    relation: 'next',
    blurb: 'For every x there is some y that comes right after it. The choice of y may depend on x.',
  },
  {
    id: 'exists-forall',
    label: 'Swapped: one next for all',
    binders: [{ q: '∃', v: 'y' }, { q: '∀', v: 'x' }],
    relation: 'next',
    blurb: 'Same relation, quantifiers swapped: one y that comes right after every x. Now y has to be chosen first.',
  },
  {
    id: 'greatest',
    label: 'A biggest number',
    binders: [{ q: '∃', v: 'y' }, { q: '∀', v: 'x' }],
    relation: 'le',
    blurb: 'Some y is at least every x. Pick y = 5.',
  },
];

/** The one direction Lean proves for any R, checked by the engine in the exhibit. */
export const SWAP_PROOF = [
  'example (R : Nat → Nat → Prop) : (∃ y, ∀ x, R x y) → ∀ x, ∃ y, R x y := by',
  '  intro h x',
  '  obtain ⟨y, hy⟩ := h',
  '  exact ⟨y, hy x⟩',
].join('\n');
