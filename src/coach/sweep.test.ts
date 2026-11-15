/**
 * Sweep over every proof level in the game: at the starter state and at each state of the reference
 * solutions, the coach must never throw, and its "Which tool?" must usually name the tactic the
 * reference solution really uses next.
 */
import { describe, expect, it } from 'vitest';
import { worlds } from '../content/index.ts';
import { checkBody, levelSession } from '../game/env.ts';
import { goalFromHeader } from './header.ts';
import { readGoal } from './read.ts';

const SKIP = new Set(['·', 'all_goals', 'any_goals', 'try', 'first', 'repeat']);

describe('coach sweep over the game', () => {
  it('reads every state of every reference solution; tools name the next tactic at least 70% of the time', () => {
    let states = 0;
    let offered = 0;
    let hit = 0;
    let hitAlt = 0;
    const missed: string[] = [];
    for (const w of worlds) {
      for (const l of w.levels) {
        if (l.kind !== 'proof') continue;
        const s = levelSession(l.id);
        // the starter, from the header (works in both modes)
        const g0 = goalFromHeader(l.header);
        expect(g0, `header of ${l.id}`).not.toBeNull();
        expect(() => readGoal([g0!], { allowedTactics: s.ctx.allowedTactics, mode: l.mode })).not.toThrow();
        expect(readGoal([g0!], { allowedTactics: s.ctx.allowedTactics, mode: l.mode })).not.toBeNull();
        const ctx = { allowedTactics: s.ctx.allowedTactics, mode: l.mode, codex: s.ctx.codex } as const;
        for (const sol of l.solutions) {
          const { result } = checkBody(s, sol);
          for (const st of result.steps) {
            expect(() => readGoal(st.before, ctx)).not.toThrow();
            expect(() => readGoal(st.after, ctx)).not.toThrow();
            if (l.mode !== 'tactic' || SKIP.has(st.tactic)) continue;
            states++;
            const r = readGoal(st.before, ctx);
            if (!r?.tools) continue;
            offered++;
            if (r.tools.some((t) => t.tactic === st.tactic)) hit++;
            else missed.push(`${l.id}: ${st.tactic} <- ${r.tools.map((t) => t.tactic).join(',')}`);
            if (r.tools.some((t) => t.tactic === st.tactic || t.also?.some((a) => a.tactic === st.tactic))) hitAlt++;
          }
        }
      }
    }
    const pct = (100 * hit) / offered;
    console.log(`coach sweep: ${states} states, tools offered in ${offered}, next tactic named ${hit} (${pct.toFixed(1)}%), counting alternatives ${hitAlt} (${((100 * hitAlt) / offered).toFixed(1)}%)`);
    expect(states).toBeGreaterThan(300);
    expect(pct).toBeGreaterThanOrEqual(70);
  });
});
