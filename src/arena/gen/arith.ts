/**
 * Shared machinery for the arithmetic families (`rw`, `ind`, `div`): statements about natural
 * numbers, built from templates with random names and constants, proved with rewriting,
 * induction and witnesses.
 *
 * Their reference proofs use the game's lemma bank (`Nat.zero_add`, `Nat.mul_comm`, `Even.add`, …).
 * In real Lean those are core lemmas (or the game's own, compiled by verify-arena); in the mini
 * engine they live in `arithEnv()`: the base library extended with the bank's sources.
 *
 * A `Gate` restricts a candidate to the tactics and lemmas a level has unlocked, so practice
 * after a level never uses something the player has not met yet.
 */
import type { Env } from '../../engine/types.ts';
import { engine } from '../../engine/index.ts';
import { world as natWorld } from '../../content/worlds/nat.ts';
import { world as numWorld } from '../../content/worlds/num.ts';
import type { ProofFamily, ProofPuzzle, Rng } from '../types.ts';
import { makeRng } from './rng.ts';
import { proofPar } from './common.ts';

export type ArithFamily = 'rw' | 'ind' | 'div';
export const ARITH_FAMILIES: readonly ArithFamily[] = ['rw', 'ind', 'div'];
export const isArith = (f: string): f is ArithFamily => (ARITH_FAMILIES as readonly string[]).includes(f);

/** Tactics each family's reference proofs may use (the Arena's `allowedTactics`). */
export const ARITH_TACTICS: Record<ArithFamily, string[]> = {
  rw: ['rw', 'rwa', 'rfl', 'exact', 'symm', 'calc', 'subst', 'intro', 'apply', 'obtain', 'use'],
  ind: ['induction', 'rw', 'rfl', 'exact'],
  div: ['use', 'obtain', 'refine', 'rw', 'rfl', 'exact', 'apply', 'subst', 'intro'],
};

/** The bank lemmas the families may cite, in dependency order. */
export const ARITH_LEMMAS = [...natWorld.lemmas, ...numWorld.lemmas];
/** Defining equations already in the base library (introduced by the Nat world's codex). */
export const BASE_LEMMAS = ['Nat.add_zero', 'Nat.add_succ', 'Nat.mul_zero', 'Nat.mul_succ'];

let cachedEnv: Env | null = null;
/** Base library plus the Nat / divisibility lemma bank. */
export function arithEnv(): Env {
  if (!cachedEnv) {
    let env = engine.baseEnv();
    for (const l of ARITH_LEMMAS) env = engine.extend(env, l.source).env;
    cachedEnv = env;
  }
  return cachedEnv;
}

/** The environment a puzzle of this family is checked in. */
export const familyEnv = (family: ProofFamily | string): Env => (isArith(family) ? arithEnv() : engine.baseEnv());

/* ------------------------------ gating ------------------------------ */

/** What a candidate may use. Missing sets mean "anything". `focus`: prefer proofs that use one of these. */
export interface Gate {
  tactics?: ReadonlySet<string>;
  lemmas?: ReadonlySet<string>;
  focus?: readonly string[];
}

export const OPEN: Gate = {};

const TACTIC_WORDS = new Set(['rw', 'rwa', 'rfl', 'exact', 'symm', 'calc', 'subst', 'intro', 'apply', 'obtain', 'use', 'induction', 'refine', 'left', 'right', 'constructor', 'rcases', 'cases', 'have', 'funext', 'unfold']);

/** Tactic names a solution text uses (first word of each step, plus `by …` inside terms). */
export function tacticsIn(solution: string): string[] {
  const out = new Set<string>();
  for (const raw of solution.split('\n')) {
    let l = raw.trim().replace(/^·\s*/, '').replace(/^\|[^=]*=>\s*/, '');
    if (l.startsWith('_ ')) l = '';
    const w = /^([a-z_]+)/.exec(l)?.[1];
    if (w && TACTIC_WORDS.has(w)) out.add(w);
    for (const m of raw.matchAll(/\bby ([a-z_]+)/g)) if (TACTIC_WORDS.has(m[1])) out.add(m[1]);
  }
  return [...out];
}

/** Bank lemma names a solution cites. */
export function lemmasIn(solution: string): string[] {
  return [...new Set([...solution.matchAll(/\b(?:Nat|Even|Odd)\.[A-Za-z_]+/g)].map((m) => m[0]))];
}

