/**
 * `prop` family: propositional theorems over P Q R S, proved with tactics; and the shared builder
 * that also serves the Prop flavour of `inhabit` (term mode).
 */
import type { Rng } from '../types.ts';
import { weighted } from './rng.ts';
import {
  and,
  atom,
  atomNames,

  classify,
  g4ip,
  iff,
  imp,
  imps,
  key,
  not,
  or,
  parse,
  show,
  size,
  substAtoms,
} from './logic.ts';
import type { F } from './logic.ts';
import { Prover, prune, spineUsesAll, stats, uniq, usedNames } from './search.ts';
import type { Hyp, Pf } from './search.ts';
import { script, termOf } from './emit.ts';
import type { Lang } from './emit.ts';
import { sentence } from './english.ts';
import { canonicalAtoms, makeHints, makeThemes, propNaming, rate, statementFeatures } from './common.ts';
import type { Features } from './common.ts';

export const LETTERS = ['P', 'Q', 'R', 'S'] as const;

export const PROP_TACTICS = [
  'intro',
  'exact',
  'apply',
  'assumption',
  'constructor',
  'left',
  'right',
  'cases',
  'rcases',
  'obtain',
  'exfalso',
  'contradiction',
  'have',
  'show',
];
export const CLASSICAL_TACTICS = ['by_cases', 'by_contra'];

