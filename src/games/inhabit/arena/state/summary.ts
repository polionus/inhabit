/**
 * What the app shell shows about the Arena (sidebar player card, home page).
 * Signature is frozen; the body reads the Arena store.
 */
import { utcDateKey } from '../plan.ts';
import { streakOn } from './model.ts';
import { useArena } from './store.ts';

export interface ArenaSummary {
  /** Arena rating, or null before the first rated puzzle. */
  rating: number | null;
  /** Today's Daily Proof already finished. */
  dailyDone: boolean;
  dailyStreak: number;
  /** Rated puzzles solved in total. */
  solved: number;
}

export function useArenaSummary(): ArenaSummary {
  const rating = useArena((s) => (s.rated > 0 ? s.rating : null));
  const solved = useArena((s) => s.solved);
  const today = utcDateKey(Date.now());
  const dailyDone = useArena((s) => s.daily[today]?.completed === true);
  const dailyStreak = useArena((s) => streakOn(s, today));
  return { rating, dailyDone, dailyStreak, solved };
}