export const tacOk = (g: Gate, t: string) => !g.tactics || g.tactics.has(t);
export const lemOk = (g: Gate, l: string) => !g.lemmas || g.lemmas.has(l);
export const prefers = (g: Gate, t: string) => !!g.focus?.includes(t);

/** True when the candidate's proof stays inside the gate. */
export function admits(g: Gate, solution: string): boolean {
  return tacticsIn(solution).every((t) => tacOk(g, t)) && lemmasIn(solution).every((l) => lemOk(g, l));
}

/* ------------------------------ candidates ------------------------------ */

export interface Hyp {
  name: string;
  type: string;
  /** English reading, used in "If …, then …". */
  en: string;
}

export interface ArithCand {
  /** Binder groups before the hypotheses, e.g. `(a b : Nat)`, `(f : Nat → Nat)`. */
  binders: string[];
  hyps: Hyp[];
  goal: string;
  /** English for the conclusion. */
  goalEn: string;
  /** For statements with no hypotheses: "For every natural number n, …". */
  forAll?: string[];
  /** Proof lines, without the two-space body indent. */
  lines: string[];
  /** First hint: the idea, in words. */
  idea: string;
  themes: string[];
  /** Bank lemmas the solver may not cite (they restate the goal). */
  forbidden?: string[];
  /** Extra difficulty the line count does not show (case splits, induction). */
  bonus?: number;
}

/** What the generator registry needs from a family attempt (a subset of prop.ts's `Built`). */
export interface ArithBuilt {
  header: string;
  solution: string;
  english: string;
  rating: number;
  hints: string[];
  themes: string[];
  forbidden?: string[];
  classical: boolean;
}

const BASE: Record<ArithFamily, number> = { rw: 300, ind: 420, div: 360 };

/** Difficulty on the Arena's 400–2400 scale: lines, rewrite rules, arrows, `at`, lemmas, case splits. */
export function rateArith(family: ArithFamily, c: ArithCand): number {
  const sol = c.lines.join('\n');
  const rules = [...sol.matchAll(/\b(?:rw|rwa) \[([^\]]*)\]/g)].reduce((n, m) => n + m[1].split(',').length, 0);
  const arrows = (sol.match(/←/g) ?? []).length;
  const ats = (sol.match(/\] at /g) ?? []).length;
  const lemmas = lemmasIn(sol).length;
  const obtains = (sol.match(/\bobtain\b/g) ?? []).length;
  const lines = c.lines.length;
  const r = BASE[family] + 50 * lines + 22 * Math.max(0, rules - 1) + 30 * arrows + 35 * ats + 45 * lemmas + 50 * obtains + 25 * Math.max(0, c.hyps.length - 2) + (c.bonus ?? 0);
  return Math.round(Math.max(400, Math.min(2400, r)));
}

