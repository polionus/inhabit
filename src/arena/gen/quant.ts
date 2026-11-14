/**
 * `quant` family: first-order statements over `(α : Type) (p q s : α → Prop) (r : α → α → Prop)`.
 * Candidates come from a schema library and from lifting propositional theorems pointwise
 * (`(∀ x, φ x) → ∀ x, ψ x`, `(∃ x, φ x) → ∃ x, ψ x`, mixed). The readable prover finds the proof.
 */
import type { Rng } from '../types.ts';
import { all, atom, ex, freeVars, imps, key, parse, show, substAtoms } from './logic.ts';
import type { F } from './logic.ts';
import { Prover, prune, spineUsesAll, stats, uniq, usedNames } from './search.ts';
import type { Hyp, Pf } from './search.ts';
import { script } from './emit.ts';
import type { Lang } from './emit.ts';
import { sentence } from './english.ts';
import { makeHints, makeThemes, propNaming, rate, statementFeatures } from './common.ts';
import { PROP_SCHEMAS, PROP_TACTICS, uncurry } from './prop.ts';
import type { Built } from './prop.ts';
import { tidy } from './tidy.ts';
import { classify, atomNames } from './logic.ts';

export const QUANT_TACTICS = [...PROP_TACTICS, 'use', 'specialize', 'exists'];

/** [statement, tag, classical?] */
export const QUANT_SCHEMAS: readonly (readonly [string, string, boolean?])[] = [
  ['(∀ x, p x) → p a', 'instantiation'],
  ['(∀ x, p x → q x) → p a → q a', 'instantiation'],
  ['p a → ∃ x, p x', 'witness'],
  ['(∀ x, p x ∧ q x) → q a', 'instantiation'],
  ['p a → q a → ∃ x, p x ∧ q x', 'witness'],
  ['(∀ x, p x) → (∀ x, q x) → p a ∧ q a', 'instantiation'],
  ['(∀ x, p x → q x) → (∀ x, p x) → q a', 'instantiation'],
  ['(∀ x y, r x y) → r a b', 'instantiation'],
  ['r a a → ∃ x, r x x', 'witness'],
  ['r a b → ∃ x y, r x y', 'witness'],
  ['r a b → ∃ x, r a x', 'witness'],
  ['(∀ x, p x) → p a ∨ q a', 'instantiation'],
  ['p a ∨ q a → ∃ x, p x ∨ q x', 'witness'],
  ['(∀ x, ¬p x) → ¬p a', 'instantiation'],
  ['¬p a → ¬∀ x, p x', 'quantifier negation'],
  ['(∃ x, p x ∧ q x) → ∃ x, q x ∧ p x', 'exists'],
  ['(∀ x, r x a) → ∃ x, r x a', 'witness'],
  ['(∀ x, p x → q x) → ¬q a → ¬p a', 'contraposition'],
  ['(∀ x, p x → q x) → (∀ x, p x) → ∀ x, q x', 'forall'],
  ['(∃ x, p x ∧ q x) → ∃ x, p x', 'exists'],
  ['(∃ x, p x ∧ q x) → (∃ x, p x) ∧ (∃ x, q x)', 'exists'],
  ['¬(∃ x, p x) → ∀ x, ¬p x', 'quantifier negation'],
  ['(∀ x, ¬p x) → ¬∃ x, p x', 'quantifier negation'],
  ['(∃ x, ¬p x) → ¬∀ x, p x', 'quantifier negation'],
  ['(∀ x, p x) → ¬∃ x, ¬p x', 'quantifier negation'],
  ['(∃ x, p x) → ¬∀ x, ¬p x', 'quantifier negation'],
  ['(∀ x, p x ∧ q x) → (∀ x, p x) ∧ (∀ x, q x)', 'forall'],
  ['(∀ x, p x) ∧ (∀ x, q x) → ∀ x, p x ∧ q x', 'forall'],
  ['(∀ x, p x) ∨ (∀ x, q x) → ∀ x, p x ∨ q x', 'forall'],
  ['(∃ x, p x ∨ q x) → (∃ x, p x) ∨ (∃ x, q x)', 'exists'],
  ['(∃ x, p x) ∨ (∃ x, q x) → ∃ x, p x ∨ q x', 'exists'],
  ['(∃ x, ∀ y, r x y) → ∀ y, ∃ x, r x y', 'quantifier swap'],
  ['(∀ x y, r x y) → ∀ y x, r x y', 'quantifier swap'],
  ['(∃ x y, r x y) → ∃ y x, r x y', 'quantifier swap'],
  ['(∀ x, r x x) → ∀ x, ∃ y, r x y', 'relations'],
  ['(∀ x, p x → q x) → (∃ x, p x) → ∃ x, q x', 'exists'],
  ['(∀ x, p x → q x) → (∀ x, ¬q x) → ∀ x, ¬p x', 'contraposition'],
  ['(∃ x, p x) → (∀ x, p x → q x) → ∃ x, p x ∧ q x', 'exists'],
  ['(∀ x, P → p x) → P → ∀ x, p x', 'forall'],
  ['(P → ∀ x, p x) → ∀ x, P → p x', 'forall'],
  ['(∃ x, P ∧ p x) → P ∧ ∃ x, p x', 'exists'],
  ['P ∧ (∃ x, p x) → ∃ x, P ∧ p x', 'exists'],
  ['(∃ x, P → p x) → P → ∃ x, p x', 'exists'],
  ['(∀ x, p x ↔ q x) → (∀ x, p x) → ∀ x, q x', 'iff'],
  ['(∀ x, p x → q x) → (∀ x, q x → s x) → ∀ x, p x → s x', 'chaining'],
  ['(∀ x y, r x y → r y x) → (∃ x y, r x y) → ∃ x y, r y x', 'relations'],
  ['(∀ x, ∃ y, r x y) → (∀ x y, r x y → p y) → ∀ x, ∃ y, p y', 'relations'],
  ['(∀ x y z, r x y → r y z → r x z) → r a b → r b c → r a c', 'transitivity'],
  ['(∀ x y, r x y → r y x) → (∀ x y z, r x y → r y z → r x z) → r a b → r a a', 'relations'],
  ['(∀ x, ∃ y, r x y) → (∀ x y, r x y → r y x) → ∀ x, ∃ y, r y x', 'relations'],
  ['(∀ x, p x ∨ q x) → (∀ x, ¬p x) → ∀ x, q x', 'case split'],
  ['(∃ x, p x) → (∀ x y, p x → r x y) → ∀ y, ∃ x, r x y', 'relations'],
  ['(∀ x, p x → ¬q x) → ¬∃ x, p x ∧ q x', 'quantifier negation'],
  ['¬(∃ x, p x ∨ q x) → (∀ x, ¬p x) ∧ (∀ x, ¬q x)', 'quantifier negation'],
  ['(∀ x, p x → q x) → (∀ x, p x → s x) → ∀ x, p x → q x ∧ s x', 'forall'],
  ['(∃ x, p x ∧ ∀ y, r x y) → ∃ x, r x x', 'relations'],
  ['(∀ x, ¬¬p x) → ¬∃ x, ¬p x', 'double negation'],
  ['¬¬(∀ x, p x) → ∀ x, ¬¬p x', 'double negation'],
  ['¬(∀ x, p x) → ∃ x, ¬p x', 'quantifier negation', true],
  ['¬(∀ x, ¬p x) → ∃ x, p x', 'quantifier negation', true],
  ['(∀ x, ¬¬p x) → ∀ x, p x', 'double negation', true],
  ['¬(∃ x, ¬p x) → ∀ x, p x', 'quantifier negation', true],
];

