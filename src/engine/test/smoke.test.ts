import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, errors } from './helpers.ts';

describe('lean-verify/Game/Smoke.lean', () => {
  const src = readFileSync(new URL('../../../lean-verify/Game/Smoke.lean', import.meta.url), 'utf8').replace('import Game.Core', '');
  const r = check(src);
  it('has no errors', () => {
    expect(errors(r)).toEqual([]);
  });
  it('is complete and every declaration is ok', () => {
    expect(r.complete).toBe(true);
    expect(r.decls.length).toBeGreaterThan(30);
    expect(r.decls.filter((d) => !d.ok)).toEqual([]);
  });
});
