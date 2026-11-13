/**
 * Arena state: shape, defaults, migration and pure transitions. No DOM, no clock, no randomness
 * (the store passes `now` and random values in). Persisted by `store.ts` under `inhabit.arena`.
 */
import { generator } from '../gen/index.ts';
import { makeRng, weighted } from '../gen/rng.ts';
import { nth, statementKey, type Slot } from '../plan.ts';
import type { Puzzle, PuzzleFamily } from '../types.ts';
import { FLOOR_RATING, START_RATING, ratingChange, type RatedOutcome } from './rating.ts';

export const HISTORY_MAX = 200;
export const SEEN_MAX = 50;
export const DAILY_KEEP = 60;
export const RUNS_MAX = 20;

export type RushMode = 'm3' | 'm5' | 'survival';
export const RUSH_MODES: RushMode[] = ['m3', 'm5', 'survival'];
export const RUSH_TITLE: Record<RushMode, string> = { m3: '3 minutes', m5: '5 minutes', survival: 'Survival' };
export const RUSH_PENALTY_MS = 10_000;
export const RUSH_STRIKES = 3;
export const RUSH_LIMIT_MS: Record<RushMode, number | null> = { m3: 180_000, m5: 300_000, survival: null };

export const RATED_FAMILIES: PuzzleFamily[] = ['prop', 'inhabit', 'quant', 'set', 'quick'];
const FAMILY_WEIGHT: Record<PuzzleFamily, number> = { prop: 3, inhabit: 2, quant: 2, set: 2, quick: 2 };

export interface HistoryPoint { t: number; r: number }

/** What a resumable puzzle remembers between reloads. */
export interface PuzzleProgress { hints: number; ms: number; body: string }

export interface RatedCurrent {
  index: number;
  family: PuzzleFamily;
  target: number;
  progress: PuzzleProgress;
}

export interface DailyMark { state: 'clean' | 'hinted' | 'failed'; ms: number }
export interface DailyResult {
  dateKey: string;
  startedAt: number;
  marks: DailyMark[];
  progress: PuzzleProgress | null;
  completed: boolean;
  completedAt: number | null;
}

export interface RushRun { mode: RushMode; score: number; at: number; best: boolean }

export interface ArenaState {
  v: 1;
  salt: string;
  displayName: string;
  /** Current rating (800 before any rated puzzle; see `rated`). */
  rating: number;
  peak: number;
  /** Rated puzzles finished. */
  rated: number;
  /** Rated puzzles solved. */
  solved: number;
  history: HistoryPoint[];
  filter: PuzzleFamily[];
  counter: number;
  seen: string[];
  current: RatedCurrent | null;
  daily: Record<string, DailyResult>;
  streak: { count: number; last: string; best: number };
  rush: { bests: Record<RushMode, number>; runs: RushRun[] };
  /** Opaque slice owned by the duel code. */
  duel: unknown;
}

export const emptyProgress = (): PuzzleProgress => ({ hints: 0, ms: 0, body: '' });

export function defaultState(salt: string): ArenaState {
  return {
    v: 1,
    salt,
    displayName: '',
    rating: START_RATING,
    peak: START_RATING,
    rated: 0,
    solved: 0,
    history: [],
    filter: [...RATED_FAMILIES],
    counter: 0,
    seen: [],
    current: null,
    daily: {},
    streak: { count: 0, last: '', best: 0 },
    rush: { bests: { m3: 0, m5: 0, survival: 0 }, runs: [] },
    duel: null,
  };
}

/* ---------------- migration (accepts anything) ---------------- */

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, d: number, lo = -Infinity, hi = Infinity): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const int = (x: unknown, d: number, lo = 0, hi = 1e9): number => Math.round(num(x, d, lo, hi));
const str = (x: unknown, d: string, max = 200): string => (typeof x === 'string' ? x.slice(0, max) : d);
const dateKeyOk = (k: unknown): k is string => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

function progressOf(x: unknown): PuzzleProgress {
  const o = isObj(x) ? x : {};
  return { hints: int(o.hints, 0, 0, 20), ms: int(o.ms, 0, 0, 1e8), body: str(o.body, '', 20000) };
}

