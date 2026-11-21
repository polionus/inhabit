/**
 * Deterministic puzzle sets for the Arena modes. Pure: the same arguments give the same puzzles
 * in every browser, so a seed (or a date) in a URL is a shared set. FROZEN contract between the
 * solo modes (src/arena/state, src/ui/arena) and the duel/share code (src/arena/net).
 * Runs under Node and in the browser.
 */
import { generator } from './gen/index.ts';
import type { ProofFamily, Puzzle, PuzzleFamily } from './types.ts';

export interface Slot {
  family: PuzzleFamily;
  target: number;
}

/**
 * What identifies a puzzle's content (two different ids can be the same statement). For proofs
 * this is the English reading, which is the same whether the premises are presented as
 * hypotheses (`(h : A) : B`) or as an implication (`A → B`).
 */
export const statementKey = (p: Puzzle): string => (p.kind === 'proof' ? `${p.family}|${p.english}` : `${p.quick}|${p.prompt}|${p.code ?? ''}`);

/**
 * Generate one puzzle per slot from `seed`, never repeating a statement within the set
 * (nor any in `avoid`): a repeat is re-drawn deterministically.
 */
export function sequence(seed: string, slots: Slot[], avoid: Iterable<string> = []): Puzzle[] {
  const seen = new Set<string>(avoid);
  const out: Puzzle[] = [];
  slots.forEach((slot, i) => {
    let p = generator.generate({ seed: `${seed}:${i}`, family: slot.family, target: slot.target });
    for (let r = 1; r <= 12 && seen.has(statementKey(p)); r++) {
      p = generator.generate({ seed: `${seed}:${i}:r${r}`, family: slot.family, target: slot.target });
    }
    seen.add(statementKey(p));
    out.push(p);
  });
  return out;
}

/** The `i`-th puzzle of an endless stream (Rush, rated play): cheap, no need to build the prefix. */
export function nth(seed: string, i: number, slot: Slot, avoid: Iterable<string> = []): Puzzle {
  const seen = new Set<string>(avoid);
  let p = generator.generate({ seed: `${seed}:${i}`, family: slot.family, target: slot.target });
  for (let r = 1; r <= 12 && seen.has(statementKey(p)); r++) {
    p = generator.generate({ seed: `${seed}:${i}:r${r}`, family: slot.family, target: slot.target });
  }
  return p;
}

/* ---------------- Daily Proof ---------------- */

/** UTC calendar day, `YYYY-MM-DD`. The Daily Proof changes at 00:00 UTC for everyone. */
export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Days since 2026-01-01 (UTC); the Daily Proof's number. */
export function dailyNumber(dateKey: string): number {
  return Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86_400_000) + 1;
}

const DAILY_MIDDLE: ProofFamily[] = ['inhabit', 'set', 'quant', 'prop', 'inhabit', 'quant', 'set'];
const DAILY_LAST: ProofFamily[] = ['prop', 'quant', 'prop', 'set', 'prop', 'inhabit', 'quant'];

/** Three proof puzzles of rising rating; the families rotate through the week. */
export function dailySlots(dateKey: string): Slot[] {
  const n = dailyNumber(dateKey);
  const k = ((n % 7) + 7) % 7;
  return [
    { family: 'prop', target: 650 },
    { family: DAILY_MIDDLE[k], target: 1000 },
    { family: DAILY_LAST[k], target: 1350 },
  ];
}

export const dailySeed = (dateKey: string): string => `daily:${generator.version}:${dateKey}`;

/** Dailies are de-duplicated in blocks of this many days (see `dailySet`). */
export const DAILY_BLOCK_DAYS = 14;

const rawDaily = new Map<string, Puzzle[]>();
const finalDaily = new Map<string, Puzzle[]>();

/** The day's draw before looking at other days (memoised; pure). */
function rawDailySet(dateKey: string): Puzzle[] {
  let s = rawDaily.get(dateKey);
  if (!s) {
    s = sequence(dailySeed(dateKey), dailySlots(dateKey));
    rawDaily.set(dateKey, s);
  }
  return s;
}

const shiftDay = (dateKey: string, days: number): string => utcDateKey(Date.parse(`${dateKey}T00:00:00Z`) + days * 86_400_000);

/**
 * The Daily Proof for a UTC date: a pure function of the date, so it is the same for everyone.
 * Days are grouped in two-week blocks. A day never repeats a statement used earlier in its own
 * block, nor a first draw of any day in the previous block, so the same puzzle does not come
 * back for at least two weeks (a re-drawn puzzle of the previous block is the one rare gap).
 */
export function dailySet(dateKey: string): Puzzle[] {
  const cached = finalDaily.get(dateKey);
  if (cached) return cached;
  const n = dailyNumber(dateKey);
  const offset = (((n - 1) % DAILY_BLOCK_DAYS) + DAILY_BLOCK_DAYS) % DAILY_BLOCK_DAYS; // days since the block began
  const avoid: string[] = [];
  for (let k = 1; k <= DAILY_BLOCK_DAYS; k++) for (const p of rawDailySet(shiftDay(dateKey, -offset - k))) avoid.push(statementKey(p));
  let set: Puzzle[] = [];
  for (let d = offset; d >= 0; d--) {
    const day = shiftDay(dateKey, -d);
    set = finalDaily.get(day) ?? sequence(dailySeed(day), dailySlots(day), avoid);
    finalDaily.set(day, set);
    for (const p of set) avoid.push(statementKey(p));
  }
  return set;
}

/* ---------------- Proof Rush ---------------- */

/** Rush is quick items only, rising steadily; item `i` is 0-based. */
export function rushSlot(i: number): Slot {
  return { family: 'quick', target: Math.min(1100, 450 + 30 * i) };
}

/* ---------------- Duels ---------------- */

export type DuelFormat = 'blitz' | 'standard' | 'proofs';

export const DUEL_FORMATS: Record<DuelFormat, { title: string; desc: string; slots: Slot[] }> = {
  blitz: {
    title: 'Blitz',
    desc: 'Eight quick questions. Fast, and fine on a phone.',
    slots: [450, 520, 600, 680, 760, 840, 920, 1000].map((target) => ({ family: 'quick' as const, target })),
  },
  standard: {
    title: 'Standard',
    desc: 'Three quick questions, then two short proofs.',
    slots: [
      { family: 'quick', target: 550 },
      { family: 'quick', target: 700 },
      { family: 'quick', target: 850 },
      { family: 'prop', target: 650 },
      { family: 'inhabit', target: 850 },
    ],
  },
  proofs: {
    title: 'Proofs',
    desc: 'Four proofs of rising difficulty. Bring a keyboard.',
    slots: [
      { family: 'prop', target: 650 },
      { family: 'set', target: 900 },
      { family: 'quant', target: 1050 },
      { family: 'prop', target: 1300 },
    ],
  },
};

export const duelSet = (seed: string, format: DuelFormat): Puzzle[] => sequence(`duel:${generator.version}:${seed}`, DUEL_FORMATS[format].slots);
