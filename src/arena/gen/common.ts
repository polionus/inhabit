/**
 * Shared pieces for proof puzzles: hypothesis naming, rating and par estimates, hints and themes.
 */
import { count, depth as fdepth, show } from './logic.ts';
import type { F } from './logic.ts';
import type { Naming, Pf, Stats } from './search.ts';
import type { Lang } from './emit.ts';
import type { ProofFamily } from '../types.ts';

/* ------------------------------------------------------------------ naming */

const short = (f: F): string | null => {
  if (f.t === 'atom') return f.p.toLowerCase() + f.args.join('');
  if (f.t === 'not' && f.a.t === 'atom') return 'n' + f.a.p.toLowerCase() + f.a.args.join('');
  return null;
};
const isBin = (f: F): f is Extract<F, { a: F; b: F }> => f.t === 'and' || f.t === 'or' || f.t === 'imp' || f.t === 'iff';

/** `hp : P`, `hnq : ¬Q`, `hpq : P → Q`, `hnpq : ¬(P ∨ Q)`, otherwise `h`. */
export const propNaming: Naming = {
  hyp(f: F): string {
    const s = short(f);
    if (s) return 'h' + s;
    if (f.t === 'bot') return 'hf';
    if (isBin(f)) {
      const a = short(f.a);
      const b = short(f.b);
      if (a && b && a.length + b.length <= 5) return 'h' + a + b;
    }
    if (f.t === 'not' && isBin(f.a) && f.a.a.t === 'atom' && f.a.b.t === 'atom') {
      return 'hn' + short(f.a.a) + short(f.a.b);
    }
    return 'h';
  },
};

/* ------------------------------------------------------------------ rating */

export interface Features {
  /** Tactic lines of the reference script. */
  lines: number;
  stats: Stats;
  /** Negations / `False` / complements in the statement. */
  negs: number;
  /** Connective nesting depth of the statement. */
  depth: number;
  /** Quantifiers in the statement. */
  quants: number;
  family: ProofFamily;
  mode: 'tactic' | 'term';
}

export function statementFeatures(fs: F[]): { negs: number; depth: number; quants: number } {
  let negs = 0;
  let depth = 0;
  let quants = 0;
  for (const f of fs) {
    negs += count(f, (g) => g.t === 'not' || g.t === 'bot');
    depth = Math.max(depth, fdepth(f));
    quants += count(f, (g) => g.t === 'all' || g.t === 'ex');
  }
  return { negs, depth, quants };
}

const FAMILY_BONUS: Record<ProofFamily, number> = { prop: 0, inhabit: 40, quant: 60, set: 40 };

/** Estimated difficulty on the 400–2400 scale. */
export function rate(x: Features): number {
  const s = x.stats;
  const lines = Math.min(x.lines, 24);
  let r =
    250 +
    55 * lines +
    150 * s.splits +
    45 * Math.min(x.negs, 6) +
    30 * Math.max(0, x.depth - 2) +
    260 * Math.min(s.classical, 2) +
    90 * s.haves +
    70 * s.applies +
    60 * s.exfalsos +
    40 * x.quants +
    FAMILY_BONUS[x.family];
  if (x.mode === 'term') r += 40;
  return Math.round(Math.max(400, Math.min(2400, r)));
}

/** Seconds an on-rating player needs for a proof puzzle. */
export function proofPar(rating: number): number {
  // 15 s at 400, ~60 s at 1200, ~4 min at 2000.
  const t = 15 * Math.pow(2, (rating - 400) / 400);
  return Math.round(Math.min(600, t) / 5) * 5;
}

/** Seconds for a quick item (8–25 s). */
export function quickPar(rating: number): number {
  return Math.round(8 + Math.max(0, Math.min(1, (rating - 400) / 1200)) * 17);
}

/* ------------------------------------------------------------------ hints and themes */

/** The first node after intros and destructuring. */
function keyNode(pf: Pf): Pf {
  let p = pf;
  while (p.k === 'intro' || p.k === 'andE' || p.k === 'exE') p = p.body;
  return p;
}

function shapeOf(goal: F, set: boolean): string {
  switch (goal.t) {
    case 'imp':
      return set
        ? 'The goal is an implication: assume its left side with `intro`.'
        : 'The goal is an implication: `intro` gives you its left side as a hypothesis.';
    case 'not':
      return 'The goal is a negation, and `¬A` means `A → False`: `intro` the assumption and aim for `False`.';
    case 'and':
      return 'The goal is a conjunction: you have to prove both sides.';
    case 'iff':
      return 'The goal is an `↔`: prove both directions.';
    case 'or':
      return 'The goal is a disjunction: you only need one side — but which one?';
    case 'all':
      return 'The goal starts with `∀`: `intro` a fresh element.';
    case 'ex':
      return 'The goal is an existence statement: you will need a witness.';
    case 'bot':
      return 'The goal is `False`: find two hypotheses that contradict each other.';
    default:
      return 'Look at what the hypotheses give you and how the goal could be built from them.';
  }
}

