/** Save-data shape, migration, ranks, XP, streaks, badges and the pure state transitions. */
import { afterReview, newItem, retune, type DeckItem } from './leitner.ts';
import { addDay, currentStreak, dayKey } from './days.ts';
import { longestStreak, playerLevel, starsFor, totalStars, worldStars } from './core.ts';
import {
  applyTestOut,
  bossIndex,
  emptyProgress,
  isPassed,
  requiredLevels,
  worldComplete,
  worldIsEmpty,
  type LevelLike,
  type LevelProgress,
  type Progress,
  type Rating,
  type WorldLike,
} from './progress.ts';

export const SAVE_VERSION = 1;

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  fontSize: number;
  strictInventory: boolean;
  motion: 'system' | 'reduce' | 'full';
  /** Sound effects (synthesised, quiet). */
  sound: boolean;
  /** Lessons start expanded in the level task panel. */
  lessonsOpen: boolean;
}

export interface SavedTheorem {
  id: string;
  name: string;
  english: string;
  binders: string;
  defs: string;
  statement: string;
  proof: string;
  complete: boolean;
  createdAt: number;
  /** Free-form theorems (started from an idea): the whole source, used instead of the fields above. */
  source?: string;
}

export interface WorkshopDraft {
  step: number;
  english: string;
  binders: string;
  defs: string;
  statement: string;
  proof: string;
  name: string;
  checks: boolean[];
}

export interface SaveData {
  version: number;
  levels: Progress;
  deck: Record<string, DeckItem>;
  xp: number;
  activeDays: string[];
  badges: Record<string, number>;
  settings: Settings;
  theorems: SavedTheorem[];
  welcomed: boolean;
  drafts: Record<string, string>;
  reviewsPassed: number;
  workshop: WorkshopDraft;
  sandbox: string;
  /** Things seen once (screen intros, primers, guide articles): key → timestamp. */
  seen: Record<string, number>;
  /** Activity of the current local day; replaced by an empty log when the day changes. */
  today: DayLog;
  /** Lifetime counters (keys in `STAT_KEYS`). */
  stats: Record<string, number>;
}

export interface DayLog {
  /** `YYYY-MM-DD` the counts belong to ('' before any activity). */
  day: string;
  /** levels, clean, reviews, stars3, puzzles (rated, solved), daily, rushBest (max), duelWins, guide. */
  counts: Record<string, number>;
  /** Ids of quests whose XP has been awarded today. */
  questsDone: string[];
}

/** Lifetime stat keys: quests, puzzles (solved), ratedSolved, daily (distinct days), rushBest (max), duelWins, guide (distinct articles), primers (distinct). */
export const STAT_KEYS = ['quests', 'puzzles', 'ratedSolved', 'daily', 'rushBest', 'duelWins', 'guide', 'primers'] as const;

export const emptyDay = (day = ''): DayLog => ({ day, counts: {}, questsDone: [] });

/** The day log for `now`: the stored one if it is today's, else a fresh empty one. */
export const logFor = (save: SaveData, now: number): DayLog => (save.today.day === dayKey(now) ? save.today : emptyDay(dayKey(now)));

/** Add `n` to a day-log counter (or take the max with `n` when `max`). Marks nothing else. */
export function bumpDay(save: SaveData, now: number, key: string, n = 1, max = false): SaveData {
  const log = logFor(save, now);
  const cur = log.counts[key] ?? 0;
  const v = max ? Math.max(cur, n) : cur + n;
  return { ...save, today: { ...log, counts: { ...log.counts, [key]: v } } };
}

export function bumpStat(save: SaveData, key: string, n = 1, max = false): SaveData {
  const cur = save.stats[key] ?? 0;
  return { ...save, stats: { ...save.stats, [key]: max ? Math.max(cur, n) : cur + n } };
}

export const defaultSettings = (): Settings => ({
  theme: 'system',
  fontSize: 15,
  strictInventory: true,
  motion: 'system',
  sound: true,
  lessonsOpen: true,
});

