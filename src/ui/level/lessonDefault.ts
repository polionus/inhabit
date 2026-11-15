/**
 * Should a level's lesson start expanded? (SPEC §12.3: doing before reading.)
 *  - 'open': open on any unsolved level in play mode; 'closed': never.
 *  - 'auto': open only on an unsolved level in play mode, on a wide viewport, that introduces
 *    something new (it unlocks a tactic, or is the first level of its world). The first three
 *    levels of the very first world always start collapsed so the first minute is doing.
 * Review mode and passed levels never start open.
 */
import type { LevelContext } from '../../content/index.ts';
import type { Settings } from '../../state/game.ts';

export interface LessonDefaultInput {
  ctx: LevelContext;
  mode: 'play' | 'review';
  /** The level is already solved or studied. */
  passed: boolean;
  settings: Pick<Settings, 'lessonMode' | 'lessonsOpen'>;
  /** Viewport is at most 900px wide (the level screen is stacked). */
  narrow: boolean;
}

/** The first world's opening levels, kept collapsed so the first minute is doing. */
const FIRST_WORLD = 'types';
const COLLAPSED_OPENING = 3;

export function lessonDefaultOpen(i: LessonDefaultInput): boolean {
  if (i.mode !== 'play' || i.passed) return false;
  const m = i.settings.lessonMode;
  if (m === 'closed') return false;
  if (m === 'open') return true;
  if (i.narrow) return false;
  if (i.ctx.world.id === FIRST_WORLD && i.ctx.index < COLLAPSED_OPENING) return false;
  return (i.ctx.level.unlocks?.tactics?.length ?? 0) > 0 || i.ctx.index === 0;
}
