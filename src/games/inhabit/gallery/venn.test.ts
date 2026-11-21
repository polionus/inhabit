import { describe, expect, it } from 'vitest';
import { parseSet, regionsOf, verdict, regionPhrase, showSet } from './venn.ts';

const reg = (s: string) => {
  const r = parseSet(s);
  if (!r.ok) throw new Error(r.error);
  return regionsOf(r.e);
};

describe('venn parser and regions', () => {
  it('distributivity', () => expect(reg('A ∩ (B ∪ C)')).toBe(reg('(A ∩ B) ∪ (A ∩ C)')));
  it('precedence: ∩ binds tighter than ∪', () => expect(reg('A ∪ B ∩ C')).toBe(reg('A ∪ (B ∩ C)')));
  it('difference is intersection with complement', () => expect(reg('A \\ B')).toBe(reg('A ∩ Bᶜ')));
  it('De Morgan', () => expect(reg('(A ∩ B)ᶜ')).toBe(reg('Aᶜ ∪ Bᶜ')));
  it('constants', () => {
    expect(reg('∅')).toBe(0);
    expect(reg('Set.univ')).toBe(0xff);
    expect(reg('Aᶜᶜ')).toBe(reg('A'));
  });
  it('absorption', () => expect(reg('A ∩ (A ∪ B)')).toBe(reg('A')));
  it('region counts', () => {
    expect(reg('A').toString(2).split('1').length - 1).toBe(4);
    expect(reg('A ∩ B').toString(2).split('1').length - 1).toBe(2);
  });
  it('reports parse errors', () => {
    for (const bad of ['', 'A ∩', '(A', 'A)', 'D', '∩ A', 'A B']) expect(parseSet(bad).ok).toBe(false);
  });
  it('verdicts', () => {
    expect(verdict(reg('A ∪ B'), reg('A'), 'eq').holds).toBe(false);
    expect(verdict(reg('A ∪ B'), reg('A'), 'eq').witnesses).toEqual([2, 6]);
    expect(verdict(reg('A'), reg('A ∪ B'), 'subset').holds).toBe(true);
  });
  it('phrases and printing', () => {
    expect(regionPhrase(3)).toBe('in A and B but not C');
    expect(regionPhrase(1)).toBe('in A but not in B or C');
    expect(showSet((parseSet("(A∩B)ᶜ ∪ C \\ A") as unknown as { e: never }).e)).toBe('(A ∩ B)ᶜ ∪ (C \\ A)');
  });
});