export const emptyWorkshop = (): WorkshopDraft => ({
  step: 1,
  english: '',
  binders: '',
  defs: '',
  statement: '',
  proof: '  sorry',
  name: '',
  checks: [false, false, false, false],
});

export const defaultSandbox = `#check Nat.add_comm
#eval 2 + 3

theorem and_swap (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by
  sorry
`;

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  levels: {},
  deck: {},
  xp: 0,
  activeDays: [],
  badges: {},
  settings: defaultSettings(),
  theorems: [],
  welcomed: false,
  drafts: {},
  reviewsPassed: 0,
  workshop: emptyWorkshop(),
  sandbox: defaultSandbox,
  seen: {},
  today: emptyDay(),
  stats: {},
});

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const str = (x: unknown, d: string) => (typeof x === 'string' ? x : d);

/** Accept anything; return a valid SaveData. Unknown/invalid fields fall back to defaults. */
export function migrate(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  const out = d;
  if (isObj(raw.levels)) {
    for (const [id, v] of Object.entries(raw.levels)) {
      if (!isObj(v)) continue;
      const status = v.status === 'solved' || v.status === 'studied' ? v.status : 'unseen';
      const lp: LevelProgress = { status, hintsUsed: num(v.hintsUsed, 0), attempts: num(v.attempts, 0) };
      if (typeof v.best === 'string') lp.best = v.best;
      if (typeof v.clean === 'boolean') lp.clean = v.clean;
      if (typeof v.testedOut === 'boolean') lp.testedOut = v.testedOut;
      if (typeof v.selfAssessed === 'boolean') lp.selfAssessed = v.selfAssessed;
      if (v.rating === 'easy' || v.rating === 'right' || v.rating === 'hard') lp.rating = v.rating;
      if (typeof v.firstPassAt === 'number') lp.firstPassAt = v.firstPassAt;
      out.levels[id] = lp;
    }
  }
  if (isObj(raw.deck)) {
    for (const [id, v] of Object.entries(raw.deck)) {
      if (!isObj(v)) continue;
      out.deck[id] = {
        box: Math.max(1, Math.min(5, Math.round(num(v.box, 1)))),
        due: num(v.due, 0),
        last: num(v.last, 0),
        reps: num(v.reps, 0),
        lapses: num(v.lapses, 0),
      };
    }
  }
  out.xp = Math.max(0, num(raw.xp, 0));
  if (Array.isArray(raw.activeDays)) out.activeDays = raw.activeDays.filter((x): x is string => typeof x === 'string');
  if (isObj(raw.badges)) for (const [k, v] of Object.entries(raw.badges)) if (typeof v === 'number') out.badges[k] = v;
  if (isObj(raw.settings)) {
    const s = raw.settings;
    out.settings = {
      theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
      fontSize: Math.max(11, Math.min(24, num(s.fontSize, 15))),
      strictInventory: typeof s.strictInventory === 'boolean' ? s.strictInventory : true,
      motion: s.motion === 'reduce' || s.motion === 'full' ? s.motion : 'system',
      sound: typeof s.sound === 'boolean' ? s.sound : true,
      lessonsOpen: typeof s.lessonsOpen === 'boolean' ? s.lessonsOpen : true,
    };
  }
  if (Array.isArray(raw.theorems)) {
    out.theorems = raw.theorems.filter(isObj).map((t) => ({
      id: str(t.id, String(Math.random())),
      name: str(t.name, 'theorem'),
      english: str(t.english, ''),
      binders: str(t.binders, ''),
      defs: str(t.defs, ''),
      statement: str(t.statement, ''),
      proof: str(t.proof, ''),
      complete: t.complete === true,
      createdAt: num(t.createdAt, 0),
      ...(typeof t.source === 'string' ? { source: t.source } : {}),
    }));
  }
  out.welcomed = raw.welcomed === true;
  if (isObj(raw.drafts)) for (const [k, v] of Object.entries(raw.drafts)) if (typeof v === 'string') out.drafts[k] = v;
  out.reviewsPassed = Math.max(0, num(raw.reviewsPassed, 0));
  if (isObj(raw.workshop)) {
    const w = raw.workshop;
    const base = emptyWorkshop();
    out.workshop = {
      step: Math.max(1, Math.min(5, Math.round(num(w.step, 1)))),
      english: str(w.english, ''),
      binders: str(w.binders, ''),
      defs: str(w.defs, ''),
      statement: str(w.statement, ''),
      proof: str(w.proof, base.proof),
      name: str(w.name, ''),
      checks: Array.isArray(w.checks) ? base.checks.map((_, i) => (w.checks as unknown[])[i] === true) : base.checks,
    };
  }
  out.sandbox = str(raw.sandbox, d.sandbox);
  if (isObj(raw.seen)) for (const [k, v] of Object.entries(raw.seen)) if (typeof v === 'number') out.seen[k] = v;
  if (isObj(raw.today)) {
    const t = raw.today;
    const counts: Record<string, number> = {};
    if (isObj(t.counts)) for (const [k, v] of Object.entries(t.counts)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) counts[k] = v;
    out.today = {
      day: str(t.day, ''),
      counts,
      questsDone: Array.isArray(t.questsDone) ? t.questsDone.filter((x): x is string => typeof x === 'string') : [],
    };
  }
  if (isObj(raw.stats)) for (const [k, v] of Object.entries(raw.stats)) if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out.stats[k] = v;
  out.version = SAVE_VERSION;
  return out;
}

