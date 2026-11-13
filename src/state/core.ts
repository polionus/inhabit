/**
 * Pure rules behind SPEC §11.2: stars, player level, streaks. Re-exported by `meta.ts`.
 * Kept separate from `game.ts` so badges can use them without an import cycle.
 */
import type { DeckItem } from './leitner.ts';
import type { SaveData } from './game.ts';
import { dayIndex, dayKey } from './days.ts';
import { isPassed, requiredLevels, type LevelProgress, type WorldLike } from './progress.ts';

export type Stars = 0 | 1 | 2 | 3;

/**
 * 1 = passed (solved or studied); 2 = status `solved` and `clean` (no hints, solution never shown);
 * 3 = two stars and at least one passed review recorded (`reps > lapses`; a failed review alone never counts).
 * A level only "studied" is capped at 1 star. `applyCompletion` upgrades studied -> solved and sets `clean`
 * only when the later solve is itself clean, so it can reach 2 stars only by a clean solve.
 */
export function starsFor(p: LevelProgress | undefined, d: DeckItem | undefined): Stars {
  if (!isPassed(p)) return 0;
  if (!p?.clean || p.status !== 'solved') return 1;
  return d && d.reps > d.lapses ? 3 : 2;
}

/** Stars over a world's required levels. */
export function worldStars(w: WorldLike, save: SaveData): { earned: number; total: number } {
  const req = requiredLevels(w);
  return { earned: req.reduce((n, l) => n + starsFor(save.levels[l.id], save.deck[l.id]), 0), total: req.length * 3 };
}

/** Total stars over the given worlds' required levels. */
export function totalStars(worlds: WorldLike[], save: SaveData): number {
  return worlds.reduce((n, w) => n + worldStars(w, save).earned, 0);
}

/** XP needed to go from level n to n+1: 40 + 12n (52, 64, 76, ...). */
export const levelCost = (n: number): number => 40 + 12 * n;

/**
 * Player level from total XP. Level 1 at 0 XP; cumulative XP to reach level L is 40(L-1) + 6L(L-1)
 * (L=10: 600, L=20: 3040, L=22: 3612, L=25: 4560), so finishing the game (~3000-4000 XP) lands at 20-23.
 * `into` / `span` = XP into the current level / XP the level spans.
 */
export function playerLevel(xp: number): { level: number; into: number; span: number; frac: number } {
  let rest = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let level = 1;
  while (rest >= levelCost(level)) {
    rest -= levelCost(level);
    level++;
  }
  const span = levelCost(level);
  return { level, into: rest, span, frac: rest / span };
}

export interface StreakInfo {
  /** Consecutive active days (rest days bridge but are not counted), forgiving one rest day per rolling 7 days. */
  current: number;
  best: number;
  activeToday: boolean;
  /** True if a rest day is bridging the current streak. */
  restUsed: boolean;
}

/** Run of active days ending at `end` (an active day index), walking backwards, one forgiven gap per 7 days. */
function runEndingAt(set: Set<number>, end: number): { n: number; rest: boolean } {
  let n = 0;
  let rest = false;
  let lastRest = Infinity;
  let t = end;
  for (;;) {
    if (set.has(t)) {
      n++;
      t--;
    } else if (set.has(t - 1) && lastRest - t >= 7) {
      // exactly one missing day, and no rest day within 7 days of it
      lastRest = t;
      rest = true;
      t--;
    } else break;
  }
  return { n, rest };
}

const indices = (days: string[]): Set<number> => new Set(days.map(dayIndex).filter((x) => Number.isFinite(x)));

/** Longest streak ever (same forgiving rule as `streakInfo`). */
export function longestStreak(days: string[]): number {
  const set = indices(days);
  let best = 0;
  for (const i of set) best = Math.max(best, runEndingAt(set, i).n);
  return best;
}

export function streakInfo(save: SaveData, now: number): StreakInfo {
  const set = indices(save.activeDays);
  const today = dayIndex(dayKey(now));
  const activeToday = set.has(today);
  const end = activeToday ? today : today - 1;
  const run = set.has(end) ? runEndingAt(set, end) : { n: 0, rest: false };
  return { current: run.n, best: Math.max(run.n, longestStreak(save.activeDays)), activeToday, restUsed: run.rest };
}
