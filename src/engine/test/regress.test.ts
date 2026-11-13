import { describe, expect, it } from 'vitest';
import { engine } from '../index.ts';
import { fullEnv } from '../../game/env.ts';

/** Bugs found in play. Each snippet is accepted by real Lean 4 (with the game library). */
describe('regressions', () => {
  it('offset unification against a literal 0 terminates (rw pattern `0 + ?n` vs `n + 1 + 0`)', () => {
    const r = engine.check(fullEnv(), 'example (n : Nat) : n + 1 + 0 = 0 + (n + 1) := by rw [Nat.zero_add]');
    expect(r.diagnostics.map((d) => d.message)).toEqual([]);
    expect(r.complete).toBe(true);
  });
  it('a successor is never a literal 0', () => {
    const r = engine.check(fullEnv(), 'example (n : Nat) : n + 1 = 0 := rfl');
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.message.startsWith('internal error'))).toBe(false);
  });
});
