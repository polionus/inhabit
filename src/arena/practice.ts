/**
 * Practice from the generator: which generated problems fit a level, as short sets (and one
 * "smaller version" for a learner who is stuck). Pure and deterministic; runs under Node.
 *
 * A puzzle is offered only if (a) its reference solution uses one of the level's focus tactics,
 * (b) every tactic that solution uses is in the level's inventory, (c) every bank lemma it cites
 * is unlocked at the level (arithmetic families), and (d) no statement repeats within the set or
 * in the previous two rounds.
 */
import { engine } from '../engine/index.ts';
import { findLevel, levelContext } from '../content/index.ts';
import type { Level } from '../content/types.ts';
import { levelSession, checkBody } from '../game/env.ts';
import { generator, GEN_VERSION } from './gen/index.ts';
import { familyEnv, generateGated, isArith, lemmasIn } from './gen/arith.ts';
import type { ArithFamily, Attempt } from './gen/arith.ts';
import { rwAttempt } from './gen/rw.ts';
import { indAttempt } from './gen/ind.ts';
import { divAttempt } from './gen/div.ts';
import { statementKey } from './plan.ts';
import { splitHeader, topLevel } from './translate.ts';
import type { ProofFamily, ProofPuzzle } from './types.ts';

/**
 * Tactics the generator's reference solutions use, per family. Measured by sampling (see
 * practice.test.ts, which re-derives this exact table); `inhabit` is term mode: no tactics.
 */
export const GENERATOR_TACTICS: Record<ProofFamily, string[]> = {
  prop: ['apply', 'by_cases', 'by_contra', 'cases', 'constructor', 'exact', 'exfalso', 'have', 'intro', 'left', 'obtain', 'rcases', 'right'],
  inhabit: [],
  quant: ['apply', 'by_contra', 'cases', 'constructor', 'exact', 'exfalso', 'have', 'intro', 'left', 'obtain', 'rcases', 'right', 'use'],
  set: ['apply', 'cases', 'constructor', 'exact', 'exfalso', 'ext', 'intro', 'left', 'obtain', 'rcases', 'right'],
  rw: ['apply', 'calc', 'exact', 'intro', 'obtain', 'rfl', 'rw', 'rwa', 'subst', 'symm', 'use'],
  ind: ['induction', 'rfl', 'rw'],
  div: ['apply', 'exact', 'obtain', 'refine', 'rfl', 'rw', 'use'],
};

/**
 * The generator families that can serve each world, in order of preference. In a world with
 * several, a level goes to the first family whose key tactics meet the level's focus.
 */
const WORLD_FAMILIES: Record<string, ProofFamily[]> = {
  types: ['inhabit'],
  props: ['prop'],
  logic: ['prop'],
  quant: ['quant'],
  sets: ['set'],
  eq: ['rw'],
  nat: ['ind', 'rw'],
  num: ['div', 'rw'],
  fun: ['rw', 'quant', 'set'],
  forge: ['rw', 'set', 'prop'],
};

/** What a family is really about: a level is served by it only if its focus includes one of these. */
const KEY_TACTICS: Partial<Record<ProofFamily, string[]>> = {
  rw: ['rw', 'rwa', 'symm', 'calc', 'subst', 'rfl'],
  ind: ['induction'],
  div: ['use', 'obtain', 'refine'],
};

const ATTEMPTS: Record<ArithFamily, Attempt> = { rw: rwAttempt, ind: indAttempt, div: divAttempt };

export interface PracticeFocus {
  tactics: string[];
  family: ProofFamily;
  label: string;
}

/** Everything the player sees: the level's name in the practice header. */
export function levelTitle(levelId: string): { world: string; number: number; title: string } | null {
  try {
    const { world, level, index } = findLevel(levelId);
    return { world: world.title, number: index + 1, title: level.title };
  } catch {
    return null;
  }
}

const focusMemo = new Map<string, PracticeFocus | null>();

function constructsOf(solution: string): string[] {
  const out: string[] = [];
  if (/\bfun\b|λ/.test(solution)) out.push('fun');
  if (/⟨/.test(solution)) out.push('⟨_, _⟩');
  if (/\.(1|2|left|right)\b/.test(solution)) out.push('.1 / .2');
  if (/Or\.(inl|inr|elim)|\.elim\b/.test(solution)) out.push('Or.inl / Or.elim');
  if (/\bmatch\b/.test(solution)) out.push('match');
  return out;
}