function idea(p: Pf, L: Lang): string {
  const shw = (f: F) => '`' + show(f, L.style) + '`';
  switch (p.k) {
    case 'orE':
      return `The key is a case split on \`${p.h}\`: handle ${shw(p.fa)} and ${shw(p.fb)} separately.`;
    case 'app':
      return `Work backwards: \`${p.h}\` concludes exactly ${shw(p.goal)}, so \`apply ${p.h}\` leaves you its premises.`;
    case 'exfalso':
      return 'The goal cannot be reached directly: derive a contradiction from the hypotheses (`exfalso`, or `absurd`).';
    case 'inl':
      return 'The left side of the disjunction is the one you can prove: `left`.';
    case 'inr':
      return 'The right side of the disjunction is the one you can prove: `right`.';
    case 'and':
      return 'Split the goal with `constructor` and prove each part.';
    case 'iff':
      return 'Use `constructor` to get the two directions, then `intro` in each.';
    case 'have':
      return `Use \`${p.h}\` forwards: first get ${shw(p.f)}, then take it apart.`;
    case 'byContra':
      return 'This needs classical logic: `by_contra` assumes the goal is false; derive `False`.';
    case 'byCases':
      return `This needs classical logic: \`by_cases\` on ${shw(p.v)} and handle both cases.`;
    case 'exI':
      return `\`${p.w}\` is the witness: \`use ${p.w}\`.`;
    case 'hyp':
      return `\`${p.name}\` is exactly what you need.`;
    default:
      return 'Assemble the goal from the hypotheses.';
  }
}

/**
 * 2–3 hints: shape of the problem, the first tactic and the key idea, the first lines.
 * `prefix` holds lines emitted before the Pf's own script (e.g. `intro x hx` for sets).
 */
export function makeHints(opts: {
  goal: F;
  pf: Pf;
  L: Lang;
  lines: string[];
  shape?: string;
}): string[] {
  const { pf, L, lines } = opts;
  const k = keyNode(pf);
  const first = lines[0].trim();
  const rung1 = opts.shape ?? shapeOf(opts.goal, false);
  const kIdea = idea(k, L);
  const rung2 = lines.length > 1 && k !== pf ? `Start with \`${first}\`. ${kIdea}` : kIdea;
  const hints = [rung1, rung2];
  if (lines.length >= 3) {
    const n = Math.min(lines.length - 1, Math.max(2, Math.ceil(lines.length / 2)));
    hints.push('The proof can begin like this:\n```lean\n' + lines.slice(0, n).join('\n') + '\n```');
  }
  return hints;
}

export function makeThemes(stmt: F[], st: Stats, extra: string[] = []): string[] {
  const has = (t: F['t']) => stmt.some((f) => count(f, (g) => g.t === t) > 0);
  const out: string[] = [...extra];
  if (has('imp')) out.push('implication');
  if (has('and')) out.push('conjunction');
  if (has('or')) out.push('disjunction');
  if (has('not') || has('bot')) out.push('negation');
  if (has('iff')) out.push('iff');
  if (has('all')) out.push('forall');
  if (has('ex')) out.push('exists');
  if (st.splits - st.classical > 0) out.push('case split');
  if (st.exfalsos > 0) out.push('contradiction');
  if (st.applies > 0) out.push('backward reasoning');
  if (st.haves > 0) out.push('forward reasoning');
  if (st.classical > 0) out.push('classical');
  if (st.witnesses > 0) out.push('witness');
  return [...new Set(out)];
}

/** Canonical letters: rename atoms by first occurrence. */
export function canonicalAtoms(fs: F[], letters: readonly string[]): Record<string, string> {
  const seen: string[] = [];
  const walk = (f: F) => {
    switch (f.t) {
      case 'atom':
        if (!seen.includes(f.p)) seen.push(f.p);
        return;
      case 'bot':
      case 'top':
        return;
      case 'not':
      case 'all':
      case 'ex':
        return walk(f.a);
      default:
        walk(f.a);
        walk(f.b);
    }
  };
  fs.forEach(walk);
  const m: Record<string, string> = {};
  seen.forEach((p, i) => (m[p] = letters[i] ?? p));
  return m;
}