/** Named theorem shapes; atoms are instantiated and sometimes replaced by small formulas. */
export const PROP_SCHEMAS: readonly (readonly [string, string])[] = [
  ['(P → Q) → P → Q', 'modus ponens'],
  ['P → (P → Q) → Q', 'modus ponens'],
  ['(P → Q) → (Q → R) → P → R', 'chaining'],
  ['(P → Q) → (Q → R) → (R → S) → P → S', 'chaining'],
  ['(P ∧ Q → R) → P → Q → R', 'currying'],
  ['(P → Q → R) → P ∧ Q → R', 'currying'],
  ['(P → Q → R) → Q → P → R', 'currying'],
  ['(P → Q → R) → (P → Q) → P → R', 'chaining'],
  ['(P → Q) → ¬Q → ¬P', 'contraposition'],
  ['(P → ¬Q) → Q → ¬P', 'contraposition'],
  ['P ∧ Q → Q ∧ P', 'commutativity'],
  ['P ∨ Q → Q ∨ P', 'commutativity'],
  ['P ∧ Q ∧ R → (P ∧ Q) ∧ R', 'associativity'],
  ['(P ∧ Q) ∧ R → P ∧ Q ∧ R', 'associativity'],
  ['P ∨ Q ∨ R → (P ∨ Q) ∨ R', 'associativity'],
  ['(P ∨ Q) ∨ R → P ∨ Q ∨ R', 'associativity'],
  ['P ∧ (Q ∨ R) → (P ∧ Q) ∨ (P ∧ R)', 'distributivity'],
  ['(P ∧ Q) ∨ (P ∧ R) → P ∧ (Q ∨ R)', 'distributivity'],
  ['P ∨ (Q ∧ R) → (P ∨ Q) ∧ (P ∨ R)', 'distributivity'],
  ['(P ∨ Q) ∧ (P ∨ R) → P ∨ (Q ∧ R)', 'distributivity'],
  ['¬(P ∨ Q) → ¬P ∧ ¬Q', 'De Morgan'],
  ['¬P ∧ ¬Q → ¬(P ∨ Q)', 'De Morgan'],
  ['¬P ∨ ¬Q → ¬(P ∧ Q)', 'De Morgan'],
  ['¬(P ∨ Q) ↔ ¬P ∧ ¬Q', 'De Morgan'],
  ['P → ¬P → Q', 'ex falso'],
  ['P ∧ ¬P → Q', 'ex falso'],
  ['¬(P ∧ ¬P)', 'non-contradiction'],
  ['P → ¬¬P', 'double negation'],
  ['¬¬¬P → ¬P', 'triple negation'],
  ['¬¬(P ∨ ¬P)', 'excluded middle'],
  ['¬¬(¬¬P → P)', 'double negation'],
  ['(¬P → P) → ¬¬P', 'double negation'],
  ['(P → ¬P) → ¬P', 'negation'],
  ['¬(P → Q) → ¬Q', 'negation'],
  ['¬(P ∨ Q) → ¬P', 'negation'],
  ['(P → Q) → (P → R) → P → Q ∧ R', 'conjunction'],
  ['(P → R) → (Q → R) → P ∨ Q → R', 'case split'],
  ['(P ∨ Q → R) → (P → R) ∧ (Q → R)', 'disjunction'],
  ['(P → R) ∧ (Q → R) → P ∨ Q → R', 'case split'],
  ['(P → Q ∧ R) → (P → Q) ∧ (P → R)', 'conjunction'],
  ['(P → Q) ∧ (P → R) → P → Q ∧ R', 'conjunction'],
  ['(P → Q) → P ∧ R → Q ∧ R', 'conjunction'],
  ['(P → Q) → P ∨ R → Q ∨ R', 'case split'],
  ['(P → Q) → (R → S) → P ∧ R → Q ∧ S', 'conjunction'],
  ['(P → Q) → (R → S) → P ∨ R → Q ∨ S', 'case split'],
  ['P ∧ (P → Q) → Q', 'modus ponens'],
  ['(P ↔ Q) → (Q ↔ P)', 'iff'],
  ['(P ↔ Q) → (Q ↔ R) → (P ↔ R)', 'iff'],
  ['(P ↔ Q) → ¬P → ¬Q', 'iff'],
  ['(P → Q) → (Q → P) → (P ↔ Q)', 'iff'],
  ['(P ↔ Q) → (P ∧ R ↔ Q ∧ R)', 'iff'],
  ['(P ↔ Q) → (P ∨ R ↔ Q ∨ R)', 'iff'],
  ['¬(P ↔ ¬P)', 'iff'],
  ['P ∨ Q → ¬P → Q', 'disjunctive syllogism'],
  ['¬P ∨ Q → P → Q', 'disjunction'],
  ['(P → Q) → (¬P → Q) → ¬¬Q', 'case split'],
  ['(True → P) → P', 'implication'],
  ['(P ∨ Q) ∧ ¬Q → P', 'disjunctive syllogism'],
  ['(P → Q) ∧ (Q → R) → (P → R)', 'chaining'],
  ['(P → Q ∨ R) → (Q → S) → (R → S) → P → S', 'case split'],
  ['(P ∧ Q → False) → P → ¬Q', 'negation'],
  ['(P → Q) ∨ (P → R) → P → Q ∨ R', 'case split'],
  ['¬¬(P → Q) → ¬¬P → ¬¬Q', 'double negation'],
  ['¬¬(P ∧ Q) → ¬¬P ∧ ¬¬Q', 'double negation'],
  ['¬¬P ∧ ¬¬Q → ¬¬(P ∧ Q)', 'double negation'],
  ['(P ∨ ¬P) → ¬¬P → P', 'excluded middle'],
  ['(P → Q) → ¬¬P → ¬¬Q', 'double negation'],
  ['¬¬¬¬P → ¬¬P', 'double negation'],
  ['¬(P → ¬Q) → ¬¬P', 'negation'],
  ['(P ∨ Q → R ∧ S) → (P → R) ∧ (Q → S)', 'conjunction'],
  ['((P ∨ ¬P) → Q) → ¬¬Q', 'excluded middle'],
  ['¬¬(P ∨ Q) → ¬P → ¬¬Q', 'double negation'],
  ['¬(P ∨ Q ∨ R) → ¬P ∧ ¬Q ∧ ¬R', 'De Morgan'],
  ['(P ∨ Q) ∧ (¬P ∨ R) → Q ∨ R', 'resolution'],
  ['(P → Q) ∧ (R → S) → (P ∨ R) → (Q ∨ S)', 'case split'],
  ['(P ∨ Q) ∧ (P → R) ∧ (Q → R) → R', 'case split'],
  ['(P ↔ Q) → (R ↔ S) → ((P → R) ↔ (Q → S))', 'iff'],
  ['(P ↔ Q) → (¬P ↔ ¬Q)', 'iff'],
  ['¬(P ∧ Q) → (P → ¬Q)', 'negation'],
  ['(P → ¬Q) → ¬(P ∧ Q)', 'negation'],
  ['(P → Q) → (P → ¬Q) → ¬P', 'negation'],
  ['(P ∨ Q) → (P → R) → (Q → S) → R ∨ S', 'case split'],
  // classical (only offered when classical reasoning is part of the puzzle)
  ['(P → Q ∨ R) → (P → Q) ∨ (P → R)', 'classical'],
  ['¬(P ↔ Q) → (P ↔ ¬Q)', 'classical'],
  ['((P → Q) → Q) → (Q → P) → P', 'classical'],
  ['¬¬P ∨ ¬P', 'classical'],
  ['(¬P → Q) → (¬Q → P)', 'contraposition'],
  ['¬(¬P ∧ ¬Q) → P ∨ Q', 'De Morgan'],
  ['¬¬P → P', 'double negation'],
  ['P ∨ ¬P', 'excluded middle'],
  ['((P → Q) → P) → P', "Peirce's law"],
  ['(¬P → P) → P', 'classical'],
  ['(¬Q → ¬P) → P → Q', 'contraposition'],
  ['(P → Q) → ¬P ∨ Q', 'material implication'],
  ['¬(P ∧ Q) → ¬P ∨ ¬Q', 'De Morgan'],
  ['¬(P → Q) → P', 'classical'],
  ['¬(P → Q) → P ∧ ¬Q', 'classical'],
  ['(P → Q) ∨ (Q → P)', 'classical'],
  ['(¬P → Q) → P ∨ Q', 'classical'],
  ['(P → Q) → (¬P → Q) → Q', 'case split'],
];

