import { describe, expect, it } from 'vitest';
import { DAY } from './leitner.ts';
import type { WorldLike } from './progress.ts';
import { BADGES, applyCompletion, applyReview, dayKey, defaultSave, migrate, type SaveData } from './game.ts';
import { playerLevel, settleQuests, starsFor, streakInfo, todaysQuests, worldStars } from './meta.ts';
import { createGameStore } from './store.ts';
import type { GameEvent } from './events.ts';

const lv = (p: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i + 1}`, kind: 'proof' }));
const worlds: WorldLike[] = [
  { id: 'a', requires: [], levels: lv('a', 12) },
  { id: 'b', requires: ['a'], levels: [...lv('b', 3), { id: 'b4', kind: 'proof', optional: true }] },
];
const noon = (d: number) => new Date(2026, 10, d, 12).getTime();
const base = noon(12);
const solvedP = (clean: boolean) => ({ status: 'solved' as const, hintsUsed: 0, attempts: 1, ...(clean ? { clean: true } : {}) });
const item = (reps: number, lapses = 0) => ({ box: 2, due: 0, last: 0, reps, lapses });

describe('stars', () => {
  it('covers every case', () => {
    expect(starsFor(undefined, undefined)).toBe(0);
    expect(starsFor({ status: 'unseen', hintsUsed: 0, attempts: 0 }, undefined)).toBe(0);
    expect(starsFor({ status: 'studied', hintsUsed: 0, attempts: 0 }, item(3))).toBe(1);
    expect(starsFor({ ...solvedP(false) }, item(3))).toBe(1);
    expect(starsFor(solvedP(true), undefined)).toBe(2);
    expect(starsFor(solvedP(true), item(0))).toBe(2);
    expect(starsFor(solvedP(true), item(1, 1))).toBe(2); // only a failed review
    expect(starsFor(solvedP(true), item(2, 1))).toBe(3);
  });
  it('a studied level stays at one star until solved cleanly', () => {
    let s = applyCompletion(defaultSave(), worlds, 'a1', { studied: true, clean: false }, 1).save;
    expect(starsFor(s.levels.a1, s.deck.a1)).toBe(1);
    s = applyCompletion(s, worlds, 'a1', { studied: false, clean: false }, 2).save; // solved with hints
    expect(starsFor(s.levels.a1, s.deck.a1)).toBe(1);
    s = applyCompletion(s, worlds, 'a1', { studied: false, clean: true }, 3).save;
    expect(starsFor(s.levels.a1, s.deck.a1)).toBe(2);
    s = applyReview(s, worlds, 'a1', true, 4).save;
    expect(starsFor(s.levels.a1, s.deck.a1)).toBe(3);
  });
  it('world stars total over required levels only', () => {
    const s: SaveData = { ...defaultSave(), levels: { b1: solvedP(true), b4: solvedP(true) }, deck: { b1: item(1) } };
    expect(worldStars(worlds[1], s)).toEqual({ earned: 3, total: 9 });
  });
});

describe('player level', () => {
  it('is anchored, monotone and slows down', () => {
    expect(playerLevel(0)).toMatchObject({ level: 1, into: 0, frac: 0, span: 52 });
    expect(playerLevel(52).level).toBe(2);
    expect(playerLevel(51).level).toBe(1);
    let prev = 0;
    let prevSpan = 0;
    for (let xp = 0; xp < 6000; xp += 7) {
      const p = playerLevel(xp);
      expect(p.level).toBeGreaterThanOrEqual(prev);
      expect(p.into).toBeLessThan(p.span);
      expect(p.span).toBeGreaterThanOrEqual(prevSpan);
      prev = p.level;
      prevSpan = p.span;
    }
    expect(playerLevel(3000).level).toBeGreaterThanOrEqual(19);
    expect(playerLevel(4000).level).toBeLessThanOrEqual(25);
    expect(playerLevel(-5).level).toBe(1);
  });
});

describe('streaks', () => {
  const days = (...offs: number[]): SaveData => ({ ...defaultSave(), activeDays: offs.map((o) => dayKey(base - o * DAY)) });
  it('plain streaks', () => {
    expect(streakInfo(days(0, 1, 2), base)).toEqual({ current: 3, best: 3, activeToday: true, restUsed: false });
    expect(streakInfo(days(1, 2), base)).toMatchObject({ current: 2, activeToday: false });
    expect(streakInfo(days(3), base).current).toBe(0);
    expect(streakInfo(defaultSave(), base)).toMatchObject({ current: 0, best: 0 });
  });
  it('one rest day bridges, a second within 7 days does not', () => {
    const one = streakInfo(days(0, 1, 3, 4), base);
    expect(one).toMatchObject({ current: 4, restUsed: true });
    const two = streakInfo(days(0, 2, 4, 5), base); // gaps at 1 and 3: two rest days within 7 days
    expect(two.current).toBe(2);
    const far = streakInfo(days(0, 1, 3, 4, 5, 6, 7, 8, 10, 11), base); // gaps at 2 and 9: seven apart
    expect(far.current).toBe(10);
  });
  it('works across a week boundary and finds the best', () => {
    const s = days(0, 1, 2, 20, 21, 22, 23, 24, 25, 27, 28);
    const info = streakInfo(s, base);
    expect(info.current).toBe(3);
    expect(info.best).toBe(8); // 20..25 plus 27, 28; the rest day 26 is not counted
    expect(info.restUsed).toBe(false);
  });
  it('a missed day today is not a loss; two missed days is', () => {
    expect(streakInfo(days(2, 3), base).current).toBe(0);
  });
});

describe('quests', () => {
  it('three quests, deterministic for a day, varying across days', () => {
    const s = defaultSave();
    const a = todaysQuests(s, worlds, base);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((q) => q.id)).size).toBe(3);
    expect(todaysQuests(s, worlds, base + 3600_000)).toEqual(a);
    const sets = new Set<string>();
    for (let d = 1; d <= 28; d++) sets.add(todaysQuests(s, worlds, noon(d)).map((q) => q.id.slice(11)).sort().join());
    expect(sets.size).toBeGreaterThan(5);
    for (const q of a) {
      expect(q.xp).toBeGreaterThanOrEqual(10);
      expect(q.xp).toBeLessThanOrEqual(30);
      expect(q.href.startsWith('#/')).toBe(true);
    }
  });
  it('always has a curriculum quest while levels remain; beginners get at most one Arena quest', () => {
    const arena = (id: string) => /daily|puzzles|rush|duel/.test(id);
    for (let d = 1; d <= 60; d++) {
      const t = base + d * DAY;
      const q = todaysQuests(defaultSave(), worlds, t);
      expect(q.some((x) => /solve-levels|clean-solve/.test(x.id))).toBe(true);
      expect(q.filter((x) => arena(x.id)).length).toBeLessThanOrEqual(1);
    }
    const levels = Object.fromEntries(worlds.flatMap((w) => w.levels).slice(0, 12).map((l) => [l.id, solvedP(false)]));
    let many = 0;
    for (let d = 1; d <= 60; d++) many = Math.max(many, todaysQuests({ ...defaultSave(), levels }, worlds, base + d * DAY).filter((x) => arena(x.id)).length);
    expect(many).toBeGreaterThan(1);
  });
  it('review quests appear only when items are due', () => {
    for (let d = 0; d < 40; d++) expect(todaysQuests(defaultSave(), worlds, base + d * DAY).some((q) => q.id.endsWith(':review'))).toBe(false);
    const due: SaveData = { ...defaultSave(), levels: { a1: solvedP(true) }, deck: { a1: item(0) } };
    let seen = false;
    for (let d = 0; d < 40; d++) seen ||= todaysQuests(due, worlds, base + d * DAY).some((q) => q.id.endsWith(':review'));
    expect(seen).toBe(true);
  });
  it('progress is live, and completion awards XP exactly once', () => {
    let t = base;
    let store = createGameStore({ worlds: () => worlds, now: () => t, key: 'k' });
    // find a day whose first quest set contains solve-levels with a goal of 1 or just play until done
    const day = (() => {
      for (let d = 0; d < 60; d++) {
        const q = todaysQuests(defaultSave(), worlds, base + d * DAY).find((x) => x.id.endsWith(':solve-levels'));
        if (q && q.goal === 1) return base + d * DAY;
      }
      throw new Error('no day');
    })();
    t = day;
    store = createGameStore({ worlds: () => worlds, now: () => t, key: 'k' });
    const quest = () => todaysQuests(store.getState().save, worlds, t).find((x) => x.id.endsWith(':solve-levels'))!;
    expect(quest().progress).toBe(0);
    const xp0 = store.getState().save.xp;
    const r = store.getState().completeLevel('a1', { studied: false, clean: false });
    expect(quest()).toMatchObject({ progress: 1, done: true });
    const gained = store.getState().save.xp - xp0;
    expect(gained).toBe(r.xp + quest().xp);
    expect(store.getState().toasts.some((x) => x.text === `Quest complete: ${quest().title} (+${quest().xp} XP)`)).toBe(true);
    store.getState().completeLevel('a2', { studied: false, clean: false });
    const after = store.getState().save;
    expect(after.stats.quests).toBeGreaterThanOrEqual(1);
    expect(after.today.questsDone.filter((x) => x === quest().id)).toHaveLength(1);
    // idempotent
    expect(settleQuests(after, worlds, t).xp).toBe(0);
    // next day: fresh log
    t = day + DAY;
    expect(todaysQuests(after, worlds, t).every((q) => q.progress === 0)).toBe(true);
  });
});

describe('events', () => {
  const mk = () => {
    let t = base;
    const s = createGameStore({ worlds: () => worlds, now: () => t, key: 'k' });
    return { s, set: (x: number) => (t = x), save: () => s.getState().save };
  };
  const ev = (s: ReturnType<typeof mk>['s'], e: GameEvent) => s.getState().recordEvent(e).xp;
  it('awards xp per event type and marks the day active', () => {
    const { s, save } = mk();
    expect(ev(s, { type: 'arena-puzzle', solved: false, rated: true, puzzleRating: 1500 })).toBe(0);
    expect(ev(s, { type: 'arena-puzzle', solved: true, rated: true, puzzleRating: 800 })).toBe(4);
    expect(ev(s, { type: 'arena-puzzle', solved: true, rated: false, puzzleRating: 5000 })).toBe(10);
    expect(ev(s, { type: 'arena-daily', solved: 3, total: 3, dateKey: '2026-11-12' })).toBe(30);
    expect(ev(s, { type: 'arena-daily', solved: 3, total: 3, dateKey: '2026-11-12' })).toBe(0);
    expect(ev(s, { type: 'arena-rush', score: 7, best: false })).toBe(7);
    expect(ev(s, { type: 'arena-rush', score: 50, best: true })).toBe(20);
    expect(ev(s, { type: 'arena-duel', won: true, opponent: 'bot' })).toBe(15);
    expect(ev(s, { type: 'arena-duel', won: false, opponent: 'friend' })).toBe(5);
    expect(ev(s, { type: 'guide-read', articleId: 'x' })).toBe(10);
    expect(ev(s, { type: 'guide-read', articleId: 'x' })).toBe(0);
    expect(ev(s, { type: 'primer-read', worldId: 'a' })).toBe(10);
    expect(ev(s, { type: 'primer-read', worldId: 'a' })).toBe(0);
    const v = save();
    expect(v.activeDays).toEqual([dayKey(base)]);
    expect(v.seen['guide:x']).toBeTruthy();
    expect(v.seen['primer:a']).toBeTruthy();
    expect(v.stats).toMatchObject({ puzzles: 2, ratedSolved: 1, daily: 1, rushBest: 50, duelWins: 1, guide: 1, primers: 1 });
    expect(v.today.counts).toMatchObject({ puzzles: 1, daily: 1, rushBest: 50, duelWins: 1, guide: 2 });
    expect(v.badges['arena-first']).toBeTruthy();
    expect(v.badges['rush-25']).toBeTruthy();
    expect(v.badges['duel-1']).toBeTruthy();
    expect(v.badges['guide-1']).toBeTruthy();
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });
  it('quest xp is not part of the returned event xp but is added to the total', () => {
    const { s, set, save } = mk();
    let hit = false;
    for (let d = 0; d < 60 && !hit; d++) {
      set(base + d * DAY);
      const q = todaysQuests(save(), worlds, base + d * DAY).find((x) => x.id.endsWith(':guide'));
      if (!q) continue;
      const before = save().xp;
      const got = ev(s, { type: 'guide-read', articleId: `g${d}` });
      expect(got).toBe(10);
      expect(save().xp - before).toBe(10 + q.xp);
      hit = true;
    }
    expect(hit).toBe(true);
  });
  it('resets the day log when the day changes', () => {
    const { s, set, save } = mk();
    ev(s, { type: 'arena-duel', won: true, opponent: 'bot' });
    expect(save().today.counts.duelWins).toBe(1);
    set(base + DAY);
    ev(s, { type: 'arena-duel', won: true, opponent: 'bot' });
    expect(save().today.counts.duelWins).toBe(1);
    expect(save().stats.duelWins).toBe(2);
  });
});

describe('migrate and badges', () => {
  it('fills new fields on old saves and accepts garbage', () => {
    const old = { version: 1, xp: 40, levels: {}, activeDays: ['2026-01-01'], badges: { 'first-step': 1 } };
    const m = migrate(old);
    expect(m.today).toEqual({ day: '', counts: {}, questsDone: [] });
    expect(m.stats).toEqual({});
    expect(m.xp).toBe(40);
    expect(m.badges['first-step']).toBe(1);
    const g = migrate({ today: { day: 5, counts: { a: 'x', b: 2, c: -1 }, questsDone: [1, 'q'] }, stats: { s: 3, t: 'no' } });
    expect(g.today).toEqual({ day: '', counts: { b: 2 }, questsDone: ['q'] });
    expect(g.stats).toEqual({ s: 3 });
    expect(migrate({ today: 7, stats: [1] }).stats).toEqual({});
    const rt = migrate(JSON.parse(JSON.stringify(m)));
    expect(rt).toEqual(m);
  });
  it('badge ids are unique, grouped, and keep the old ids', () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(30);
    for (const old of ['first-step', 'clean-solve', 'first-term', 'first-formal', 'first-world', 'halfway', 'atlas', 'clean-boss', 'test-out', 'review-10', 'box-5', 'workshop', 'regular']) expect(ids).toContain(old);
    for (const b of BADGES) {
      expect(['path', 'craft', 'memory', 'arena', 'reading']).toContain(b.group);
      expect(b.desc).not.toMatch(/!/);
    }
  });
  it('star, quest, streak and reading badges fire', () => {
    const levels = Object.fromEntries(worlds[1].levels.filter((l) => !('optional' in l)).map((l) => [l.id, solvedP(true)]));
    const deck = Object.fromEntries(Object.keys(levels).map((k) => [k, item(1)]));
    const save: SaveData = {
      ...defaultSave(), levels, deck, stats: { quests: 10 },
      activeDays: [0, 1, 2].map((o) => dayKey(base - o * DAY)),
      seen: { 'primer:a': 1, 'primer:b': 1 },
    };
    const got = BADGES.filter((b) => b.test({ save, worlds })).map((b) => b.id);
    expect(got).toEqual(expect.arrayContaining(['first-3star', 'world-3stars', 'quest-1', 'quest-10', 'streak-3', 'primers-all']));
    expect(got).not.toContain('streak-7');
  });
});
