import { describe, expect, it } from 'vitest';
import { DAY, INTERVALS, afterReview, dueIds, newItem, pickSession, retune } from './leitner.ts';
import {
  applyTestOut, bossIndex, canTestOut, layoutWorlds, levelPlayable, levelState, nextAfter, worldComplete, worldUnlocked,
  type Progress, type WorldLike,
} from './progress.ts';
import { applyCompletion, currentStreak, defaultSave, dayKey, migrate, rankFor, newBadges } from './game.ts';
import { createGameStore } from './store.ts';

const L = (id: string, extra: object = {}) => ({ id, kind: 'proof', ...extra });
const worlds: WorldLike[] = [
  { id: 'a', requires: [], levels: [L('a1'), L('a2'), L('a3', { optional: true }), L('a4', { boss: true })] },
  { id: 'b', requires: ['a'], levels: [L('b1'), L('b2', { boss: true })] },
  { id: 'c', requires: ['a'], levels: [L('c1')] },
  { id: 'd', requires: ['b', 'c'], levels: [] },
];
const solved = (...ids: string[]): Progress =>
  Object.fromEntries(ids.map((i) => [i, { status: 'solved' as const, hintsUsed: 0, attempts: 0 }]));

describe('unlocking', () => {
  it('levels unlock sequentially, optional never gates', () => {
    expect(levelState(worlds[0], 0, worlds, {})).toBe('open');
    expect(levelState(worlds[0], 1, worlds, {})).toBe('locked');
    expect(levelState(worlds[0], 1, worlds, solved('a1'))).toBe('open');
    expect(levelState(worlds[0], 3, worlds, solved('a1', 'a2'))).toBe('open');
    expect(levelState(worlds[0], 0, worlds, solved('a1'))).toBe('done');
  });
  it('worlds unlock when all requires are complete; empty worlds pass', () => {
    expect(worldUnlocked(worlds[1], worlds, {})).toBe(false);
    const p = solved('a1', 'a2', 'a4');
    expect(worldComplete(worlds[0], p)).toBe(true);
    expect(worldUnlocked(worlds[1], worlds, p)).toBe(true);
    expect(worldUnlocked(worlds[3], worlds, { ...p, ...solved('b1', 'b2', 'c1') })).toBe(true);
  });
  it('studied counts as passed', () => {
    const p: Progress = { a1: { status: 'studied', hintsUsed: 0, attempts: 0 } };
    expect(levelState(worlds[0], 1, worlds, p)).toBe('open');
  });
  it('boss can be tested out when the world is reachable', () => {
    expect(bossIndex(worlds[0])).toBe(3);
    expect(canTestOut(worlds[0], worlds, {})).toBe(true);
    expect(levelPlayable(worlds[0], 3, worlds, {})).toBe(true);
    expect(canTestOut(worlds[1], worlds, {})).toBe(false);
    const t = applyTestOut(worlds[0], solved('a4'), 5);
    expect(worldComplete(worlds[0], t)).toBe(true);
    expect(t.a1.testedOut).toBe(true);
    expect(t.a3).toBeUndefined();
  });
  it('next target', () => {
    expect(nextAfter(worlds[0], 0, worlds, solved('a1'))).toEqual({ kind: 'level', levelId: 'a2' });
    expect(nextAfter(worlds[1], 1, worlds, solved('a1', 'a2', 'a4', 'b1', 'b2')).kind).toBe('world-complete');
  });
  it('layered layout', () => {
    const l = layoutWorlds(worlds);
    const by = Object.fromEntries(l.map((x) => [x.id, x]));
    expect(by.a.layer).toBe(0);
    expect(by.b.layer).toBe(1);
    expect(by.c.layer).toBe(1);
    expect(by.d.layer).toBe(2);
    expect(by.b.slots).toBe(2);
  });
});

describe('completion, test out, badges', () => {
  it('awards XP once and enrols in the deck', () => {
    const r = applyCompletion(defaultSave(), worlds, 'a1', { studied: false, clean: true }, 1000);
    expect(r.xp).toBe(25);
    expect(r.save.levels.a1.status).toBe('solved');
    expect(r.save.deck.a1.box).toBe(1);
    expect(r.earned).toContain('first-step');
    const again = applyCompletion(r.save, worlds, 'a1', { studied: false, clean: true }, 2000);
    expect(again.xp).toBe(0);
  });
  it('studied then solved upgrades', () => {
    const s = applyCompletion(defaultSave(), worlds, 'a1', { studied: true, clean: false }, 1).save;
    expect(s.levels.a1.status).toBe('studied');
    const u = applyCompletion(s, worlds, 'a1', { studied: false, clean: true }, 2);
    expect(u.save.levels.a1.status).toBe('solved');
    const back = applyCompletion(u.save, worlds, 'a1', { studied: true, clean: false }, 3);
    expect(back.save.levels.a1.status).toBe('solved');
  });
  it('beating a boss early tests out the world', () => {
    const r = applyCompletion(defaultSave(), worlds, 'a4', { studied: false, clean: true }, 1);
    expect(r.testedOutWorld).toBe('a');
    expect(worldComplete(worlds[0], r.save.levels)).toBe(true);
    expect(r.earned).toContain('test-out');
    expect(r.earned).toContain('clean-boss');
    expect(Object.keys(r.save.deck)).toEqual(['a4']);
  });
  it('world badge', () => {
    const s = { ...defaultSave(), levels: solved('a1', 'a2', 'a4') };
    expect(newBadges(s, worlds)).toContain('first-world');
  });
});

