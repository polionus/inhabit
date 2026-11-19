/** Name completion logic.   npx vitest run src/ui/lean/complete */
import { describe, expect, it } from 'vitest';
import { dataForContext, hypItems, matchItems, tacticItems, truncate, wordBefore } from './complete.ts';

describe('wordBefore', () => {
  it('needs two identifier characters and ignores abbreviations', () => {
    expect(wordBefore('  e')).toBeNull();
    expect(wordBefore('  ex')).toEqual({ from: 2, text: 'ex' });
    expect(wordBefore('rw [Nat.add_c')).toEqual({ from: 4, text: 'Nat.add_c' });
    expect(wordBefore('\\and')).toBeNull();
    expect(wordBefore('x = 12')).toBeNull();
  });
});

describe('matchItems', () => {
  const data = dataForContext({
    allowedTactics: ['intro', 'exact', 'rw'],
    lemmas: [{ name: 'Nat.add_comm', source: 'theorem Nat.add_comm (a b : Nat) : a + b = b + a := by\n  omega' }],
  });
  const hyps = hypItems([{ names: ['hx', 'h✝'], type: 'P' }, { names: ['ex1'], type: 'Q' }]);
  it('offers only unlocked tactics', () => {
    expect(matchItems('ex', data).map((i) => i.name)).toEqual(['exact']);
    expect(matchItems('si', data)).toEqual([]);
    expect(matchItems('simp', { tactics: tacticItems(['intro']) })).toEqual([]);
  });
  it('puts hypotheses first, matches the last dotted segment, skips exact matches', () => {
    expect(matchItems('ex', data, hyps).map((i) => i.name)).toEqual(['ex1', 'exact']);
    expect(matchItems('add_', data).map((i) => i.name)).toEqual(['Nat.add_comm']);
    expect(matchItems('intro', data)).toEqual([]);
  });
  it('shows short details', () => {
    expect(data.lemmas![0].detail).toBe('(a b : Nat) : a + b = b + a');
    expect(truncate('x'.repeat(100), 10)).toHaveLength(10);
    expect(hyps[0].detail).toBe('P');
  });
});