const PARSED = QUANT_SCHEMAS.map(([s, tag, cl]) => ({ f: parse(s), tag, classical: !!cl }));

/** Intuitionistic prop schemas over at most three letters, to lift pointwise. */
const LIFTABLE = PROP_SCHEMAS.map(([s, tag]) => ({ f: parse(s), tag })).filter(
  (s) =>
    classify(s.f) === 'intuitionistic' &&
    atomNames(s.f).length <= 3 &&
    !atomNames(s.f).includes('S') &&
    !/True|False/.test(show(s.f)) &&
    s.tag !== 'associativity',
);
const PRED: Record<string, string> = { P: 'p', Q: 'q', R: 's' };

const L: Lang = { style: {}, cases: 'cases' };

export interface QCand {
  hyps: F[];
  goal: F;
  tag: string;
  classical: boolean;
}

function liftCand(rng: Rng, target: number): QCand | null {
  const s = rng.pick(LIFTABLE);
  // lifting a double-negation law sprays ¬¬ over every predicate: keep that occasional
  if (s.tag === 'double negation' && rng.next() < 0.75) return null;
  const at = (x: string) => Object.fromEntries(atomNames(s.f).map((n) => [n, atom(PRED[n], x)]));
  const { hyps, goal } = uncurry(s.f);
  const pt = (f: F) => substAtoms(f, at('x'));
  const mode = rng.int(hyps.length === 1 ? 3 : 2);
  if (hyps.length === 0) return { hyps: [], goal: all('x', pt(goal)), tag: s.tag, classical: false };
  if (mode === 0 || (hyps.length > 2 && target < 1500)) {
    return { hyps: hyps.map((h) => all('x', pt(h))), goal: all('x', pt(goal)), tag: s.tag, classical: false };
  }
  if (hyps.length === 1) return { hyps: [ex('x', pt(hyps[0]))], goal: ex('x', pt(goal)), tag: s.tag, classical: false };
  // mixed: one premise is existential, the others universal
  const j = rng.int(hyps.length);
  return {
    hyps: hyps.map((h, i) => (i === j ? ex('x', pt(h)) : all('x', pt(h)))),
    goal: ex('x', pt(goal)),
    tag: s.tag,
    classical: false,
  };
}