/* ---------- days, streaks (see days.ts, core.ts) ---------- */

export { addDay, currentStreak, dayKey };

/* ---------- ranks, XP ---------- */

export const RANKS = [
  { xp: 0, title: 'Wanderer' },
  { xp: 80, title: 'Surveyor' },
  { xp: 250, title: 'Draftsperson' },
  { xp: 600, title: 'Cartographer' },
  { xp: 1200, title: 'Navigator' },
  { xp: 2200, title: 'Pathfinder' },
  { xp: 3600, title: 'Atlas Keeper' },
] as const;

export function rankFor(xp: number): { title: string; index: number; next?: { title: string; at: number }; frac: number } {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (xp >= r.xp) index = i;
  });
  const next = RANKS[index + 1];
  const frac = next ? (xp - RANKS[index].xp) / (next.xp - RANKS[index].xp) : 1;
  return { title: RANKS[index].title, index, next: next ? { title: next.title, at: next.xp } : undefined, frac };
}

const BASE_XP: Record<string, number> = { proof: 20, parsons: 10, choice: 8, predict: 8, formalize: 25 };

export function xpFor(level: LevelLike, o: { studied: boolean; clean: boolean }): number {
  if (o.studied) return 5;
  const base = (BASE_XP[level.kind] ?? 10) * (level.boss ? 2 : 1);
  return base + (o.clean ? 5 : 0);
}

/* ---------- badges ---------- */

export interface BadgeCtx {
  save: SaveData;
  worlds: WorldLike[];
}

export interface BadgeDef {
  id: string;
  /** For grouping on the profile page. */
  group?: 'path' | 'craft' | 'memory' | 'arena' | 'reading';
  title: string;
  desc: string;
  test: (c: BadgeCtx) => boolean;
}

const allLevels = (c: BadgeCtx): LevelLike[] => c.worlds.flatMap((w) => w.levels);
const passedLevels = (c: BadgeCtx) => allLevels(c).filter((l) => isPassed(c.save.levels[l.id]));
const completeWorlds = (c: BadgeCtx) =>
  c.worlds.filter((w) => !worldIsEmpty(w) && worldComplete(w, c.save.levels));

const stat = (c: BadgeCtx, k: string) => c.save.stats[k] ?? 0;
const hasThirdStar = (c: BadgeCtx) => allLevels(c).some((l) => starsFor(c.save.levels[l.id], c.save.deck[l.id]) === 3);
const readCount = (c: BadgeCtx, prefix: string) => Object.keys(c.save.seen).filter((k) => k.startsWith(prefix)).length;

