/**
 * The bot ladder. A bot is a named model of a player of a given rating: for a puzzle of rating `r`
 * and `par` seconds it solves with probability 1 / (1 + 10^((r - b) / 400)) and takes `par * f`
 * seconds, `f` log-normal with a spread that shrinks as `b - r` grows. All randomness is seeded by
 * the duel seed and the bot id, so reloading cannot re-roll a duel. Pure; runs under Node.
 */
import { makeRng } from '../gen/rng.ts';
import type { DuelFormat } from '../plan.ts';
import type { PuzzleResult } from './duel.ts';

export interface Bot {
  id: string;
  name: string;
  rating: number;
  blurb: string;
  /** A Lean symbol shown on a coloured disc. */
  glyph: string;
  /** Hue (degrees) of the disc. */
  hue: number;
}

export const BOTS: Bot[] = [
  { id: 'tally', name: 'Tally', rating: 500, glyph: '1', hue: 150, blurb: 'Counts on its fingers and checks twice. Gentle and slow.' },
  { id: 'cairn', name: 'Cairn', rating: 750, glyph: '→', hue: 190, blurb: 'Stacks one careful step on another. Rarely rushes.' },
  { id: 'sextant', name: 'Sextant', rating: 1000, glyph: '∧', hue: 215, blurb: 'Takes a bearing before every move; steady and tidy.' },
  { id: 'lemma', name: 'Lemma Lark', rating: 1200, glyph: '∀', hue: 260, blurb: 'Chirps through the easy ones, stalls on a tricky quantifier.' },
  { id: 'meridian', name: 'Meridian', rating: 1400, glyph: '∃', hue: 290, blurb: 'Always finds a witness, usually before you do.' },
  { id: 'cartographer', name: 'The Cartographer', rating: 1600, glyph: '⊢', hue: 330, blurb: 'Has drawn every map in the Arena and knows the shortcuts.' },
  { id: 'kernel', name: 'Kernel Keeper', rating: 1750, glyph: 'λ', hue: 20, blurb: 'Trusts nothing it has not reduced to a term.' },
  { id: 'archon', name: 'Archon of Axioms', rating: 1900, glyph: '∎', hue: 45, blurb: 'Fast, exact and unbothered. The top of the ladder.' },
];

export const botById = (id: string): Bot | undefined => BOTS.find((b) => b.id === id);

/** What the bot model needs to know about a puzzle. */
export interface PuzzleInfo {
  rating: number;
  par: number;
  /** 'quick' items have a 3 s floor, proofs 8 s. */
  kind: 'quick' | 'proof';
}

export const FLOOR_MS = { quick: 3000, proof: 8000 };

/** Probability that a player of rating `b` solves a puzzle of rating `r`. */
export const solveProbability = (b: number, r: number): number => 1 / (1 + Math.pow(10, (r - b) / 400));

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** The precomputed timeline of a bot on a set: per-puzzle result, in order. */
export function botTimeline(bot: Bot, seed: string, puzzles: PuzzleInfo[]): PuzzleResult[] {
  const rng = makeRng(`duel-bot:${seed}:${bot.id}`);
  return puzzles.map((p) => {
    // Always draw the same three numbers so one outcome never shifts the next puzzle's stream.
    const u1 = Math.max(1e-9, rng.next());
    const u2 = rng.next();
    const roll = rng.next();
    const jitter = rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const gap = bot.rating - p.rating;
    const floor = FLOOR_MS[p.kind];
    const solved = roll < solveProbability(bot.rating, p.rating);
    if (!solved) {
      const ms = Math.max(floor, Math.round(p.par * 1000 * 1.2 * (0.85 + 0.3 * jitter)));
      return { solved: false, ms };
    }
    const sigma = clamp(0.4 - gap / 2000, 0.12, 0.6);
    const mu = clamp(-gap / 900, -0.9, 0.7);
    const f = clamp(Math.exp(mu + sigma * z), 0.2, 2.5);
    return { solved: true, ms: Math.max(floor, Math.round(p.par * 1000 * f)) };
  });
}

/** Cumulative finish time (ms after the start) of each puzzle in a timeline. */
export function finishTimes(tl: PuzzleResult[]): number[] {
  let t = 0;
  return tl.map((r) => (t += r.ms));
}

/** The results a bot has revealed by `elapsedMs` after the start (in order). */
export function revealedBy(tl: PuzzleResult[], elapsedMs: number): { i: number; r: PuzzleResult }[] {
  const ft = finishTimes(tl);
  const out: { i: number; r: PuzzleResult }[] = [];
  for (let i = 0; i < tl.length; i++) if (ft[i] <= elapsedMs) out.push({ i, r: tl[i] });
  return out;
}

/** A fresh seed: unguessable enough for variety, not for secrecy. Takes the randomness as input. */
export const seedFrom = (rand: () => number): string => Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0');

/** Which bots are available: the first, and any whose predecessor has been beaten. */
export function unlockedBots(wins: Record<string, { w: number }>): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < BOTS.length; i++) {
    if (i === 0 || (wins[BOTS[i - 1].id]?.w ?? 0) > 0) out.add(BOTS[i].id);
  }
  return out;
}

export type { DuelFormat };
