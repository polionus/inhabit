/**
 * Content registry: world order, prerequisite closure, and the per-level context
 * (which lemmas are loaded and which tactics are unlocked when a level is played).
 * Pure data + pure functions; no engine or UI imports.
 */
import type { CodexEntry, Lemma, Level, World } from './types.ts';
import { world as types } from './worlds/types.ts';
import { world as props } from './worlds/props.ts';
import { world as logic } from './worlds/logic.ts';
import { world as quant } from './worlds/quant.ts';
import { world as eq } from './worlds/eq.ts';
import { world as nat } from './worlds/nat.ts';
import { world as sets } from './worlds/sets.ts';
import { world as fun } from './worlds/fun.ts';
import { world as num } from './worlds/num.ts';
import { world as forge } from './worlds/forge.ts';

/** Topologically ordered: every world appears after all worlds it requires. */
export const worlds: World[] = [types, props, logic, quant, eq, nat, sets, fun, num, forge];

const worldById = new Map(worlds.map((w) => [w.id, w]));

export function getWorld(id: string): World {
  const w = worldById.get(id);
  if (!w) throw new Error(`Unknown world: ${id}`);
  return w;
}

/** All worlds that must be completed before `worldId` (transitive), in global order. Excludes itself. */
export function prerequisiteWorlds(worldId: string): World[] {
  const seen = new Set<string>();
  const visit = (id: string) => {
    for (const r of getWorld(id).requires) {
      if (!seen.has(r)) {
        seen.add(r);
        visit(r);
      }
    }
  };
  visit(worldId);
  return worlds.filter((w) => seen.has(w.id));
}

export function findLevel(levelId: string): { world: World; level: Level; index: number } {
  for (const world of worlds) {
    const index = world.levels.findIndex((l) => l.id === levelId);
    if (index >= 0) return { world, level: world.levels[index], index };
  }
  throw new Error(`Unknown level: ${levelId}`);
}

export const allLemmas: Lemma[] = worlds.flatMap((w) => w.lemmas);
export const allCodex: CodexEntry[] = worlds.flatMap((w) => w.codex);
const lemmaByName = new Map(allLemmas.map((l) => [l.name, l]));
export const getLemma = (name: string): Lemma | undefined => lemmaByName.get(name);
export const getCodex = (id: string): CodexEntry | undefined => allCodex.find((c) => c.id === id);

export interface LevelContext {
  world: World;
  level: Level;
  index: number;
  /** Lemma-bank entries loaded into the environment for this level, in dependency order. */
  lemmas: Lemma[];
  /** Canonical tactic names the learner may use in this level. */
  allowedTactics: string[];
  /** Codex ids visible by the time this level is played (including the ones it introduces). */
  codex: string[];
}

/**
 * What is available while playing `levelId`:
 *  - tactics: everything unlocked by prerequisite worlds and earlier levels of this world,
 *    plus this level's own `unlocks.tactics` (the tactic being taught) and `extraTactics`;
 *  - lemmas: `unlocks.lemmas` of EARLIER levels, plus `grants` up to and including this level.
 */
export function levelContext(levelId: string): LevelContext {
  const { world, level, index } = findLevel(levelId);
  const tactics = new Set<string>();
  const lemmaNames = new Set<string>();
  const codex = new Set<string>();
  const absorb = (l: Level, isCurrent: boolean) => {
    for (const t of l.unlocks?.tactics ?? []) tactics.add(t);
    for (const c of l.unlocks?.codex ?? []) codex.add(c);
    for (const g of l.grants ?? []) lemmaNames.add(g);
    if (!isCurrent) for (const n of l.unlocks?.lemmas ?? []) lemmaNames.add(n);
  };
  for (const w of prerequisiteWorlds(world.id)) for (const l of w.levels) absorb(l, false);
  world.levels.slice(0, index).forEach((l) => absorb(l, false));
  absorb(level, true);
  if (level.kind === 'proof') for (const t of level.extraTactics ?? []) tactics.add(t);
  return {
    world,
    level,
    index,
    lemmas: allLemmas.filter((l) => lemmaNames.has(l.name)),
    allowedTactics: [...tactics],
    codex: [...codex],
  };
}

/** Everything unlocked: used by the Sandbox and the final world. */
export function fullContext(): { lemmas: Lemma[]; codex: string[] } {
  return { lemmas: allLemmas, codex: allCodex.map((c) => c.id) };
}
