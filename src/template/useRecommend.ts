/** Wires the pure recommender (src/template/state/recommend.ts) to the active disc, stores and router. */
import { useMemo } from 'react';
import { recommend, skipKey, type Rec, type RecInput } from './state/recommend.ts';
import { dayKey } from './state/days.ts';
import { streakInfo } from './state/core.ts';
import { useDisc } from './context.tsx';
import { useGame, game } from './store.ts';
import { href } from './router.ts';

export function useRecommendations(n = 3, after?: RecInput['after']): Rec[] {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  const useExtras = disc.hooks?.useRecommendExtras;
  const extras = useExtras ? useExtras() : undefined;
  const afterKey = after ? `${after.levelId}|${after.hints}|${after.studied}` : '';

  const chapters: ReadonlySet<string> = useMemo(
    () => new Set((disc.chapters?.meta ?? []).map((c) => c.worldId)),
    [disc.chapters],
  );
  const exhibitsFor = useMemo(
    () => (worldId: string) =>
      (disc.gallery?.exhibits ?? [])
        .filter((e) => e.worlds.includes(worldId))
        .map((e) => ({ id: e.id, title: e.title })),
    [disc.gallery],
  );

  return useMemo(() => {
    const now = Date.now();
    const st = streakInfo(save, now);
    const links: RecInput['links'] = {
      level: href.level,
      practice: extras?.practiceLink ?? (() => ''),
      chapter: href.chapter,
      gallery: (id) => href.gallery(id),
      review: '#/review',
      daily: extras?.dailyLink ?? '',
      workshop: extras?.workshopLink ?? '',
    };
    const afterAll = disc.progression?.afterAllWorlds;
    try {
      return recommend(
        {
          worlds: disc.worlds,
          levels: save.levels,
          deck: save.deck,
          seen: save.seen,
          today: save.today,
          activeDays: save.activeDays,
          streak: { current: st.current, activeToday: st.activeToday },
          now,
          dayKey: dayKey(now),
          dailyDone: extras?.dailyDone ?? null,
          practiceable: extras?.practiceable ?? (() => false),
          chapters,
          exhibitsFor,
          links,
          completeAction: afterAll
            ? {
                key: 'after-all',
                href: afterAll.href,
                title: afterAll.title,
                reason: afterAll.reason,
              }
            : undefined,
          after,
        },
        n,
      );
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disc, save, extras?.dailyDone, n, afterKey, chapters, exhibitsFor]);
}

/** "Not now": hide this suggestion until tomorrow. */
export const dismissRec = (r: Rec): void => game().markSeen(skipKey(dayKey(Date.now()), r.key));
