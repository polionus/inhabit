import { describe, expect, it } from 'vitest';
import { levelContext, worlds } from '../../content/index.ts';
import { lessonDefaultOpen } from './lessonDefault.ts';

const base = { mode: 'play' as const, passed: false, narrow: false };
const auto = { lessonMode: 'auto' as const, lessonsOpen: true };
const open = (id: string, over: Partial<Parameters<typeof lessonDefaultOpen>[0]> = {}) =>
  lessonDefaultOpen({ ctx: levelContext(id), settings: auto, ...base, ...over });

describe('lessonDefaultOpen', () => {
  it('keeps the first three levels of the first world collapsed', () => {
    for (const id of ['types-01', 'types-02', 'types-03']) expect(open(id)).toBe(false);
  });
  it('opens on the first level of a later world', () => {
    expect(open('props-01')).toBe(true);
  });
  it('opens where a tactic is introduced, stays collapsed elsewhere', () => {
    const intro = worlds.flatMap((w) => w.levels).find((l) => (l.unlocks?.tactics?.length ?? 0) > 0 && !l.id.startsWith('types-') && !l.id.endsWith('-01'))!;
    expect(open(intro.id)).toBe(true);
    const plain = worlds[2].levels.find((l, i) => i > 0 && !(l.unlocks?.tactics?.length))!;
    expect(open(plain.id)).toBe(false);
  });
  it('never opens when narrow, in review, or on a passed level (auto)', () => {
    expect(open('props-01', { narrow: true })).toBe(false);
    expect(open('props-01', { mode: 'review' })).toBe(false);
    expect(open('props-01', { passed: true })).toBe(false);
  });
  it('open and closed override auto', () => {
    const o = { lessonMode: 'open' as const, lessonsOpen: true };
    const c = { lessonMode: 'closed' as const, lessonsOpen: true };
    expect(open('types-01', { settings: o })).toBe(true);
    expect(open('types-01', { settings: o, narrow: true })).toBe(true);
    expect(open('types-01', { settings: o, passed: true })).toBe(false);
    expect(open('types-01', { settings: o, mode: 'review' })).toBe(false);
    expect(open('props-01', { settings: c })).toBe(false);
  });
  it('opens between 25% and 40% of levels under auto on a wide screen', () => {
    const ids = worlds.flatMap((w) => w.levels.map((l) => l.id));
    const share = ids.filter((id) => open(id)).length / ids.length;
    expect(share).toBeGreaterThanOrEqual(0.25);
    expect(share).toBeLessThanOrEqual(0.4);
  });
});
