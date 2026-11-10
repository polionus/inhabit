/** Save-data shape, migration, ranks, XP, streaks, badges and the pure state transitions. */
import { afterReview, newItem, retune, type DeckItem } from './leitner.ts';
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
}

export const defaultSettings = (): Settings => ({
  theme: 'system',
  fontSize: 15,
  strictInventory: true,
  motion: 'system',
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
  out.version = SAVE_VERSION;
  return out;
}

/* ---------- days, streaks ---------- */

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDay(days: string[], now: number): string[] {
  const k = dayKey(now);
  return days.includes(k) ? days : [...days, k].sort();
}

/** Consecutive active days ending today, or yesterday (a missed day today is not shown as a loss). */
export function currentStreak(days: string[], now: number): number {
  const set = new Set(days);
  let t = now;
  if (!set.has(dayKey(t))) t -= 86_400_000;
  let n = 0;
  while (set.has(dayKey(t))) {
    n++;
    t -= 86_400_000;
  }
  return n;
}

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
  title: string;
  desc: string;
  test: (c: BadgeCtx) => boolean;
}

const allLevels = (c: BadgeCtx): LevelLike[] => c.worlds.flatMap((w) => w.levels);
const passedLevels = (c: BadgeCtx) => allLevels(c).filter((l) => isPassed(c.save.levels[l.id]));
const completeWorlds = (c: BadgeCtx) =>
  c.worlds.filter((w) => !worldIsEmpty(w) && worldComplete(w, c.save.levels));

export const BADGES: BadgeDef[] = [
  { id: 'first-step', title: 'First inhabitant', desc: 'Complete your first level.', test: (c) => passedLevels(c).length >= 1 },
  { id: 'clean-solve', title: 'No hints needed', desc: 'Solve a proof level without hints.', test: (c) => allLevels(c).some((l) => l.kind === 'proof' && c.save.levels[l.id]?.clean) },
  { id: 'first-term', title: 'Term builder', desc: 'Finish a level where you write the proof term directly.', test: (c) => allLevels(c).some((l) => l.mode === 'term' && c.save.levels[l.id]?.status === 'solved' && !c.save.levels[l.id]?.testedOut) },
  { id: 'first-formal', title: 'Translator', desc: 'Formalize an English statement.', test: (c) => allLevels(c).some((l) => l.kind === 'formalize' && isPassed(c.save.levels[l.id]) && !c.save.levels[l.id]?.testedOut) },
  { id: 'first-world', title: 'Region charted', desc: 'Complete a whole world.', test: (c) => completeWorlds(c).length >= 1 },
  { id: 'halfway', title: 'Halfway across the map', desc: 'Complete half of the worlds.', test: (c) => c.worlds.length > 0 && completeWorlds(c).length * 2 >= c.worlds.length },
  { id: 'atlas', title: 'Atlas complete', desc: 'Complete every world.', test: (c) => c.worlds.length > 0 && completeWorlds(c).length === c.worlds.length },
  { id: 'clean-boss', title: 'Boss, cleanly', desc: 'Beat a boss level with no hints.', test: (c) => allLevels(c).some((l) => l.boss && c.save.levels[l.id]?.clean) },
  { id: 'test-out', title: 'Shortcut earned', desc: 'Test out of a world by beating its boss.', test: (c) => Object.values(c.save.levels).some((p) => p.testedOut) },
  { id: 'review-10', title: 'Remembering', desc: 'Pass ten review items.', test: (c) => c.save.reviewsPassed >= 10 },
  { id: 'box-5', title: 'Long memory', desc: 'Bring a level to the top review box.', test: (c) => Object.values(c.save.deck).some((d) => d.box >= 5) },
  { id: 'workshop', title: 'My own theorem', desc: 'Prove a theorem of your own in the Workshop.', test: (c) => c.save.theorems.some((t) => t.complete) },
  { id: 'regular', title: 'Regular', desc: 'Visit on seven different days.', test: (c) => c.save.activeDays.length >= 7 },
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
  const b = withBadges(next, worlds, now);
  next = b.save;
  return { save: next, earned: b.earned };
}
