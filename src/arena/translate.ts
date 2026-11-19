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
  /** Logically the same statement written another way; `note` names the difference. */
  | { kind: 'equivalent'; note: string }
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

export interface Equivalent {
  text: string;
  note: string;
}

const NOTE_BUNDLE = "You bundled the hypotheses with ∧; Lean's convention is to chain them with →, though both say the same thing.";
const NOTE_ORDER = 'You listed the hypotheses in a different order. That says the same thing, since each → just takes the next assumption in turn.';
const NOTE_NOT_EX = 'You wrote ¬∃ where the sentence reads as ∀ … ¬ (or the other way around). “No x has it” and “every x lacks it” mean the same thing.';
const NOTE_IFF = 'You flipped the two sides of ↔. An “if and only if” works in both directions.';
const NOTE_COMM = "You swapped the two sides of ∧ (or ∨). Order doesn't change what “and” and “or” mean.";

const BINARY = [' → ', ' ↔ ', ' ∧ ', ' ∨ '];
const hasTopBinary = (s: string) => BINARY.some((b) => topLevel(s, b).length > 0);

/** Equivalent rewrites of one component (a hypothesis or the conclusion), original excluded. */
function componentRewrites(s: string): Equivalent[] {
  if (!/^[∀∃]/.test(s) && topLevel(s, ' → ').length > 0) {
    const at = topLevel(s, ' → ');
    const segs: string[] = [];
    let from = 0;
    for (const i of at) {
      segs.push(s.slice(from, i));
      from = i + 3;
    }
    segs.push(s.slice(from));
    return segs.flatMap((seg, k) => componentRewrites(seg).map((r) => ({ text: segs.map((x, j) => (j === k ? r.text : x)).join(' → '), note: r.note })));
  }
  const out: Equivalent[] = [];
  const quant = /^(∀|∃)\s*/.exec(s);
  const notEx = /^¬\s*∃\s*/.exec(s);
  if (notEx) {
    const rest = s.slice(notEx[0].length);
    const c = topLevel(rest, ',')[0];
    if (c !== undefined) out.push({ text: `∀ ${rest.slice(0, c).trim()}, ¬${paren(rest.slice(c + 1).trim())}`, note: NOTE_NOT_EX });
  }
  if (quant && quant[1] === '∀') {
    const rest = s.slice(quant[0].length);
    const c = topLevel(rest, ',')[0];
    if (c !== undefined) {
      const body = rest.slice(c + 1).trim();
      if (body.startsWith('¬')) {
        const inner = body.slice(1).trim();
        if (!hasTopBinary(inner)) out.push({ text: `¬∃ ${rest.slice(0, c).trim()}, ${inner}`, note: NOTE_NOT_EX });
      }
    }
  }
  if (!/^[∀∃]/.test(s)) {
    const iff = topLevel(s, ' ↔ ');
    if (iff.length === 1) out.push({ text: `${s.slice(iff[0] + 3)} ↔ ${s.slice(0, iff[0])}`, note: NOTE_IFF });
    else if (iff.length === 0 && topLevel(s, ' → ').length === 0) {
      const sep = topLevel(s, ' ∨ ').length > 0 ? ' ∨ ' : ' ∧ ';
      const at = topLevel(s, sep);
      if (at.length > 0) {
        const parts: string[] = [];
        let from = 0;
        for (const i of at) {
          parts.push(s.slice(from, i));
          from = i + 3;
        }
        parts.push(s.slice(from));
        out.push({ text: parts.reverse().join(sep), note: NOTE_COMM });
      }
    }
  }
  return out;
}

const permutations = <T,>(xs: T[]): T[][] =>
  xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));

/** Statements logically equivalent to the reference that a careful learner may write instead, with a note each. Fewest changes first. */
export function equivalentVariants(task: TranslateTask, cap = 400): Equivalent[] {
  const comps = [...task.hypotheses, task.conclusion];
  const options = comps.map((c) => [{ text: c, note: '' }, ...componentRewrites(c)]);
  const out: Equivalent[] = [];
  const n = task.hypotheses.length;
  const orders = n >= 2 && n <= 3 ? permutations([...Array(n).keys()]) : [[...Array(n).keys()]];
  const picks: Equivalent[][] = [[]];
  for (const o of options) {
    const next: Equivalent[][] = [];
    for (const p of picks) for (const x of o) next.push([...p, x]);
    picks.splice(0, picks.length, ...next.slice(0, 64));
  }
  for (const pick of picks) {
    const notes = [...new Set(pick.map((x) => x.note).filter(Boolean))];
    const texts = pick.map((x) => x.text);
    const concl = texts[n];
    for (const order of orders) {
      const hs = order.map((i) => texts[i]);
      const orderNote = order.some((v, i) => v !== i) ? [NOTE_ORDER] : [];
      for (let mask = 0; mask < 1 << Math.max(0, n - 1); mask++) {
        const groups: string[][] = n === 0 ? [] : [[]];
        hs.forEach((h, i) => {
          groups[groups.length - 1].push(h);
          if (i < n - 1 && !(mask & (1 << i))) groups.push([]);
        });
        const bundled = groups.some((g) => g.length > 1);
        const nests: boolean[] = bundled && groups.some((g) => g.length === 3) ? [false, true] : [false];
        for (const left of nests) {
          const gs = groups.map((g) => {
            if (g.length === 1) return paren(g[0]);
            const ps = g.map(paren);
            return '(' + (left ? `(${ps[0]} ∧ ${ps[1]}) ∧ ${ps[2]}` : ps.join(' ∧ ')) + ')';
          });
          const all = [...notes, ...orderNote, ...(bundled ? [NOTE_BUNDLE] : [])];
          if (all.length === 0) continue;
          out.push({ text: [...gs, concl].join(' → '), note: all.join(' ') });
        }
      }
    }
  }
  out.sort((a, b) => a.note.length - b.note.length);
  return out.slice(0, cap);
}

export function checkTranslation(env: Env, task: TranslateTask, answer: string): Verdict {
  const binders = task.binders || undefined;
  const el = engine.elab(env, answer, binders);
  if (!el.ok) return { kind: 'error', message: el.diagnostics.find((d) => d.severity === 'error')?.message ?? 'Lean could not read that.' };
  if (el.type && el.type.trim() !== 'Prop') return { kind: 'not-prop', type: el.type };
  if (engine.defEq(env, answer, task.reference, binders)) return { kind: 'right' };
  for (const q of equivalentVariants(task)) {
    if (engine.defEq(env, answer, q.text, binders)) return { kind: 'equivalent', note: q.note };
  }
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
