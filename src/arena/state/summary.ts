/**
 * What the app shell shows about the Arena (sidebar player card, home page).
 * Stub: the arena agent replaces the body with a hook over the arena store. Signature is frozen.
 */
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
  return { rating: null, dailyDone: false, dailyStreak: 0, solved: 0 };
}
