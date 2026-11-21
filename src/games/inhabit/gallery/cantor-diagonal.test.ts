import { describe, expect, it } from 'vitest';
import { MAX_N, MIN_N, clash, diagonalSet, differsAt, inRange, randomRel, relPresets, resize, toggle } from './cantor-diagonal.ts';
import { cantorReport } from './cantor-diagonal-lean.ts';

function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('diagonal set', () => {
  it('flips the diagonal', () => {
    const f = [[true, false, false], [false, false, true], [true, true, true]];
    expect(diagonalSet(f)).toEqual([false, true, false]);
  });
  it('presets', () => {
    expect(diagonalSet(relPresets[0].make(4))).toEqual([false, false, false, false]);
    expect(diagonalSet(relPresets[2].make(4))).toEqual([true, true, true, true]);
  });
  it('D differs from f x at x, and is never in the range, for any f', () => {
    const rnd = lcg(7);
    for (let n = 1; n <= MAX_N; n++) {
      for (let t = 0; t < 200; t++) {
        const f = randomRel(n, rnd);
        const d = diagonalSet(f);
        for (let x = 0; x < n; x++) {
          expect(differsAt(f, x)).toBe(true);
          expect(d[x]).not.toBe(f[x][x]);
          expect(clash(f, x).iffHolds).toBe(false);
        }
        expect(inRange(f, d)).toBe(false);
      }
    }
  });
  it('exhaustive for n = 3 (512 relations)', () => {
    for (let m = 0; m < 512; m++) {
      const f = [0, 1, 2].map((x) => [0, 1, 2].map((y) => ((m >> (3 * x + y)) & 1) === 1));
      expect(inRange(f, diagonalSet(f))).toBe(false);
    }
  });
  it('edit helpers', () => {
    expect(toggle(relPresets[2].make(3), 1, 2)[1][2]).toBe(true);
    expect(resize(relPresets[1].make(3), 5).length).toBe(5);
    expect(resize(relPresets[1].make(3), 5)[4][4]).toBe(false);
    expect(MIN_N).toBe(3);
  });
});

describe('engine', () => {
  it('checks the reference proof of Cantor', () => {
    const r = cantorReport();
    expect(r.complete).toBe(true);
    expect(r.pretty).toBeTruthy();
    expect(r.iffNotSelf).toBeTruthy();
  });
});
