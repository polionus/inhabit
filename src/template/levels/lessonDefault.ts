import type { Settings } from '../state/game.ts';
import type { TemplateLevel, TemplateWorld } from '../types.ts';

export interface LessonDefaultConfig {
  firstWorldId?: string;
  openingCount?: number;
  isIntroducing?: (world: TemplateWorld, level: TemplateLevel, index: number) => boolean;
}

export interface LessonDefaultInput {
  world: TemplateWorld;
  level: TemplateLevel;
  index: number;
  mode: 'play' | 'review';
  passed: boolean;
  settings: Pick<Settings, 'lessonMode' | 'lessonsOpen'>;
  narrow: boolean;
  config?: LessonDefaultConfig;
}

const defaultIsIntroducing = (_world: TemplateWorld, level: TemplateLevel, index: number): boolean =>
  (level.unlocks?.tactics?.length ?? 0) > 0 ||
  (level.unlocks?.items?.length ?? 0) > 0 ||
  (level.unlocks?.codex?.length ?? 0) > 0 ||
  index === 0;

export function lessonDefaultOpen(i: LessonDefaultInput): boolean {
  if (i.mode !== 'play' || i.passed) return false;
  const m = i.settings.lessonMode;
  if (m === 'closed') return false;
  if (m === 'open') return true;
  if (i.narrow) return false;
  const firstWorld = i.config?.firstWorldId;
  const openingCount = i.config?.openingCount ?? 0;
  if (firstWorld && i.world.id === firstWorld && i.index < openingCount) return false;
  const fn = i.config?.isIntroducing ?? defaultIsIntroducing;
  return fn(i.world, i.level, i.index);
}
