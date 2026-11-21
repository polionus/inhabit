import { describe, expect, it } from 'vitest';
import { engine } from '../../../domains/lean/engine/index.ts';
import { fullEnv } from '../env.ts';
import { findLevel } from '../content/index.ts';
import type { Goal } from '../../../domains/lean/engine/types.ts';
import { PROOF_PRESETS, bodyLines, buildReplay, diffGoals, diffSpan, holesFromSorry, referenceBody, removedHyps } from './proof-replay.ts';

const env = fullEnv();
const replayOf = (id: string) => {
  const { level } = findLevel(id);
  const body = referenceBody(level as never);
  if (!body || !('header' in level)) throw new Error(`no body for ${id}`);
  return buildReplay(engine, env, level.header, body);
};
const targets = (gs: Goal[] | null) => gs?.map((g) => g.target) ?? null;

describe('holes', () => {
  it('turns sorryAx into ?_', () => {
    expect(holesFromSorry('fun hp => sorryAx R')).toBe('fun hp => ?_');
    expect(holesFromSorry('fun hp => hqr (sorryAx Q)')).toBe('fun hp => hqr ?_');
    expect(holesFromSorry('Or.casesOn h (fun hp => sorryAx (Q ∨ P)) fun hq => sorryAx (Q ∨ P)')).toBe('Or.casesOn h (fun hp => ?_) fun hq => ?_');
    expect(holesFromSorry('⟨sorryAx Q, sorryAx (P x)⟩')).toBe('⟨?_, ?_⟩');
    expect(holesFromSorry('sorryAx (P ∧ Q) true')).toBe('?_');
    expect(holesFromSorry('mysorryAx Q')).toBe('mysorryAx Q');
  });
});

describe('replay', () => {
  it('every preset is a complete proof whose every cut checks, with one hole per open goal', () => {
    for (const p of PROOF_PRESETS) {
      const r = replayOf(p.level);
      expect(r.complete, p.level).toBe(true);
      expect(r.cuts).toHaveLength(r.lines.length + 1);
      r.cuts.forEach((c, k) => {
        expect(c.error, `${p.level} cut ${k}`).toBeNull();
        expect(c.term, `${p.level} cut ${k}`).toBeTruthy();
        expect(c.term!.includes('sorry')).toBe(false);
        const holes = c.term!.split('?_').length - 1;
        // `have` keeps its goal but the hole is shared; otherwise holes = open goals
        expect(holes, `${p.level} cut ${k}: ${c.term}`).toBe(c.goals!.length);
      });
      expect(r.cuts[r.lines.length].goals).toEqual([]);
    }
  });

  it('builds the implication chain term from the outside in', () => {
    const r = replayOf('props-07');
    expect(r.cuts.map((c) => c.term)).toEqual(['?_', 'fun hp => ?_', 'fun hp => hqr ?_', 'fun hp => hqr (hpq ?_)', 'fun hp => hqr (hpq hp)']);
    expect(r.cuts.map((c) => targets(c.goals))).toEqual([['P → R'], ['R'], ['Q'], ['P'], []]);
  });

  it('splits into two holes at a case split, and fills them in order', () => {
    const r = replayOf('logic-06');
    const afterCases = r.cuts[2];
    expect(afterCases.goals?.map((g) => g.caseName)).toEqual(['inl', 'inr']);
    expect(afterCases.term).toBe('fun h => Or.casesOn h (fun hp => ?_) fun hq => ?_');
    expect(r.cuts[3].term).toBe('fun h => Or.casesOn h (fun hp => Or.inr hp) fun hq => ?_');
  });

  it('handles bullets after constructor', () => {
    const r = replayOf('logic-04');
    expect(r.cuts[3].term).toMatch(/⟨\?_, \?_⟩$/);
    expect(r.cuts[4].term).toMatch(/⟨hq, \?_⟩$/);
  });

  it('replays a learner proof up to its first error', () => {
    const header = 'theorem chain (P Q R : Prop) (hpq : P → Q) (hqr : Q → R) : P → R := by';
    const r = buildReplay(engine, env, header, '  intro hp\n  apply hpq\n  exact hp');
    expect(r.complete).toBe(false);
    expect(r.fullError?.line).toBe(2);
    expect(r.reachable).toBe(2);
    expect(r.cuts[1].term).toBe('fun hp => ?_');
    expect(r.cuts[2].goals).toBeNull();
  });

  it('reads the statement goal from an empty body', () => {
    const r = buildReplay(engine, env, 'theorem t (P : Prop) (hp : P) : P := by', '');
    expect(r.lines).toEqual([]);
    expect(targets(r.cuts[0].goals)).toEqual(['P']);
  });

  it('lines skip blanks and comments', () => {
    expect(bodyLines('  intro h\n\n  -- note\n  exact h').map((l) => [l.index, l.text, l.indent])).toEqual([[1, 'intro h', 2], [2, 'exact h', 2]]);
  });
});

describe('what changed', () => {
  const g = (target: string, hyps: [string, string][], caseName?: string): Goal => ({ target, caseName, hyps: hyps.map(([n, t]) => ({ names: [n], type: t, isProof: true })) });
  it('marks new hypotheses and a changed target', () => {
    const before = [g('P → R', [['hpq', 'P → Q']])];
    const after = [g('R', [['hpq', 'P → Q'], ['hp', 'P']])];
    const d = diffGoals(before, after);
    expect(d[0].hyps).toEqual(['same', 'new']);
    expect(d[0].targetChanged).toBe(true);
    expect(removedHyps(before, after)).toEqual([]);
  });
  it('leaves untouched goals alone and reports consumed hypotheses', () => {
    const before = [g('Q', [['h', 'P ∧ Q']]), g('R', [])];
    const after = [g('Q', [['hp', 'P'], ['hq', 'Q']]), g('R', [])];
    const d = diffGoals(before, after);
    expect(d[1].untouched).toBe(true);
    expect(d[0].hyps).toEqual(['new', 'new']);
    expect(removedHyps(before, after)).toEqual(['h']);
    expect(removedHyps(before, [g('R', [])])).toEqual([]);
  });
  it('diffs terms at token boundaries', () => {
    expect(diffSpan('fun hp => ?_', 'fun hp => hqr ?_')).toEqual(['fun hp => ', 'hqr ', '?_']);
    expect(diffSpan('fun hp => hqr (hpq ?_)', 'fun hp => hqr (hpq hp)')).toEqual(['fun hp => hqr (hpq ', 'hp', ')']);
    expect(diffSpan('x', 'x')).toEqual(['x', '', '']);
  });
});
