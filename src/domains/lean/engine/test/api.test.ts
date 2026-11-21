import { describe, expect, it } from 'vitest';
import { engine } from '../index.ts';
import { check, envWithNat, goalText } from './helpers.ts';

const SRC = 'example (P Q : Prop) (hp : P) (hq : Q) : P ∧ Q := by\n  constructor\n  · exact hp\n  · exact hq';

describe('goalsAt', () => {
  const r = check(SRC);
  it('before the first tactic shows the initial goal', () => {
    const g = engine.goalsAt(r, SRC.indexOf('constructor'))!;
    expect(g.map(goalText)).toEqual(['P Q : Prop\nhp : P\nhq : Q\n⊢ P ∧ Q']);
  });
  it('after a tactic shows its result, with case tags', () => {
    const g = engine.goalsAt(r, SRC.indexOf('constructor') + 'constructor'.length)!;
    expect(g.map((x) => x.caseName)).toEqual(['left', 'right']);
  });
  it('inside a tactic shows the state before it', () => {
    const g = engine.goalsAt(r, SRC.indexOf('exact hp') + 3)!;
    expect(g).toHaveLength(1);
    expect(g[0].target).toBe('P');
  });
  it('at the end shows no goals', () => {
    expect(engine.goalsAt(r, SRC.length)).toEqual([]);
  });
  it('outside a tactic proof is null', () => {
    expect(engine.goalsAt(r, 3)).toBeNull();
  });
});

describe('check options and results', () => {
  it('locks tactics not in allowedTactics', () => {
    const r = check(SRC, { allowedTactics: ['exact'] });
    const d = r.diagnostics.find((x) => x.code === 'tactic-locked');
    expect(d?.data?.tactic).toBe('constructor');
    expect(r.complete).toBe(false);
  });
  it('forbids names', () => {
    const r = check('example (a b : Nat) : a + b = b + a := Nat.add_comm a b', { forbiddenNames: ['Nat.add_comm'] });
    expect(r.diagnostics.some((d) => d.code === 'name-locked')).toBe(true);
  });
  it('term mode: `by` is rejected when no tactic is allowed', () => {
    const r = check('example (P : Prop) (hp : P) : P := by exact hp', { allowedTactics: [] });
    expect(r.diagnostics.some((d) => d.code === 'mode')).toBe(true);
  });
  it('sorry is a warning and not complete', () => {
    const r = check('example (P : Prop) : P := by\n  sorry', { allowedTactics: ['exact'] });
    expect(r.ok).toBe(true);
    expect(r.complete).toBe(false);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['sorry']);
  });
  it('reports unsolved goals with data.goals', () => {
    const r = check('example (P Q : Prop) (hp : P) : P ∧ Q := by\n  constructor\n  exact hp');
    const d = r.diagnostics.find((x) => x.code === 'unsolved-goals')!;
    expect(d.message).toBe('unsolved goals\ncase right\nP Q : Prop\nhp : P\n⊢ Q');
    expect(d.data?.goals?.[0].caseName).toBe('right');
  });
  it('rw failure quotes the pattern', () => {
    const r = check('example (n : Nat) : 0 + n = n := by\n  rw [Nat.add_zero]');
    const d = r.diagnostics.find((x) => x.code === 'rewrite-failed')!;
    expect(d.data?.pattern).toBe('?n + 0');
  });
  it('unknown identifiers get suggestions', () => {
    const r = check('example (a b : Nat) : a + b = b + a := Nat.add_comn a b');
    const d = r.diagnostics.find((x) => x.code === 'unknown-identifier')!;
    expect(d.data?.suggestions).toContain('Nat.add_comm');
  });
  it('provides proof terms for tactic proofs', () => {
    const r = check('example (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by\n  obtain ⟨hp, hq⟩ := h\n  exact ⟨hq, hp⟩');
    expect(r.decls[0].term).toBe('And.casesOn h fun hp hq => ⟨hq, hp⟩');
    expect(r.decls[0].isTacticProof).toBe(true);
    expect(r.decls[0].usedTactics.sort()).toEqual(['exact', 'obtain']);
  });
  it('later declarations still check after an error', () => {
    const r = check('example (P : Prop) : P := by\n  exact foo\nexample : True := trivial');
    expect(r.decls.map((d) => d.ok)).toEqual([false, true]);
  });
  it('never throws, and times out on runaway computation', () => {
    expect(() => check('example : 2 ^ 2 ^ 2 ^ 2 ^ 2 = 0 := rfl')).not.toThrow();
    const r = engine.check(envWithNat(), 'def f : Nat → Nat\n  | 0 => 0\n  | n + 1 => f n + 1\nexample : f 100000 = 100000 := rfl', { maxSteps: 20000 });
    expect(r.ok).toBe(false);
    expect(engine.check(engine.baseEnv(), '(((').ok).toBe(false);
  });
});

describe('elab / defEq / constant / extend', () => {
  const env = engine.baseEnv();
  it('elaborates under binders', () => {
    const r = engine.elab(env, '∀ x, x ∈ A → x ∈ B', '(α : Type) (A B : Set α)');
    expect(r).toMatchObject({ ok: true, type: 'Prop', pretty: '∀ (x : α), x ∈ A → x ∈ B' });
  });
  it('defEq sees through definitions', () => {
    expect(engine.defEq(env, 'A ⊆ B', '∀ x, x ∈ A → x ∈ B', '(α : Type) (A B : Set α)')).toBe(true);
    expect(engine.defEq(env, 'A ⊆ B', 'B ⊆ A', '(α : Type) (A B : Set α)')).toBe(false);
  });
  it('looks up constants', () => {
    expect(engine.constant(env, 'Nat.add_succ')).toMatchObject({ kind: 'theorem', type: '∀ (n m : Nat), n + m.succ = (n + m).succ' });
    expect(engine.constant(env, 'Nat.zero_add')).toBeNull();
  });
  it('extend does not mutate the base environment', () => {
    const ext = engine.extend(env, 'theorem my_triv : True := trivial');
    expect(engine.constant(ext.env, 'my_triv')).not.toBeNull();
    expect(engine.constant(env, 'my_triv')).toBeNull();
  });
  it('lists canonical tactics', () => {
    for (const t of ['intro', 'exact', 'apply', 'rw', 'induction', 'rcases', 'use', 'ext', 'calc']) expect(engine.tactics()).toContain(t);
  });
});
