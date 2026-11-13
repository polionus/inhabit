import { describe, expect, it } from 'vitest';
import { exportSections, importSections, resetSections } from '../../state/sections.ts';
import type { GameEvent } from '../../state/events.ts';
import { generator } from '../gen/index.ts';
import { dailyNumber, dailySet, statementKey } from '../plan.ts';
import { defaultState, dailyShareText, formatTime, migrate, streakOn, dayBefore, rushItem, chooseRated, ratedPuzzle } from './model.ts';
import { expectedScore, kFactor, ratingChange } from './rating.ts';
import { createArenaStore, sectionFor, type StorageLike } from './store.ts';
import { registerSaveSection } from '../../state/sections.ts';

const mem = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const clean = { solved: true, hintsUsed: 0, revealed: false, skipped: false };
const mk = (storage = mem(), t = { now: 1_000_000 }, events: GameEvent[] = []) => ({
  storage,
  events,
  t,
  store: createArenaStore({ storage, now: () => t.now, random: () => 0.123456789, onEvent: (e) => events.push(e) }),
});

describe('rating maths', () => {
  it('expected score is 0.5 at equal rating and monotone', () => {
    expect(expectedScore(800, 800)).toBeCloseTo(0.5);
    expect(expectedScore(1000, 800)).toBeGreaterThan(0.7);
    expect(expectedScore(800, 1200)).toBeCloseTo(1 / 11, 2);
  });
  it('K schedule', () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(19)).toBe(40);
    expect(kFactor(20)).toBe(24);
    expect(kFactor(99)).toBe(24);
    expect(kFactor(100)).toBe(16);
  });
  it('solve at equal rating gains K/2; miss loses K/2; hint is a draw', () => {
    expect(ratingChange(800, 800, 0, clean).delta).toBe(20);
    expect(ratingChange(800, 800, 0, { ...clean, solved: false }).delta).toBe(-20);
    expect(ratingChange(800, 800, 0, { ...clean, hintsUsed: 1 }).delta).toBe(0);
    expect(ratingChange(800, 1200, 0, { ...clean, hintsUsed: 2 }).delta).toBeLessThan(40);
    expect(ratingChange(800, 1200, 0, { ...clean, hintsUsed: 2 }).delta).toBeGreaterThan(0);
    expect(ratingChange(800, 800, 0, { ...clean, revealed: true }).delta).toBe(-20);
    expect(ratingChange(800, 800, 0, { ...clean, skipped: true }).delta).toBe(-20);
  });
  it('never falls below the floor', () => {
    expect(ratingChange(402, 400, 0, { ...clean, solved: false }).next).toBe(400);
    expect(ratingChange(400, 2000, 50, { ...clean, solved: false }).next).toBe(400);
  });
});

describe('rated stream', () => {
  it('rating, history, peak and counts update; event reported', () => {
    const { store, events } = mk();
    const c = store.getState().ensureRated();
    const p = ratedPuzzle(store.getState(), c);
    const r = store.getState().finishRated(p, clean);
    const s = store.getState();
    expect(r.delta).toBeGreaterThan(0);
    expect(s.rating).toBe(800 + r.delta);
    expect(s.peak).toBe(s.rating);
    expect(s.rated).toBe(1);
    expect(s.solved).toBe(1);
    expect(s.history).toHaveLength(1);
    expect(s.current).toBeNull();
    expect(events).toEqual([{ type: 'arena-puzzle', solved: true, rated: true, puzzleRating: p.rating }]);
  });
  it('history is capped at 200', () => {
    const { store } = mk();
    for (let i = 0; i < 205; i++) {
      const c = store.getState().ensureRated();
      store.getState().finishRated(ratedPuzzle(store.getState(), c), { ...clean, solved: i % 2 === 0 });
    }
    expect(store.getState().history).toHaveLength(200);
  });
  it('avoids the last 50 statements and stays in family range', () => {
    const { store } = mk();
    const keys: string[] = [];
    for (let i = 0; i < 60; i++) {
      const c = store.getState().ensureRated();
      const [lo, hi] = generator.range[c.family];
      expect(c.target).toBeGreaterThanOrEqual(lo);
      expect(c.target).toBeLessThanOrEqual(hi);
      const p = ratedPuzzle(store.getState(), c);
      const seen = store.getState().seen;
      expect(seen.includes(statementKey(p))).toBe(false);
      keys.push(statementKey(p));
      store.getState().finishRated(p, clean);
    }
    expect(store.getState().seen).toHaveLength(50);
  });
  it('the unfinished puzzle persists across reloads and is the same puzzle', () => {
    const a = mk();
    const c = a.store.getState().ensureRated();
    a.store.getState().saveRatedProgress({ hints: 1, ms: 5000, body: '  intro h' });
    const p1 = ratedPuzzle(a.store.getState(), c);
    const b = mk(a.storage);
    const c2 = b.store.getState().ensureRated();
    expect(c2).toEqual({ ...c, progress: { hints: 1, ms: 5000, body: '  intro h' } });
    expect(ratedPuzzle(b.store.getState(), c2).id).toBe(p1.id);
    expect(b.store.getState().salt).toBe(a.store.getState().salt);
  });
  it('respects the family filter', () => {
    const { store } = mk();
    store.getState().setFilter(['set']);
    for (let i = 0; i < 5; i++) {
      const c = store.getState().ensureRated();
      expect(c.family).toBe('set');
      store.getState().finishRated(ratedPuzzle(store.getState(), c), clean);
    }
    expect(chooseRated(store.getState()).family).toBe('set');
  });
});