const PARSED = PROP_SCHEMAS.map(([s, tag]) => ({ f: parse(s), tag }));

/** Premises and conclusion of a curried statement. */
export function uncurry(f: F): { hyps: F[]; goal: F } {
  const hyps: F[] = [];
  let g = f;
  while (g.t === 'imp') {
    hyps.push(g.a);
    g = g.b;
  }
  return { hyps, goal: g };
}

/* ------------------------------------------------------------------ candidates */

export interface Cand {
  hyps: F[];
  goal: F;
  tag?: string;
}

/** Replace some atoms of a schema by small formulas (raises difficulty, adds variety). */
function substitute(rng: Rng, f: F, strength: number): F {
  const names = atomNames(f);
  const free = LETTERS.filter((l) => !names.includes(l));
  const m: Record<string, F> = {};
  const nSub = strength <= 0 ? 0 : Math.min(names.length, rng.int(strength + 1));
  for (const n of rng.shuffle(names).slice(0, nSub)) {
    const pool = [...names.filter((x) => x !== n), ...free];
    const y = atom(rng.pick(pool));
    const z = atom(n);
    m[n] = weighted<F>(rng, [
      [not(z), 4],
      [and(z, y), 2],
      [or(z, y), 2],
      [imp(y, z), 2],
      [not(not(z)), strength >= 2 ? 1 : 0],
    ]);
  }
  return substAtoms(f, m);
}

const CLASS = PARSED.map((s) => classify(s.f));

/**
 * A schema instance. `strength` controls atom substitution; `iffChance` turns a one-premise
 * schema whose converse also holds into an `↔`.
 */
