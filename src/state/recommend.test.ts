import { describe, expect, it } from 'vitest';
import { candidates, recommend, shakiness, skipKey, type RecInput, type RecWorld } from './recommend.ts';
import { DAY, type DeckItem } from './leitner.ts';
import type { Progress } from './progress.ts';

const NOW = Date.parse('2026-11-21T12:00:00Z');
const lv = (id: string, extra = {}) => ({ id, title: `T ${id}`, kind: 'proof', ...extra });
const worlds: RecWorld[] = [
  { id: 'a', title: 'World A', requires: [], levels: [lv('a1'), lv('a2'), lv('a3'), lv('a4'), lv('a5'), lv('a6', { boss: true })] },
  { id: 'b', title: 'World B', requires: ['a'], levels: [lv('b1'), lv('b2')] },
];
const solved = (t: number, extra = {}) => ({ status: 'solved' as const, hintsUsed: 0, attempts: 1, clean: true, firstPassAt: t, ...extra });
const item = (due: number, extra: Partial<DeckItem> = {}): DeckItem => ({ box: 1, due, last: due - DAY, reps: 0, lapses: 0, ...extra });

function input(over: Partial<RecInput> = {}): RecInput {
  return {
    worlds,
    levels: {},
    deck: {},
    seen: {},
    today: { day: '2026-11-21', counts: {} },
    activeDays: ['2026-11-20'],
    streak: { current: 1, activeToday: false },
    now: NOW,
    dayKey: '2026-11-21',
    dailyDone: false,
    practiceable: () => true,
    chapters: new Set(['a', 'b']),
    exhibitsFor: (w) => (w === 'a' ? [{ id: 'venn', title: 'Venn' }] : []),
    links: {
      level: (id) => `#/level/${id}`, practice: (id) => `#/practice/${id}`, chapter: (id) => `#/chapter/${id}`,
      gallery: (id) => `#/gallery/${id}`, review: '#/review', daily: '#/arena/daily', workshop: '#/workshop',
    },
    ...over,
  };
}

describe('shakiness', () => {
  it('is zero for clean or tested-out passes and grows with help', () => {
    expect(shakiness(solved(1), undefined)).toBe(0);
    expect(shakiness({ status: 'solved', hintsUsed: 3, attempts: 1, testedOut: true }, undefined)).toBe(0);
    expect(shakiness({ status: 'studied', hintsUsed: 0, attempts: 1 }, undefined)).toBe(1);
    expect(shakiness({ status: 'solved', hintsUsed: 2, attempts: 1, rating: 'hard' }, item(0, { lapses: 1 }))).toBeCloseTo(1.4);
  });
});

describe('recommend', () => {
  it('sends a newcomer to level one and nothing else competes', () => {
    const [top] = recommend(input({ dailyDone: false }));
    expect(top.kind).toBe('continue');
    expect(top.levelId).toBe('a1');
    expect(candidates(input()).some((r) => r.kind === 'daily' || r.kind === 'chapter')).toBe(false);
  });

  it('puts review first after time away', () => {
    const levels: Progress = { a1: solved(NOW - 9 * DAY) };
    const r = recommend(input({ levels, deck: { a1: item(NOW - 2 * DAY) }, activeDays: ['2026-11-10'] }));
    expect(r[0].kind).toBe('review');
    expect(r[0].reason).toMatch(/away 11 days/);
  });

  it('says how close a nearly finished world is', () => {
    const levels: Progress = Object.fromEntries(['a1', 'a2', 'a3', 'a4'].map((id, i) => [id, solved(NOW - (10 - i) * 1000)]));
    const top = recommend(input({ levels, dailyDone: true }))[0];
    expect(top.kind).toBe('continue');
    expect(top.reason).toMatch(/2 levels left to finish World A/);
  });

  it('after a struggle, prefers practice on that level over moving on', () => {
    const levels: Progress = { a1: solved(1), a2: { status: 'solved', hintsUsed: 3, attempts: 4, firstPassAt: 2 } };
    const r = recommend(input({ levels, after: { levelId: 'a2', hints: 3, studied: false } }));
    expect(r[0].kind).toBe('practice');
    expect(r[0].levelId).toBe('a2');
    expect(r.map((x) => x.kind)).toContain('continue');
  });

  it('offers the boss on a clean run', () => {
    const levels: Progress = { a1: solved(1), a2: solved(2), a3: solved(3) };
    expect(candidates(input({ levels })).find((r) => r.kind === 'boss')?.levelId).toBe('a6');
  });

  it('offers to redo a studied level unless review already has it', () => {
    const levels: Progress = { a1: { status: 'studied', hintsUsed: 0, attempts: 1, firstPassAt: 1 } };
    expect(candidates(input({ levels, deck: { a1: item(NOW + DAY) } })).some((r) => r.kind === 'redo')).toBe(true);
    expect(candidates(input({ levels, deck: { a1: item(NOW - 1) } })).some((r) => r.kind === 'redo')).toBe(false);
  });

  it('builds a varied slate with at most one thing to read or watch', () => {
    const levels: Progress = { a1: solved(1), a2: { status: 'studied', hintsUsed: 0, attempts: 1, firstPassAt: 2 } };
    const r = recommend(input({ levels, deck: { a1: item(NOW - DAY) } }), 4);
    expect(new Set(r.map((x) => x.kind)).size).toBe(r.length);
    expect(r.filter((x) => x.kind === 'chapter' || x.kind === 'gallery').length).toBeLessThanOrEqual(1);
  });

  it('hides a suggestion for the day after "Not now"', () => {
    const levels: Progress = { a1: solved(1) };
    const first = recommend(input({ levels }))[0];
    const again = recommend(input({ levels, seen: { [skipKey('2026-11-21', first.key)]: NOW } }));
    expect(again.some((r) => r.key === first.key)).toBe(false);
  });

  it('favors the short Daily Proof when a streak is at risk', () => {
    const levels: Progress = { a1: solved(1) };
    const calm = candidates(input({ levels })).find((r) => r.kind === 'daily')!;
    const risk = candidates(input({ levels, streak: { current: 5, activeToday: false } })).find((r) => r.kind === 'daily')!;
    expect(risk.score).toBeGreaterThan(calm.score);
    expect(risk.reason).toMatch(/5-day streak/);
  });

  it('after finishing a world, suggests its chapter and exhibit', () => {
    const levels: Progress = Object.fromEntries(worlds[0].levels.map((l, i) => [l.id, solved(i + 1)]));
    const r = candidates(input({ levels, after: { levelId: 'a6', hints: 0, studied: false } }));
    expect(r.find((x) => x.kind === 'chapter')?.worldId).toBe('a');
    expect(r.find((x) => x.kind === 'gallery')?.href).toBe('#/gallery/venn');
  });
});