describe('daily proof', () => {
  const key = '2026-11-13';
  it('records marks, completes once, streaks, shares', () => {
    const { store, events, t } = mk();
    store.getState().startDaily(key);
    store.getState().finishDaily(key, 0, { ...clean, ms: 60_000 });
    store.getState().finishDaily(key, 1, { ...clean, hintsUsed: 1, ms: 90_000 });
    expect(store.getState().daily[key].completed).toBe(false);
    expect(events).toHaveLength(0);
    store.getState().finishDaily(key, 2, { solved: false, hintsUsed: 0, revealed: true, skipped: false, ms: 102_000 });
    const r = store.getState().daily[key];
    expect(r.completed).toBe(true);
    expect(r.marks.map((m) => m.state)).toEqual(['clean', 'hinted', 'failed']);
    expect(events).toEqual([{ type: 'arena-daily', solved: 2, total: 3, dateKey: key }]);
    // repeats are ignored
    store.getState().finishDaily(key, 2, { ...clean, ms: 1 });
    expect(events).toHaveLength(1);
    expect(store.getState().streak.count).toBe(1);
    expect(dailyShareText(r, dailyNumber(key), 'https://x.test/#/arena/daily')).toBe(
      `Inhabit Daily Proof #${dailyNumber(key)} · 2/3 · 4:12\n🟩🟨⬛\nhttps://x.test/#/arena/daily`,
    );
    t.now += 1;
  });
  it('streak counts consecutive days, survives until the day after, then resets', () => {
    const s = mk().store;
    const days = ['2026-11-10', '2026-11-11', '2026-11-12'];
    for (const d of days) {
      s.getState().startDaily(d);
      for (let i = 0; i < 3; i++) s.getState().finishDaily(d, i, { ...clean, ms: 1000 });
    }
    expect(s.getState().streak.count).toBe(3);
    expect(streakOn(s.getState(), '2026-11-12')).toBe(3);
    expect(streakOn(s.getState(), '2026-11-13')).toBe(3);
    expect(streakOn(s.getState(), '2026-11-14')).toBe(0);
    s.getState().startDaily('2026-11-14');
    for (let i = 0; i < 3; i++) s.getState().finishDaily('2026-11-14', i, { ...clean, ms: 1000 });
    expect(s.getState().streak).toMatchObject({ count: 1, best: 3 });
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
  });
  it('resumes in-progress state after a reload and keeps 60 days', () => {
    const a = mk();
    a.store.getState().startDaily(key);
    a.store.getState().finishDaily(key, 0, { ...clean, ms: 5000 });
    a.store.getState().saveDailyProgress(key, { hints: 2, ms: 7000, body: 'x' });
    const b = mk(a.storage);
    expect(b.store.getState().daily[key]).toMatchObject({ marks: [{ state: 'clean', ms: 5000 }], progress: { hints: 2, ms: 7000, body: 'x' } });
    for (let i = 1; i <= 70; i++) b.store.getState().startDaily(`2025-${String(1 + Math.floor(i / 29)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`);
    expect(Object.keys(b.store.getState().daily).length).toBeLessThanOrEqual(60);
  });
  it('formats time and the day set exists', () => {
    expect(formatTime(252_000)).toBe('4:12');
    expect(formatTime(3_725_000)).toBe('1:02:05');
    expect(dailySet(key)).toHaveLength(3);
  });
});

