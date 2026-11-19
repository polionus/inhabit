/**
 * The arithmetic families (`rw`, `ind`, `div`): every reference proof checks, statements vary,
 * and a gate keeps proofs to the tactics and lemmas a level has unlocked.
 *   npx vitest run src/arena/gen/arith
 * (Real Lean: `node scripts/verify-arena.ts` compiles samples of these and every practice set.)
 */
import { describe, expect, it } from 'vitest';
import { engine } from '../../engine/index.ts';
import { generator, GEN_VERSION } from './index.ts';
import { ARITH_FAMILIES, ARITH_LEMMAS, BASE_LEMMAS, arithEnv, generateGated, lemmasIn, tacticsIn } from './arith.ts';
import type { ArithFamily, Attempt, Gate } from './arith.ts';
import { rwAttempt } from './rw.ts';
import { indAttempt } from './ind.ts';
import { divAttempt } from './div.ts';
import type { ProofPuzzle } from '../types.ts';

const ATTEMPT: Record<ArithFamily, Attempt> = { rw: rwAttempt, ind: indAttempt, div: divAttempt };
const N = 100;

describe('arithmetic families', () => {
  for (const family of ARITH_FAMILIES) {
    it(`${family}: ${N} puzzles check, vary, and stay in range`, () => {
      const [lo, hi] = generator.range[family];
      const keys = new Set<string>();
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        const target = Math.round(lo + ((hi - lo) * (i % 10)) / 9);
        const p = generator.generate({ seed: `arith-${i}`, family, target }) as ProofPuzzle;
        expect(p.kind).toBe('proof');
        expect(p.family, p.id).toBe(family);
        expect(generator.check(p, p.solution).complete, `${p.id}\n${p.header}\n${p.solution}`).toBe(true);
        expect(p.rating).toBeGreaterThanOrEqual(400);
        expect(p.rating).toBeLessThanOrEqual(hi + 150);
        expect(p.english.length).toBeGreaterThan(5);
        expect(p.hints.length).toBeGreaterThanOrEqual(2);
        for (const t of tacticsIn(p.solution)) expect(p.allowedTactics, p.id).toContain(t);
        for (const l of lemmasIn(p.solution)) expect([...BASE_LEMMAS, ...ARITH_LEMMAS.map((x) => x.name)], p.id).toContain(l);
        keys.add(p.header.replace(/\((h[\w'₀-₉]*) : /g, '(_ : '));
      }
      const ms = (performance.now() - t0) / N;
      console.log(`${family}: ${keys.size} distinct statements of ${N}, ${ms.toFixed(1)} ms per puzzle`);
      expect(keys.size).toBeGreaterThan(N * 0.4);
      expect(ms).toBeLessThan(150);
    });
  }

  it('is deterministic', () => {
    for (const family of ARITH_FAMILIES) {
      const a = generator.generate({ seed: 'same', family, target: 600 });
      const b = generator.generate({ seed: 'same', family, target: 600 });
      expect(a).toEqual(b);
    }
  });
});

describe('gates', () => {
  const cases: [string, ArithFamily, Gate][] = [
    // the Equality world: hypotheses only, no lemma names, no `calc` / `symm` / `subst` / `rwa` yet
    ['eq-04', 'rw', { tactics: new Set(['rw', 'rfl', 'exact', 'intro', 'apply']), lemmas: new Set() }],
    ['eq-11', 'rw', { tactics: new Set(['rw', 'rfl', 'exact', 'symm', 'calc', 'subst']), lemmas: new Set(), focus: ['subst'] }],
    // first induction: only the defining equations
    ['nat-06', 'ind', { tactics: new Set(['induction', 'rw', 'rfl', 'exact']), lemmas: new Set(['Nat.add_zero', 'Nat.add_succ', 'Nat.mul_zero', 'Nat.mul_succ']) }],
    // divisibility before `refine`, and before any dvd lemma
    ['num-02', 'div', { tactics: new Set(['use', 'obtain', 'rw', 'rfl', 'exact', 'intro', 'apply']), lemmas: new Set(['Nat.mul_one', 'Nat.mul_comm', 'Nat.mul_assoc', 'Nat.mul_add', 'Nat.add_mul', 'Nat.two_mul', 'Nat.add_assoc', 'Nat.add_right_comm']) }],
  ];
  for (const [label, family, gate] of cases) {
    it(`${label}: proofs use only what the gate allows`, () => {
      let made = 0;
      let focused = 0;
      const keys = new Set<string>();
      for (let i = 0; i < 40; i++) {
        const p = generateGated(`${label}:${i}`, family, 450 + 5 * i, ATTEMPT[family], gate, GEN_VERSION);
        if (!p) continue;
        made++;
        keys.add(p.english);
        const r = engine.check(arithEnv(), p.header + '\n' + p.solution, { allowedTactics: [...gate.tactics!] });
        expect(r.complete, `${p.header}\n${p.solution}`).toBe(true);
        for (const d of r.decls) for (const t of d.usedTactics) expect(gate.tactics!.has(t), `${t} in ${p.solution}`).toBe(true);
        for (const l of lemmasIn(p.solution)) expect(gate.lemmas!.has(l), `${l} in ${p.solution}`).toBe(true);
        if (gate.focus && tacticsIn(p.solution).some((t) => gate.focus!.includes(t))) focused++;
      }
      expect(made).toBeGreaterThan(30);
      if (gate.focus) expect(focused).toBeGreaterThan(made / 2);
      expect(keys.size).toBeGreaterThan(made / 5);
    });
  }
});
