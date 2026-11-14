/**
 * Arena generator tests: every family across its rating range.
 *   npx vitest run src/arena/gen
 * Prints the rating-deviation distribution, duplicate rates and timings per family.
 */
import { describe, expect, it } from 'vitest';
import { generator } from './index.ts';
import { makeRng } from './rng.ts';
import { classify, countermodel, g4ip, parse } from './logic.ts';
import type { ProofPuzzle, PuzzleFamily, QuickPuzzle } from '../types.ts';

const FAMILIES: PuzzleFamily[] = ['prop', 'inhabit', 'quant', 'set', 'quick'];
const SEEDS = 60;

function targets(f: PuzzleFamily): number[] {
  const [lo, hi] = generator.range[f];
  return [0, 0.25, 0.5, 0.75, 1].map((x) => Math.round(lo + x * (hi - lo)));
}

/** Statement text up to renaming of hypothesis names (letters are already canonical). */
const statementKey = (p: ProofPuzzle) => p.header.replace(/\((h[\w'₀-₉]*) : /g, '(_ : ');

describe('rng', () => {
  it('is deterministic, uniform-ish and forks independently of draws', () => {
    const a = makeRng('seed');
    const b = makeRng('seed');
    const xs = Array.from({ length: 1000 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b.next()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.05);
    const c = makeRng('seed');
    c.next();
    expect(c.fork('x').next()).toBe(makeRng('seed').fork('x').next());
    expect(makeRng('seed').fork('x').next()).not.toBe(makeRng('seed').fork('y').next());
    const counts = new Array(6).fill(0);
    const r = makeRng('dice');
    for (let i = 0; i < 6000; i++) counts[r.int(6)]++;
    expect(Math.min(...counts)).toBeGreaterThan(850);
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('logic', () => {
  it('classifies formulas', () => {
    expect(classify(parse('P ∧ Q → Q ∧ P'))).toBe('intuitionistic');
    expect(classify(parse('¬¬(P ∨ ¬P)'))).toBe('intuitionistic');
    expect(classify(parse('P ∨ ¬P'))).toBe('classical');
    expect(classify(parse('((P → Q) → P) → P'))).toBe('classical');
    expect(classify(parse('¬(P ∧ Q) → ¬P ∨ ¬Q'))).toBe('classical');
    expect(classify(parse('(P → Q) → Q → P'))).toBe('invalid');
    expect(countermodel(parse('(P → Q) → Q → P'))).toEqual({ P: false, Q: true });
    expect(g4ip([parse('P ∨ Q'), parse('¬P')], parse('Q'))).toBe(true);
    expect(g4ip([], parse('¬¬P → P'))).toBe(false);
  });
});

for (const family of FAMILIES) {
  describe(`family ${family}`, () => {
    it(`across its range (${SEEDS} seeds × 5 targets)`, () => {
      const [lo, hi] = generator.range[family];
      const devs: number[] = [];
      let worst = 0;
      let total = 0;
      let n = 0;
      for (const target of targets(family)) {
        for (let i = 0; i < SEEDS; i++) {
          const spec = { seed: `t${i}`, family, target };
          const t0 = performance.now();
          const p = generator.generate(spec);
          const dt = performance.now() - t0;
          worst = Math.max(worst, dt);
          total += dt;
          n++;
          expect(p.id).toBe(`${family}.${generator.version}.t${i}.${target}`);
          expect(p.family === family || (p as ProofPuzzle).family === 'prop').toBe(true);
          expect(p.rating).toBeGreaterThanOrEqual(400);
          expect(p.rating).toBeLessThanOrEqual(2400);
          expect(p.par).toBeGreaterThan(0);
          devs.push(p.rating - target);
          if (i % 10 === 0) expect(generator.generate(spec)).toEqual(p);
          if (p.kind === 'proof') {
            const ok = generator.check(p, p.solution);
            if (!ok.complete) console.log(p.header, '\n', p.solution, ok.result.diagnostics.map((d) => d.message));
            expect(ok.complete).toBe(true);
            expect(generator.check(p, p.starter).complete).toBe(false);
            expect(p.english.length).toBeGreaterThan(5);
            expect(p.hints.length).toBeGreaterThanOrEqual(2);
            expect(p.hints.length).toBeLessThanOrEqual(3);
            expect(p.themes.length).toBeGreaterThan(0);
            expect(p.header.endsWith(p.mode === 'tactic' ? ':= by' : ':=')).toBe(true);
            if (p.mode === 'term') expect(p.allowedTactics).toEqual([]);
          } else {
            const q = p as QuickPuzzle;
            expect(q.options.length).toBeGreaterThanOrEqual(2);
            expect(q.options.length).toBeLessThanOrEqual(4);
            expect(q.options.filter((o) => o.correct).length).toBe(1);
            expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
            expect(q.options.every((o) => o.why.length > 5)).toBe(true);
            expect(q.par).toBeGreaterThanOrEqual(8);
            expect(q.par).toBeLessThanOrEqual(25);
          }
        }
      }
      const within = (d: number) => devs.filter((x) => Math.abs(x) <= d).length / devs.length;
      const sorted = [...devs].sort((a, b) => a - b);
      const q = (x: number) => sorted[Math.floor(x * (sorted.length - 1))];
      console.log(
        `[${family}] range ${lo}–${hi}: within ±100 ${(100 * within(100)).toFixed(0)}%, ±150 ${(100 * within(150)).toFixed(0)}%, ` +
          `±250 ${(100 * within(250)).toFixed(0)}%; deviation q05 ${q(0.05)} q50 ${q(0.5)} q95 ${q(0.95)}; ` +
          `time avg ${(total / n).toFixed(1)} ms, worst ${worst.toFixed(0)} ms (n=${n})`,
      );
      expect(within(150)).toBeGreaterThanOrEqual(0.9);
      expect(total / n).toBeLessThan(30);
      expect(worst).toBeLessThan(250);
    }, 60_000);

    it('has variety: few duplicate statements among s:0 … s:29', () => {
      const rates: string[] = [];
      for (const target of targets(family)) {
        const keys: string[] = [];
        for (let i = 0; i < 30; i++) {
          const p = generator.generate({ seed: `s:${i}`, family, target });
          keys.push(p.kind === 'proof' ? statementKey(p) : `${p.prompt}|${p.code}`);
        }
        const dup = 1 - new Set(keys).size / keys.length;
        rates.push(`${target}: ${(100 * dup).toFixed(0)}%`);
        expect(dup).toBeLessThanOrEqual(0.55);
      }
      console.log(`[${family}] duplicate rate among 30 seeds: ${rates.join(', ')}`);
    }, 60_000);
  });
}

describe('check', () => {
  const p = generator.generate({ seed: 'check', family: 'prop', target: 800 }) as ProofPuzzle;
  it('accepts the reference and rejects sorry, axioms and locked tactics', () => {
    expect(generator.check(p, p.solution).complete).toBe(true);
    expect(generator.check(p, '  sorry').complete).toBe(false);
    const ax = generator.check(p, '  exact cheat\naxiom cheat : False');
    expect(ax.complete).toBe(false);
    const before = generator.check(p, '  exact False.elim cheat');
    expect(before.complete).toBe(false);
    const locked = generator.check(p, '  simp');
    expect(locked.complete).toBe(false);
    expect(generator.check(p, p.solution).bodyOffset).toBe(p.header.length + 1);
  });
  it('term-mode puzzles reject tactic blocks', () => {
    const t = generator.generate({ seed: 'check', family: 'inhabit', target: 800 }) as ProofPuzzle;
    expect(t.mode).toBe('term');
    expect(generator.check(t, t.solution).complete).toBe(true);
    expect(generator.check(t, '  by\n    sorry').complete).toBe(false);
  });
  it('never throws on odd specs', () => {
    for (const target of [-50, 0, 5000, Number.NaN]) {
      for (const family of FAMILIES) expect(() => generator.generate({ seed: '', family, target })).not.toThrow();
    }
    const q = generator.generate({ seed: 'k', family: 'quick', target: 600, quick: ['provable'] }) as QuickPuzzle;
    expect(q.quick).toBe('provable');
  });
});