export function migrate(raw: unknown, newSalt: () => string): ArenaState {
  const d = defaultState(typeof raw === 'object' && raw && typeof (raw as { salt?: unknown }).salt === 'string' && (raw as { salt: string }).salt ? (raw as { salt: string }).salt.slice(0, 64) : newSalt());
  try {
    if (!isObj(raw)) return d;
    const s: ArenaState = { ...d };
    s.displayName = str(raw.displayName, '', 20).trim();
    s.rated = int(raw.rated, 0);
    s.solved = int(raw.solved, 0);
    s.rating = int(raw.rating, START_RATING, FLOOR_RATING, 4000);
    s.peak = Math.max(s.rating, int(raw.peak, s.rating, FLOOR_RATING, 4000));
    s.history = Array.isArray(raw.history)
      ? raw.history.filter(isObj).map((h) => ({ t: int(h.t, 0, 0, 1e15), r: int(h.r, START_RATING, FLOOR_RATING, 4000) })).slice(-HISTORY_MAX)
      : [];
    const f = Array.isArray(raw.filter) ? RATED_FAMILIES.filter((fam) => (raw.filter as unknown[]).includes(fam)) : [];
    s.filter = f.length ? f : [...RATED_FAMILIES];
    s.counter = int(raw.counter, 0);
    s.seen = Array.isArray(raw.seen) ? raw.seen.filter((x): x is string => typeof x === 'string').slice(-SEEN_MAX) : [];
    if (isObj(raw.current) && RATED_FAMILIES.includes(raw.current.family as PuzzleFamily)) {
      s.current = {
        index: int(raw.current.index, s.counter),
        family: raw.current.family as PuzzleFamily,
        target: int(raw.current.target, s.rating, 300, 3000),
        progress: progressOf(raw.current.progress),
      };
    }
    if (isObj(raw.daily)) {
      const keys = Object.keys(raw.daily).filter(dateKeyOk).sort().slice(-DAILY_KEEP);
      for (const k of keys) {
        const r = raw.daily[k];
        if (!isObj(r)) continue;
        const marks = Array.isArray(r.marks)
          ? r.marks
              .filter(isObj)
              .slice(0, 3)
              .map((m): DailyMark => ({ state: m.state === 'clean' || m.state === 'hinted' ? m.state : 'failed', ms: int(m.ms, 0, 0, 1e8) }))
          : [];
        s.daily[k] = {
          dateKey: k,
          startedAt: int(r.startedAt, 0, 0, 1e15),
          marks,
          progress: r.progress ? progressOf(r.progress) : null,
          completed: r.completed === true && marks.length === 3,
          completedAt: typeof r.completedAt === 'number' ? int(r.completedAt, 0, 0, 1e15) : null,
        };
      }
    }
    if (isObj(raw.streak)) {
      const c = int(raw.streak.count, 0, 0, 100000);
      s.streak = { count: c, last: dateKeyOk(raw.streak.last) ? raw.streak.last : '', best: Math.max(c, int(raw.streak.best, 0, 0, 100000)) };
    }
    if (isObj(raw.rush)) {
      const b = isObj(raw.rush.bests) ? raw.rush.bests : {};
      s.rush = {
        bests: { m3: int(b.m3, 0, 0, 1e5), m5: int(b.m5, 0, 0, 1e5), survival: int(b.survival, 0, 0, 1e5) },
        runs: Array.isArray(raw.rush.runs)
          ? raw.rush.runs
              .filter(isObj)
              .filter((r) => RUSH_MODES.includes(r.mode as RushMode))
              .map((r): RushRun => ({ mode: r.mode as RushMode, score: int(r.score, 0, 0, 1e5), at: int(r.at, 0, 0, 1e15), best: r.best === true }))
              .slice(-RUNS_MAX)
          : [],
      };
    }
    s.duel = 'duel' in raw ? raw.duel ?? null : null;
    return s;
  } catch {
    return d;
  }
}

/* ---------------- rated stream ---------------- */

export const ratedSeed = (s: ArenaState): string => `rated:${s.salt}`;

/** Next stream position for the current rating and filter. Deterministic in (salt, counter, rating, filter). */
export function chooseRated(s: ArenaState): RatedCurrent {
  const rng = makeRng(`${ratedSeed(s)}|choose|${s.counter}`);
  const families = s.filter.length ? s.filter : RATED_FAMILIES;
  const family = weighted(rng, families.map((f) => [f, FAMILY_WEIGHT[f]] as const));
  const jitter = rng.int(161) - 80;
  const [lo, hi] = generator.range[family];
  const target = Math.min(hi, Math.max(lo, s.rating + jitter));
  return { index: s.counter, family, target, progress: emptyProgress() };
}

/** The puzzle for the current stream position (regenerated deterministically on resume). */
export function ratedPuzzle(s: ArenaState, c: RatedCurrent): Puzzle {
  return nth(ratedSeed(s), c.index, { family: c.family, target: c.target } satisfies Slot, s.seen);
}

export interface RatedResult { before: number; after: number; delta: number; puzzleRating: number }

