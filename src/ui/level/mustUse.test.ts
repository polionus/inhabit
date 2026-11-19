import { describe, expect, it } from 'vitest';
import { missingTactics, mustUseNote } from './mustUse.ts';

describe('missingTactics', () => {
  it('is empty without a requirement', () => {
    expect(missingTactics(undefined, ['exact'])).toEqual([]);
    expect(missingTactics([], [])).toEqual([]);
  });
  it('reports tactics the proof skipped', () => {
    expect(missingTactics(['calc'], ['exact', 'rw'])).toEqual(['calc']);
    expect(missingTactics(['calc', 'induction'], ['calc'])).toEqual(['induction']);
  });
  it('accepts when every required tactic was used', () => {
    expect(missingTactics(['calc'], new Set(['calc', 'rw']))).toEqual([]);
  });
  it('names the tactic in the note', () => {
    expect(mustUseNote(['calc'])).toContain('`calc`');
  });
});
