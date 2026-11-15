/**
 * Translate: English to a Lean statement. A generated proof puzzle supplies the sentence and the
 * reference proposition; the learner's statement is compared with it by definitional equality.
 * Pure (runs under Node and in the browser).
 */
import { engine } from '../engine/index.ts';
import type { Env } from '../engine/types.ts';
import { generator } from './gen/index.ts';
import { statementKey } from './plan.ts';
import type { ProofFamily, ProofPuzzle } from './types.ts';

/* ------------------------------ header parsing ------------------------------ */

export interface BinderGroup {
  open: string;
  names: string[];
  type: string;
}

export interface SplitHeader {
  groups: BinderGroup[];
  /** Everything after the last binder's colon, without `:= by` / `:=`. */
  conclusion: string;
}

const OPEN = '([{⟨';
const CLOSE = ')]}⟩';

/** Index of the bracket matching the one opening at `i` (or -1). */
function matching(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (OPEN.includes(s[j])) depth++;
    else if (CLOSE.includes(s[j]) && --depth === 0) return j;
  }
  return -1;
}

/** Positions of `needle` in `s` outside every bracket. */
export function topLevel(s: string, needle: string): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (depth === 0 && s.startsWith(needle, i)) out.push(i);
  }
  return out;
}

/** Split `theorem puzzle (binders…) : conclusion := by` into binder groups and conclusion. Null if it does not fit. */
export function splitHeader(header: string): SplitHeader | null {
  const m = /^\s*theorem\s+puzzle\b/.exec(header);
  if (!m) return null;
  let s = header.slice(m[0].length).replace(/\s*:=\s*(by)?\s*$/, '');
  s = s.replace(/\s+/g, ' ');
  const groups: BinderGroup[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === ' ') {
      i++;
      continue;
    }
    if (s[i] === ':') return { groups, conclusion: s.slice(i + 1).trim() };
    if (!OPEN.includes(s[i])) return null;
    const j = matching(s, i);
    if (j < 0) return null;
    const inner = s.slice(i + 1, j);
    const colon = topLevel(inner, ' : ')[0];
    if (colon === undefined) return null;
    groups.push({ open: s[i], names: inner.slice(0, colon).trim().split(' '), type: inner.slice(colon + 3).trim() });
    i = j + 1;
  }
  return null;
}

/** Hypothesis names in generated headers: `h`, `h'`, `hqp`, `h₁`. */
const isHypName = (n: string) => /^h[\w'₀-₉]*$/.test(n);
const needsParens = (t: string) => !/^[\w'₀-₉.]+$/.test(t) && !(t.startsWith('(') && matching(t, 0) === t.length - 1);
const paren = (t: string) => (needsParens(t) ? `(${t})` : t);

export interface TranslateTask {
  /** Leading data binders, e.g. `(P Q R : Prop)`. */
  binders: string;
  /** The reference proposition, hypotheses folded into implications. */
  reference: string;
  /** The conclusion alone (after the last binder). */
  conclusion: string;
  hypotheses: string[];
}

/** Derive the translation task from a generated proof puzzle, or null for shapes it does not cover. */
export function translateTask(p: ProofPuzzle): TranslateTask | null {
  const h = splitHeader(p.header);
  if (!h) return null;
  const data: string[] = [];
  const hyps: string[] = [];
  for (const g of h.groups) {
    if (g.open !== '(') return null;
    if (g.names.every(isHypName)) for (const _ of g.names) hyps.push(g.type);
    else if (g.names.some(isHypName)) return null;
    else data.push(`(${g.names.join(' ')} : ${g.type})`);
  }
  if (hyps.some((t) => t === 'Prop' || t === 'Type')) return null;
  const reference = [...hyps.map(paren), h.conclusion].join(' → ');
  return { binders: data.join(' '), reference, conclusion: h.conclusion, hypotheses: hyps };
}

/* ------------------------------ checking an answer ------------------------------ */

export type Slip = 'converse' | 'and-for-implies';

export type Verdict =
  | { kind: 'error'; message: string }
  | { kind: 'not-prop'; type: string }
  | { kind: 'right' }
  | { kind: 'different'; slip?: Slip };

/** Statements a learner might write by mistake, built from the reference. Only the two cheap slips. */
export function slipVariants(reference: string): { slip: Slip; text: string }[] {
  const out: { slip: Slip; text: string }[] = [];
  const arrows = topLevel(reference, ' → ');
  if (arrows.length > 0) {
    const a = arrows[0];
    const lhs = reference.slice(0, a);
    const rhs = reference.slice(a + 3);
    out.push({ slip: 'converse', text: `${paren(rhs)} → ${paren(lhs)}` });
  }
  if (reference.includes('∀')) {
    const all = [...reference.matchAll(/ → /g)].map((m) => m.index!);
    for (const at of all) out.push({ slip: 'and-for-implies', text: reference.slice(0, at) + ' ∧ ' + reference.slice(at + 3) });
  }
  return out;
}

export function checkTranslation(env: Env, task: TranslateTask, answer: string): Verdict {
  const binders = task.binders || undefined;
  const el = engine.elab(env, answer, binders);
  if (!el.ok) return { kind: 'error', message: el.diagnostics.find((d) => d.severity === 'error')?.message ?? 'Lean could not read that.' };
  if (el.type && el.type.trim() !== 'Prop') return { kind: 'not-prop', type: el.type };
  if (engine.defEq(env, answer, task.reference, binders)) return { kind: 'right' };
  for (const v of slipVariants(task.reference)) {
    if (engine.defEq(env, answer, v.text, binders) && !engine.defEq(env, v.text, task.reference, binders)) return { kind: 'different', slip: v.slip };
  }
  return { kind: 'different' };
}

/* ------------------------------ the set ------------------------------ */

export const TRANSLATE_N = 5;
const FAMILIES: ProofFamily[] = ['prop', 'quant', 'set', 'prop', 'quant'];
const TARGETS = [600, 700, 800, 900, 1000];
const memo = new Map<number, TranslateItem[]>();

export interface TranslateItem {
  puzzle: ProofPuzzle;
  task: TranslateTask;
}

/** Five statements, ratings rising from about 600 to 1000, families rotating. Deterministic per round. */
export function translateSet(round = 0, n = TRANSLATE_N): TranslateItem[] {
  const hit = memo.get(round);
  if (hit) return hit.slice(0, n);
  const prev = round > 0 ? translateSet(round - 1, TRANSLATE_N).map((x) => statementKey(x.puzzle)) : [];
  const seen = new Set<string>(prev);
  const out: TranslateItem[] = [];
  for (let i = 0; i < TRANSLATE_N; i++) {
    const family = FAMILIES[i % FAMILIES.length];
    const [lo, hi] = generator.range[family];
    const target = Math.min(hi, Math.max(lo, TARGETS[i]));
    for (let t = 0; t < 30; t++) {
      const p = generator.generate({ seed: `translate:${round}:${i}:${t}`, family, target });
      if (p.kind !== 'proof' || p.family !== family) continue;
      const key = statementKey(p);
      if (seen.has(key)) continue;
      const task = translateTask(p);
      if (!task) continue;
      seen.add(key);
      out.push({ puzzle: p, task });
      break;
    }
  }
  memo.set(round, out);
  return out.slice(0, n);
}