/** Rename predicate letters by first occurrence (p q s), so statements read naturally. */
function canonPreds(fs: F[]): F[] {
  const seen: string[] = [];
  const walk = (f: F): void => {
    if (f.t === 'atom') {
      if (f.args.length === 1 && !seen.includes(f.p)) seen.push(f.p);
    } else if (f.t === 'not' || f.t === 'all' || f.t === 'ex') walk(f.a);
    else if (f.t === 'and' || f.t === 'or' || f.t === 'imp' || f.t === 'iff') {
      walk(f.a);
      walk(f.b);
    }
  };
  fs.forEach(walk);
  const names = ['p', 'q', 's'];
  const m: Record<string, string> = {};
  seen.forEach((p, i) => (m[p] = names[i]));
  const ren = (f: F): F => {
    switch (f.t) {
      case 'atom':
        return f.args.length === 1 && m[f.p] ? { t: 'atom', p: m[f.p], args: f.args } : f;
      case 'bot':
      case 'top':
        return f;
      case 'not':
        return { t: 'not', a: ren(f.a) };
      case 'all':
      case 'ex':
        return { t: f.t, x: f.x, a: ren(f.a) };
      default:
        return { t: f.t, a: ren(f.a), b: ren(f.b) };
    }
  };
  return fs.map(ren);
}

function arities(f: F, out: Map<string, number>): void {
  if (f.t === 'atom') out.set(f.p, f.args.length);
  else if (f.t === 'not' || f.t === 'all' || f.t === 'ex') arities(f.a, out);
  else if (f.t === 'and' || f.t === 'or' || f.t === 'imp' || f.t === 'iff') {
    arities(f.a, out);
    arities(f.b, out);
  }
}

export function buildQuant(c: QCand, o: { hypStyle: boolean; contraOk?: boolean }): Built | null {
  const fs = canonPreds([...c.hyps, c.goal]);
  const hyps = fs.slice(0, -1);
  const goal = fs[fs.length - 1];
  const statement = imps(hyps, goal);
  if (!tidy(statement, { contraOk: o.contraOk })) return null;
  const hk = hyps.map(key);
  if (new Set(hk).size !== hk.length) return null;
  const ar = new Map<string, number>();
  arities(statement, ar);
  const elems = [...freeVars(statement)].sort();
  const props = [...ar].filter(([, n]) => n === 0).map(([p]) => p).sort();
  const unary = [...ar].filter(([, n]) => n === 1).map(([p]) => p).sort();
  const binary = [...ar].filter(([, n]) => n === 2).map(([p]) => p).sort();
  let binders = '(α : Type)';
  if (unary.length) binders += ` (${unary.join(' ')} : α → Prop)`;
  if (binary.length) binders += ` (${binary.join(' ')} : α → α → Prop)`;
  if (props.length) binders += ` (${props.join(' ')} : Prop)`;
  if (elems.length) binders += ` (${elems.join(' ')} : α)`;

  const reserved = ['α', ...unary, ...binary, ...props, ...elems];
  const taken = new Set(reserved);
  const named: Hyp[] = [];
  if (o.hypStyle) {
    for (const h of hyps) {
      const name = uniq(propNaming.hyp(h), taken);
      taken.add(name);
      named.push({ name, f: h });
    }
  }
  const searchGoal = o.hypStyle ? goal : statement;
  const prover = new Prover({ naming: propNaming, classical: c.classical, maxCost: 22, nodeLimit: 25000 });
  const res = prover.prove(named, elems, searchGoal, [...taken]);
  if (!res) return null;
  const pf = prune(res.pf);
  const used = usedNames(pf);
  if (named.some((h) => !used.has(h.name))) return null;
  if (!o.hypStyle && !spineUsesAll(pf)) return null;
  let k: Pf = pf;
  while (k.k === 'intro' || k.k === 'andE') k = k.body;
  if (k.k === 'hyp') return null;

  const lines = script(pf, L);
  const header = `theorem puzzle ${binders}${named.map((h) => ` (${h.name} : ${show(h.f)})`).join('')} : ${show(searchGoal)} := by`;
  const st = stats(pf);
  const sf = statementFeatures([statement]);
  const rating = rate({ lines: lines.length, stats: st, ...sf, family: 'quant', mode: 'tactic' });
  return {
    header,
    solution: lines.map((l) => '  ' + l).join('\n'),
    english: sentence(hyps, goal),
    rating,
    hints: makeHints({ goal: searchGoal, pf, L, lines }),
    themes: makeThemes([statement], st, [c.tag]),
    classical: c.classical,
    statement,
    pf,
    lines,
  };
}

export function quantAttempt(rng: Rng, target: number): Built | null {
  let c: QCand | null;
  if (rng.next() < 0.55) {
    const pool = PARSED.filter((s) => !s.classical || target >= 1500);
    const s = rng.pick(pool);
    const { hyps, goal } = uncurry(s.f);
    c = { hyps, goal, tag: s.tag, classical: s.classical };
  } else c = liftCand(rng, target);
  if (!c) return null;
  return buildQuant(c, { hypStyle: c.hyps.length > 0 && rng.next() < 0.5, contraOk: target < 800 });
}
