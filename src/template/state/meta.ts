/**
 * Game layer v2 (SPEC §11.2): stars, player level, daily quests, streaks. Pure functions over
 * SaveData. The SIGNATURES here are a contract with the UI. Stars, level and streak rules live in
 * `core.ts` and are re-exported here.
 */
import type { SaveData } from './game.ts';
import { bumpStat, dayKey, logFor } from './game.ts';
import { dueIds } from './leitner.ts';
import { isPassed, worldComplete, type WorldLike } from './progress.ts';
import { starsFor } from './core.ts';

export { levelCost, longestStreak, playerLevel, starsFor, streakInfo, totalStars, worldMastery, worldStars } from './core.ts';
export { masteryOf, type Mastery } from './progress.ts';
export type { Stars, StreakInfo } from './core.ts';

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

/* ---------- quest pool ---------- */

interface Ctx {
  save: SaveData;
  worlds: WorldLike[];
  day: string;
  counts: Record<string, number>;
  /** Items due now. */
  due: number;
  passed: number;
  unfinished: number;
  secondStars: number;
  /** World `logic` is complete: the player has the tactics Arena puzzles use. */
  logicDone: boolean;
  /** Passed a level in props, logic, quant or sets. */
  canPractice: boolean;
  /** Seeded numbers for this day, one per pool entry (stable). */
  pick: (key: string, options: number[]) => number;
}

export interface QuestTemplate {
  key: string;
  arena: boolean;
  curriculum: boolean;
  /** Counter in the day log that measures progress. */
  count: string;
  offered: (c: Ctx) => boolean;
  make: (c: Ctx) => { title: string; desc: string; goal: number; xp: number; href: string };
}

