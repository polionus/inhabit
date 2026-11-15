/**
 * Practice from the generator: which generated problems fit a level, as short sets (and one
 * "smaller version" for a learner who is stuck). Pure and deterministic; runs under Node.
 *
 * A puzzle is offered only if (a) its reference solution uses one of the level's focus tactics,
 * (b) every tactic that solution uses is in the level's inventory, and (c) no statement repeats
 * within the set or in the previous two rounds.
 */
import { engine } from '../engine/index.ts';
import { findLevel, levelContext } from '../content/index.ts';
import type { Level } from '../content/types.ts';
import { levelSession, checkBody } from '../game/env.ts';
import { generator } from './gen/index.ts';
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
};

const WORLD_FAMILY: Record<string, ProofFamily> = { types: 'inhabit', props: 'prop', logic: 'prop', quant: 'quant', sets: 'set' };

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
  const base = WORLD_FAMILY[world.id];
  if (!base || level.kind !== 'proof') return null;
  if (level.mode === 'term') {
    // Term proofs about types and propositions; a level about numbers (`∃ n : Nat …`) is not served.
    if (!/\b(Type|Prop)\b/.test(level.header)) return null;
    const c = constructsOf(level.solutions[0] ?? '');
    return { tactics: [], family: 'inhabit', label: c.length ? `term-mode proofs (${c.join(', ')})` : 'term-mode proofs' };
  }
  if (base === 'inhabit') return null;
  const emitted = new Set(GENERATOR_TACTICS[base]);
  const unlocked = level.unlocks?.tactics ?? [];
  let tactics: string[];
  if (unlocked.length > 0) {
    tactics = unlocked.filter((t) => emitted.has(t));
  } else {
    const r = checkBody(levelSession(levelId), level.solutions[0]).result;
    const used = [...new Set(r.decls.flatMap((d) => d.usedTactics))].filter((t) => emitted.has(t));
    const rest = used.filter((t) => t !== 'exact' && t !== 'intro');
    tactics = rest.length > 0 ? rest : used;
  }
  if (tactics.length === 0) return null;
  return { tactics, family: base, label: tactics.map((t) => `\`${t}\``).join(', ') };
}

/* ------------------------------ choosing puzzles ------------------------------ */

/** Tries per slot, in three bands: at the target, then 150 and 300 above it (some tactics only appear in harder statements). */
const TRIES = 60;
const bandOf = (t: number) => Math.floor(t / 20) * 150;
const TARGETS = [500, 650, 800];

function usedBy(p: ProofPuzzle): string[] {
  const r = engine.check(engine.baseEnv(), p.setup + (p.setup ? '\n' : '') + p.header + '\n' + p.solution, { allowedTactics: p.allowedTactics });
  return [...new Set(r.decls.flatMap((d) => d.usedTactics))];
}

/** The puzzle, restricted to the level's inventory, if it fits the level; else null. */
function fit(p: ReturnType<typeof generator.generate>, focus: PracticeFocus, inventory: Set<string>, maxRating: number): ProofPuzzle | null {
  if (p.kind !== 'proof' || p.family !== focus.family || p.rating > maxRating) return null;
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
  const seen = new Set<string>();
  for (const r of [round - 2, round - 1]) if (r >= 0) for (const p of practiceSet(levelId, r, 99)) seen.add(statementKey(p));
  const out: ProofPuzzle[] = [];
  for (let i = 0; i < TARGETS.length; i++) {
    for (let t = 0; t < TRIES; t++) {
      const target = clamp(focus.family, TARGETS[i] + bandOf(t));
      const raw = generator.generate({ seed: `practice:${levelId}:${round}:${i}:${t}`, family: focus.family, target });
      const k = raw.kind === 'proof' ? statementKey(raw) : '';
      if (!k || seen.has(k)) continue;
      const p = fit(raw, focus, inventory, TARGETS[i] + 300);
      if (!p) continue;
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
    const lo = generator.range[focus.family][0];
    for (let t = 0; t < TRIES; t++) {
      const target = lo + bandOf(t);
      const raw = generator.generate({ seed: `practice:${levelId}:small:${t}`, family: focus.family, target });
      const p = fit(raw, focus, inventory, lo + 450);
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
