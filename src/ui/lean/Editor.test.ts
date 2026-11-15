import { describe, expect, it } from 'vitest';
import { placeholderRange } from './Editor.tsx';

describe('placeholderRange', () => {
  it('finds a single sorry', () => {
    expect(placeholderRange('  sorry')).toEqual({ from: 2, to: 7 });
    expect(placeholderRange('  fun n => sorry')).toEqual({ from: 11, to: 16 });
  });
  it('is null for none or several', () => {
    expect(placeholderRange('  7')).toBeNull();
    expect(placeholderRange('  constructor\n  sorry\n  sorry')).toBeNull();
  });
  it('ignores sorry as part of a longer word', () => {
    expect(placeholderRange('  sorryx')).toBeNull();
    expect(placeholderRange('  my_sorry')).toBeNull();
  });
});
