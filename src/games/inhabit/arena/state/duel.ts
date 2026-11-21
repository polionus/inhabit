/**
 * Duel core: a pure reducer, independent of transport and UI. Both sides play the same set in
 * order; per puzzle each records `{ solved, ms }`. One point per solved puzzle. The duel ends when
 * both have finished, when the format's time cap passes, or (for the local player) when the
 * opponent has left and the local player has finished. Most points wins; ties go to the lower total
 * time on solved puzzles; otherwise a draw. Runs under Node and in the browser.
 */
import type { DuelFormat } from '../plan.ts';

export interface PuzzleResult {
  solved: boolean;
  ms: number;
}

/** Time cap per format, in ms. */
export const DUEL_CAP_MS: Record<DuelFormat, number> = {
  blitz: 3 * 60_000,
  standard: 6 * 60_000,
  proofs: 12 * 60_000,
};

export const DUEL_SIZE: Record<DuelFormat, number> = { blitz: 8, standard: 5, proofs: 4 };

export type EndReason = 'both-finished' | 'cap' | 'opponent-left';
export type Winner = 'me' | 'them' | 'draw';

export interface DuelState {
  seed: string;
  format: DuelFormat;
  count: number;
  capMs: number;
  /** Epoch ms of the start (local clock); null until `start`. */
  startedAt: number | null;
  now: number;
  me: (PuzzleResult | null)[];
  them: (PuzzleResult | null)[];
  remoteLeft: boolean;
  endedAt: number | null;
  endReason: EndReason | null;
}

export type DuelEvent =
  | { type: 'start'; at: number }
  | { type: 'localResult'; i: number; r: PuzzleResult }
  | { type: 'remoteProgress'; i: number; r: PuzzleResult }
  | { type: 'tick'; now: number }
  | { type: 'remoteLeft' };

export function newDuel(seed: string, format: DuelFormat, count: number = DUEL_SIZE[format]): DuelState {
  return {
    seed,
    format,
    count,
    capMs: DUEL_CAP_MS[format],
    startedAt: null,
    now: 0,
    me: Array.from({ length: count }, () => null),
    them: Array.from({ length: count }, () => null),
    remoteLeft: false,
    endedAt: null,
    endReason: null,
  };
}

const cleanResult = (r: PuzzleResult, capMs: number): PuzzleResult => ({
  solved: r.solved === true,
  ms: Number.isFinite(r.ms) ? Math.max(0, Math.min(Math.round(r.ms), capMs)) : capMs,
});

const finishedCount = (xs: (PuzzleResult | null)[]) => xs.filter((x) => x !== null).length;

/** Decide whether the duel is over after an event; sets `endedAt`/`endReason` once. */
function settle(s: DuelState): DuelState {
  if (s.endedAt !== null || s.startedAt === null) return s;
  const meDone = finishedCount(s.me) >= s.count;
  const themDone = finishedCount(s.them) >= s.count;
  if (meDone && themDone) return { ...s, endedAt: s.now, endReason: 'both-finished' };
  if (meDone && s.remoteLeft) return { ...s, endedAt: s.now, endReason: 'opponent-left' };
  if (s.now - s.startedAt >= s.capMs) return { ...s, endedAt: s.startedAt + s.capMs, endReason: 'cap' };
  return s;
}

export function duelReduce(s: DuelState, e: DuelEvent): DuelState {
  switch (e.type) {
    case 'start':
      return s.startedAt !== null ? s : { ...s, startedAt: e.at, now: e.at };
    case 'tick': {
      if (s.startedAt === null || s.endedAt !== null) return s;
      return settle({ ...s, now: Math.max(s.now, e.now) });
    }
    case 'localResult':
    case 'remoteProgress': {
      if (s.startedAt === null || s.endedAt !== null) return s;
      const key = e.type === 'localResult' ? 'me' : 'them';
      if (!Number.isInteger(e.i) || e.i < 0 || e.i >= s.count || s[key][e.i] !== null) return s;
      // Results must arrive in order: a side cannot finish puzzle 3 before puzzle 2.
      if (e.i > 0 && s[key][e.i - 1] === null) return s;
      const next = s[key].slice();
      next[e.i] = cleanResult(e.r, s.capMs);
      return settle({ ...s, [key]: next });
    }
    case 'remoteLeft':
      return settle({ ...s, remoteLeft: true });
  }
}

/* ---------------- derived views ---------------- */

export type Mark = 'solved' | 'missed' | 'pending';

export interface DuelView {
  scores: { me: number; them: number };
  /** Total ms spent on solved puzzles (the tie-break). */
  solvedMs: { me: number; them: number };
  marks: { me: Mark[]; them: Mark[] };
  /** Index of the puzzle each side is on; null when finished. */
  on: { me: number | null; them: number | null };
  meFinished: boolean;
  themFinished: boolean;
  finished: boolean;
  winner: Winner | null;
  endReason: EndReason | null;
  opponentLeft: boolean;
  /** Milliseconds until the cap (never negative); null before the start. */
  capLeftMs: number | null;
}

const score = (xs: (PuzzleResult | null)[]) => xs.filter((x) => x?.solved).length;
const solvedMs = (xs: (PuzzleResult | null)[]) => xs.reduce((a, x) => a + (x?.solved ? x.ms : 0), 0);
const marksOf = (xs: (PuzzleResult | null)[]): Mark[] => xs.map((x) => (x === null ? 'pending' : x.solved ? 'solved' : 'missed'));

export function decide(s: Pick<DuelState, 'me' | 'them'>): Winner {
  const a = score(s.me);
  const b = score(s.them);
  if (a !== b) return a > b ? 'me' : 'them';
  const ta = solvedMs(s.me);
  const tb = solvedMs(s.them);
  if (a === 0 || ta === tb) return 'draw';
  return ta < tb ? 'me' : 'them';
}

export function duelView(s: DuelState): DuelView {
  const meN = finishedCount(s.me);
  const themN = finishedCount(s.them);
  const finished = s.endedAt !== null;
  return {
    scores: { me: score(s.me), them: score(s.them) },
    solvedMs: { me: solvedMs(s.me), them: solvedMs(s.them) },
    marks: { me: marksOf(s.me), them: marksOf(s.them) },
    on: { me: meN >= s.count ? null : meN, them: themN >= s.count ? null : themN },
    meFinished: meN >= s.count,
    themFinished: themN >= s.count,
    finished,
    winner: finished ? decide(s) : null,
    endReason: s.endReason,
    opponentLeft: s.remoteLeft,
    capLeftMs: s.startedAt === null ? null : Math.max(0, s.startedAt + s.capMs - s.now),
  };
}
