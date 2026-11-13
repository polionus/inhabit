import { describe, expect, it } from 'vitest';
import { dailyNumber, dailySet, duelSet, nth, rushSlot, sequence, statementKey, utcDateKey } from './plan.ts';
import { generator } from './gen/index.ts';

describe('arena plans', () => {
  it('daily set is deterministic, three rising proofs, all solvable', () => {
    const a = dailySet('2026-11-13');
    expect(a).toEqual(dailySet('2026-11-13'));
    expect(a.map((p) => p.id)).not.toEqual(dailySet('2026-11-14').map((p) => p.id));
    expect(a.length).toBe(3);
    for (const p of a) {
      expect(p.kind).toBe('proof');
      if (p.kind === 'proof') expect(generator.check(p, p.solution).complete).toBe(true);
    }
    expect(a[0].rating).toBeLessThan(a[2].rating);
  });
  it('a month of dailies never repeats a statement inside a set', () => {
    for (let d = 1; d <= 30; d++) {
      const set = dailySet(`2026-12-${String(d).padStart(2, '0')}`);
      expect(new Set(set.map(statementKey)).size).toBe(set.length);
    }
  });
  it('duel sets are deterministic and free of repeats', () => {
    for (const f of ['blitz', 'standard', 'proofs'] as const) {
      const s = duelSet('abc', f);
      expect(s).toEqual(duelSet('abc', f));
      expect(new Set(s.map(statementKey)).size).toBe(s.length);
    }
  });
  it('sequence avoids given statements; nth matches sequence when nothing is avoided', () => {
    const slots = Array.from({ length: 12 }, (_, i) => rushSlot(i));
    const s = sequence('rush:x', slots);
    expect(new Set(s.map(statementKey)).size).toBe(s.length);
    expect(nth('rush:x', 0, slots[0]).id).toBe(s[0].id);
    const again = sequence('rush:x', slots, [statementKey(s[0])]);
    expect(statementKey(again[0])).not.toBe(statementKey(s[0]));
  });
  it('date helpers', () => {
    expect(utcDateKey(Date.UTC(2026, 10, 13, 23, 59))).toBe('2026-11-13');
    expect(dailyNumber('2026-01-01')).toBe(1);
    expect(dailyNumber('2026-11-13')).toBe(317);
  });
});
