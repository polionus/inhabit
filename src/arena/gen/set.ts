/**
 * `set` family: set-algebra facts over `(α : Type) (A B C : Set α)`, from translating propositional
 * theorems elementwise (∧ → ∩, ∨ → ∪, ¬ → ᶜ, implication → ⊆, iff → = via `ext`) and from random
 * set expressions filtered by G4ip. Proofs work at the element level: `intro x hx`, then the
 * propositional proof on memberships (the tactics see through `∈ ∩ ∪ ᶜ \`).
 */
import type { Rng } from '../types.ts';
import { weighted } from './rng.ts';
import { and, atom, atomNames as atomNamesOf, bot, g4ip, iff, imp, key, not, or, parse, substAtoms, top } from './logic.ts';
import type { Atom, F } from './logic.ts';
import { Prover, prune, spineUsesAll, stats, usedNames } from './search.ts';
import type { Hyp, Naming, Pf } from './search.ts';
import { script } from './emit.ts';
import type { Lang } from './emit.ts';
import { makeHints, makeThemes, rate, statementFeatures } from './common.ts';
import { PROP_SCHEMAS, PROP_TACTICS, uncurry } from './prop.ts';
import type { Built } from './prop.ts';
import { commute, tidy } from './tidy.ts';
import { imps } from './logic.ts';
import { classify } from './logic.ts';

export const SET_TACTICS = [...PROP_TACTICS, 'ext'];

export type SE =
  | { t: 'set'; n: string }
  | { t: 'inter' | 'union' | 'diff'; a: SE; b: SE }
  | { t: 'compl'; a: SE }
  | { t: 'empty' }
  | { t: 'univ' };

const S = (n: string): SE => ({ t: 'set', n });

/** Membership `x ∈ e` as a proposition over atoms `x ∈ A`. */
export function mem(e: SE): F {
  switch (e.t) {
    case 'set':
      return atom(e.n, 'x');
    case 'inter':
      return and(mem(e.a), mem(e.b));
    case 'union':
      return or(mem(e.a), mem(e.b));
    case 'diff':
      return and(mem(e.a), not(mem(e.b)));
    case 'compl':
      return not(mem(e.a));
    case 'empty':
      return bot;
    case 'univ':
      return top;
  }
}

/** Lean source; mixed ∩/∪ are bracketed for readability. */
export function showSE(e: SE, parent: SE['t'] | 'top' = 'top', right = false): string {
  switch (e.t) {
    case 'set':
      return e.n;
    case 'empty':
      return '∅';
    case 'univ':
      return 'Set.univ';
    case 'compl': {
      const a = e.a.t === 'set' || e.a.t === 'compl' ? showSE(e.a) : '(' + showSE(e.a) + ')';
      return a + 'ᶜ';
    }
    default: {
      const op = e.t === 'inter' ? ' ∩ ' : e.t === 'union' ? ' ∪ ' : ' \\ ';
      const s = showSE(e.a, e.t, false) + op + showSE(e.b, e.t, true);
      const bare = parent === 'top' || (parent === e.t && !right && e.t !== 'diff');
      return bare ? s : '(' + s + ')';
    }
  }
}

