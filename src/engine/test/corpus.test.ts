import { describe, expect, it } from 'vitest';
import { corpus } from './corpus.ts';
import { check } from './helpers.ts';

describe('differential corpus (verdicts recorded from real Lean 4.25.1)', () => {
  for (const c of corpus) {
    it(`${c.expect}: ${c.name}`, () => {
      const r = check(c.src);
      const verdict = r.ok && !r.diagnostics.some((d) => d.code === 'sorry') ? 'accept' : 'reject';
      expect(verdict, r.diagnostics.map((d) => d.message).join('\n---\n')).toBe(c.expect);
    });
  }
});