/** Apply a finished rated puzzle. */
export function applyRated(s: ArenaState, puzzle: Puzzle, o: RatedOutcome, now: number): { state: ArenaState; result: RatedResult } {
  const { delta, next } = ratingChange(s.rating, puzzle.rating, s.rated, o);
  const solved = o.solved && !o.skipped && !o.revealed;
  const history = [...s.history, { t: now, r: next }].slice(-HISTORY_MAX);
  const state: ArenaState = {
    ...s,
    rating: next,
    peak: Math.max(s.peak, next),
    rated: s.rated + 1,
    solved: s.solved + (solved ? 1 : 0),
    history,
    counter: s.counter + 1,
    seen: [...s.seen, statementKey(puzzle)].slice(-SEEN_MAX),
    current: null,
  };
  return { state, result: { before: s.rating, after: next, delta, puzzleRating: puzzle.rating } };
}

/* ---------------- daily ---------------- */

export const dayBefore = (dateKey: string): string => new Date(Date.parse(`${dateKey}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

export function markOf(o: { solved: boolean; hintsUsed: number; revealed: boolean; skipped: boolean; ms: number }): DailyMark {
  const ok = o.solved && !o.revealed && !o.skipped;
  return { state: !ok ? 'failed' : o.hintsUsed > 0 ? 'hinted' : 'clean', ms: Math.max(0, Math.round(o.ms)) };
}

export function startDaily(s: ArenaState, dateKey: string, now: number): ArenaState {
  if (s.daily[dateKey]) return s;
  const daily = { ...s.daily, [dateKey]: { dateKey, startedAt: now, marks: [], progress: null, completed: false, completedAt: null } };
  return { ...s, daily: prune(daily) };
}

function prune(daily: Record<string, DailyResult>): Record<string, DailyResult> {
  const keys = Object.keys(daily).sort();
  if (keys.length <= DAILY_KEEP) return daily;
  const out: Record<string, DailyResult> = {};
  for (const k of keys.slice(-DAILY_KEEP)) out[k] = daily[k];
  return out;
}

/** Record one daily puzzle's outcome; returns the updated state and whether the set just completed. */
export function applyDailyMark(s: ArenaState, dateKey: string, index: number, mark: DailyMark, now: number): { state: ArenaState; completedNow: boolean } {
  const cur = s.daily[dateKey];
  if (!cur || cur.completed || index !== cur.marks.length) return { state: s, completedNow: false };
  const marks = [...cur.marks, mark];
  const completed = marks.length >= 3;
  const next: DailyResult = { ...cur, marks, progress: null, completed, completedAt: completed ? now : null };
  let streak = s.streak;
  if (completed) {
    const count = streak.last === dateKey ? streak.count : streak.last === dayBefore(dateKey) ? streak.count + 1 : 1;
    streak = { count, last: dateKey, best: Math.max(streak.best, count) };
  }
  return { state: { ...s, daily: { ...s.daily, [dateKey]: next }, streak }, completedNow: completed };
}

/** Streak still alive on `todayKey`: counts through yesterday if today is not done yet. */
export function streakOn(s: ArenaState, todayKey: string): number {
  return s.streak.last === todayKey || s.streak.last === dayBefore(todayKey) ? s.streak.count : 0;
}

export const dailySolved = (r: DailyResult): number => r.marks.filter((m) => m.state !== 'failed').length;
export const dailyTime = (r: DailyResult): number => r.marks.reduce((a, m) => a + m.ms, 0);

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

const EMOJI: Record<DailyMark['state'], string> = { clean: '🟩', hinted: '🟨', failed: '⬛' };

/** Shareable text for a finished daily result. `link` is the full URL of `#/arena/daily`. */
export function dailyShareText(r: DailyResult, number: number, link: string): string {
  const head = `Inhabit Daily Proof #${number} · ${dailySolved(r)}/3 · ${formatTime(dailyTime(r))}`;
  return `${head}\n${r.marks.map((m) => EMOJI[m.state]).join('')}\n${link}`;
}

/* ---------------- rush ---------------- */

export function applyRush(s: ArenaState, mode: RushMode, score: number, now: number): { state: ArenaState; best: boolean; previous: number } {
  const previous = s.rush.bests[mode];
  const best = score > previous;
  const runs = [...s.rush.runs, { mode, score, at: now, best }].slice(-RUNS_MAX);
  return { state: { ...s, rush: { bests: { ...s.rush.bests, [mode]: best ? score : previous }, runs } }, best, previous };
}

/** The `i`-th Rush item of a run; `seen` holds statement keys already shown in the run. */
export function rushItem(runSeed: string, i: number, seen: Iterable<string>): Puzzle {
  return nth(runSeed, i, { family: 'quick', target: Math.min(1100, 450 + 30 * i) }, seen);
}
