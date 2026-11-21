/**
 * Rejects statements that read as machine-made. Applied to every generated statement (set
 * statements through their elementwise translation, so `∩ ∪ ᶜ` follow the `∧ ∨ ¬` rules).
 *
 *  - redundant operands: the same operand twice in one ∧/∨ chain (`Q ∨ R ∨ Q`), or an operand
 *    absorbed by a sibling (`P ∧ (R ∨ P)`); `X → X` and `X ↔ X` (unless `bottom`);
 *  - negation stacks: never four or more `¬` in a row, at most one triple stack, at most two
 *    double stacks (`¬¬` sprayed over every atom of a plain law);
 *  - contradictory filler: `X ∧ ¬X` in one chain, or premises `X` and `¬X`, where X is compound;
 *    with X a single letter only when `contraOk` (the plain `¬(P ∧ ¬P)` at the bottom).
 */
import { key as rawKey } from './logic.ts';
import type { F } from './logic.ts';
import type { Rng } from '../types.ts';

export interface TidyOpts {
  /** Very bottom of the range: `P → P`-shaped statements are allowed. */
  bottom?: boolean;
  /** Plain contradictions `P ∧ ¬P` between single letters are allowed. */
  contraOk?: boolean;
  /** Maximum number of `¬¬` stacks (default 3; sets use 1, since `ᶜᶜ` reads as padding). */
  maxDoubles?: number;
}

/** Key up to commuting ∧, ∨, ↔ (so `P ∧ Q` and `Q ∧ P` count as the same operand). */
function key(f: F): string {
  switch (f.t) {
    case 'and':
    case 'or':
      return '(' + chain(f, f.t).map(key).sort().join(f.t === 'and' ? '∧' : '∨') + ')';
    case 'iff':
      return '(' + [key(f.a), key(f.b)].sort().join('↔') + ')';
    case 'imp':
      return '(' + key(f.a) + '→' + key(f.b) + ')';
    case 'not':
      return '¬' + key(f.a);
    case 'all':
    case 'ex':
      return f.t + '.' + rawKey({ t: f.t, x: f.x, a: f.a });
    default:
      return rawKey(f);
  }
}

const isLetter = (f: F) => f.t === 'atom' || f.t === 'top' || f.t === 'bot';

function chain(f: F, op: 'and' | 'or', out: F[] = []): F[] {
  if (f.t === op) {
    chain(f.a, op, out);
    chain(f.b, op, out);
  } else out.push(f);
  return out;
}

export function tidy(statement: F, o: TidyOpts = {}): boolean {
  let triples = 0;
  let doubles = 0;
  let ok = true;

  const walk = (f: F, parent: F['t'] | null): void => {
    if (!ok) return;
    switch (f.t) {
      case 'atom':
      case 'bot':
      case 'top':
        return;
      case 'not': {
        if (parent !== 'not') {
          let d = 0;
          let g: F = f;
          while (g.t === 'not') {
            d++;
            g = g.a;
          }
          if (d >= 4) ok = false;
          else if (d === 3) triples++;
          else if (d === 2) doubles++;
        }
        return walk(f.a, 'not');
      }
      case 'all':
      case 'ex':
        return walk(f.a, f.t);
      case 'imp':
      case 'iff':
        if (!o.bottom && key(f.a) === key(f.b)) ok = false;
        // `R → S ∧ R`: the premise restated inside the conclusion
        if (f.t === 'imp' && f.b.t === 'and' && chain(f.b, 'and').map(key).includes(key(f.a))) ok = false;
        // `X ↔ ¬X` with X compound (the plain `¬(P ↔ ¬P)` stays)
        if (f.t === 'iff') {
          for (const [x, y] of [[f.a, f.b], [f.b, f.a]] as const) {
            if (y.t === 'not' && key(y.a) === key(x) && !isLetter(x)) ok = false;
          }
        }
        // `P ↔ Q ∨ P`: one side is an operand of the other
        if (f.t === 'iff') {
          for (const [x, y] of [[f.a, f.b], [f.b, f.a]] as const) {
            if ((y.t === 'and' || y.t === 'or') && chain(y, y.t).map(key).includes(key(x))) ok = false;
          }
        }
        walk(f.a, f.t);
        return walk(f.b, f.t);
      case 'and':
      case 'or': {
        if (parent !== f.t) {
          const ops = chain(f, f.t);
          const keys = ops.map(key);
          if (new Set(keys).size !== keys.length) ok = false;
          // `R ∨ ¬¬R`: the same operand once plain and once under `¬¬`
          const strip = (x: F): F => (x.t === 'not' && x.a.t === 'not' ? strip(x.a.a) : x);
          const stripped = ops.map((x) => key(strip(x)));
          if (new Set(stripped).size !== stripped.length) ok = false;
          const dual = f.t === 'and' ? 'or' : 'and';
          for (const x of ops) {
            if (x.t !== dual) continue;
            const inner = chain(x, dual).map(key);
            if (inner.some((k) => keys.includes(k))) ok = false; // absorption
          }
          // a sibling hidden inside a negated chain: `X ∧ ¬(X ∨ Y)`, `X ∨ ¬(X ∧ Y)`
          for (const x of ops) {
            if (x.t !== 'not' || x.a.t !== dual) continue;
            if (chain(x.a, dual).map(key).some((k) => keys.includes(k))) ok = false;
          }
          for (const x of ops) {
            if (x.t !== 'not' || !keys.includes(key(x.a))) continue;
            // `X ∧ ¬X` (contradiction) or `X ∨ ¬X` (excluded middle) as filler
            if (f.t === 'and' && (!isLetter(x.a) || !o.contraOk)) ok = false;
            if (f.t === 'or' && !isLetter(x.a)) ok = false;
          }
        }
        walk(f.a, f.t);
        return walk(f.b, f.t);
      }
    }
  };
  walk(statement, null);
  if (!ok || triples > 1 || doubles > (o.maxDoubles ?? 3)) return false;

  // premises X and ¬X used as filler
  const prem: string[] = [];
  const negs: F[] = [];
  let g = statement;
  while (g.t === 'imp') {
    prem.push(key(g.a));
    if (g.a.t === 'not') negs.push(g.a.a);
    g = g.b;
  }
  for (const x of negs) if (prem.includes(key(x)) && (!isLetter(x) || !o.contraOk)) return false;
  return true;
}

/**
 * Tidy variation: commute the operands of some `∧`, `∨`, `↔` (`¬(P ∨ Q) ↔ ¬Q ∧ ¬P`). Adds variety
 * without adding symbols.
 */
export function commute(f: F, rng: Rng, p = 0.35): F {
  switch (f.t) {
    case 'atom':
    case 'bot':
    case 'top':
      return f;
    case 'not':
      return { t: 'not', a: commute(f.a, rng, p) };
    case 'all':
    case 'ex':
      return { t: f.t, x: f.x, a: commute(f.a, rng, p) };
    case 'imp':
      return { t: 'imp', a: commute(f.a, rng, p), b: commute(f.b, rng, p) };
    default: {
      const a = commute(f.a, rng, p);
      const b = commute(f.b, rng, p);
      return rng.next() < p ? { t: f.t, a: b, b: a } : { t: f.t, a, b };
    }
  }
}