export const BADGES: BadgeDef[] = [
  // path: progress along the map
  { id: 'first-step', group: 'path', title: 'First inhabitant', desc: 'Complete your first level.', test: (c) => passedLevels(c).length >= 1 },
  { id: 'first-world', group: 'path', title: 'Region charted', desc: 'Complete a whole world.', test: (c) => completeWorlds(c).length >= 1 },
  { id: 'halfway', group: 'path', title: 'Halfway across the map', desc: 'Complete half of the worlds.', test: (c) => c.worlds.length > 0 && completeWorlds(c).length * 2 >= c.worlds.length },
  { id: 'atlas', group: 'path', title: 'Atlas complete', desc: 'Complete every world.', test: (c) => c.worlds.length > 0 && completeWorlds(c).length === c.worlds.length },
  { id: 'stars-25', group: 'path', title: 'Constellation', desc: 'Earn 25 stars across the levels.', test: (c) => totalStars(c.worlds, c.save) >= 25 },
  { id: 'stars-100', group: 'path', title: 'Night sky', desc: 'Earn 100 stars across the levels.', test: (c) => totalStars(c.worlds, c.save) >= 100 },
  { id: 'world-3stars', group: 'path', title: 'Every star in a world', desc: 'Earn all three stars on every level of one world.', test: (c) => c.worlds.some((w) => { const s = worldStars(w, c.save); return s.total > 0 && s.earned === s.total; }) },
  { id: 'quest-1', group: 'path', title: 'Errand run', desc: 'Complete a daily quest.', test: (c) => stat(c, 'quests') >= 1 },
  { id: 'quest-10', group: 'path', title: 'Ten errands', desc: 'Complete ten daily quests.', test: (c) => stat(c, 'quests') >= 10 },
  { id: 'quest-50', group: 'path', title: 'Fifty errands', desc: 'Complete fifty daily quests.', test: (c) => stat(c, 'quests') >= 50 },
  { id: 'regular', group: 'path', title: 'Regular', desc: 'Visit on seven different days.', test: (c) => c.save.activeDays.length >= 7 },
  { id: 'streak-3', group: 'path', title: 'Three in a row', desc: 'Keep a three-day streak.', test: (c) => longestStreak(c.save.activeDays) >= 3 },
  { id: 'streak-7', group: 'path', title: 'A full week', desc: 'Keep a seven-day streak.', test: (c) => longestStreak(c.save.activeDays) >= 7 },
  { id: 'streak-30', group: 'path', title: 'A month of days', desc: 'Keep a thirty-day streak.', test: (c) => longestStreak(c.save.activeDays) >= 30 },
  { id: 'level-10', group: 'path', title: 'Level ten', desc: 'Reach player level 10.', test: (c) => playerLevel(c.save.xp).level >= 10 },
  { id: 'level-20', group: 'path', title: 'Level twenty', desc: 'Reach player level 20.', test: (c) => playerLevel(c.save.xp).level >= 20 },
  // craft: how you solve
  { id: 'clean-solve', group: 'craft', title: 'No hints needed', desc: 'Solve a proof level without hints.', test: (c) => allLevels(c).some((l) => l.kind === 'proof' && c.save.levels[l.id]?.clean) },
  { id: 'first-term', group: 'craft', title: 'Term builder', desc: 'Finish a level where you write the proof term directly.', test: (c) => allLevels(c).some((l) => l.mode === 'term' && c.save.levels[l.id]?.status === 'solved' && !c.save.levels[l.id]?.testedOut) },
  { id: 'first-formal', group: 'craft', title: 'Translator', desc: 'Formalize an English statement.', test: (c) => allLevels(c).some((l) => l.kind === 'formalize' && isPassed(c.save.levels[l.id]) && !c.save.levels[l.id]?.testedOut) },
  { id: 'clean-boss', group: 'craft', title: 'Boss, cleanly', desc: 'Beat a boss level with no hints.', test: (c) => allLevels(c).some((l) => l.boss && c.save.levels[l.id]?.clean) },
  { id: 'test-out', group: 'craft', title: 'Shortcut earned', desc: 'Test out of a world by beating its boss.', test: (c) => Object.values(c.save.levels).some((p) => p.testedOut) },
  { id: 'workshop', group: 'craft', title: 'My own theorem', desc: 'Prove a theorem of your own in the Workshop.', test: (c) => c.save.theorems.some((t) => t.complete) },
  // memory: retention
  { id: 'review-10', group: 'memory', title: 'Remembering', desc: 'Pass ten review items.', test: (c) => c.save.reviewsPassed >= 10 },
  { id: 'box-5', group: 'memory', title: 'Long memory', desc: 'Bring a level to the top review box.', test: (c) => Object.values(c.save.deck).some((d) => d.box >= 5) },
  { id: 'first-3star', group: 'memory', title: 'Still there', desc: 'Earn a third star by re-solving a level in Review.', test: hasThirdStar },
  // arena
  { id: 'arena-first', group: 'arena', title: 'Into the Arena', desc: 'Solve a rated Arena puzzle.', test: (c) => stat(c, 'ratedSolved') >= 1 },
  { id: 'arena-10', group: 'arena', title: 'Ten puzzles', desc: 'Solve ten Arena puzzles.', test: (c) => stat(c, 'puzzles') >= 10 },
  { id: 'arena-100', group: 'arena', title: 'A hundred puzzles', desc: 'Solve one hundred Arena puzzles.', test: (c) => stat(c, 'puzzles') >= 100 },
  { id: 'daily-1', group: 'arena', title: 'Daily proof', desc: 'Finish a Daily Proof.', test: (c) => stat(c, 'daily') >= 1 },
  { id: 'daily-7', group: 'arena', title: 'Seven dailies', desc: 'Finish seven Daily Proofs.', test: (c) => stat(c, 'daily') >= 7 },
  { id: 'rush-10', group: 'arena', title: 'Quick hands', desc: 'Score 10 in Proof Rush.', test: (c) => stat(c, 'rushBest') >= 10 },
  { id: 'rush-25', group: 'arena', title: 'Fast and sound', desc: 'Score 25 in Proof Rush.', test: (c) => stat(c, 'rushBest') >= 25 },
  { id: 'duel-1', group: 'arena', title: 'First duel won', desc: 'Win a duel.', test: (c) => stat(c, 'duelWins') >= 1 },
  { id: 'duel-10', group: 'arena', title: 'Ten duels won', desc: 'Win ten duels.', test: (c) => stat(c, 'duelWins') >= 10 },
  // reading
  { id: 'guide-1', group: 'reading', title: 'Reader', desc: 'Read a Guide article to the end.', test: (c) => readCount(c, 'guide:') >= 1 },
  { id: 'guide-5', group: 'reading', title: 'Well read', desc: 'Read five Guide articles.', test: (c) => readCount(c, 'guide:') >= 5 },
  { id: 'primers-all', group: 'reading', title: 'Primed', desc: 'Read the primer of every world.', test: (c) => { const ws = c.worlds.filter((w) => !worldIsEmpty(w)); return ws.length > 0 && ws.every((w) => c.save.seen[`primer:${w.id}`]); } },
];