export function schemaCand(rng: Rng, strength: number, classical: boolean, iffChance = 0, pool?: number[]): Cand {
  const idx = pool ?? PARSED.map((_, i) => i).filter((i) => classical || CLASS[i] === 'intuitionistic');
  const s = PARSED[rng.pick(idx)];
  // random letters, then substitution
  const names = atomNames(s.f);
  const perm = rng.shuffle(LETTERS.slice(0, Math.max(names.length, 2)));
  const renamed = substAtoms(s.f, Object.fromEntries(names.map((n, i) => [n, atom(perm[i])])));
  let f = substitute(rng, renamed, strength);
  if (iffChance > 0 && f.t === 'imp' && f.b.t !== 'imp' && rng.next() < iffChance) {
    const conv = imp(f.b, f.a);
    if (classify(conv) === 'intuitionistic' || (classical && classify(conv) === 'classical')) {
      return { hyps: [], goal: iff(f.a, f.b), tag: s.tag };
    }
  }
  return { ...uncurry(f), tag: s.tag };
}

/** Number of schemas (for target-aware pools). */
export const SCHEMA_COUNT = PARSED.length;
export const schemaClass = (i: number) => CLASS[i];

function randomFormula(rng: Rng, vars: string[], sz: number): F {
  if (sz <= 0) {
    const a = atom(rng.pick(vars));
    return rng.next() < 0.18 ? not(a) : a;
  }
  const c = weighted<string>(rng, [
    ['and', 3],
    ['or', 3],
    ['imp', 4],
    ['not', 1],
    ['iff', 0.6],
  ]);
  if (c === 'not') return not(randomFormula(rng, vars, sz - 1));
  const l = rng.int(sz);
  const a = randomFormula(rng, vars, l);
  const b = randomFormula(rng, vars, sz - 1 - l);
  return c === 'and' ? and(a, b) : c === 'or' ? or(a, b) : c === 'imp' ? imp(a, b) : iff(a, b);
}

/** Random hypotheses and goal; provability is checked by the caller. */
export function randomCand(rng: Rng, nVars: number, nHyps: number, hypSize: number, goalSize: number): Cand {
  const vars = LETTERS.slice(0, nVars) as unknown as string[];
  const hyps: F[] = [];
  for (let i = 0; i < nHyps; i++) hyps.push(randomFormula(rng, vars, rng.int(hypSize + 1)));
  const goal = randomFormula(rng, vars, Math.max(1, rng.int(goalSize + 1)));
  return { hyps, goal, tag: undefined };
}

/* ------------------------------------------------------------------ building */

export interface Built {
  header: string;
  solution: string;
  english: string;
  rating: number;
  hints: string[];
  themes: string[];
  classical: boolean;
  /** Statement as one formula (for dedupe / quick items). */
  statement: F;
  pf: Pf;
  lines: string[];
  /** Term proof (always computed for intuitionistic statements). */
  term?: string;
}

export interface BuildOpts {
  family: 'prop' | 'inhabit';
  mode: 'tactic' | 'term';
  /** Present premises as named hypotheses in the header. */
  hypStyle: boolean;
  allowClassical: boolean;
  allowTrivial: boolean;
  maxCost?: number;
}

const L: Lang = { style: {}, cases: 'cases' };