function englishOf(c: ArithCand): string {
  const goal = c.goalEn;
  const lead = c.forAll?.length ? `For ${c.forAll.length === 1 ? 'every natural number' : 'all natural numbers'} ${andList(c.forAll)}, ` : '';
  if (!c.hyps.length) return cap(lead + goal) + '.';
  return cap(`${lead}${lead ? 'if' : 'If'} ${andList(c.hyps.map((h) => h.en))}, then ${goal}`) + '.';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function andList(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
}

function hintsOf(c: ArithCand): string[] {
  const first = c.lines[0].trim();
  const hints = [c.idea];
  if (c.lines.length > 1) hints.push(`Start with \`${first}\`.`);
  else hints.push("One step closes this. Which single lemma or tactic matches the goal's shape exactly?");
  if (c.lines.length >= 3) {
    const n = Math.min(c.lines.length - 1, Math.max(2, Math.ceil(c.lines.length / 2)));
    hints.push('The proof can begin like this:\n```lean\n' + c.lines.slice(0, n).join('\n') + '\n```');
  }
  return hints;
}

export function headerOf(c: ArithCand): string {
  const parts = [...c.binders, ...c.hyps.map((h) => `(${h.name} : ${h.type})`)];
  return `theorem puzzle ${parts.length ? parts.join(' ') + ' ' : ''}: ${c.goal} := by`;
}

export function buildArith(family: ArithFamily, c: ArithCand): ArithBuilt {
  return {
    header: headerOf(c),
    solution: c.lines.map((l) => '  ' + l).join('\n'),
    english: englishOf(c),
    rating: rateArith(family, c),
    hints: hintsOf(c),
    themes: c.themes,
    ...(c.forbidden?.length ? { forbidden: c.forbidden } : {}),
    classical: false,
  };
}

/* ------------------------------ names and English ------------------------------ */

const NAME_SETS = [
  ['a', 'b', 'c', 'd', 'e'],
  ['x', 'y', 'z', 'w', 'v'],
  ['m', 'n', 'p', 'q', 'r'],
];

/** `k` distinct variable names from one family of letters. */
export function varNames(rng: Rng, k: number): string[] {
  const set = rng.pick(NAME_SETS);
  return set.slice(0, Math.min(k, set.length));
}

/** Lean expression → plain English-ish math: `f a` → `f(a)`, `x ∣ y` → `x divides y`. */
export function enExpr(e: string): string {
  let s = e.trim();
  let m = /^Even (.+)$/.exec(s);
  if (m) return `${enExpr(unparen(m[1]))} is even`;
  m = /^Odd (.+)$/.exec(s);
  if (m) return `${enExpr(unparen(m[1]))} is odd`;
  s = s.replace(/ ∣ /g, ' divides ');
  s = s.replace(/ ≠ /g, ' ≠ ');
  // function application: `f (g a)` → `f(g(a))`, `f a` → `f(a)`
  for (let i = 0; i < 4; i++) s = s.replace(/\b([fgP]) \(([^()]*)\)/g, '$1⟪$2⟫').replace(/\b([fgP]) ([a-z0-9]+)\b/g, '$1⟪$2⟫');
  return s.replace(/⟪/g, '(').replace(/⟫/g, ')');
}

const unparen = (s: string) => (s.startsWith('(') && s.endsWith(')') ? s.slice(1, -1) : s);

/* ------------------------------ gated generation ------------------------------ */

export type Attempt = (rng: Rng, target: number, gate: Gate) => ArithBuilt | null;

/** Names a solver may not cite: the puzzle's own restated lemmas, plus bank lemmas the gate has not unlocked. */
export function forbiddenFor(b: { forbidden?: string[] }, gate: Gate): string[] {
  const locked = gate.lemmas ? ARITH_LEMMAS.map((l) => l.name).filter((n) => !gate.lemmas!.has(n)) : [];
  return [...new Set([...(b.forbidden ?? []), ...locked])];
}

/** Draw candidates until one is near the target, inside the gate, and checks in the engine. */
export function pickArith(rng: Rng, target: number, attempt: Attempt, gate: Gate, allowed: string[], maxAttempts = 90): ArithBuilt | null {
  const near: ArithBuilt[] = [];
  const ok = (b: ArithBuilt) => engine.check(arithEnv(), b.header + '\n' + b.solution, { allowedTactics: allowed, forbiddenNames: forbiddenFor(b, gate) }).complete;
  for (let i = 0; i < maxAttempts; i++) {
    const b = attempt(rng.fork('attempt' + i), target, gate);
    if (!b || !admits(gate, b.solution)) continue;
    if (Math.abs(b.rating - target) <= 90 && ok(b)) return b;
    near.push(b);
  }
  near.sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
  for (const b of near.slice(0, 6)) if (ok(b)) return b;
  return null;
}

/**
 * A puzzle of an arithmetic family restricted to a gate (for practice after a level).
 * Deterministic in (seed, family, target, gate). Null when nothing fits.
 */
export function generateGated(seed: string, family: ArithFamily, target: number, attempt: Attempt, gate: Gate, version: number): ProofPuzzle | null {
  const rng = makeRng(`${family}|gated|${seed}|${target}`);
  const allowed = ARITH_TACTICS[family].filter((t) => tacOk(gate, t));
  const b = pickArith(rng, target, attempt, gate, allowed);
  if (!b) return null;
  const forbiddenNames = forbiddenFor(b, gate);
  return {
    kind: 'proof',
    id: `${family}.${version}.${seed}.${target}`,
    family,
    rating: b.rating,
    par: proofPar(b.rating),
    mode: 'tactic',
    english: b.english,
    setup: '',
    header: b.header,
    starter: '  sorry',
    solution: b.solution,
    allowedTactics: allowed,
    ...(forbiddenNames.length ? { forbiddenNames } : {}),
    hints: b.hints,
    themes: b.themes,
  };
}