describe('leitner', () => {
  it('intervals are 1,3,7,16,35 days', () => {
    expect([...INTERVALS]).toEqual([1, 3, 7, 16, 35]);
    let it = newItem(0);
    const days: number[] = [it.due / DAY];
    for (let i = 0; i < 5; i++) {
      it = afterReview(it, true, it.due);
      days.push((it.due - it.last) / DAY);
    }
    expect(days).toEqual([1, 3, 7, 16, 35, 35]);
    expect(it.box).toBe(5);
  });
  it('failure returns to box 1', () => {
    const it = afterReview({ box: 4, due: 0, last: 0, reps: 3, lapses: 0 }, false, 100);
    expect(it.box).toBe(1);
    expect(it.lapses).toBe(1);
  });
  it('rating tunes the first interval', () => {
    expect(newItem(0, 'easy').due).toBe(3 * DAY);
    expect(newItem(0, 'right').due).toBe(DAY);
    expect(newItem(0, 'hard').due).toBe(DAY / 2);
    expect(newItem(0, 'easy', true).due).toBe(DAY);
    expect(retune(newItem(0), 'easy').box).toBe(2);
    expect(retune({ ...newItem(0), reps: 1 }, 'easy').box).toBe(1);
  });
  it('session interleaves worlds, most overdue first, capped', () => {
    const deck = {
      a1: { box: 1, due: 1, last: 0, reps: 0, lapses: 0 }, a2: { box: 1, due: 2, last: 0, reps: 0, lapses: 0 },
      a3: { box: 1, due: 3, last: 0, reps: 0, lapses: 0 }, b1: { box: 1, due: 4, last: 0, reps: 0, lapses: 0 },
      b2: { box: 1, due: 5, last: 0, reps: 0, lapses: 0 }, z: { box: 1, due: 9999, last: 0, reps: 0, lapses: 0 },
    };
    const w = (id: string) => id[0];
    expect(dueIds(deck, 100)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
    expect(pickSession(deck, w, 100, 4)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
});

describe('save data', () => {
  it('migrate tolerates garbage and unknown versions', () => {
    expect(migrate(null).xp).toBe(0);
    expect(migrate('x').levels).toEqual({});
    const m = migrate({ version: 99, xp: 12, levels: { a: { status: 'solved', hintsUsed: 'no' }, b: 3 }, settings: { fontSize: 99, theme: 'bogus' } });
    expect(m.xp).toBe(12);
    expect(m.levels.a.status).toBe('solved');
    expect(m.levels.a.hintsUsed).toBe(0);
    expect(m.levels.b).toBeUndefined();
    expect(m.settings.fontSize).toBe(24);
    expect(m.settings.theme).toBe('system');
  });
  it('streak and ranks', () => {
    const now = new Date(2026, 5, 10, 12).getTime();
    const d = (n: number) => dayKey(now - n * DAY);
    expect(currentStreak([d(0), d(1), d(2), d(4)], now)).toBe(3);
    expect(currentStreak([d(1), d(2)], now)).toBe(2);
    expect(currentStreak([d(3)], now)).toBe(0);
    expect(rankFor(0).title).toBe('Wanderer');
    expect(rankFor(100000).next).toBeUndefined();
  });
  it('store persists, exports, imports and survives storage failures', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const s = createGameStore({ worlds: () => worlds, storage, key: 'k', now: () => 5000 });
    s.getState().completeLevel('a1', { studied: false, clean: true });
    expect(JSON.parse(mem.get('k')!).levels.a1.status).toBe('solved');
    const json = s.getState().exportJson();
    s.getState().resetAll();
    expect(s.getState().save.levels).toEqual({});
    expect(s.getState().importJson(json).ok).toBe(true);
    expect(s.getState().save.levels.a1.status).toBe('solved');
    expect(s.getState().importJson('nope').ok).toBe(false);
    const bad = createGameStore({ worlds: () => worlds, storage: { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => {} }, key: 'k' });
    bad.getState().completeLevel('a1', { studied: false, clean: true });
    expect(bad.getState().storageError).toBe(true);
    expect(bad.getState().save.levels.a1.status).toBe('solved');
  });
});