/** Check and dress a candidate. Returns null when it is rejected. */
export function buildProp(c: Cand, o: BuildOpts): Built | null {
  if (c.hyps.length > 4) return null;
  // canonical letters by first occurrence
  const ren = canonicalAtoms([...c.hyps, c.goal], LETTERS);
  if (Object.keys(ren).length > 4) return null;
  const m = Object.fromEntries(Object.entries(ren).map(([k, v]) => [k, atom(v)]));
  const hyps = c.hyps.map((h) => substAtoms(h, m));
  const goal = substAtoms(c.goal, m);
  const statement = imps(hyps, goal);
  if (size(statement) > 14) return null;
  const hk = hyps.map(key);
  if (new Set(hk).size !== hk.length || hk.includes(key(goal))) return null;
  // validity
  const v = classify(statement);
  if (v === 'invalid') return null;
  const classical = v === 'classical';
  if (classical && (!o.allowClassical || o.mode === 'term')) return null;
  if (!classical && g4ip(hyps, goal) !== true) return null;

  const vars = atomNames(statement).sort();
  const reserved = [...vars];
  const taken = new Set<string>(reserved);
  const named: Hyp[] = [];
  if (o.hypStyle) {
    for (const h of hyps) {
      const name = uniq(propNaming.hyp(h), taken);
      taken.add(name);
      named.push({ name, f: h });
    }
  }
  const searchGoal = o.hypStyle ? goal : statement;
  const prover = new Prover({
    naming: propNaming,
    classical,
    caseAtoms: vars.map((x) => atom(x)),
    maxCost: o.maxCost ?? 20,
    nodeLimit: 25000,
  });
  const res = prover.prove(named, [], searchGoal, [...reserved, ...named.map((h) => h.name)]);
  if (!res) return null;
  const pf = prune(res.pf);

  // every premise must be needed
  const used = usedNames(pf);
  if (o.hypStyle) {
    if (named.some((h) => !used.has(h.name))) return null;
  } else {
    let p: Pf = pf;
    for (let i = 0; i < hyps.length; i++) {
      if (p.k !== 'intro') return null;
      if (!usedNames(p.body).has(p.name)) return null;
      p = p.body;
    }
  }
  if (!spineUsesAll(pf)) return null;
  // the goal must not literally be a hypothesis
  let k: Pf = pf;
  while (k.k === 'intro' || k.k === 'andE') k = k.body;
  if (k.k === 'hyp' && !o.allowTrivial) return null;

  const lines = script(pf, L);
  const binders = `(${vars.join(' ')} : Prop)`;
  const hypBinders = named.map((h) => ` (${h.name} : ${show(h.f)})`).join('');
  const shown = show(searchGoal);
  const header =
    o.mode === 'tactic'
      ? `theorem puzzle ${binders}${hypBinders} : ${shown} := by`
      : `theorem puzzle ${binders}${hypBinders} : ${shown} :=`;
  const term = classical ? undefined : termOf(pf, L);
  const solution = o.mode === 'tactic' ? lines.map((l) => '  ' + l).join('\n') : term!;

  const st = stats(pf);
  const sf = statementFeatures([statement]);
  const feat: Features = { lines: lines.length, stats: st, ...sf, family: o.family, mode: o.mode };
  const rating = rate(feat);
  const english = sentence(hyps, goal);
  const hints =
    o.mode === 'tactic'
      ? makeHints({ goal: searchGoal, pf, L, lines })
      : termHints(searchGoal, pf, term!);
  const themes = makeThemes([statement], st, c.tag ? [c.tag] : []);
  return { header, solution, english, rating, hints, themes, classical, statement, pf, lines, term };
}

/** Hints for term-mode proofs. */
export function termHints(goal: F, pf: Pf, term: string): string[] {
  const shape =
    goal.t === 'imp' || goal.t === 'not'
      ? 'The type is a function type (a negation `¬A` is `A → False`): start with `fun … =>`.'
      : goal.t === 'and' || goal.t === 'iff'
        ? 'Build the pair with the anonymous constructor `⟨_, _⟩`.'
        : goal.t === 'or'
          ? 'Choose a side: `Or.inl` or `Or.inr`.'
          : 'Combine the hypotheses by application.';
  let k: Pf = pf;
  while (k.k === 'intro' || k.k === 'andE') k = k.body;
  const ideaText: Record<string, string> = {
    orE: 'A disjunction is used with `Or.elim h (fun a => …) (fun b => …)`: one function per case.',
    app: 'Apply a hypothesis to arguments, like a function: `h a`.',
    exfalso: 'From a contradiction you get anything: `absurd a na` or `False.elim (na a)`.',
    inl: '`Or.inl` proves the left side of a disjunction.',
    inr: '`Or.inr` proves the right side of a disjunction.',
    and: '`⟨a, b⟩` builds a conjunction (or pair); `h.1` and `h.2` take one apart.',
    iff: 'An `↔` is a pair of functions: `⟨fun a => …, fun b => …⟩`.',
    have: 'Apply a hypothesis first, then take the result apart with `.1` / `.2` or `Or.elim`.',
    hyp: 'Once you have named the arguments, one of them is the answer.',
  };
  const flat = term.trim().replace(/\s+/g, ' ');
  const cut = flat.length > 24 ? flat.slice(0, Math.max(14, Math.floor(flat.length / 2))) + ' …' : flat.split('=>')[0] + '=> …';
  const out = [shape, ideaText[k.k] ?? 'Follow the types: each hypothesis is a function you can apply.'];
  if (flat.length > 18) out.push('The term can begin like this:\n```lean\n' + cut + '\n```');
  return out;
}

