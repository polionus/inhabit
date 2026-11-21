import { describe, expect, it } from 'vitest';
import { engine } from '../engine/index.ts';
import { PRESETS, classifyTable, leanProof, parseFormula, truthTable, verdict } from './truth-table.ts';

const parsed = (s: string) => {
  const r = parseFormula(s);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('parser', () => {
  it('reads Lean and ASCII spellings', () => {
    expect(parsed('P -> Q').f).toEqual(parsed('P → Q').f);
    expect(parsed('~P \\/ Q /\\ R').f).toEqual(parsed('¬P ∨ Q ∧ R').f);
    expect(parsed('P <-> Q').atoms).toEqual(['P', 'Q']);
    expect(parsed('True → False').atoms).toEqual([]);
  });
  it('rejects bad input with a message', () => {
    for (const s of ['', 'P →', '(P', 'P ∧ x', '∀ x, P', 'P + Q', 'A B C D E ∧']) expect(parseFormula(s).ok).toBe(false);
    expect(parseFormula('A ∧ B ∧ C ∧ D ∧ E').ok).toBe(false);
  });
});

describe('table', () => {
  it('evaluates and classifies', () => {
    const k = (s: string) => {
      const p = parsed(s);
      return classifyTable(truthTable(p.f, p.atoms)).kind;
    };
    expect(k('P ∨ ¬P')).toBe('tautology');
    expect(k('P ∧ ¬P')).toBe('contradiction');
    expect(k('P → Q')).toBe('contingent');
    const p = parsed('P → Q');
    const t = truthTable(p.f, p.atoms);
    expect(t.rows.map((r) => r.result)).toEqual([true, false, true, true]);
    expect(t.rows).toHaveLength(4);
  });
});

describe('constructive verdicts and Lean proofs', () => {
  const expected = ['classical', 'classical', 'constructive', 'constructive', 'classical', 'invalid'];
  PRESETS.forEach((p, i) => {
    it(`${p.formula} is ${expected[i]}`, () => {
      const r = parsed(p.formula);
      expect(verdict(r.f)).toBe(expected[i]);
      if (expected[i] === 'invalid') return;
      const cl = expected[i] === 'classical';
      const pr = leanProof(r.f, r.atoms, cl);
      expect(pr, 'proof found').not.toBeNull();
      const res = engine.check(engine.baseEnv(), pr!.source, { allowedTactics: pr!.allowed });
      expect(res.complete, pr!.source + JSON.stringify(res.diagnostics)).toBe(true);
      expect(pr!.usesClassical).toBe(cl);
      if (cl) {
        // the constructive search must come up empty
        expect(leanProof(r.f, r.atoms, false)).toBeNull();
      }
    });
  });
});
