/** Generated English stays unambiguous.   npx vitest run src/arena/gen/english */
import { describe, expect, it } from 'vitest';
import { generator } from './index.ts';
import type { ProofFamily } from '../types.ts';

describe('generated English', () => {
  it('has no bare "has … implies …" and separates comma-bearing hypotheses', () => {
    const fams: ProofFamily[] = ['prop', 'quant', 'set'];
    let n = 0;
    for (let i = 0; i < 210; i++) {
      const fam = fams[i % 3];
      const [lo, hi] = generator.range[fam];
      const p = generator.generate({ seed: 'en' + i, family: fam, target: lo + ((hi - lo) * (i % 9)) / 8 });
      if (p.kind !== 'proof' || !p.english) continue;
      n++;
      const flat = p.english.replace(/\([^()]*\)/g, '');
      expect(flat, p.english).not.toMatch(/\bhas\b[^.;:]*\bimplies\b/);
      if (p.english.startsWith('If ')) {
        const hyps = p.english.slice(3, p.english.lastIndexOf(', then '));
        expect(hyps, p.english).not.toMatch(/for every|there is|:/);
      }
    }
    expect(n).toBeGreaterThan(150);
  }, 60000);
  it('is deterministic', () => {
    const a = generator.generate({ seed: 'en7', family: 'quant', target: 800 });
    const b = generator.generate({ seed: 'en7', family: 'quant', target: 800 });
    expect(a).toEqual(b);
  });
});
