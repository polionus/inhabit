/** Derived player numbers for the shell, home and profile. */
import { useMemo } from 'react';
import { data } from './data.ts';
import { useGame } from './game.ts';
import { rankFor } from '../state/game.ts';
import { playerLevel, streakInfo, todaysQuests, totalStars, type Quest, type StreakInfo } from '../state/meta.ts';
import { dueIds } from '../state/leitner.ts';
import { requiredLevels } from '../state/progress.ts';

export interface PlayerView {
  xp: number;
  level: ReturnType<typeof playerLevel>;
  rank: ReturnType<typeof rankFor>;
  streak: StreakInfo;
  stars: number;
  starsMax: number;
  due: number;
}

export function usePlayer(): PlayerView {
  const save = useGame((s) => s.save);
  return useMemo(() => {
    const now = Date.now();
    let stars = 0;
    try {
      stars = totalStars(data.worlds, save);
    } catch {
      stars = 0;
    }
    return {
      xp: save.xp,
      level: playerLevel(save.xp),
      rank: rankFor(save.xp),
      streak: streakInfo(save, now),
      stars,
      starsMax: data.worlds.reduce((n, w) => n + requiredLevels(w).length * 3, 0),
      due: dueIds(save.deck, now).length,
    };
  }, [save]);
}

export function useQuests(): Quest[] {
  const save = useGame((s) => s.save);
  return useMemo(() => {
    try {
      return todaysQuests(save, data.worlds, Date.now());
    } catch {
      return [];
    }
  }, [save]);
}
