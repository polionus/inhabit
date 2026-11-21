/**
 * Practice sets: which levels the generator can serve, and that every offered problem is solvable
 * with exactly what the level has unlocked.   npx vitest run src/arena/practice
 */
import { describe, expect, it } from 'vitest';
import { engine } from '../../../domains/lean/engine/index.ts';
import { worlds, levelContext } from '../content/index.ts';
import { generator } from './gen/index.ts';
import { familyEnv, lemmasIn } from './gen/arith.ts';
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
    const r = engine.check(familyEnv(fam), p.header + '\n' + p.solution, { allowedTactics: p.allowedTactics });
    for (const d of r.decls) for (const t of d.usedTactics) s.add(t);
  }
  return [...s].sort();
}

describe('GENERATOR_TACTICS', () => {
  it('is what the generator emits (re-derived by sampling)', () => {
    for (const fam of ['prop', 'inhabit', 'quant', 'set', 'rw', 'ind', 'div'] as const) expect(sampleTactics(fam), fam).toEqual(GENERATOR_TACTICS[fam]);
  }, 60000);
});

describe('practiceFocus', () => {
  it('never throws, and serves each world with its own families', () => {
    const allowed: Record<string, ProofFamily[]> = {
      types: ['inhabit'],
      props: ['prop', 'inhabit'],
      logic: ['prop', 'inhabit'],
      quant: ['quant', 'inhabit'],
      sets: ['set', 'inhabit'],
      eq: ['rw'],
      nat: ['ind', 'rw'],
      num: ['div', 'rw'],
      fun: ['rw', 'quant', 'set'],
      forge: ['rw', 'set', 'prop'],
    };
    for (const { w, l } of allLevels) {
      const f = practiceFocus(l.id);
      if (f) {
        expect(allowed[w.id], l.id).toContain(f.family);
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
    expect(practiceFocus('eq-07')).toMatchObject({ family: 'rw', tactics: ['symm'] });
    expect(practiceFocus('eq-11')).toMatchObject({ family: 'rw', tactics: ['subst'] });
    expect(practiceFocus('nat-06')?.family).toBe('ind');
    expect(practiceFocus('nat-11')?.family).toBe('rw'); // a rewriting level, no induction
    expect(practiceFocus('num-06')).toMatchObject({ family: 'div', tactics: ['refine'] });
    expect(practiceFocus('eq-09')).toBeNull(); // term mode about numbers
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
        const r = engine.check(familyEnv(p.family), p.header + '\n' + p.solution, { allowedTactics: inv });
        expect(r.complete, `${id} ${p.id} under inventory`).toBe(true);
        expect(p.allowedTactics.every((t) => inv.includes(t))).toBe(true);
        // ...citing only lemmas the level has unlocked (bank lemmas, or equations its codex introduced)
        const ctx = levelContext(id);
        const unlocked = new Set([...ctx.lemmas.map((l) => l.name), ...ctx.codex]);
        for (const l of lemmasIn(p.solution)) expect(unlocked.has(l), `${id}: ${l} not unlocked`).toBe(true);
      }
    }
    for (const [w, [a, b]] of Object.entries(count)) perWorld[w] = `${a}/${b}`;
    console.log(`practice-supported levels: ${ok} of ${allLevels.length}`, JSON.stringify(perWorld));
    expect(ok).toBeGreaterThanOrEqual(55);
    for (const w of ['eq', 'nat', 'num']) expect(count[w][0], w).toBeGreaterThanOrEqual(6);
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
  it('serves the arithmetic worlds', () => {
    for (const id of ['eq-04', 'eq-08', 'nat-06', 'nat-11', 'num-02', 'num-08']) {
      const p = smallerVersion(id);
      expect(p, id).not.toBeNull();
      expect(generator.check(p!, p!.solution).complete, id).toBe(true);
      expect(p!.rating, id).toBeLessThan(1000);
    }
  });
  it('knows the head connective', () => {
    expect(headConnective('P ∨ Q → Q ∨ P')).toBe('→');
    expect(headConnective('P ∧ Q')).toBe('∧');
    expect(headConnective('¬(P ∨ Q)')).toBe('¬');
    expect(headConnective('(A ∪ B)ᶜ ⊆ C')).toBe('⊆');
  });
});
