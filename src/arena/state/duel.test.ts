import { describe, expect, it } from 'vitest';
import { DUEL_CAP_MS, duelReduce, duelView, newDuel, type DuelEvent, type DuelState } from './duel.ts';
import { migrateDuel, recordDuel, emptyDuel } from './duelStore.ts';

const run = (s: DuelState, ...es: DuelEvent[]) => es.reduce(duelReduce, s);
const ok = (ms: number) => ({ solved: true, ms });
const miss = (ms: number) => ({ solved: false, ms });
const start = () => run(newDuel('abc', 'standard'), { type: 'start', at: 1000 });

describe('duel reducer', () => {
  it('ends when both finish; most points wins', () => {
    let s = start();
    for (let i = 0; i < 5; i++) s = run(s, { type: 'localResult', i, r: i < 4 ? ok(5000) : miss(9000) });
    expect(duelView(s).finished).toBe(false);
    for (let i = 0; i < 5; i++) s = run(s, { type: 'remoteProgress', i, r: i < 3 ? ok(4000) : miss(1000) });
    const v = duelView(s);
    expect(v.finished).toBe(true);
    expect(v.endReason).toBe('both-finished');
    expect(v.scores).toEqual({ me: 4, them: 3 });
    expect(v.winner).toBe('me');
    expect(v.marks.me).toEqual(['solved', 'solved', 'solved', 'solved', 'missed']);
  });

  it('ends at the time cap; unfinished puzzles score nothing', () => {
    let s = start();
    s = run(s, { type: 'localResult', i: 0, r: ok(5000) }, { type: 'remoteProgress', i: 0, r: ok(5000) }, { type: 'remoteProgress', i: 1, r: ok(5000) });
    s = run(s, { type: 'tick', now: 1000 + DUEL_CAP_MS.standard - 1 });
    expect(duelView(s).finished).toBe(false);
    s = run(s, { type: 'tick', now: 1000 + DUEL_CAP_MS.standard + 50 });
    const v = duelView(s);
    expect(v.finished).toBe(true);
    expect(v.endReason).toBe('cap');
    expect(v.winner).toBe('them');
    expect(v.capLeftMs).toBe(0);
    // Nothing is accepted after the end.
    expect(duelReduce(s, { type: 'localResult', i: 1, r: ok(1) })).toBe(s);
  });

  it('breaks ties by lower total time on solved puzzles, else draws', () => {
    const play = (a: number, b: number) => {
      let s = run(newDuel('x', 'blitz'), { type: 'start', at: 0 });
      for (let i = 0; i < 8; i++) s = run(s, { type: 'localResult', i, r: i < 2 ? ok(a) : miss(100000) }, { type: 'remoteProgress', i, r: i < 2 ? ok(b) : miss(1) });
      return duelView(s);
    };
    expect(play(4000, 5000).winner).toBe('me');
    expect(play(6000, 5000).winner).toBe('them');
    expect(play(5000, 5000).winner).toBe('draw');
  });

  it('a draw at zero points is a draw however long it took', () => {
    let s = run(newDuel('x', 'proofs'), { type: 'start', at: 0 });
    for (let i = 0; i < 4; i++) s = run(s, { type: 'localResult', i, r: miss(1) }, { type: 'remoteProgress', i, r: miss(9) });
    expect(duelView(s).winner).toBe('draw');
  });

  it('opponent leaving: I can finish alone', () => {
    let s = start();
    s = run(s, { type: 'remoteProgress', i: 0, r: ok(3000) }, { type: 'remoteLeft' });
    expect(duelView(s).finished).toBe(false);
    for (let i = 0; i < 5; i++) s = run(s, { type: 'localResult', i, r: ok(2000) });
    const v = duelView(s);
    expect(v.finished).toBe(true);
    expect(v.endReason).toBe('opponent-left');
    expect(v.opponentLeft).toBe(true);
    expect(v.winner).toBe('me');
  });

  it('ignores out-of-order, duplicate and out-of-range results; sanitises time', () => {
    let s = start();
    s = run(s, { type: 'localResult', i: 2, r: ok(1) });
    expect(s.me[2]).toBeNull();
    s = run(s, { type: 'localResult', i: 0, r: ok(1) }, { type: 'localResult', i: 0, r: miss(1) }, { type: 'localResult', i: 9, r: ok(1) }, { type: 'localResult', i: -1, r: ok(1) });
    expect(s.me.filter(Boolean)).toHaveLength(1);
    s = run(s, { type: 'remoteProgress', i: 0, r: { solved: true, ms: NaN } });
    expect(s.them[0]?.ms).toBe(DUEL_CAP_MS.standard);
    expect(duelReduce(newDuel('a', 'blitz'), { type: 'localResult', i: 0, r: ok(1) }).me[0]).toBeNull();
  });

  it('views say who is on which puzzle', () => {
    let s = start();
    s = run(s, { type: 'localResult', i: 0, r: ok(1) }, { type: 'localResult', i: 1, r: ok(1) });
    expect(duelView(s).on).toEqual({ me: 2, them: 0 });
  });
});

describe('persisted duel data', () => {
  it('never throws on garbage and keeps valid parts', () => {
    for (const g of [null, 1, 'x', [], {}, { bots: 5 }, { history: [null, 3, { format: 'nope' }] }, { bots: { tally: { w: -4, l: 'x' } } }]) {
      expect(() => migrateDuel(g)).not.toThrow();
      expect(migrateDuel(g).v).toBe(1);
    }
    expect(migrateDuel({ bots: { tally: { w: 2, l: 1, d: 0 }, ghost: { w: 9 } } }).bots).toEqual({ tally: { w: 2, l: 1, d: 0 } });
  });
  it('records results and caps history', () => {
    let d = emptyDuel();
    for (let i = 0; i < 40; i++) d = recordDuel(d, { at: i, opponent: 'bot', name: 'Tally', format: 'blitz', seed: 's', me: 5, them: 2, result: 'win' }, 'tally');
    expect(d.bots.tally.w).toBe(40);
    expect(d.history).toHaveLength(30);
    expect(migrateDuel(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});