/* ------------------------------------------------------------------ generation */

let baseTable: number[] | null = null;
/** Rating of each schema without substitution (computed once; deterministic). */
export function schemaBase(): number[] {
  if (baseTable) return baseTable;
  baseTable = PARSED.map((s, i) => {
    const { hyps, goal } = uncurry(s.f);
    const b = buildProp(
      { hyps, goal },
      { family: 'prop', mode: 'tactic', hypStyle: false, allowClassical: true, allowTrivial: true, maxCost: 26 },
    );
    return b ? b.rating : -1;
  });
  return baseTable;
}

/** One candidate attempt for a target rating. */
export function propAttempt(rng: Rng, target: number, mode: 'tactic' | 'term', family: 'prop' | 'inhabit'): Built | null {
  const base = schemaBase();
  const classicalOk = mode === 'tactic' && target >= 1400 && rng.next() < 0.35;
  const randomShare = target < 650 ? 0.5 : target < 1300 ? 0.25 : 0.1;
  let cand: Cand;
  if (rng.next() >= randomShare) {
    const lo = target - (target < 800 ? 350 : 900);
    const hi = target + 60;
    let pool = base
      .map((r, i) => [r, i] as const)
      .filter(([r, i]) => r > 0 && r >= lo && r <= hi && (classicalOk || CLASS[i] === 'intuitionistic'))
      .map(([, i]) => i);
    if (pool.length === 0) {
      pool = base.map((_, i) => i).filter((i) => base[i] > 0 && (classicalOk || CLASS[i] === 'intuitionistic'));
    }
    const i = rng.pick(pool);
    const gap = target - base[i];
    const strength = gap < 100 ? rng.int(2) : gap < 350 ? 1 + rng.int(2) : gap < 650 ? 2 : 3;
    const iffChance = target >= 1300 ? 0.5 : 0;
    cand = schemaCand(rng, strength, classicalOk, iffChance, [i]);
  } else {
    const t = Math.max(0, Math.min(1, (target - 400) / 1200));
    const nVars = 2 + (rng.next() < t ? 1 : 0);
    const nHyps = rng.int(2 + Math.round(2 * t)) + (t > 0.3 ? 1 : 0);
    cand = randomCand(rng, nVars, nHyps, 1 + Math.round(2 * t), 1 + Math.round(3 * t));
  }
  const hypStyle = cand.hyps.length > 0 && rng.next() < 0.5;
  return buildProp(cand, {
    family,
    mode,
    hypStyle,
    allowClassical: classicalOk,
    allowTrivial: target < 520,
    maxCost: target >= 1500 ? 26 : 20,
  });
}

/** Search candidates from the seed's stream; first within ±tol of target, else the closest. */
export function searchTarget<T extends { rating: number }>(
  rng: Rng,
  target: number,
  attempt: (r: Rng) => T | null,
  maxAttempts = 70,
  tol = 90,
): T | null {
  let best: T | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const b = attempt(rng.fork('attempt' + i));
    if (!b) continue;
    if (Math.abs(b.rating - target) <= tol) return b;
    if (!best || Math.abs(b.rating - target) < Math.abs(best.rating - target)) best = b;
  }
  return best;
}
