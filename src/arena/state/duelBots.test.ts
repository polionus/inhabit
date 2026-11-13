import { describe, expect, it } from 'vitest';
import { BOTS, FLOOR_MS, botTimeline, revealedBy, unlockedBots, type PuzzleInfo } from './duelBots.ts';
import { decide } from './duel.ts';
import { duelSet } from '../plan.ts';

const infoOf = (p: { kind: 'proof' | 'quick'; rating: number; par: number }): PuzzleInfo => ({ rating: p.rating, par: p.par, kind: p.kind });
const synthetic = (seedN: number): PuzzleInfo[] => [0, 1, 2, 3, 4].map((i) => ({ rating: 500 + ((seedN * 37 + i * 190) % 900), par: 20 + i * 15, kind: i < 3 ? 'quick' : 'proof' }));

describe('bots', () => {
  it('has a ladder of 8 from about 500 to 1900, with unique ids', () => {
    expect(BOTS).toHaveLength(8);
    expect(BOTS[0].rating).toBe(500);
    expect(BOTS[7].rating).toBe(1900);
    expect(new Set(BOTS.map((b) => b.id)).size).toBe(8);
    for (let i = 1; i < 8; i++) expect(BOTS[i].rating).toBeGreaterThan(BOTS[i - 1].rating);
  });

  it('is deterministic per seed and bot, and differs across seeds', () => {
    const ps = synthetic(3);
    expect(botTimeline(BOTS[3], 'seed1', ps)).toEqual(botTimeline(BOTS[3], 'seed1', ps));
    expect(botTimeline(BOTS[3], 'seed1', ps)).not.toEqual(botTimeline(BOTS[3], 'seed2', ps));
    expect(botTimeline(BOTS[3], 'seed1', ps)).not.toEqual(botTimeline(BOTS[4], 'seed1', ps));
  });

  it('stronger bots win more over 200 seeds', () => {
    let weakWins = 0;
    let strongWins = 0;
    for (let n = 0; n < 200; n++) {
      const ps = synthetic(n);
      const r = decide({ me: botTimeline(BOTS[0], `s${n}`, ps), them: botTimeline(BOTS[7], `s${n}`, ps) });
      if (r === 'me') weakWins++;
      else if (r === 'them') strongWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins * 3);
    const mid = (b: number) => {
      let pts = 0;
      for (let n = 0; n < 200; n++) pts += botTimeline(BOTS[b], `m${n}`, synthetic(n)).filter((r) => r.solved).length;
      return pts;
    };
    expect(mid(7)).toBeGreaterThan(mid(4));
    expect(mid(4)).toBeGreaterThan(mid(0));
  });

  it('never answers faster than the floor', () => {
    for (let n = 0; n < 200; n++) {
      const ps = synthetic(n).map((p) => ({ ...p, par: 1 }));
      for (const r of botTimeline(BOTS[7], `f${n}`, ps).map((r, i) => ({ r, k: ps[i].kind }))) expect(r.r.ms).toBeGreaterThanOrEqual(FLOOR_MS[r.k]);
    }
  });

  it('works on real duel sets and reveals results as time passes', () => {
    const set = duelSet('q1', 'blitz');
    const tl = botTimeline(BOTS[2], 'q1', set.map(infoOf));
    expect(tl).toHaveLength(8);
    expect(revealedBy(tl, 0)).toHaveLength(0);
    expect(revealedBy(tl, 1e9)).toHaveLength(8);
    const first = tl[0].ms;
    expect(revealedBy(tl, first)).toHaveLength(1);
    expect(revealedBy(tl, first - 1)).toHaveLength(0);
  });

  it('unlocks the next bot after a win', () => {
    expect([...unlockedBots({})]).toEqual(['tally']);
    expect(unlockedBots({ tally: { w: 1 } }).has('cairn')).toBe(true);
    expect(unlockedBots({ tally: { w: 1 } }).has('sextant')).toBe(false);
  });
});
