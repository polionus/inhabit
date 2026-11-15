/**
 * Should a level's lesson start expanded? FROZEN signature; the body is a stub to be replaced.
 * Rule to implement (SPEC \u00a712.3): with `lessonMode === 'auto'`, open only for an unsolved level
 * that introduces something new, and never on a narrow (phone) viewport.
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

export function lessonDefaultOpen(i: LessonDefaultInput): boolean {
  return i.mode === 'play' && !i.passed && i.settings.lessonsOpen;
}
