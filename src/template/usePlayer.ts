/** Derived player numbers for the shell, home and profile. */
import { useMemo } from 'react';
import { useDisc } from './context.tsx';
import { useGame } from './store.ts';
import { rankFor } from './state/game.ts';
import { playerLevel, streakInfo, todaysQuests, totalStars, type Quest, type StreakInfo } from './state/meta.ts';
import { reviewReady } from './state/leitner.ts';
import { requiredLevels } from './state/progress.ts';

export interface PlayerView {
  xp: number;
  level: ReturnType<typeof playerLevel>;
  rank: ReturnType<typeof rankFor>;
  streak: StreakInfo;
  stars: number;
  starsMax: number;
  ready: number;
  due: number;
}

export function usePlayer(): PlayerView {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  return useMemo(() => {
    const now = Date.now();
    let stars = 0;
    try {
      stars = totalStars(disc.worlds, save);
    } catch {
      stars = 0;
    }
    const liveReady = reviewReady(Object.fromEntries(Object.entries(save.deck).filter(([id]) => disc.findLevel(id))), now);
    return {
      xp: save.xp,
      level: playerLevel(save.xp),
      rank: rankFor(save.xp, disc.progression?.ranks),
      streak: streakInfo(save, now),
      stars,
      starsMax: disc.worlds.reduce((n, w) => n + requiredLevels(w).length * 3, 0),
      ready: liveReady,
      due: liveReady,
    };
  }, [disc, save]);
}

export function useQuests(): Quest[] {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  return useMemo(() => {
    try {
      return todaysQuests(save, disc.worlds, Date.now(), disc.progression?.questOptions);
    } catch {
      return [];
    }
  }, [disc, save]);
}
