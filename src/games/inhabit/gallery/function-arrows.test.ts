import { describe, expect, it } from 'vitest';
import { PRESETS, analyze, collision, image, indegrees, makeFn, missed, preimage, resize, setArrow } from './function-arrows.ts';
import { checkFn } from './function-arrows-lean.ts';

describe('function arrows logic', () => {
  it('bijection', () => {
    const a = analyze(makeFn(3, 3, [1, 2, 0]));
    expect([a.injective, a.surjective, a.bijective]).toEqual([true, true, true]);
  });
  it('collapse gives a reason', () => {
    const f = makeFn(3, 3, [1, 0, 1]);
    expect(collision(f)).toEqual({ i: 0, k: 2, j: 1 });
    expect(analyze(f).injReason).toBe('a₁ and a₃ both go to b₂');
    expect(missed(f)).toBe(2);
    expect(analyze(f).surjReason).toBe('b₃ is never hit');
  });
  it('pigeonhole: bigger domain is never injective', () => {
    for (let n = 2; n <= 6; n++) for (let m = 1; m < n; m++) {
      const f = makeFn(n, m, Array.from({ length: n }, (_, i) => i));
      expect(analyze(f).injective).toBe(false);
      expect(analyze(f).pigeon).toMatch(/Pigeonhole/);
    }
  });
  it('image and preimage', () => {
    const f = makeFn(4, 3, [0, 0, 1, 1]);
    expect([...image(f, new Set([0, 1]))]).toEqual([0]);
    expect([...preimage(f, new Set([2]))]).toEqual([]);
    expect([...preimage(f, new Set([1]))]).toEqual([2, 3]);
    expect(indegrees(f)).toEqual([2, 2, 0]);
  });
  it('resize keeps maps in range', () => {
    const f = resize(setArrow(makeFn(3, 6, [5, 5, 5]), 0, 4), 6, 2);
    expect(f.nA).toBe(6);
    expect(f.map.every((v) => v >= 0 && v < 2)).toBe(true);
  });
});

describe('function arrows: Lean claims are accepted by the engine', () => {
  const fns = [...PRESETS.map((p) => p.fn), makeFn(1, 1, [0]), makeFn(6, 6, [5, 4, 3, 2, 1, 0]), makeFn(2, 6, [3, 3])];
  for (const f of fns) {
    it(`${f.nA}->${f.nB} [${f.map}]`, () => {
      const r = checkFn(f);
      expect(r.declsOk).toBe(true);
      expect(r.injective.ok, r.injective.source).toBe(true);
      expect(r.surjective.ok, r.surjective.source).toBe(true);
    });
  }
});

import { definitionsAgree } from './function-arrows-lean.ts';
describe('displayed definitions', () => {
  it('the engine agrees they are the definitions', () => expect(definitionsAgree()).toEqual({ injective: true, surjective: true }));
});
