import { describe, expect, it } from 'vitest';
import { baseHolds, brokenLink, cascade, instantiate, presetById, presets, stepHolds } from './induction-dominoes.ts';
import { checkPreset } from './induction-dominoes-lean.ts';

describe('domino logic', () => {
  it('the preset flags agree with the arithmetic', () => {
    for (const p of presets) {
      expect(!!p.base, p.id).toBe(baseHolds(p));
      expect(!!p.step, p.id).toBe(stepHolds(p));
    }
  });
  it('true statements fall completely', () => {
    expect(cascade(presetById('zero-add')).fates.every((f) => f === 'falls')).toBe(true);
    expect(cascade(presetById('two-mul')).blockedAt).toBe(null);
  });
  it('base failure wobbles domino 0', () => {
    expect(cascade(presetById('succ-self')).fates[0]).toBe('wobbles');
    expect(cascade(presetById('mul-zero-one')).fates[0]).toBe('wobbles');
  });
  it('n * n = n breaks the link 1 to 2', () => {
    const c = cascade(presetById('mul-self'));
    expect(brokenLink(presetById('mul-self'))).toBe(1);
    expect(c.blockedAt).toBe(2);
    expect(c.fates.slice(0, 2)).toEqual(['falls', 'falls']);
    expect(c.fates[2]).toBe('blocked');
  });
  it('instantiates', () => expect(instantiate('2 * n = n + n', 3)).toBe('2 * 3 = 3 + 3'));
});

describe('engine', () => {
  it('goals and proofs', () => {
    for (const p of presets) {
      const c = checkPreset(p);
      expect(c.goals.base?.target, p.id).toBeTruthy();
      expect(c.goals.step?.hyps.some((h) => h.names.includes('ih')), p.id).toBe(true);
      if (p.base) expect(c.baseOk, p.id).toBe(true);
      if (p.step) expect(c.stepOk, p.id).toBe(true);
      expect(c.complete, p.id).toBe(!!p.base && !!p.step);
    }
  });
});
