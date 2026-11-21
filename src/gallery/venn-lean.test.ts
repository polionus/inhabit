import { describe, expect, it } from 'vitest';
import { parseSet, regionsOf, verdict } from './venn.ts';
import { leanInfo } from './venn-lean.ts';

const go = (a: string, b: string, rel: 'eq' | 'subset' = 'eq') => {
  const l = parseSet(a);
  const r = parseSet(b);
  if (!l.ok || !r.ok) throw new Error('parse');
  return leanInfo(l.e, r.e, rel, verdict(regionsOf(l.e), regionsOf(r.e), rel).holds);
};

describe('venn lean tie-in', () => {
  it('distributivity elaborates and gets a checked proof', () => {
    const i = go('A ∩ (B ∪ C)', '(A ∩ B) ∪ (A ∩ C)');
    expect(i.elaborates).toBe(true);
    expect(i.proof).toContain('ext x');
  });
  it('every preset statement elaborates', () => {
    for (const [a, b] of [['(A ∪ B)ᶜ', 'Aᶜ ∩ Bᶜ'], ['A \\ B', 'A ∩ Bᶜ'], ['A ∪ B', 'A'], ['A ∪ (A ∩ B)', 'A'], ['∅', 'A ∩ Aᶜ'], ['Set.univ', 'A ∪ Aᶜ']]) {
      const i = go(a, b);
      expect(i.elaborates, a + ' = ' + b).toBe(true);
    }
  });
  it('subset proofs', () => expect(go('A ∩ B', 'A', 'subset').proof).toBeTruthy());
  it('false statements get no proof', () => expect(go('A ∪ B', 'A').proof).toBeUndefined());
});

describe('venn lean tie-in, timing', () => {
  it('classical De Morgan finishes quickly (proof or none)', () => {
    const t = Date.now();
    const i = go('(A ∩ B)ᶜ', 'Aᶜ ∪ Bᶜ');
    expect(i.elaborates).toBe(true);
    expect(Date.now() - t).toBeLessThan(3000);
    console.log('demorgan-classical proof:', !!i.proof);
  });
});