/** Badges newly earned given the state. */
export function newBadges(save: SaveData, worlds: WorldLike[]): string[] {
  const ctx = { save, worlds };
  return BADGES.filter((b) => !save.badges[b.id] && b.test(ctx)).map((b) => b.id);
}

export function withBadges(save: SaveData, worlds: WorldLike[], now: number): { save: SaveData; earned: string[] } {
  const earned = newBadges(save, worlds);
  if (!earned.length) return { save, earned };
  const badges = { ...save.badges };
  for (const id of earned) badges[id] = now;
  return { save: { ...save, badges }, earned };
}

/* ---------- transitions ---------- */

export interface Completion {
  studied: boolean;
  /** No hints used and solution never revealed. */
  clean: boolean;
  body?: string;
  selfAssessed?: boolean;
}

export interface CompletionResult {
  save: SaveData;
  xp: number;
  earned: string[];
  firstPass: boolean;
  testedOutWorld?: string;
}

export function applyCompletion(
  save: SaveData,
  worlds: WorldLike[],
  levelId: string,
  c: Completion,
  now: number,
): CompletionResult {
  const world = worlds.find((w) => w.levels.some((l) => l.id === levelId));
  const level = world?.levels.find((l) => l.id === levelId);
  const prev = save.levels[levelId] ?? emptyProgress();
  const wasPassed = isPassed(prev);
  let status = prev.status;
  let xp = 0;
  let firstPass = false;
  if (!wasPassed) {
    firstPass = true;
    status = c.studied ? 'studied' : 'solved';
    if (level) xp = xpFor(level, { studied: c.studied, clean: c.clean });
  } else if (prev.status === 'studied' && !c.studied) {
    status = 'solved';
    if (level) xp = Math.floor((BASE_XP[level.kind] ?? 10) / 2);
  }
  const entry: LevelProgress = {
    ...prev,
    status,
    best: c.body ?? prev.best,
    clean: prev.clean || (!c.studied && c.clean) || undefined,
    selfAssessed: c.selfAssessed || prev.selfAssessed,
    firstPassAt: prev.firstPassAt ?? now,
  };
  if (!entry.clean) delete entry.clean;
  if (!entry.selfAssessed) delete entry.selfAssessed;
  let levels: Progress = { ...save.levels, [levelId]: entry };
  const deck = { ...save.deck };
  if (firstPass && level && (level as { review?: boolean }).review !== false) {
    deck[levelId] = newItem(now, entry.rating, status === 'studied');
  }
  // Test out: beating a world's boss while earlier required levels are unpassed.
  let testedOutWorld: string | undefined;
  if (world && level?.boss && bossIndex(world) === world.levels.indexOf(level) && firstPass) {
    const open = requiredLevels(world).filter((l) => l.id !== levelId && !isPassed(levels[l.id]));
    if (open.length) {
      levels = applyTestOut(world, levels, now);
      testedOutWorld = world.id;
    }
  }
  let next: SaveData = { ...save, levels, deck, xp: save.xp + xp, activeDays: addDay(save.activeDays, now) };
  if (status === 'solved' && prev.status !== 'solved') next = bumpDay(next, now, 'levels');
  if (entry.clean && !prev.clean) next = bumpDay(next, now, 'clean');
  if (starsFor(entry, deck[levelId]) === 3 && starsFor(prev, save.deck[levelId]) < 3) next = bumpDay(next, now, 'stars3');
  next = { ...next, today: logFor(next, now) };
  const b = withBadges(next, worlds, now);
  next = b.save;
  return { save: next, xp, earned: b.earned, firstPass, testedOutWorld };
}

