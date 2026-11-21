import { describe, expect, it } from 'vitest';
import { engine } from '../engine/index.ts';
import {
  N, PRESETS, SWAP_PROOF, advance, computerMove, goodMoves, holds, leanOf, matrixOf, narrate, outcome, ownerOf, solve, strategy,
} from './quantifier-game.ts';
import type { Binder, Side } from './quantifier-game.ts';

const P = (id: string) => PRESETS.find((p) => p.id === id)!;
const M = (id: string) => matrixOf(P(id).relation);

describe('truth by brute force', () => {
  it('matches the presets', () => {
    expect(PRESETS.map((p) => solve(p.binders, matrixOf(p.relation)))).toEqual([false, true, true, false, true]);
  });
  it('∀∃ is implied by ∃∀ but not conversely', () => {
    const ae: Binder[] = [{ q: '∀', v: 'x' }, { q: '∃', v: 'y' }];
    const ea: Binder[] = [{ q: '∃', v: 'y' }, { q: '∀', v: 'x' }];
    for (let seed = 0; seed < 300; seed++) {
      const m = Array.from({ length: N }, (_, x) => Array.from({ length: N }, (_, y) => ((seed * 2654435761 + x * 31 + y * 17 + x * y) >>> 3) % 5 < 2));
      if (solve(ea, m)) expect(solve(ae, m)).toBe(true);
    }
  });
});

describe('game', () => {
  it('the computer never loses a won position, and the winner wins against any play', () => {
    for (const p of PRESETS) {
      const m = matrixOf(p.relation);
      const truth = solve(p.binders, m);
      for (const side of ['true', 'false'] as Side[]) {
        const winnerIsPlayer = (side === 'true') === truth;
        // the player plays every possible way, using the optimal move when it has one
        const play = (vals: number[]): void => {
          vals = advance(p.binders, m, side, vals);
          if (vals.length === p.binders.length) {
            if (!winnerIsPlayer) expect(outcome(p.binders, m, side, vals).playerWon).toBe(false);
            return;
          }
          for (let v = 0; v < N; v++) {
            if (winnerIsPlayer && !goodMoves(p.binders, m, vals).includes(v)) continue;
            play([...vals, v]);
          }
        };
        play([]);
        // and when the player wins by playing well, it does
        if (winnerIsPlayer) {
          const go = (vals: number[]): void => {
            vals = advance(p.binders, m, side, vals);
            if (vals.length === p.binders.length) return void expect(outcome(p.binders, m, side, vals).playerWon).toBe(true);
            go([...vals, goodMoves(p.binders, m, vals)[0]]);
          };
          go([]);
        }
      }
    }
  });
  it('ownership', () => {
    expect(ownerOf('∃', 'true')).toBe('player');
    expect(ownerOf('∀', 'true')).toBe('computer');
    expect(ownerOf('∀', 'false')).toBe('player');
  });
  it('∀ x ∃ y, y > x fails at 5: claiming false, the computer-as-∃ cannot answer x = 5', () => {
    const p = P('succ');
    expect(goodMoves(p.binders, M('succ'), [])).toEqual([5]);
    expect(computerMove(p.binders, M('succ'), [5])).toBe(0);
    const v = advance(p.binders, M('succ'), 'false', [3]);
    expect(v).toEqual([3, 4]);
    expect(narrate(p.binders, [3, 4], 'false')[1].text).toContain('y = 4 for x = 3');
    expect(holds(p.binders, M('succ'), [5, 0])).toBe(false);
  });
});

describe('strategy', () => {
  it('table for the true ∀∃ with next', () => {
    const s = strategy(P('forall-exists').binders, M('forall-exists'));
    expect(s.winner).toBe('true');
    expect(s.tables).toHaveLength(1);
    expect(s.tables[0].rows.map((r) => r.move)).toEqual([1, 2, 3, 4, 5, 0]);
  });
  it('the false ∃∀ is won by ∀ with a table over y', () => {
    const s = strategy(P('exists-forall').binders, M('exists-forall'));
    expect(s.winner).toBe('false');
    expect(s.tables[0].binder).toEqual({ q: '∀', v: 'x' });
    expect(s.tables[0].rows).toHaveLength(N);
    // each reply refutes the y chosen first
    s.tables[0].rows.forEach((r, y) => expect(M('exists-forall')[r.move][y]).toBe(false));
  });
});

describe('Lean', () => {
  const env = engine.baseEnv();
  it('every preset statement elaborates', () => {
    for (const p of PRESETS) {
      const r = engine.elab(env, leanOf(p.binders), '(R : Nat → Nat → Prop)');
      expect(r.ok, leanOf(p.binders)).toBe(true);
    }
  });
  it('the swap direction is proved', () => {
    expect(engine.check(env, SWAP_PROOF).complete).toBe(true);
  });
});
