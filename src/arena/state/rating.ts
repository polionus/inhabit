/** Elo-style rating maths for the Arena. Pure. */
export const START_RATING = 800;
export const FLOOR_RATING = 400;

/** Expected score of a player rated `player` against a puzzle rated `puzzle`. */
export function expectedScore(player: number, puzzle: number): number {
  return 1 / (1 + Math.pow(10, (puzzle - player) / 400));
}

/** K factor from the number of rated puzzles already finished. */
export function kFactor(ratedBefore: number): number {
  if (ratedBefore < 20) return 40;
  if (ratedBefore < 100) return 24;
  return 16;
}

export interface RatedOutcome {
  solved: boolean;
  hintsUsed: number;
  revealed: boolean;
  skipped: boolean;
}

/** 1 solved clean, 0.5 solved after a hint, 0 otherwise. */
export function scoreOf(o: RatedOutcome): number {
  if (!o.solved || o.revealed || o.skipped) return 0;
  return o.hintsUsed > 0 ? 0.5 : 1;
}

export function ratingChange(player: number, puzzle: number, ratedBefore: number, o: RatedOutcome): { delta: number; next: number } {
  const raw = kFactor(ratedBefore) * (scoreOf(o) - expectedScore(player, puzzle));
  const next = Math.max(FLOOR_RATING, Math.round(player + raw));
  return { delta: next - player, next };
}