export function applyRating(save: SaveData, levelId: string, rating: Rating): SaveData {
  const prev = save.levels[levelId];
  if (!prev) return save;
  const deck = { ...save.deck };
  if (deck[levelId]) deck[levelId] = retune(deck[levelId], rating);
  return { ...save, levels: { ...save.levels, [levelId]: { ...prev, rating } }, deck };
}

export function applyReview(save: SaveData, worlds: WorldLike[], levelId: string, passed: boolean, now: number) {
  const item = save.deck[levelId] ?? newItem(now);
  const nextItem = afterReview(item, passed, now);
  let next: SaveData = {
    ...save,
    deck: { ...save.deck, [levelId]: nextItem },
    reviewsPassed: save.reviewsPassed + (passed ? 1 : 0),
    xp: save.xp + (passed ? 3 : 0),
    activeDays: addDay(save.activeDays, now),
  };
  if (passed) next = bumpDay(next, now, 'reviews');
  if (starsFor(next.levels[levelId], nextItem) === 3 && starsFor(save.levels[levelId], save.deck[levelId]) < 3) next = bumpDay(next, now, 'stars3');
  next = { ...next, today: logFor(next, now) };
  const b = withBadges(next, worlds, now);
  next = b.save;
  return { save: next, earned: b.earned };
}
