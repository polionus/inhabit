import { describe, expect, it } from 'vitest';
import { completionsFor, findPending, onType, resolve, terminates } from './abbrev.ts';
import { lineOffset, mapDiagnostics, toBodyRange } from './offsets.ts';
import { openInLeanUrl, wrapForRealLean } from './openInLean.ts';
import { ALL_CODES, explain } from './explain.ts';
import { hintRevealsSolution } from './hints.ts';
import { highlightHtml, tokenize } from './highlight.ts';
import { parseHash } from '../router.ts';
import type { Level } from '../../content/types.ts';

const T = { to: '→', and: '∧', le: '≤', leq: '≤', lambda: 'λ', '<>': '⟨$CURSOR⟩', langle: '⟨', alpha: 'α', a: 'α' };

describe('abbreviations', () => {
  it('finds the pending abbreviation', () => {
    expect(findPending('exact \\to')).toEqual({ start: 6, query: 'to' });
    expect(findPending('exact \\to ')).toBeNull();
    expect(findPending('a \\x \\an')?.query).toBe('an');
  });
  it('replaces on space, punctuation and tab', () => {
    expect(onType('P \\to', 5, ' ', T)).toEqual({ from: 2, to: 5, insert: '→ ', cursor: 4 });
    expect(onType('(\\and', 5, ')', T)?.insert).toBe('∧)');
    expect(onType('P \\to', 5, '', T)).toEqual({ from: 2, to: 5, insert: '→', cursor: 3 });
  });
  it('does not replace while the abbreviation can still grow, or when unknown', () => {
    expect(onType('\\a', 2, 'n', T)).toBeNull();
    expect(onType('\\zzz', 4, ' ', T)).toBeNull();
    expect(onType('plain', 5, ' ', T)).toBeNull();
    expect(terminates('<', '>', T)).toBe(false);
    expect(terminates('to', ' ', T)).toBe(true);
  });
  it('shortest-prefix fallback and cursor markers', () => {
    expect(resolve('lam', T)?.text).toBe('λ');
    expect(resolve('<>', T)).toEqual({ text: '⟨⟩', cursor: 1 });
    expect(completionsFor('le', T).map((c) => c.key)).toEqual(['le', 'leq']);
  });
});

describe('offset mapping', () => {
  it('maps assembled offsets to body offsets', () => {
    expect(toBodyRange(110, 115, 100, 50)).toEqual({ from: 10, to: 15, inBody: true });
    expect(toBodyRange(10, 20, 100, 50).inBody).toBe(false);
    expect(toBodyRange(90, 120, 100, 50)).toEqual({ from: 0, to: 20, inBody: true });
    expect(toBodyRange(150, 150, 100, 50)).toEqual({ from: 50, to: 50, inBody: true });
    expect(toBodyRange(200, 210, 100, 50).inBody).toBe(false);
    const d = mapDiagnostics([{ severity: 'error', code: 'other', message: 'm', from: 105, to: 106 }], 100, 50);
    expect(d[0]).toMatchObject({ bFrom: 5, bTo: 6, inBody: true });
  });
  it('finds a line offset', () => {
    expect(lineOffset('ab\n  cd\nef', 2)).toEqual({ start: 3, indent: 5, end: 7 });
  });
});

describe('open in real Lean', () => {
  it('wraps and encodes', () => {
    const code = wrapForRealLean('theorem t : 1 = 1 := rfl');
    expect(code).toBe('import Mathlib\n\nnamespace Inhabit\n\ntheorem t : 1 = 1 := rfl\n\nend Inhabit\n');
    const url = openInLeanUrl(code);
    expect(url.startsWith('https://live.lean-lang.org/#code=')).toBe(true);
    expect(decodeURIComponent(url.split('#code=')[1])).toBe(code);
    expect(wrapForRealLean(['a', 'b'])).toContain('a\n\nb');
  });
});

describe('friendly errors', () => {
  it('explains every diagnostic code', () => {
    expect(ALL_CODES.length).toBe(18);
    for (const code of ALL_CODES) {
      const e = explain({ severity: 'error', code, message: 'x', from: 0, to: 0, data: { name: 'foo', tactic: 'simp', suggestions: ['bar'], pattern: 'a + b', expected: 'P', actual: 'Q' } });
      expect(e.what.length).toBeGreaterThan(10);
      expect(e.tryThis.length).toBeGreaterThan(0);
    }
    expect(explain({ severity: 'error', code: 'unknown-identifier', message: '', from: 0, to: 0, data: { suggestions: ['hp'] } }).tryThis[0]).toContain('hp');
  });
});

describe('misc', () => {
  it('hint heuristic', () => {
    const level = { kind: 'proof', solutions: ['  intro hp\n  exact f hp'] } as unknown as Level;
    expect(hintRevealsSolution('Try `intro hp` then `exact f hp`', level)).toBe(true);
    expect(hintRevealsSolution('Start with intro.', level)).toBe(false);
  });
  it('tokenizes Lean', () => {
    const t = tokenize('theorem x : ∀ n, n = 0 -- c\nsorry');
    expect(t.find((k) => k.text === 'theorem')?.cls).toBe('kw');
    expect(t.find((k) => k.text === 'sorry')?.cls).toBe('sorry');
    expect(t.find((k) => k.text === '-- c')?.cls).toBe('com');
    expect(highlightHtml('a < b')).toContain('&lt;');
  });
  it('routes', () => {
    expect(parseHash('#/')).toEqual({ name: 'map' });
    expect(parseHash('#/level/nat-03')).toEqual({ name: 'level', id: 'nat-03' });
    expect(parseHash('#/codex/intro')).toEqual({ name: 'codex', id: 'intro' });
    expect(parseHash('#/bogus').name).toBe('notfound');
  });
});
