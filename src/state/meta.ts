/**
 * Game layer v2 (SPEC §11.2): stars, player level, daily quests, streaks. Pure functions over
 * SaveData. The SIGNATURES here are a contract with the UI; the bodies are stubs to be replaced.
 */
import type { DeckItem } from './leitner.ts';
import type { SaveData } from './game.ts';
import { currentStreak, dayKey } from './game.ts';
import { isPassed, requiredLevels, type LevelProgress, type WorldLike } from './progress.ts';

export type Stars = 0 | 1 | 2 | 3;

/** 1 = passed; 2 = solved cleanly; 3 = clean and re-solved in Review at least once. */
export function starsFor(p: LevelProgress | undefined, d: DeckItem | undefined): Stars {
  if (!isPassed(p)) return 0;
  if (!p?.clean || p.status !== 'solved') return 1;
  return d && d.reps > 0 ? 3 : 2;
}

/** Stars over a world's required levels. */
export function worldStars(w: WorldLike, save: SaveData): { earned: number; total: number } {
  const req = requiredLevels(w);
  return { earned: req.reduce((n, l) => n + starsFor(save.levels[l.id], save.deck[l.id]), 0), total: req.length * 3 };
}

/** Player level from total XP. `into` / `span` = XP into the current level / XP the level spans. */
export function playerLevel(xp: number): { level: number; into: number; span: number; frac: number } {
  const span = 100;
  return { level: 1 + Math.floor(xp / span), into: xp % span, span, frac: (xp % span) / span };
}

export interface Quest {
  /** Stable for the day, e.g. `2026-11-12:solve-levels`. */
  id: string;
  title: string;
  /** One short sentence. */
  desc: string;
  goal: number;
  progress: number;
  done: boolean;
  /** XP awarded once, automatically, when the quest completes. */
  xp: number;
  /** Hash route that helps complete it, e.g. '#/review'. */
  href: string;
}

/** Today's three quests with live progress. Deterministic for a given day and save. */
export function todaysQuests(_save: SaveData, _worlds: WorldLike[], now: number): Quest[] {
  const d = dayKey(now);
  return [{ id: `${d}:stub`, title: 'Solve a level', desc: 'Finish any level today.', goal: 1, progress: 0, done: false, xp: 10, href: '#/map' }];
}

export interface StreakInfo {
  /** Consecutive active days, forgiving one rest day per week. */
  current: number;
  best: number;
  activeToday: boolean;
  /** True if a rest day is currently bridging the streak. */
  restUsed: boolean;
}

export function streakInfo(save: SaveData, now: number): StreakInfo {
  const current = currentStreak(save.activeDays, now);
  return { current, best: current, activeToday: save.activeDays.includes(dayKey(now)), restUsed: false };
}
