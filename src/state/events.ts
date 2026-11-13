/**
 * Events other parts of the app report to the main game store (`game().recordEvent(e)`).
 * The store turns them into XP, daily-quest progress, badges and the activity calendar.
 * FROZEN contract between the core game state and the Arena.
 */
export type GameEvent =
  /** A generated Arena puzzle was finished (solved or failed/skipped). */
  | { type: 'arena-puzzle'; solved: boolean; rated: boolean; puzzleRating: number }
  /** The Daily Proof set was finished. */
  | { type: 'arena-daily'; solved: number; total: number; dateKey: string }
  /** A Proof Rush run ended. */
  | { type: 'arena-rush'; score: number; best: boolean }
  /** A duel ended. */
  | { type: 'arena-duel'; won: boolean; opponent: 'bot' | 'friend' }
  /** A Guide article was read to the end. */
  | { type: 'guide-read'; articleId: string }
  /** A world primer was read to the end. */
  | { type: 'primer-read'; worldId: string };

export interface EventResult {
  /** XP awarded for this event (0 if none). */
  xp: number;
}