/** Noun phrase. */
export function nounSE(e: SE): string {
  const simple = (x: SE) => x.t === 'set' || x.t === 'empty' || x.t === 'univ' || (x.t === 'compl' && x.a.t === 'set');
  switch (e.t) {
    case 'set':
      return e.n;
    case 'empty':
      return 'the empty set';
    case 'univ':
      return 'the universal set';
    case 'compl':
      return 'the complement of ' + nounSE(e.a);
    case 'inter':
      return simple(e.a) && simple(e.b)
        ? `the intersection of ${nounSE(e.a)} and ${nounSE(e.b)}`
        : `the intersection of ${nounSE(e.a)} with ${nounSE(e.b)}`;
    case 'union':
      return simple(e.a) && simple(e.b)
        ? `the union of ${nounSE(e.a)} and ${nounSE(e.b)}`
        : `the union of ${nounSE(e.a)} with ${nounSE(e.b)}`;
    case 'diff':
      return `${nounSE(e.a)} minus ${nounSE(e.b)}`;
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const setStyle = {
  atom: (a: Atom) => `${a.args[0] ?? 'x'} ∈ ${a.p}`,
  notAtom: (a: Atom) => `${a.args[0] ?? 'x'} ∉ ${a.p}`,
};

export const setNaming: Naming = {
  hyp(f: F) {
    if (f.t === 'atom') return 'h' + f.p.toLowerCase();
    if (f.t === 'not' && f.a.t === 'atom') return 'hn' + f.a.p.toLowerCase();
    if (f.t === 'bot') return 'he';
    if ((f.t === 'and' || f.t === 'or') && f.a.t === 'atom' && f.b.t === 'atom') return 'h' + f.a.p.toLowerCase() + f.b.p.toLowerCase();
    return 'h';
  },
};

const L: Lang = { style: setStyle, cases: 'cases' };

/* ------------------------------------------------------------------ candidates */

export interface SetCand {
  /** `lhs ⊆ rhs` hypotheses */
  hyps: [SE, SE][];
  lhs: SE;
  rhs: SE;
  eq: boolean;
  tag?: string;
}

/** Translate a propositional formula built from ∧ ∨ ¬ False True into a set expression. */
function toSE(f: F, m: Record<string, string>): SE | null {
  switch (f.t) {
    case 'atom':
      return S(m[f.p]);
    case 'bot':
      return { t: 'empty' };
    case 'top':
      return { t: 'univ' };
    case 'not': {
      const a = toSE(f.a, m);
      return a && { t: 'compl', a };
    }
    case 'and': {
      if (f.b.t === 'not') {
        const a = toSE(f.a, m);
        const b = toSE(f.b.a, m);
        if (a && b && b.t === 'set') return { t: 'diff', a, b };
      }
      const a = toSE(f.a, m);
      const b = toSE(f.b, m);
      return a && b && { t: 'inter', a, b };
    }
    case 'or': {
      const a = toSE(f.a, m);
      const b = toSE(f.b, m);
      return a && b && { t: 'union', a, b };
    }
    default:
      return null;
  }
}

/** Textbook set identities and subset facts, written as their elementwise propositions. */
const SET_LAWS: readonly (readonly [string, string])[] = [
  ['P ∧ (Q ∨ R) ↔ (P ∧ Q) ∨ (P ∧ R)', 'distributivity'],
  ['P ∨ (Q ∧ R) ↔ (P ∨ Q) ∧ (P ∨ R)', 'distributivity'],
  ['(P ∧ ¬Q) ∧ ¬R ↔ P ∧ ¬(Q ∨ R)', 'difference'],
  ['P ∧ ¬(Q ∨ R) ↔ (P ∧ ¬Q) ∧ (P ∧ ¬R)', 'difference'],
  ['(P ∨ Q) ∧ ¬R ↔ (P ∧ ¬R) ∨ (Q ∧ ¬R)', 'difference'],
  ['(P ∧ Q) ∧ ¬R ↔ P ∧ (Q ∧ ¬R)', 'difference'],
  ['(P ∧ ¬Q) ∨ (Q ∧ ¬P) → P ∨ Q', 'symmetric difference'],
  ['(P ∧ ¬Q) ∨ (Q ∧ ¬P) → ¬(P ∧ Q)', 'symmetric difference'],
  ['P ∧ ¬Q ↔ P ∧ ¬(P ∧ Q)', 'difference'],
  ['(P → Q) → ¬Q ∧ R → ¬P ∧ R', 'complement'],
  ['(P → Q) → (Q → R) → P ∧ ¬R → False', 'subset'],
  ['(P → Q) → (P ∧ R) ∨ (Q ∧ R) → Q ∧ R', 'subset'],
  ['(P → Q) → P ∧ ¬Q → R', 'subset'],
  ['(P → Q) → P ∧ ¬R → Q ∧ ¬R', 'difference'],
  ['(P → Q) → R ∧ ¬Q → R ∧ ¬P', 'difference'],
  ['(P → R) → (Q → R) → P ∨ Q → R', 'subset'],
  ['(P → Q) → (P → R) → P → Q ∧ R', 'subset'],
  ['(P ∨ Q) ∧ ¬P → Q', 'difference'],
  ['(P ∨ Q) ∧ (P ∨ R) ∧ ¬P → Q ∧ R', 'difference'],
  ['¬(P ∨ Q ∨ R) ↔ ¬P ∧ ¬Q ∧ ¬R', 'De Morgan'],
];

const TRANSLATABLE = [...PROP_SCHEMAS, ...SET_LAWS].map(([s, tag]) => ({ f: parse(s), tag })).filter((s) => {
  if (classify(s.f) !== 'intuitionistic' || atomNamesOf(s.f).includes('S')) return false;
  return translate(s.f, { P: 'A', Q: 'B', R: 'C', S: 'D' }) !== null;
});

function translate(f: F, m: Record<string, string>): SetCand | null {
  if (f.t === 'iff') {
    const l = toSE(f.a, m);
    const r = toSE(f.b, m);
    return l && r ? { hyps: [], lhs: l, rhs: r, eq: true } : null;
  }
  const { hyps, goal } = uncurry(f);
  // last premise + goal form the ⊆; the others must be implications between sets
  if (hyps.length === 0) return null;
  const lhs = toSE(hyps[hyps.length - 1], m);
  const rhs = toSE(goal, m);
  if (!lhs || !rhs) return null;
  const hs: [SE, SE][] = [];
  for (const h of hyps.slice(0, -1)) {
    if (h.t !== 'imp') return null;
    const a = toSE(h.a, m);
    const b = toSE(h.b, m);
    if (!a || !b) return null;
    hs.push([a, b]);
  }
  return { hyps: hs, lhs, rhs, eq: false };
}

function randomSE(rng: Rng, sets: string[], sz: number): SE {
  if (sz <= 0) {
    const r = rng.next();
    if (r < 0.04) return { t: 'empty' };
    return S(rng.pick(sets));
  }
  const c = weighted<string>(rng, [
    ['inter', 4],
    ['union', 4],
    ['compl', 1.5],
    ['diff', 1.5],
  ]);
  if (c === 'compl') return { t: 'compl', a: randomSE(rng, sets, sz - 1) };
  const l = rng.int(sz);
  const a = randomSE(rng, sets, l);
  const b = c === 'diff' ? S(rng.pick(sets)) : randomSE(rng, sets, sz - 1 - l);
  return { t: c as 'inter' | 'union' | 'diff', a, b };
}

/* ------------------------------------------------------------------ building */

function setsIn(e: SE, out: Set<string>): Set<string> {
  if (e.t === 'set') out.add(e.n);
  else if (e.t === 'compl') setsIn(e.a, out);
  else if (e.t === 'inter' || e.t === 'union' || e.t === 'diff') {
    setsIn(e.a, out);
    setsIn(e.b, out);
  }
  return out;
}

function renameSE(e: SE, m: Record<string, string>): SE {
  switch (e.t) {
    case 'set':
      return S(m[e.n] ?? e.n);
    case 'compl':
      return { t: 'compl', a: renameSE(e.a, m) };
    case 'inter':
    case 'union':
    case 'diff':
      return { t: e.t, a: renameSE(e.a, m), b: renameSE(e.b, m) };
    default:
      return e;
  }
}

export function buildSet(c0: SetCand, o: { hypStyle: boolean; contraOk?: boolean; doubleNegOk?: boolean }): Built | null {
  // canonical set names by first occurrence
  const order: string[] = [];
  for (const e of [...c0.hyps.flat(), c0.lhs, c0.rhs]) for (const n of setsIn(e, new Set())) if (!order.includes(n)) order.push(n);
  if (order.length > 3) return null;
  const complDepth = (e: SE): number =>
    e.t === 'compl' ? 1 + complDepth(e.a) : e.t === 'inter' || e.t === 'union' || e.t === 'diff' ? Math.max(complDepth(e.a), complDepth(e.b)) : 0;
  if ([...c0.hyps.flat(), c0.lhs, c0.rhs].some((e) => complDepth(e) > 2)) return null;
  // no `B ∩ B`, `B ∪ B`, `B \ B`-style padding, and statements short enough to read
  const idem = (e: SE): boolean =>
    e.t === 'compl'
      ? idem(e.a)
      : e.t === 'inter' || e.t === 'union' || e.t === 'diff'
        ? showSE(e.a) === showSE(e.b) || idem(e.a) || idem(e.b)
        : false;
  if ([...c0.hyps.flat(), c0.lhs, c0.rhs].some(idem)) return null;
  if (showSE(c0.lhs).length + showSE(c0.rhs).length > 44) return null;
  const m = Object.fromEntries(order.map((n, i) => [n, 'ABC'[i]]));
  const hyps = c0.hyps.map(([a, b]) => [renameSE(a, m), renameSE(b, m)] as [SE, SE]);
  const lhs = renameSE(c0.lhs, m);
  const rhs = renameSE(c0.rhs, m);
  const sets = [...order.map((n) => m[n])].sort();
  if (sets.length === 0) return null;
  const L0 = mem(lhs);
  const R0 = mem(rhs);
  if (key(L0) === key(R0)) return null;
  const hypF = hyps.map(([a, b]) => imp(mem(a), mem(b)));
  if (!tidy(imps(hypF, c0.eq ? iff(L0, R0) : imp(L0, R0)), { contraOk: o.contraOk, maxDoubles: o.doubleNegOk ? 1 : 0 })) return null;
  if (c0.eq) {
    if (g4ip(hypF, iff(L0, R0)) !== true) return null;
  } else if (g4ip([...hypF, L0], R0) !== true) return null;
  const subset = (a: SE, b: SE) => `${showSE(a)} ⊆ ${showSE(b)}`;

  const hypNames = hyps.length === 1 ? ['h'] : hyps.map((_, i) => 'h' + '₁₂₃'[i]);
  const named: Hyp[] = hypF.map((f, i) => ({ name: hypNames[i], f }));
  const prover = new Prover({ naming: setNaming, maxCost: 22, nodeLimit: 25000 });
  const reserved = ['α', 'x', ...sets, ...hypNames];
  let pf: Pf;
  let lines: string[];
  if (c0.eq) {
    const res = prover.prove(named, ['x'], iff(L0, R0), reserved);
    if (!res) return null;
    pf = prune(res.pf);
    if (pf.k !== 'iff') return null;
    lines = ['ext x', ...script(pf, L)];
  } else {
    const hx: Hyp = { name: 'hx', f: L0 };
    const res = prover.prove([...named, hx], ['x'], R0, [...reserved, 'hx']);
    if (!res) return null;
    pf = prune(res.pf);
    const intro = ['intro', ...(o.hypStyle ? [] : hypNames), 'x', 'hx'].join(' ');
    const rest = script(pf, L);
    // `intro x hx` followed by `intro ha` reads better as one line
    if (rest[0].startsWith('intro ')) lines = [intro + rest[0].slice(5), ...rest.slice(1)];
    else lines = [intro, ...rest];
  }
  const used = usedNames(pf);
  if (hypNames.some((n) => !used.has(n))) return null;
  if (!c0.eq && !used.has('hx')) return null;
  if (!spineUsesAll(pf)) return null;
  let k: Pf = pf;
  while (k.k === 'intro' || k.k === 'andE') k = k.body;
  if (k.k === 'hyp') return null;

  const goalText = c0.eq ? `${showSE(lhs)} = ${showSE(rhs)}` : subset(lhs, rhs);
  const hypText = hyps.map(([a, b]) => subset(a, b));
  const binders = `(α : Type) (${sets.join(' ')} : Set α)`;
  const header = o.hypStyle
    ? `theorem puzzle ${binders}${hypText.map((t, i) => ` (${hypNames[i]} : ${t})`).join('')} : ${goalText} := by`
    : `theorem puzzle ${binders} : ${[...hypText, goalText].join(' → ')} := by`;

  const st = stats(pf);
  const statementF = c0.eq ? iff(L0, R0) : imp(L0, R0);
  const sf = statementFeatures([statementF, ...hypF]);
  const rating = rate({ lines: lines.length, stats: st, ...sf, family: 'set', mode: 'tactic' }) + (c0.eq ? 60 : 0);

  const goalEn = c0.eq
    ? `${capital(nounSE(lhs))} equals ${nounSE(rhs)}`
    : `${capital(nounSE(lhs))} is contained in ${nounSE(rhs)}`;
  const english =
    hyps.length === 0
      ? goalEn + '.'
      : `If ${hyps.map(([a, b]) => `${nounSE(a)} is contained in ${nounSE(b)}`).join(' and ')}, then ${goalEn.charAt(0).toLowerCase() + goalEn.slice(1)}.`;
  const shape = c0.eq
    ? 'Two sets are equal when they have the same elements: start with `ext x`, then prove both directions of the `↔`.'
    : 'To prove `S ⊆ T`, take an element: `intro x hx` gives `hx : x ∈ S`; show `x ∈ T`.';
  const hints = makeHints({ goal: statementF, pf, L, lines, shape });
  const themes = makeThemes([statementF], st, [
    'sets',
    c0.eq ? 'set equality' : 'subset',
    ...(c0.tag ? [c0.tag] : []),
  ]).map((t) => (t === 'conjunction' ? 'intersection' : t === 'disjunction' ? 'union' : t === 'negation' ? 'complement' : t));
  return {
    header,
    solution: lines.map((l) => '  ' + l).join('\n'),
    english,
    rating,
    hints,
    themes: [...new Set(themes.filter((t) => t !== 'implication' && t !== 'iff'))],
    classical: false,
    statement: statementF,
    pf,
    lines,
  };
}

export function setAttempt(rng: Rng, target: number): Built | null {
  let c: SetCand | null;
  const tt = Math.max(0, Math.min(1, (target - 400) / 1200));
  if (rng.next() < 0.2 + 0.6 * tt) {
    const s = rng.pick(TRANSLATABLE);
    const letters = rng.shuffle(['A', 'B', 'C']);
    let f = s.f;
    // replace letters by small set expressions (∩, ∪, ᶜ) for harder, more varied facts
    const nSub = /associativity|commutativity/.test(s.tag) ? 0 : rng.int(1 + Math.round(2 * tt));
    for (let i = 0; i < nSub; i++) {
      // only fresh letters: `B ∩ C` for `B`, never a set that already occurs
      const fresh = ['P', 'Q', 'R'].filter((x) => !atomNamesOf(f).includes(x));
      if (!fresh.length) break;
      const n = rng.pick(atomNamesOf(f));
      const y = atom(rng.pick(fresh));
      const z = atom(n);
      f = substAtoms(f, { [n]: rng.pick([not(z), and(z, y), or(z, y)]) });
    }
    // a law whose converse also holds becomes an equality
    if (f.t === 'imp' && f.b.t !== 'imp' && rng.next() < 0.25 + 0.4 * tt && g4ip([f.b], f.a) === true) f = iff(f.a, f.b);
    if (!/associativity|commutativity/.test(s.tag)) f = commute(f, rng);
    c = translate(f, { P: letters[0], Q: letters[1], R: letters[2], S: 'C' });
    if (c) c.tag = s.tag;
  } else {
    const t = Math.max(0, Math.min(1, (target - 400) / 1200));
    const sets = ['A', 'B', 'C'].slice(0, 2 + (rng.next() < 0.55 + t / 3 ? 1 : 0));
    const eq = rng.next() < 0.15 + 0.25 * t;
    const nh = !eq && rng.next() < 0.4 ? 1 : 0;
    const hyps: [SE, SE][] = [];
    for (let i = 0; i < nh; i++) hyps.push([randomSE(rng, sets, rng.int(2)), randomSE(rng, sets, rng.int(2))]);
    c = {
      hyps,
      lhs: randomSE(rng, sets, 1 + rng.int(1 + Math.round(2 * t))),
      rhs: randomSE(rng, sets, rng.int(2 + Math.round(2 * t))),
      eq,
    };
  }
  if (!c) return null;
  return buildSet(c, { hypStyle: c.hyps.length > 0 && rng.next() < 0.6, contraOk: target < 800, doubleNegOk: c.tag === 'double negation' });
}
