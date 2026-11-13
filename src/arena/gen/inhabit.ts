/**
 * `inhabit` family (term mode): "write a term of this type". Two flavours:
 *  - Type flavour: function and pair types over `A B C : Type` (a program to write);
 *  - Prop flavour: the same statements as `prop`, proved by a term (delegates to prop.ts).
 */
import type { Rng } from '../types.ts';
import { weighted } from './rng.ts';
import { and, atom, atomNames, g4ip, imp, imps, key, parse, show, size, substAtoms } from './logic.ts';
import type { F } from './logic.ts';
import { Prover, prune, spineUsesAll, stats, usedNames } from './search.ts';
import type { Hyp, Naming, Pf } from './search.ts';
import { flatTerm, termOf } from './emit.ts';
import type { Lang } from './emit.ts';
import { typeSentence } from './english.ts';
import { canonicalAtoms, makeThemes, rate, statementFeatures } from './common.ts';
import { propAttempt, uncurry } from './prop.ts';
import type { Built } from './prop.ts';

export const TYPE_LETTERS = ['A', 'B', 'C'] as const;

/** Program-shaped types (Curry–Howard twins of the prop schemas). */
export const TYPE_SCHEMAS: readonly (readonly [string, string])[] = [
  ['A → (A → B) → B', 'application'],
  ['(A → B) → A → B', 'application'],
  ['(A → B) → (B → C) → A → C', 'composition'],
  ['(B → C) → (A → B) → A → C', 'composition'],
  ['(A → B → C) → B → A → C', 'flip'],
  ['(A ∧ B → C) → A → B → C', 'currying'],
  ['(A → B → C) → A ∧ B → C', 'currying'],
  ['A ∧ B → B ∧ A', 'pairs'],
  ['(A → B) → (A → C) → A → B ∧ C', 'pairs'],
  ['(A → B) ∧ (A → C) → A → B ∧ C', 'pairs'],
  ['(A → B ∧ C) → (A → B) ∧ (A → C)', 'pairs'],
  ['(A → B) → A ∧ C → B ∧ C', 'pairs'],
  ['((A → B) → C) → B → C', 'higher-order'],
  ['(A → A → B) → A → B', 'duplication'],
  ['((A → B) → A → C) → A → B → C', 'higher-order'],
  ['A ∧ B ∧ C → (A ∧ B) ∧ C', 'pairs'],
  ['(A ∧ B) ∧ C → A ∧ B ∧ C', 'pairs'],
  ['A ∧ B ∧ C → (A ∧ B) ∧ (A ∧ C)', 'pairs'],
  ['(A → B ∧ C) → A → C ∧ B', 'pairs'],
  ['(A ∧ B → C) → (A → B) → A → C', 'currying'],
  ['(((A → B) → B) → B) → A → B', 'higher-order'],
  ['(A → B) → ((A → B) → C) → C', 'higher-order'],
  ['(A → B → C) → (A → B) → A → C', 'combinators'],
  ['(A → B) → (C → A) → C → B', 'composition'],
];

const PARSED = TYPE_SCHEMAS.map(([s, tag]) => ({ f: parse(s), tag }));

/** `a : A`, functions `f g h k`, pairs `p q`. */
export const typeNaming: Naming = {
  hyp(f: F) {
    return f.t === 'atom' ? f.p.toLowerCase() : f.t === 'imp' ? 'f' : 'p';
  },
  fresh(f: F, taken: Set<string>) {
    const cands =
      f.t === 'atom'
        ? [f.p.toLowerCase(), f.p.toLowerCase() + "'", f.p.toLowerCase() + '₂']
        : f.t === 'imp'
          ? ['f', 'g', 'h', 'k', 'f₂', 'g₂', 'h₂']
          : ['p', 'q', 'p₂', 'q₂'];
    for (const c of cands) if (!taken.has(c)) return c;
    for (let i = 3; ; i++) if (!taken.has('x' + i)) return 'x' + i;
  },
};

export const typeLang: Lang = { style: { prod: true }, cases: 'cases', typeMode: true };

function randomType(rng: Rng, vars: string[], sz: number): F {
  if (sz <= 0) return atom(rng.pick(vars));
  const c = weighted<string>(rng, [
    ['imp', 3],
    ['and', 2],
  ]);
  const l = rng.int(sz);
  const a = randomType(rng, vars, l);
  const b = randomType(rng, vars, sz - 1 - l);
  return c === 'imp' ? imp(a, b) : and(a, b);
}

export interface TypeBuilt extends Built {
  /** The full type, for quick items. */
  type: F;
  flat: string;
}

