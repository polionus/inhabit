/**
 * Pre-bound Lean environment helpers for Inhabit content, scripts, and tests.
 * Runs under Node and in the browser.
 */
import { createLeanEnv } from '../../domains/lean/env.ts';
import { engine } from '../../domains/lean/engine/index.ts';
import { allLemmas, levelContext } from './content/index.ts';

export type { Assembled, LevelSession } from '../../domains/lean/env.ts';

export const { envWithLemmas, fullEnv, assemble, levelSession, checkBody } = createLeanEnv({
  engine,
  allLemmas,
  levelContext,
  appName: 'Inhabit',
});
