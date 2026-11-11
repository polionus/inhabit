import { describe, expect, it } from 'vitest';
import { shuffledOrder } from './shuffle.ts';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('shuffledOrder', () => {
  it('is a permutation of 0..n-1', () => {
    for (let seed = 1; seed < 30; seed++) {
      for (const n of [0, 1, 2, 3, 4, 7]) {
        const o = shuffledOrder(n, seeded(seed));
        expect([...o].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });
  it('uses the injected rng (rng=0 rotates, rng~1 is identity)', () => {
    expect(shuffledOrder(4, () => 0.999999)).toEqual([0, 1, 2, 3]);
    expect(shuffledOrder(4, () => 0)).toEqual([1, 2, 3, 0]);
  });
  it('actually reorders for some seeds', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) seen.add(shuffledOrder(4, seeded(seed)).join(','));
    expect(seen.size).toBeGreaterThan(5);
  });
});