export interface QuestOptions {
  pool?: QuestTemplate[];
  arenaUnlockWorldId?: string;
  practiceWorlds?: string[];
  hasArena?: boolean;
  hasPractice?: boolean;
  hasGuide?: boolean;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const POOL: QuestTemplate[] = [
  {
    key: 'solve-levels', arena: false, curriculum: true, count: 'levels',
    offered: (c) => c.unfinished + (c.counts.levels ?? 0) > 0,
    make: (c) => {
      const goal = c.pick('solve-levels', [1, 2, 2, 3]);
      return { title: goal === 1 ? 'Solve a level' : `Solve ${goal} levels`, desc: `Finish ${goal} ${plural(goal, 'level', 'levels')} on the map today.`, goal, xp: 10 + 5 * goal, href: '#/map' };
    },
  },
  {
    key: 'clean-solve', arena: false, curriculum: true, count: 'clean',
    offered: (c) => c.unfinished + (c.counts.clean ?? 0) > 0,
    make: () => ({ title: 'Solve a level without hints', desc: 'Solve a level with no hints and without showing the solution.', goal: 1, xp: 20, href: '#/map' }),
  },
  {
    key: 'review', arena: false, curriculum: false, count: 'reviews',
    offered: (c) => c.due + (c.counts.reviews ?? 0) > 0,
    make: (c) => {
      const goal = Math.max(1, Math.min(c.pick('review', [2, 3, 4]), c.due + (c.counts.reviews ?? 0)));
      return { title: `Pass ${goal} review ${plural(goal, 'item', 'items')}`, desc: 'Re-solve what you learned earlier, from a blank start.', goal, xp: 10 + 4 * goal, href: '#/review' };
    },
  },
  {
    key: 'third-star', arena: false, curriculum: false, count: 'stars3',
    offered: (c) => c.secondStars + (c.counts.stars3 ?? 0) > 0,
    make: () => ({ title: 'Earn a third star', desc: 'Re-solve a cleanly solved level in Review.', goal: 1, xp: 25, href: '#/review' }),
  },
  {
    key: 'guide', arena: false, curriculum: false, count: 'guide',
    offered: () => true,
    make: () => ({ title: 'Read a Guide article', desc: 'Read any Guide article to the end.', goal: 1, xp: 10, href: '#/guide' }),
  },
  {
    key: 'practice-set', arena: false, curriculum: false, count: 'practiceSets',
    offered: (c) => c.canPractice || (c.counts.practiceSets ?? 0) > 0,
    make: () => ({ title: 'Finish a practice set', desc: 'Work through a short set of practice problems.', goal: 1, xp: 15, href: '#/map' }),
  },
  {
    key: 'daily', arena: true, curriculum: false, count: 'daily',
    offered: (c) => c.logicDone,
    make: () => ({ title: 'Finish the Daily Proof', desc: "Work through today's set of proofs.", goal: 1, xp: 20, href: '#/arena/daily' }),
  },
  {
    key: 'puzzles', arena: true, curriculum: false, count: 'puzzles',
    offered: (c) => c.logicDone,
    make: (c) => {
      const goal = c.pick('puzzles', [1, 2, 3]);
      return { title: `Solve ${goal} rated ${plural(goal, 'puzzle', 'puzzles')}`, desc: `Solve ${goal} rated Arena ${plural(goal, 'puzzle', 'puzzles')}.`, goal, xp: 10 + 5 * goal, href: '#/arena/puzzles' };
    },
  },
  {
    key: 'rush', arena: true, curriculum: false, count: 'rushBest',
    offered: (c) => c.logicDone && (c.save.stats.rushBest ?? 0) > 0,
    make: (c) => {
      const goal = c.pick('rush', [6, 8, 10, 12]);
      return { title: `Score ${goal} in Proof Rush`, desc: `Reach a score of ${goal} in a single Proof Rush run.`, goal, xp: 15 + goal, href: '#/arena/rush' };
    },
  },
  {
    key: 'duel', arena: true, curriculum: false, count: 'duelWins',
    offered: (c) => c.logicDone && (c.save.stats.duels ?? 0) > 0,
    make: () => ({ title: 'Win a duel', desc: 'Win one duel in the Arena.', goal: 1, xp: 25, href: '#/arena/duel' }),
  },
];

const PRACTICE_WORLDS = ['props', 'logic', 'quant', 'sets'];

/** FNV-1a string hash. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Today's three quests with live progress. Deterministic for a given day and save situation.
 * Selection: one curriculum quest while levels remain; Arena quests only once world `logic` is complete (rush and duel
 * only for players who have used that mode), at most one a day unless Arena puzzles were solved on three of the last
 * seven active days; the rest from a day-seeded shuffle of what is offered.
 * Review quests only appear when items are due (or were passed today), so the set stays stable as you work.
 */
export function todaysQuests(save: SaveData, worlds: WorldLike[], now: number, opts: QuestOptions = {}): Quest[] {
  const day = dayKey(now);
  const counts = logFor(save, now).counts;
  const levels = worlds.flatMap((w) => w.levels);
  const passed = levels.filter((l) => isPassed(save.levels[l.id])).length;
  const ids = new Set(levels.map((l) => l.id));
  const hasArena = opts.hasArena ?? true;
  const hasPractice = opts.hasPractice ?? true;
  const hasGuide = opts.hasGuide ?? true;
  const arenaWorldId = opts.arenaUnlockWorldId ?? 'logic';
  const practiceWorldIds = opts.practiceWorlds ?? PRACTICE_WORLDS;
  const pool = (opts.pool ?? POOL).filter((t) => {
    if (!hasArena && t.arena) return false;
    if (!hasPractice && t.key === 'practice-set') return false;
    if (!hasGuide && t.key === 'guide') return false;
    return true;
  });

  const ctx: Ctx = {
    save, worlds, day, counts,
    due: dueIds(save.deck, now).filter((id) => ids.has(id)).length,
    passed,
    unfinished: levels.filter((l) => !isPassed(save.levels[l.id])).length,
    logicDone: (() => {
      if (!hasArena) return false;
      if (!arenaWorldId) return true;
      const w = worlds.find((x) => x.id === arenaWorldId);
      return !!w && w.levels.length > 0 && worldComplete(w, save.levels);
    })(),
    canPractice: hasPractice && worlds.some((w) => practiceWorldIds.includes(w.id) && w.levels.some((l) => isPassed(save.levels[l.id]))),
    secondStars: levels.filter((l) => starsFor(save.levels[l.id], save.deck[l.id]) === 2).length,
    pick: (key, options) => options[hash(`${day}:${key}`) % options.length],
  };
  const random = rng(hash(day));
  const shuffled = pool.filter((t) => t.offered(ctx))
    .map((t) => ({ t, r: random() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.t);
  // Arena habit, judged on the last seven active days before today (so playing today does not reshuffle the quests).
  const recent = save.activeDays.filter((d) => d < day).slice(-7);
  const arenaDays = new Set(save.arenaDays ?? []);
  const arenaHabit = recent.filter((d) => arenaDays.has(d)).length >= 3;
  const maxArena = hasArena ? (arenaHabit ? 3 : 1) : 0;
  const chosen: QuestTemplate[] = [];
  const curriculum = shuffled.find((t) => t.curriculum);
  if (curriculum) chosen.push(curriculum);
  let arena = 0;
  for (const t of shuffled) {
    if (chosen.length >= 3) break;
    if (chosen.includes(t)) continue;
    if (t.arena && arena >= maxArena) continue;
    if (t.arena) arena++;
    chosen.push(t);
  }
  // Fallback for tiny pools: anything offered, then any non-Arena quest, so there are up to three.
  for (const t of shuffled) if (chosen.length < 3 && !chosen.includes(t) && (!t.arena || arena < maxArena)) chosen.push(t);
  for (const t of pool) if (chosen.length < 3 && !chosen.includes(t) && !t.arena) chosen.push(t);
  const log = logFor(save, now);
  return chosen.map((t) => {
    const m = t.make(ctx);
    const id = `${day}:${t.key}`;
    const awarded = log.questsDone.includes(id);
    const progress = Math.min(m.goal, counts[t.count] ?? 0);
    return { id, ...m, progress: awarded ? m.goal : progress, done: awarded || progress >= m.goal };
  });
}

/**
 * Award every newly completed quest of today exactly once: records its id in the day log, adds its XP and
 * bumps `stats.quests`. Returns the new save, toast texts and total quest XP.
 */
export function settleQuests(save: SaveData, worlds: WorldLike[], now: number, opts?: QuestOptions): { save: SaveData; toasts: string[]; xp: number } {
  let next: SaveData = { ...save, today: logFor(save, now) };
  const toasts: string[] = [];
  let xp = 0;
  for (const q of todaysQuests(next, worlds, now, opts)) {
    if (!q.done || next.today.questsDone.includes(q.id)) continue;
    next = { ...next, xp: next.xp + q.xp, today: { ...next.today, questsDone: [...next.today.questsDone, q.id] } };
    next = bumpStat(next, 'quests');
    xp += q.xp;
    toasts.push(`Quest complete: ${q.title} (+${q.xp} XP)`);
  }
  return { save: next, toasts, xp };
}
