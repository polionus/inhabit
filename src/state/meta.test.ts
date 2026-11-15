import { describe, expect, it } from 'vitest';
import { DAY, reviewReady, reviewSession } from './leitner.ts';
import { isPassed, type WorldLike } from './progress.ts';
import { BADGES, applyCompletion, applyReview, dayKey, defaultSave, migrate, type SaveData } from './game.ts';
import { masteryOf, playerLevel, settleQuests, starsFor, streakInfo, todaysQuests, worldMastery, worldStars } from './meta.ts';
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
    expect(starsFor({ status: 'studied', hintsUsed: 0, attempts: 0 }, item(3))).toBe(0); // studied earns no star
    expect(starsFor({ ...solvedP(false) }, item(3))).toBe(1);
    expect(starsFor(solvedP(true), undefined)).toBe(2);
    expect(starsFor(solvedP(true), item(0))).toBe(2);
    expect(starsFor(solvedP(true), item(1, 1))).toBe(2); // only a failed review
    expect(starsFor(solvedP(true), item(2, 1))).toBe(3);
  });
  it('a studied level has no star until solved unaided', () => {
    let s = applyCompletion(defaultSave(), worlds, 'a1', { studied: true, clean: false }, 1).save;
    expect(starsFor(s.levels.a1, s.deck.a1)).toBe(0);
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

const qworlds: WorldLike[] = [
  ...worlds,
  { id: 'props', requires: [], levels: lv('p', 2) },
  { id: 'logic', requires: ['props'], levels: lv('l', 2) },
];
const veteran = (extra: Partial<SaveData> = {}): SaveData => ({
  ...defaultSave(),
  levels: Object.fromEntries(['p1', 'p2', 'l1', 'l2'].map((id) => [id, solvedP(false)])),
  ...extra,
});

describe('quests', () => {
  it('three quests, deterministic for a day; a new player gets only curriculum and reading quests', () => {
    const s = defaultSave();
    const a = todaysQuests(s, worlds, base);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((q) => q.id)).size).toBe(3);
    expect(todaysQuests(s, worlds, base + 3600_000)).toEqual(a);
    for (let d = 0; d < 30; d++) {
      for (const q of todaysQuests(s, qworlds, noon(d + 1))) expect(q.id).toMatch(/solve-levels|clean-solve|guide/);
    }
    for (const q of a) {
      expect(q.xp).toBeGreaterThanOrEqual(10);
      expect(q.xp).toBeLessThanOrEqual(30);
      expect(q.href.startsWith('#/')).toBe(true);
    }
  });
  it('varies across days once the player has more to offer', () => {
    const s = veteran({ stats: { rushBest: 6, duels: 1 }, deck: { l1: item(0) } });
    const sets = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      const q = todaysQuests(s, qworlds, noon(d));
      expect(q).toHaveLength(3);
      sets.add(q.map((x) => x.id.slice(11)).sort().join());
    }
    expect(sets.size).toBeGreaterThan(5);
  });
  it('Arena quests need world logic complete; rush and duel need prior use; at most one a day without the habit', () => {
    const arena = (id: string) => /daily|puzzles|rush|duel/.test(id);
    const kinds = new Set<string>();
    const half: SaveData = { ...defaultSave(), levels: { p1: solvedP(false), p2: solvedP(false), l1: solvedP(false) }, stats: { rushBest: 9, duels: 3 } };
    for (let d = 1; d <= 60; d++) {
      const t = base + d * DAY;
      expect(todaysQuests(half, qworlds, t).filter((x) => arena(x.id))).toHaveLength(0);
      const fresh = todaysQuests(veteran(), qworlds, t);
      expect(fresh.filter((x) => arena(x.id)).length).toBeLessThanOrEqual(1);
      expect(fresh.some((x) => /rush|duel/.test(x.id))).toBe(false);
      const used = todaysQuests(veteran({ stats: { rushBest: 9, duels: 3 } }), qworlds, t);
      expect(used.filter((x) => arena(x.id)).length).toBeLessThanOrEqual(1);
      used.forEach((x) => kinds.add(x.id.slice(11)));
    }
    expect(kinds.has('rush') && kinds.has('duel')).toBe(true);
  });
  it('an Arena habit (puzzles on 3 of the last 7 active days) allows more than one Arena quest', () => {
    const arena = (id: string) => /daily|puzzles|rush|duel/.test(id);
    let most = 0;
    for (let d = 10; d < 70; d++) {
      const t = base + d * DAY;
      const days = [1, 2, 3, 4, 5].map((o) => dayKey(t - o * DAY)).sort();
      const habit = veteran({ stats: { rushBest: 9, duels: 3 }, activeDays: days, arenaDays: days.slice(0, 3) });
      most = Math.max(most, todaysQuests(habit, qworlds, t).filter((x) => arena(x.id)).length);
    }
    expect(most).toBeGreaterThan(1);
  });
  it('the practice quest needs a passed level in props, logic, quant or sets', () => {
    let seen = false;
    for (let d = 0; d < 60; d++) {
      expect(todaysQuests(defaultSave(), qworlds, base + d * DAY).some((q) => q.id.endsWith(':practice-set'))).toBe(false);
      seen ||= todaysQuests(veteran(), qworlds, base + d * DAY).some((q) => q.id.endsWith(':practice-set'));
    }
    expect(seen).toBe(true);
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
    expect(ev(s, { type: 'guide-read', articleId: 'x' })).toBe(0); // reading pays nothing
    expect(ev(s, { type: 'guide-read', articleId: 'x' })).toBe(0);
    expect(ev(s, { type: 'primer-read', worldId: 'a' })).toBe(0);
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
      expect(got).toBe(0);
      expect(save().xp - before).toBe(q.xp);
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
      expect(['path', 'craft', 'memory', 'arena', 'reading', 'practice']).toContain(b.group);
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

describe('understanding first (SPEC 12.2)', () => {
  const studiedP = { status: 'studied' as const, hintsUsed: 0, attempts: 1 };
  it('studying earns no XP and no star, but opens the path and enters the deck', () => {
    const r = applyCompletion(defaultSave(), worlds, 'a1', { studied: true, clean: false }, 1);
    expect(r.xp).toBe(0);
    expect(r.save.xp).toBe(0);
    expect(r.save.levels.a1.status).toBe('studied');
    expect(starsFor(r.save.levels.a1, r.save.deck.a1)).toBe(0);
    expect(r.save.deck.a1).toBeTruthy();
    expect(isPassed(r.save.levels.a1)).toBe(true);
  });
  it('solving a studied level later pays in full, with the clean bonus', () => {
    const s = applyCompletion(defaultSave(), worlds, 'a1', { studied: true, clean: false }, 1).save;
    const hinted = applyCompletion(s, worlds, 'a1', { studied: false, clean: false }, 2);
    expect(hinted.xp).toBe(20);
    expect(hinted.save.levels.a1.studiedFirst).toBe(true);
    expect(hinted.earned).toContain('second-look');
    const clean = applyCompletion(s, worlds, 'a1', { studied: false, clean: true }, 2);
    expect(clean.xp).toBe(25);
    expect(clean.save.today.counts.levels).toBe(1);
  });
  it('masteryOf and worldMastery', () => {
    expect(masteryOf(undefined)).toBe('none');
    expect(masteryOf(studiedP)).toBe('studied');
    expect(masteryOf(solvedP(false))).toBe('solved');
    expect(masteryOf(solvedP(true))).toBe('clean');
    const save: SaveData = {
      ...defaultSave(),
      levels: { a1: solvedP(true), a2: solvedP(false), a3: studiedP, a4: { ...solvedP(false), testedOut: true }, a5: { status: 'unseen', hintsUsed: 0, attempts: 0 } },
    };
    expect(worldMastery(worlds[0], save)).toEqual({ unaided: 2, clean: 1, studied: 1, total: 12 });
  });
  it('a save with studied levels loads and simply shows fewer stars', () => {
    const old = { version: 1, xp: 90, levels: { a1: { status: 'studied', hintsUsed: 2, attempts: 3 }, a2: { status: 'solved', hintsUsed: 0, attempts: 1, clean: true } }, deck: { a1: { box: 1, due: 5, last: 0, reps: 0, lapses: 0 } } };
    const m = migrate(JSON.parse(JSON.stringify(old)));
    expect(m.xp).toBe(90);
    expect(m.levels.a1.status).toBe('studied');
    expect(worldStars(worlds[0], m)).toEqual({ earned: 2, total: 36 });
    expect(m.arenaDays).toEqual([]);
    expect(migrate(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
  it('Own work badge needs every required level solved unaided', () => {
    const levels = Object.fromEntries(worlds[1].levels.filter((l) => !('optional' in l)).map((l) => [l.id, solvedP(false)]));
    const has = (save: SaveData) => BADGES.find((b) => b.id === 'own-work')!.test({ save, worlds });
    expect(has({ ...defaultSave(), levels })).toBe(true);
    expect(has({ ...defaultSave(), levels: { ...levels, b1: studiedP } })).toBe(false);
    expect(has({ ...defaultSave(), levels: { ...levels, b1: { ...solvedP(false), testedOut: true } } })).toBe(false);
  });
  it('practice events pay 3 XP per solved problem (cap 12) and count', () => {
    const t = base;
    const s = createGameStore({ worlds: () => worlds, now: () => t, key: 'k' });
    expect(s.getState().recordEvent({ type: 'practice', kind: 'tactic', levelId: 'a1', solved: 2, total: 5 }).xp).toBe(6);
    expect(s.getState().recordEvent({ type: 'practice', kind: 'translate', solved: 9, total: 9 }).xp).toBe(12);
    expect(s.getState().recordEvent({ type: 'practice', kind: 'tactic', solved: 0, total: 5 }).xp).toBe(0);
    const v = s.getState().save;
    expect(v.stats).toMatchObject({ practice: 2, translate: 9, practiceSets: 3 });
    expect(v.today.counts).toMatchObject({ practice: 2, translate: 9, practiceSets: 3 });
    expect(v.activeDays).toEqual([dayKey(base)]);
    expect(v.badges['practice-1']).toBeTruthy();
    expect(v.badges['practice-25']).toBeFalsy();
    s.getState().recordEvent({ type: 'practice', kind: 'translate', solved: 12, total: 12 });
    s.getState().recordEvent({ type: 'practice', kind: 'translate', solved: 12, total: 12 });
    expect(s.getState().save.badges['practice-25']).toBeTruthy();
  });
  it('practice quest completes on a practice event', () => {
    for (let d = 0; d < 60; d++) {
      const t = base + d * DAY;
      const save = veteran();
      if (!todaysQuests(save, qworlds, t).some((q) => q.id.endsWith(':practice-set'))) continue;
      const s = createGameStore({ worlds: () => qworlds, now: () => t, key: 'k' });
      s.getState().importJson(JSON.stringify(save));
      s.getState().recordEvent({ type: 'practice', kind: 'tactic', solved: 1, total: 3 });
      expect(todaysQuests(s.getState().save, qworlds, t).find((q) => q.id.endsWith(':practice-set'))!.done).toBe(true);
      return;
    }
    throw new Error('practice quest never offered');
  });
  it('duels played and Arena days are recorded', () => {
    const s = createGameStore({ worlds: () => worlds, now: () => base, key: 'k' });
    s.getState().recordEvent({ type: 'arena-duel', won: false, opponent: 'bot' });
    s.getState().recordEvent({ type: 'arena-puzzle', solved: true, rated: true, puzzleRating: 900 });
    expect(s.getState().save.stats.duels).toBe(1);
    expect(s.getState().save.arenaDays).toEqual([dayKey(base)]);
  });
  it('review sessions: five at most, most overdue first, studied first among equals', () => {
    const deck = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`x${i}`, { box: 1, due: 100 + i, last: 0, reps: 0, lapses: 0 }]));
    deck.s1 = { box: 1, due: 100, last: 0, reps: 0, lapses: 0 };
    deck.t1 = { box: 1, due: 100, last: 0, reps: 0, lapses: 0 };
    deck.later = { box: 1, due: 10_000, last: 0, reps: 0, lapses: 0 };
    const levels = { s1: studiedP, t1: solvedP(false) };
    expect(reviewSession(deck, 5000, { levels })).toEqual(['s1', 't1', 'x0', 'x1', 'x2']);
    expect(reviewSession(deck, 5000, { size: 2 })).toHaveLength(2);
    expect(reviewSession(deck, 50)).toEqual([]);
    expect(reviewReady(deck, 5000)).toBe(5);
    expect(reviewReady(deck, 101)).toBe(4);
    expect(reviewReady({}, 5000)).toBe(0);
    expect(reviewSession(deck, 5000).includes('later')).toBe(false);
  });
});
