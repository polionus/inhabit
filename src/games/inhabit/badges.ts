import { BADGES, RANKS, type BadgeDef, type RankDef } from '../../template/state/game.ts';
import type { QuestOptions } from '../../template/state/meta.ts';
import type { IconName } from '../../template/components/kit.tsx';

export const INHABIT_RANKS: readonly RankDef[] = RANKS;
export const INHABIT_BADGES: BadgeDef[] = BADGES;

export const INHABIT_BADGE_GROUPS: { id: string; title: string; icon: IconName }[] = [
  { id: 'path', title: 'The path', icon: 'map' },
  { id: 'craft', title: 'Craft', icon: 'workshop' },
  { id: 'memory', title: 'Memory', icon: 'review' },
  { id: 'practice', title: 'Practice', icon: 'bolt' },
  { id: 'reading', title: 'Reading', icon: 'guide' },
  { id: 'arena', title: 'Arena', icon: 'arena' },
];

export const INHABIT_QUEST_OPTIONS: QuestOptions = {
  hasArena: true,
  hasPractice: true,
  hasGuide: true,
  arenaUnlockWorldId: 'logic',
  practiceWorlds: ['props', 'logic', 'quant', 'sets'],
};
