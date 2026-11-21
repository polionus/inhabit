/** Wires the pure recommender (src/state/recommend.ts) to the stores, content registries and router. */
import { useMemo } from 'react';
import { recommend, skipKey, type Rec, type RecInput } from '../state/recommend.ts';
import { dayKey } from '../state/days.ts';
import { streakInfo } from '../state/core.ts';
import { practiceLevels } from '../arena/practiceLevels.ts';
import { chapterMeta } from '../content/chapters/meta.ts';
import { exhibitsForWorld } from '../gallery/registry.ts';
import { useArenaSummary } from '../arena/state/summary.ts';
import { data } from './data.ts';
import { useGame, game } from './game.ts';
import { href } from './router.ts';

const chapters: ReadonlySet<string> = new Set(chapterMeta.map((c) => c.worldId));
const links: RecInput['links'] = {
  level: href.level, practice: href.practice, chapter: href.chapter, gallery: (id) => href.gallery(id),
  review: '#/review', daily: href.arena('daily'), workshop: href.to('workshop'),
};

export function useRecommendations(n = 3, after?: RecInput['after']): Rec[] {
  const save = useGame((s) => s.save);
  const { dailyDone } = useArenaSummary();
  const afterKey = after ? `${after.levelId}|${after.hints}|${after.studied}` : '';
  return useMemo(() => {
    const now = Date.now();
    const st = streakInfo(save, now);
    try {
      return recommend({
        worlds: data.worlds, levels: save.levels, deck: save.deck, seen: save.seen, today: save.today,
        activeDays: save.activeDays, streak: { current: st.current, activeToday: st.activeToday }, now, dayKey: dayKey(now),
        dailyDone, practiceable: (id) => practiceLevels.has(id), chapters, exhibitsFor: exhibitsForWorld, links, after,
      }, n);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, dailyDone, n, afterKey]);
}

/** "Not now": hide this suggestion until tomorrow. */
export const dismissRec = (r: Rec): void => game().markSeen(skipKey(dayKey(Date.now()), r.key));
