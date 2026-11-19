/** Registry of chapter explainers (one blog-style article per world). Pure data; orchestrator-owned. */
import type { ChapterExplainer } from '../types.ts';
import { chapter as types } from './types.ts';
import { chapter as props } from './props.ts';
import { chapter as logic } from './logic.ts';
import { chapter as quant } from './quant.ts';
import { chapter as eq } from './eq.ts';
import { chapter as nat } from './nat.ts';
import { chapter as sets } from './sets.ts';
import { chapter as fun } from './fun.ts';
import { chapter as num } from './num.ts';
import { chapter as forge } from './forge.ts';

export const chapters: ChapterExplainer[] = [types, props, logic, quant, eq, nat, sets, fun, num, forge].filter(
  (c): c is ChapterExplainer => c !== undefined,
);

const byWorld = new Map(chapters.map((c) => [c.worldId, c]));

export const chapterFor = (worldId: string): ChapterExplainer | undefined => byWorld.get(worldId);
