/**
 * Practice sets: which levels the generator can serve, and that every offered problem is solvable
 * with exactly what the level has unlocked.   npx vitest run src/arena/practice
 */
import { describe, expect, it } from 'vitest';
import { engine } from '../engine/index.ts';
import { worlds, levelContext } from '../content/index.ts';
import { generator } from './gen/index.ts';
import { statementKey } from './plan.ts';
import { GENERATOR_TACTICS, practiceFocus, practiceSet, smallerVersion, headConnective } from './practice.ts';
import type { ProofFamily, ProofPuzzle } from './types.ts';

const allLevels = worlds.flatMap((w) => w.levels.map((l) => ({ w, l })));

function sampleTactics(fam: ProofFamily): string[] {
  const [lo, hi] = generator.range[fam];
  const s = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const p = generator.generate({ seed: 't' + i, family: fam, target: lo + ((hi - lo) * (i % 10)) / 9 });
    if (p.kind !== 'proof') continue;
    const r = engine.check(engine.baseEnv(), p.header + '\n' + p.solution, { allowedTactics: p.allowedTactics });
    for (const d of r.decls) for (const t of d.usedTactics) s.add(t);
  }
  return [...s].sort();
}

describe('GENERATOR_TACTICS', () => {
  it('is what the generator emits (re-derived by sampling)', () => {
    for (const fam of ['prop', 'inhabit', 'quant', 'set'] as const) expect(sampleTactics(fam)).toEqual(GENERATOR_TACTICS[fam]);
  }, 60000);
});

describe('practiceFocus', () => {
  it('never throws and is null for worlds without a generator family', () => {
    for (const { w, l } of allLevels) {
      const f = practiceFocus(l.id);
      if (['eq', 'nat', 'fun', 'num', 'forge'].includes(w.id)) expect(f, l.id).toBeNull();
      if (f) {
        expect(['types', 'props', 'logic', 'quant', 'sets']).toContain(w.id);
        for (const t of f.tactics) expect(GENERATOR_TACTICS[f.family]).toContain(t);
      }
    }
    expect(practiceFocus('no-such-level')).toBeNull();
  });
  it('reads the level', () => {
    expect(practiceFocus('logic-06')?.tactics).toEqual(['cases']);
    expect(practiceFocus('logic-06')?.family).toBe('prop');
    expect(practiceFocus('quant-06')?.tactics).toEqual(['use']);
    expect(practiceFocus('quant-04')).toBeNull(); // specialize: the generator never emits it
    expect(practiceFocus('types-09')?.family).toBe('inhabit');
    expect(practiceFocus('types-02')).toBeNull(); // a choice level
  });
});

describe('practiceSet', () => {
  const supported = allLevels.filter(({ l }) => practiceFocus(l.id)).map(({ w, l }) => ({ w: w.id, id: l.id }));

  it('serves every supported level with problems that fit its inventory', () => {
    const perWorld: Record<string, string> = {};
    const count: Record<string, [number, number]> = {};
    let ok = 0;
    for (const { w, id } of supported) {
      count[w] ??= [0, 0];
      count[w][1]++;
      const set = practiceSet(id);
      if (set.length === 0) continue;
      ok++;
      count[w][0]++;
      expect(set.length, id).toBeLessThanOrEqual(3);
      const inv = levelContext(id).allowedTactics;
      const keys = new Set(set.map(statementKey));
      expect(keys.size, id).toBe(set.length);
      for (const p of set) {
        expect(p.kind).toBe('proof');
        // complete under the generator's own check...
        expect(generator.check(p, p.solution).complete, `${id} ${p.id}`).toBe(true);
        // ...and with the allowed tactics restricted to the level's inventory
        const r = engine.check(engine.baseEnv(), p.header + '\n' + p.solution, { allowedTactics: inv });
        expect(r.complete, `${id} ${p.id} under inventory`).toBe(true);
        expect(p.allowedTactics.every((t) => inv.includes(t))).toBe(true);
      }
    }
    for (const [w, [a, b]] of Object.entries(count)) perWorld[w] = `${a}/${b}`;
    console.log(`practice-supported levels: ${ok} of ${allLevels.length}`, JSON.stringify(perWorld));
    expect(ok).toBeGreaterThan(10);
  }, 120000);

  it('is deterministic, rounds differ, ratings rise', () => {
    const a = practiceSet('logic-06', 0);
    expect(a.map((p) => p.id)).toEqual(practiceSet('logic-06', 0).map((p) => p.id));
    const b = practiceSet('logic-06', 1);
    const c = practiceSet('logic-06', 2);
    const ka = new Set(a.map(statementKey));
    for (const p of [...b]) expect(ka.has(statementKey(p))).toBe(false);
    const kb = new Set(b.map(statementKey));
    for (const p of c) expect(ka.has(statementKey(p)) || kb.has(statementKey(p))).toBe(false);
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
    expect(a.length).toBe(3);
    for (let i = 1; i < a.length; i++) expect(a[i].rating).toBeGreaterThanOrEqual(a[i - 1].rating);
  });

  it('is empty for unsupported levels', () => {
    expect(practiceSet('eq-03')).toEqual([]);
    expect(practiceSet('nope')).toEqual([]);
  });
});

describe('smallerVersion', () => {
  it('is an easy valid problem, deterministic, null when unsupported', () => {
    const p = smallerVersion('logic-06') as ProofPuzzle;
    expect(p).not.toBeNull();
    expect(smallerVersion('logic-06')!.id).toBe(p.id);
    expect(p.rating).toBeLessThan(900);
    expect(generator.check(p, p.solution).complete).toBe(true);
    const inv = levelContext('logic-06').allowedTactics;
    expect(engine.check(engine.baseEnv(), p.header + '\n' + p.solution, { allowedTactics: inv }).complete).toBe(true);
    expect(smallerVersion('eq-03')).toBeNull();
  });
  it('knows the head connective', () => {
    expect(headConnective('P ∨ Q → Q ∨ P')).toBe('→');
    expect(headConnective('P ∧ Q')).toBe('∧');
    expect(headConnective('¬(P ∨ Q)')).toBe('¬');
    expect(headConnective('(A ∪ B)ᶜ ⊆ C')).toBe('⊆');
  });
});