describe('rush', () => {
  it('keeps bests per mode and the last 20 runs', () => {
    const { store, events } = mk();
    expect(store.getState().finishRush('m3', 7)).toEqual({ best: true, previous: 0 });
    expect(store.getState().finishRush('m3', 5)).toEqual({ best: false, previous: 7 });
    expect(store.getState().finishRush('m3', 7).best).toBe(false);
    expect(store.getState().finishRush('survival', 3).best).toBe(true);
    expect(store.getState().rush.bests).toEqual({ m3: 7, m5: 0, survival: 3 });
    for (let i = 0; i < 30; i++) store.getState().finishRush('m5', i);
    expect(store.getState().rush.runs).toHaveLength(20);
    expect(events[0]).toEqual({ type: 'arena-rush', score: 7, best: true });
  });
  it('items are deterministic per run seed and avoid repeats', () => {
    const seen: string[] = [];
    const keys = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const p = rushItem('run-x', i, seen);
      expect(p.kind).toBe('quick');
      expect(p).toEqual(rushItem('run-x', i, seen));
      seen.push(statementKey(p));
      keys.add(statementKey(p));
    }
    expect(keys.size).toBe(25);
  });
});

describe('migrate and save section', () => {
  it('never throws on garbage and yields a valid state', () => {
    const junk: unknown[] = [null, undefined, 5, 'x', [], {}, { rating: 'high', history: 3, daily: 'x', rush: 7, current: { family: 'zzz' } }, { salt: 5, filter: ['nope'], streak: { count: -4, last: 9 } }, { daily: { 'bad': 1, '2026-01-01': { marks: 'x' } }, rush: { bests: null, runs: [1, { mode: 'q' }] } }];
    for (const j of junk) {
      const s = migrate(j, () => 'abc');
      expect(s.v).toBe(1);
      expect(s.rating).toBeGreaterThanOrEqual(400);
      expect(s.filter.length).toBeGreaterThan(0);
      expect(typeof s.salt).toBe('string');
      expect(s.salt.length).toBeGreaterThan(0);
    }
    const storage = mem();
    storage.setItem('inhabit.arena', '{not json');
    expect(() => createArenaStore({ storage })).not.toThrow();
  });
  it('preserves the duel slice and display name', () => {
    const a = mk();
    a.store.getState().setDuelState({ x: [1, 2] });
    a.store.getState().setDisplayName('Ada Lovelace the Third of Name');
    expect(a.store.getState().displayName).toHaveLength(20);
    const b = mk(a.storage);
    expect(b.store.getState().duel).toEqual({ x: [1, 2] });
    expect(migrate({ duel: { y: 1 } }, () => 's').duel).toEqual({ y: 1 });
    expect(migrate({}, () => 's').duel).toBeNull();
  });
  it('export, reset and import round trip through the registry', () => {
    const a = mk();
    registerSaveSection('arena', sectionFor(a.store));
    const c = a.store.getState().ensureRated();
    a.store.getState().finishRated(ratedPuzzle(a.store.getState(), c), clean);
    a.store.getState().finishRush('m3', 4);
    const exported = JSON.parse(JSON.stringify(exportSections()));
    const salt = a.store.getState().salt;
    resetSections();
    expect(a.store.getState().rated).toBe(0);
    expect(a.store.getState().rush.bests.m3).toBe(0);
    expect(JSON.parse(a.storage.data.get('inhabit.arena')!).rated).toBe(0);
    importSections(exported);
    expect(a.store.getState().rated).toBe(1);
    expect(a.store.getState().salt).toBe(salt);
    expect(a.store.getState().rush.bests.m3).toBe(4);
    expect(JSON.parse(a.storage.data.get('inhabit.arena')!).rated).toBe(1);
    expect(defaultState('s').rating).toBe(800);
  });
});
