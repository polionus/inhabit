/** Registry of long-form prose per world. Pure data; orchestrator-owned. */
import type { LevelLesson, WorldLessons } from '../types.ts';
import { lessons as types } from './types.ts';
import { lessons as props } from './props.ts';
import { lessons as logic } from './logic.ts';
import { lessons as quant } from './quant.ts';
import { lessons as eq } from './eq.ts';
import { lessons as nat } from './nat.ts';
import { lessons as sets } from './sets.ts';
import { lessons as fun } from './fun.ts';
import { lessons as num } from './num.ts';
import { lessons as forge } from './forge.ts';

export const allLessons: WorldLessons[] = [types, props, logic, quant, eq, nat, sets, fun, num, forge];

const byWorld = new Map(allLessons.map((l) => [l.worldId, l]));

export const worldLessons = (worldId: string): WorldLessons | undefined => byWorld.get(worldId);

export function levelLesson(levelId: string): LevelLesson | undefined {
  for (const w of allLessons) {
    const l = w.levels[levelId];
    if (l) return l;
  }
  return undefined;
}