/** Check and dress a Type-flavour candidate. */
export function buildType(hyps0: F[], goal0: F, o: { hypStyle: boolean; allowTrivial: boolean; tag?: string }): TypeBuilt | null {
  const ren = canonicalAtoms([...hyps0, goal0], TYPE_LETTERS);
  if (Object.keys(ren).length > 3) return null;
  const m = Object.fromEntries(Object.entries(ren).map(([k, v]) => [k, atom(v)]));
  const hyps = hyps0.map((h) => substAtoms(h, m));
  const goal = substAtoms(goal0, m);
  const statement = imps(hyps, goal);
  if (size(statement) > 11 || hyps.length > 4) return null;
  const hk = hyps.map(key);
  if (new Set(hk).size !== hk.length || hk.includes(key(goal))) return null;
  if (g4ip(hyps, goal) !== true) return null;

  const vars = atomNames(statement).sort();
  const taken = new Set<string>(vars);
  const named: Hyp[] = [];
  if (o.hypStyle) {
    for (const h of hyps) {
      const name = typeNaming.fresh!(h, taken);
      taken.add(name);
      named.push({ name, f: h });
    }
  }
  const searchGoal = o.hypStyle ? goal : statement;
  const prover = new Prover({ naming: typeNaming, maxCost: 18, nodeLimit: 15000 });
  const res = prover.prove(named, [], searchGoal, [...taken]);
  if (!res) return null;
  const pf = prune(res.pf);
  if (!spineUsesAll(pf)) return null;
  if (o.hypStyle && named.some((h) => !usedIn(pf, h.name))) return null;
  let k: Pf = pf;
  while (k.k === 'intro' || k.k === 'andE') k = k.body;
  if (k.k === 'hyp' && !o.allowTrivial) return null;

  const term = termOf(pf, typeLang);
  const sh = (f: F) => show(f, typeLang.style);
  const header = `def puzzle (${vars.join(' ')} : Type)${named.map((h) => ` (${h.name} : ${sh(h.f)})`).join('')} : ${sh(searchGoal)} :=`;
  const st = stats(pf);
  const sf = statementFeatures([statement]);
  const lines = term.split('\n');
  // term length is a better effort proxy than tactic lines here
  const flatT = flatTerm(pf, typeLang);
  const pseudoLines = Math.max(1, Math.round(flatT.length / 7));
  const innerFuns = Math.max(0, (flatT.match(/\bfun\b/g) ?? []).length - 1);
  const patterns = (flatT.match(/⟨/g) ?? []).length;
  const rating =
    rate({ lines: pseudoLines, stats: st, ...sf, family: 'inhabit', mode: 'term' }) + 140 * innerFuns + 40 * patterns - 40;
  const hints = typeHints(searchGoal, pf, term);
  const themes = [...new Set(['functions', ...(o.tag ? [o.tag] : []), ...makeThemes([statement], st).filter((t) => t !== 'implication' && t !== 'conjunction'), ...(sf.depth > 0 && JSON.stringify(statement).includes('"and"') ? ['pairs'] : [])])];
  return {
    header,
    solution: term,
    english: typeSentence(o.hypStyle ? hyps : uncurry(statement).hyps, o.hypStyle ? goal : uncurry(statement).goal),
    rating: Math.max(400, rating),
    hints,
    themes,
    classical: false,
    statement,
    pf,
    lines,
    term,
    type: statement,
    flat: flatTerm(pf, typeLang),
  };
}

function usedIn(pf: Pf, name: string): boolean {
  return usedNames(pf).has(name);
}

function typeHints(goal: F, pf: Pf, term: string): string[] {
  const out = [
    goal.t === 'imp'
      ? 'You are asked for a function: start with `fun x => …` and name each argument.'
      : 'You are asked for a pair: build it with `(_, _)`.',
  ];
  let k: Pf = pf;
  while (k.k === 'intro' || k.k === 'andE') k = k.body;
  out.push(
    k.k === 'app'
      ? 'Follow the types: which argument produces the type you need? Apply it.'
      : k.k === 'and'
        ? 'The result is a pair `(_, _)`; fill each component separately. `p.1` and `p.2` take a pair apart.'
        : 'Name the arguments; then the answer is built from them by application and pairing.',
  );
  const flat = term.trim().replace(/\s+/g, ' ');
  if (flat.length > 18) out.push('The term can begin like this:\n```lean\n' + flat.slice(0, Math.max(12, Math.floor(flat.length / 2))) + ' …\n```');
  return out;
}

export function typeAttempt(rng: Rng, target: number): TypeBuilt | null {
  const hypStyle = rng.next() < 0.4;
  if (rng.next() < 0.6) {
    const s = rng.pick(PARSED);
    const names = atomNames(s.f);
    const perm = rng.shuffle(TYPE_LETTERS.slice(0, Math.max(names.length, 2)));
    let f = substAtoms(s.f, Object.fromEntries(names.map((n, i) => [n, atom(perm[i])])));
    if (target > 900 && rng.next() < 0.5) {
      // replace one letter by a small type
      const n = rng.pick(atomNames(f));
      const y = atom(rng.pick(TYPE_LETTERS as unknown as string[]));
      f = substAtoms(f, { [n]: rng.next() < 0.5 ? imp(y, atom(n)) : and(atom(n), y) });
    }
    const { hyps, goal } = uncurry(f);
    return buildType(hyps, goal, { hypStyle: hypStyle && hyps.length > 0, allowTrivial: target < 520, tag: s.tag });
  }
  const t = Math.max(0, Math.min(1, (target - 400) / 1000));
  const vars = TYPE_LETTERS.slice(0, 2 + (rng.next() < 0.3 + t / 2 ? 1 : 0)) as unknown as string[];
  const nHyps = 1 + rng.int(2 + Math.round(t));
  const hyps: F[] = [];
  for (let i = 0; i < nHyps; i++) hyps.push(randomType(rng, vars, rng.int(2 + Math.round(t))));
  const goal = randomType(rng, vars, rng.int(2 + Math.round(t)));
  return buildType(hyps, goal, { hypStyle, allowTrivial: target < 520 });
}

/** One attempt for the inhabit family: Type or Prop flavour. */
export function inhabitAttempt(rng: Rng, target: number): Built | null {
  const typeShare = target < 900 ? 0.5 : target < 1300 ? 0.35 : 0.15;
  if (rng.next() < typeShare) return typeAttempt(rng, target);
  return propAttempt(rng, target, 'term', 'inhabit');
}