/** What a level is about, in terms the generator can serve; null when it cannot. */
export function practiceFocus(levelId: string): PracticeFocus | null {
  if (focusMemo.has(levelId)) return focusMemo.get(levelId)!;
  let f: PracticeFocus | null = null;
  try {
    f = computeFocus(levelId);
  } catch {
    f = null;
  }
  focusMemo.set(levelId, f);
  return f;
}

function computeFocus(levelId: string): PracticeFocus | null {
  const { world, level } = findLevel(levelId);
  const families = WORLD_FAMILIES[world.id];
  if (!families) return null;
  const base = families[0];
  if (level.kind === 'proof' && level.mode === 'term') {
    if (!['inhabit', 'prop', 'quant', 'set'].includes(base)) return null;
    // Term proofs about types and propositions; a level about numbers (`∃ n : Nat …`) is not served.
    if (!/\b(Type|Prop)\b/.test(level.header)) return null;
    const c = constructsOf(level.solutions[0] ?? '');
    return { tactics: [], family: 'inhabit', label: c.length ? `term-mode proofs (${c.join(', ')})` : 'term-mode proofs' };
  }
  if (level.kind !== 'proof' && level.kind !== 'parsons') return null;
  if (base === 'inhabit') return null;
  const solution = level.kind === 'proof' ? level.solutions[0] : level.lines.join('\n');
  let used: string[] | null = null;
  const usedTactics = () => {
    if (!used) {
      const r = checkBody(levelSession(levelId), solution).result;
      used = [...new Set(r.decls.flatMap((d) => d.usedTactics))];
    }
    return used;
  };
  const unlocked = level.unlocks?.tactics ?? [];
  for (const family of families) {
    const emitted = new Set(GENERATOR_TACTICS[family]);
    let tactics: string[];
    if (unlocked.length > 0) {
      tactics = unlocked.filter((t) => emitted.has(t));
    } else {
      const u = usedTactics().filter((t) => emitted.has(t));
      const rest = u.filter((t) => t !== 'exact' && t !== 'intro');
      tactics = rest.length > 0 ? rest : u;
    }
    if (tactics.length === 0) continue;
    const key = KEY_TACTICS[family];
    if (key && !tactics.some((t) => key.includes(t))) continue;
    return { tactics, family, label: tactics.map((t) => `\`${t}\``).join(', ') };
  }
  return null;
}

/** Bank lemmas a level may use: the unlocked bank, plus the core equations its codex has introduced. */
function unlockedLemmas(levelId: string): Set<string> {
  const ctx = levelContext(levelId);
  return new Set([...ctx.lemmas.map((l) => l.name), ...ctx.codex.filter((c) => /^[A-Z]\w*\.\w/.test(c))]);
}

/* ------------------------------ choosing puzzles ------------------------------ */

/** Tries per slot, in three bands: at the target, then 150 and 300 above it (some tactics only appear in harder statements). */
const TRIES = 60;
const bandOf = (t: number) => Math.floor(t / 20) * 150;
const TARGETS = [500, 650, 800];

function usedBy(p: ProofPuzzle): string[] {
  const r = engine.check(familyEnv(p.family), p.setup + (p.setup ? '\n' : '') + p.header + '\n' + p.solution, { allowedTactics: p.allowedTactics });
  return [...new Set(r.decls.flatMap((d) => d.usedTactics))];
}

/** The puzzle, restricted to the level's inventory, if it fits the level; else null. */
function fit(p: ReturnType<typeof generator.generate> | null, focus: PracticeFocus, inventory: Set<string>, maxRating: number, lemmas?: Set<string>): ProofPuzzle | null {
  if (!p || p.kind !== 'proof' || p.family !== focus.family || p.rating > maxRating) return null;
  if (lemmas && !lemmasIn(p.solution).every((l) => lemmas.has(l))) return null;
  if (p.mode === 'tactic') {
    const used = usedBy(p);
    if (!used.some((t) => focus.tactics.includes(t))) return null;
    if (!used.every((t) => inventory.has(t))) return null;
    return { ...p, allowedTactics: p.allowedTactics.filter((t) => inventory.has(t)) };
  }
  return p;
}

const clamp = (family: ProofFamily, t: number) => {
  const [lo, hi] = generator.range[family];
  return Math.min(hi, Math.max(lo, t));
};

