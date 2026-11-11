import { describe, expect, it } from 'vitest';
import { engine } from '../engine/index.ts';
import { home } from '../content/site.ts';
import { describeGoals, demoStates, lineOfOffset, mapNotesToSteps, stepForLine } from './demoSteps.ts';

const code = 'theorem t : True := by\n  skip\n  trivial';

describe('demo step mapping', () => {
  it('finds lines', () => {
    expect(lineOfOffset(code, 0)).toBe(1);
    expect(lineOfOffset(code, code.indexOf('skip'))).toBe(2);
    expect(lineOfOffset(code, code.indexOf('trivial'))).toBe(3);
  });
  it('maps a line to the earliest step starting on it', () => {
    const steps = [{ from: 25 }, { from: 40 }, { from: 33 }];
    expect(stepForLine(code, steps, 2)).toBe(0);
    expect(stepForLine(code, steps, 3)).toBe(2);
    expect(stepForLine(code, steps, 9)).toBe(-1);
  });
  it('returns null when a note has no step', () => {
    expect(mapNotesToSteps(code, [{ line: 2 }, { line: 7 }], [{ from: 25 }])).toBeNull();
    expect(mapNotesToSteps(code, [{ line: 2 }], [{ from: 25 }])).toEqual([0]);
  });
  it('describes goals', () => {
    expect(describeGoals([])).toMatch(/No goals/);
    expect(describeGoals([{ hyps: [{ names: ['p', 'q'], type: 'Prop', isProof: false }], target: 'p ∧ q' }])).toBe('p q : Prop. Goal: p ∧ q');
  });
  it('the shipped demo checks, completes, and yields a state per note', () => {
    const d = home.demo;
    const r = engine.check(engine.baseEnv(), d.code);
    expect(r.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    expect(r.complete).toBe(true);
    const idx = mapNotesToSteps(d.code, d.steps, r.steps);
    expect(idx).not.toBeNull();
    const states = demoStates(d.code, d.steps, r.steps)!;
    expect(states).toHaveLength(d.steps.length + 1);
    expect(states[0].length).toBeGreaterThan(0);
    expect(states[states.length - 1]).toEqual([]);
    // every step changes the visible state
    for (let i = 1; i < states.length; i++) expect(JSON.stringify(states[i])).not.toBe(JSON.stringify(states[i - 1]));
  });
});
