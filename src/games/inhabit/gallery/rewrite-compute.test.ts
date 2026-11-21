import { describe, expect, it } from 'vitest';
import { engine } from '../../../domains/lean/engine/index.ts';
import { fullEnv } from '../env.ts';
import { findLevel } from '../content/index.ts';
import {
  COMPUTE_PRESETS, DOUBLE_DEF, RW_PRESETS, checkSteps, cleanRule, dbl, num, parseExpr, reduce, rflCheck, ruleSides, runRewrite, segments,
} from './rewrite-compute.ts';

const env = fullEnv();
const marked = (text: string, spans: { from: number; to: number }[]) => segments(text, spans).map((s) => (s.mark ? `[${s.text}]` : s.text)).join('');

describe('parsing printed goals', () => {
  it('keeps spans, including parentheses', () => {
    const e = parseExpr('z + (x + y) = 6')!;
    expect(e.k).toBe('op');
    if (e.k !== 'op' || e.l.k !== 'op') throw new Error('shape');
    expect([e.l.r.pfrom, e.l.r.pto, e.l.r.from, e.l.r.to]).toEqual([4, 11, 5, 10]);
  });
  it('reads rule types', () => {
    const s = ruleSides('∀ (n m : Nat), n + m.succ = (n + m).succ')!;
    expect(s.vars).toEqual(['n', 'm']);
    expect(s.rhs.k).toBe('succ');
    expect(ruleSides('a = b')!.vars).toEqual([]);
    expect(ruleSides('P ∧ Q')).toBeNull();
  });
  it('accepts rule text and rejects anything else', () => {
    expect(cleanRule(' <- h ')).toBe('← h');
    expect(cleanRule('h] at ha')).toBeNull();
    expect(cleanRule('')).toBeNull();
  });
});

describe('rewrite (engine goals, confirmed highlights)', () => {
  const run = (binders: string, goal: string, rule: string) => runRewrite(engine, env, binders, goal, rule);
  it('finds the first match, or the one the arguments pick', () => {
    const cases: [string, string, string][] = [
      ['Nat.add_comm', '[x + y + z] = z + y + x', '[z + (x + y)] = z + y + x'],
      ['Nat.add_comm x y', '[x + y] + z = z + y + x', '[y + x] + z = z + y + x'],
      ['Nat.add_comm z y', 'x + y + z = [z + y] + x', 'x + y + z = [y + z] + x'],
      ['Nat.add_assoc', '[x + y + z] = z + y + x', '[x + (y + z)] = z + y + x'],
    ];
    for (const [rule, before, after] of cases) {
      const r = run('(x y z : Nat)', 'x + y + z = z + y + x', rule);
      expect(r.ok, rule).toBe(true);
      expect(r.match?.confirmed, rule).toBe(true);
      expect(marked(r.before, r.match!.before)).toBe(before);
      expect(marked(r.after!, r.match!.after)).toBe(after);
    }
    expect(run('(x y z : Nat)', 'x + y + z = z + y + x', 'Nat.add_comm').match?.bindings).toEqual([['n', 'x + y'], ['m', 'z']]);
  });
  it('rewrites every occurrence, and in either direction', () => {
    const r = run('(a b : Nat) (h : a = b)', 'a + a = 2 * a', 'h');
    expect(marked(r.after!, r.match!.after)).toBe('[b] + [b] = 2 * [b]');
    const back = run('(a b : Nat) (h : a = b) (ha : a + 1 = 5)', 'b + 1 = 5', '← h');
    expect(marked(back.after!, back.match!.after)).toBe('[a] + 1 = 5');
    expect(back.hyps.map((h) => h.names.join(' '))).toEqual(['a b', 'h', 'ha']);
  });
  it('reads Nat.succ patterns against + 1', () => {
    const r = run('(a b : Nat) (h : a + b = 5)', 'a + (b + 1) = 6', 'Nat.add_succ');
    expect(r.match?.confirmed).toBe(true);
    expect(r.after).toBe('(a + b).succ = 6');
  });
  it("reports Lean's own error when the left side is missing", () => {
    const r = run('(x y z : Nat)', 'x + y + z = z + y + x', 'Nat.add_comm y z');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Did not find an occurrence of the pattern/);
    expect(r.pattern).toBe('y + z');
    expect(run('(a b : Nat) (h : a = b) (ha : a + 1 = 5)', 'b + 1 = 5', 'h').pattern).toBe('a');
  });
  it('notices when rw would close the goal with rfl', () => {
    expect(run('(a b : Nat) (h : a = b)', 'a + 0 = b', 'Nat.add_zero').closedByRfl).toBe(false);
    expect(run('(a b : Nat) (h : a = b)', 'a = b', 'h').closedByRfl).toBe(true);
  });
  it('every preset rule runs, and successful ones are confirmed', () => {
    for (const p of RW_PRESETS) {
      for (const rule of p.rules) {
        const r = run(p.binders, p.goal, rule);
        if (r.ok) expect(r.match?.confirmed, `${p.id} ${rule}`).toBe(true);
        else expect(r.error, `${p.id} ${rule}`).toBeTruthy();
      }
    }
  });
});

describe('compute (every step confirmed by rfl)', () => {
  const nat02 = findLevel('nat-02').level;
  const def = nat02.kind === 'proof' ? `${nat02.header}\n${nat02.solutions[0]}` : '';
  const denv = engine.extend(env, def).env;
  it("uses the game's own double", () => {
    expect(def).toBe(DOUBLE_DEF);
  });
  it('unfolds double 3 one case at a time', () => {
    const steps = reduce(dbl(num(3)), 'double');
    expect(steps.map((s) => s.text)).toEqual([
      'double 3', 'double 2 + 2', 'double 1 + 2 + 2', 'double 0 + 2 + 2 + 2', '0 + 2 + 2 + 2', '2 + 2 + 2', '4 + 2', '6',
    ]);
    expect(marked(steps[1].text, [steps[1].redex!])).toBe('[double 2] + 2');
  });
  it('every step of every preset, over its whole range, is an rfl equation', () => {
    for (const p of COMPUTE_PRESETS) {
      for (let a = p.a[0]; a <= p.a[1]; a++) {
        for (const b of p.b ? [p.b[0], p.b[2], p.b[1]] : [0]) {
          const steps = reduce(p.make(a, b), p.strategy);
          const c = checkSteps(engine, denv, steps);
          expect(c.stepOk.every(Boolean), `${p.id} ${a} ${b}`).toBe(true);
          expect(c.endOk, `${p.id} ${a} ${b}`).toBe(true);
          expect(c.reduced).toBe(steps[steps.length - 1].text);
          expect(steps[steps.length - 1].text).toMatch(/^\d+$/);
        }
      }
    }
  });
  it('a wrong step is caught', () => {
    const steps = reduce(dbl(num(3)), 'double');
    steps[2] = { ...steps[2], text: 'double 1 + 3' };
    const c = checkSteps(engine, denv, steps);
    expect(c.stepOk[2]).toBe(false);
    expect(c.stepOk[1]).toBe(true);
  });
  it('checks a guess with rfl', () => {
    expect(rflCheck(engine, denv, 'double 3', '6').ok).toBe(true);
    expect(rflCheck(engine, denv, 'double 3', 'double 2 + 2').ok).toBe(true);
    const bad = rflCheck(engine, denv, 'double 3', '5');
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/mismatch/i);
    expect(rflCheck(engine, denv, 'double 3', '6 := by').ok).toBe(false);
  });
});