/** One candidate for a slot: the Arena generator, or (arithmetic families) the gated one. */
function draw(levelId: string, seed: string, focus: PracticeFocus, target: number, inventory: Set<string>, lemmas: Set<string>) {
  if (isArith(focus.family)) {
    return generateGated(seed, focus.family, target, ATTEMPTS[focus.family], { tactics: inventory, lemmas, focus: focus.tactics }, GEN_VERSION);
  }
  void levelId;
  return generator.generate({ seed, family: focus.family, target });
}

const setMemo = new Map<string, ProofPuzzle[]>();

/** `n` generated problems for the level, easy to moderate and rising. Fewer (or none) if the generator cannot fill a slot. */
export function practiceSet(levelId: string, round = 0, n = 3): ProofPuzzle[] {
  const key = `${levelId}|${round}`;
  let all = setMemo.get(key);
  if (!all) {
    all = buildSet(levelId, round);
    setMemo.set(key, all);
  }
  return all.slice(0, n);
}

function buildSet(levelId: string, round: number): ProofPuzzle[] {
  const focus = practiceFocus(levelId);
  if (!focus) return [];
  const inventory = new Set(levelContext(levelId).allowedTactics);
  const lemmas = unlockedLemmas(levelId);
  const seen = new Set<string>();
  for (const r of [round - 2, round - 1]) if (r >= 0) for (const p of practiceSet(levelId, r, 99)) seen.add(statementKey(p));
  const out: ProofPuzzle[] = [];
  // Template families: prefer a different template (its first hint names the idea) for each slot.
  const ideas = new Set<string>();
  for (let i = 0; i < TARGETS.length; i++) {
    for (let t = 0; t < TRIES; t++) {
      const target = clamp(focus.family, TARGETS[i] + bandOf(t));
      const raw = draw(levelId, `practice:${levelId}:${round}:${i}:${t}`, focus, target, inventory, lemmas);
      const k = raw?.kind === 'proof' ? statementKey(raw) : '';
      if (!k || seen.has(k)) continue;
      const p = fit(raw, focus, inventory, TARGETS[i] + 300, lemmas);
      if (!p) continue;
      if (isArith(p.family) && t < TRIES / 2 && ideas.has(p.hints[0])) continue;
      ideas.add(p.hints[0]);
      seen.add(k);
      out.push(p);
      break;
    }
  }
  return out.sort((a, b) => a.rating - b.rating);
}

/** The main connective of a statement: what its shape is called. */
export function headConnective(statement: string): string {
  const s = statement.trim();
  for (const op of [' ↔ ', ' → ', ' ∨ ', ' ∧ ']) if (topLevel(s, op).length > 0) return op.trim();
  if (/^¬/.test(s)) return '¬';
  if (/^∀/.test(s)) return '∀';
  if (/^∃/.test(s)) return '∃';
  if (topLevel(s, ' ⊆ ').length > 0) return '⊆';
  if (topLevel(s, ' = ').length > 0) return '=';
  return '';
}

function conclusionOf(header: string): string {
  return splitHeader(header)?.conclusion ?? '';
}

function levelHeader(level: Level): string {
  return level.kind === 'proof' || level.kind === 'parsons' ? level.header : '';
}

const smallMemo = new Map<string, ProofPuzzle | null>();

/** One easy problem of the same shape as the level's own statement where possible, for a learner who is stuck. */
export function smallerVersion(levelId: string): ProofPuzzle | null {
  if (smallMemo.has(levelId)) return smallMemo.get(levelId)!;
  let found: ProofPuzzle | null = null;
  const focus = practiceFocus(levelId);
  if (focus) {
    const { level } = findLevel(levelId);
    const wanted = headConnective(conclusionOf(levelHeader(level).replace(/^(theorem|example)\s+\w*/, 'theorem puzzle')));
    const inventory = new Set(levelContext(levelId).allowedTactics);
    const lemmas = unlockedLemmas(levelId);
    const lo = generator.range[focus.family][0];
    for (let t = 0; t < TRIES; t++) {
      const target = lo + bandOf(t);
      const raw = draw(levelId, `practice:${levelId}:small:${t}`, focus, target, inventory, lemmas);
      const p = fit(raw, focus, inventory, lo + 450, lemmas);
      if (!p) continue;
      if (!found) found = p;
      if (!wanted || headConnective(conclusionOf(p.header)) === wanted) {
        found = p;
        break;
      }
    }
  }
  smallMemo.set(levelId, found);
  return found;
}

/** True when the level has a practice set (does the generation, once). */
export const hasPractice = (levelId: string): boolean => practiceFocus(levelId) !== null && practiceSet(levelId, 0).length > 0;
