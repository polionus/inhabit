import { describe, expect, it } from 'vitest';
import { generator } from '../gen/index.ts';
import { SOURCE_MAX, b64urlDecode, b64urlEncode, challengeIsCurrent, decodeChallenge, decodeProof, encodeChallenge, encodeProof, type Challenge } from './codec.ts';
import { parseWire, validateMessage, type DuelMessage } from './protocol.ts';
import { createSession } from './session.ts';
import { LocalTransport } from './localTransport.ts';
import { memoryPair } from './memoryTransport.ts';
import type { DuelTransport } from './transport.ts';
import { duelReduce, duelView, newDuel } from '../state/duel.ts';

const ch = (over: Partial<Challenge> = {}): Challenge => ({ v: 1, gen: generator.version, seed: 'k3j9x2', format: 'standard', from: 'Ada', results: [{ solved: true, ms: 4100 }, { solved: false, ms: 9000 }, { solved: true, ms: 12000 }, { solved: true, ms: 50000 }, { solved: false, ms: 70000 }], at: 1_760_000_000_000, ...over });

describe('base64url', () => {
  it('round-trips bytes of every length', () => {
    for (let n = 0; n < 40; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
      expect(Array.from(b64urlDecode(b64urlEncode(b))!)).toEqual(Array.from(b));
    }
    expect(b64urlDecode('a')).toBeNull();
    expect(b64urlDecode('ab+/')).toBeNull();
  });
});

describe('challenge codec', () => {
  it('round-trips (to the second)', () => {
    const c = ch();
    const d = decodeChallenge(encodeChallenge(c))!;
    expect(d).toEqual({ ...c, at: Math.round(c.at / 1000) * 1000 });
    expect(encodeChallenge(c)).toMatch(/^c1[A-Za-z0-9_-]+$/);
  });
  it('round-trips a reply carrying both sides', () => {
    const c = ch({ from: 'Bo', vs: { from: 'Ada', results: ch().results } });
    expect(decodeChallenge(encodeChallenge(c))?.vs?.from).toBe('Ada');
  });
  it('flags a different generator version', () => {
    const d = decodeChallenge(encodeChallenge(ch({ gen: generator.version + 7 })))!;
    expect(d).not.toBeNull();
    expect(challengeIsCurrent(d)).toBe(false);
    expect(challengeIsCurrent(decodeChallenge(encodeChallenge(ch()))!)).toBe(true);
  });
  it('returns null for garbage and never throws', () => {
    const junk = ['', 'c1', 'c1!!!', 'c1' + 'A'.repeat(20000), 'p1abc', 'c2abc', 'c1' + b64urlEncode(new TextEncoder().encode('{"x":1}')), 'c1' + b64urlEncode(new TextEncoder().encode('[1,2,3]')), 'c1' + b64urlEncode(new Uint8Array([255, 254, 253])), null as unknown as string];
    for (const j of junk) expect(decodeChallenge(j)).toBeNull();
    const bad = [1, 'seed', 0, 'Ada', '1abc', 1];
    expect(decodeChallenge('c1' + b64urlEncode(new TextEncoder().encode(JSON.stringify(bad))))).toBeNull();
    // wrong result count for the format
    expect(decodeChallenge(encodeChallenge(ch({ results: ch().results.slice(0, 2) })))).toBeNull();
  });
  it('trims hostile names', () => {
    const d = decodeChallenge(encodeChallenge(ch({ from: '<b>' + 'x'.repeat(50) })))!;
    expect(d.from.length).toBeLessThanOrEqual(20);
  });
});

describe('proof codec', () => {
  const src = 'theorem and_swap (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by\n  obtain ⟨hp, hq⟩ := h\n  exact ⟨hq, hp⟩';
  it('round-trips unicode source and metadata', () => {
    const r = encodeProof({ title: 'And swap', english: 'If P and Q then Q and P.', source: src, by: 'Ada', kind: 'level', ref: 'logic-03' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toMatch(/^p1[A-Za-z0-9_-]+$/);
    expect(decodeProof(r.code)).toEqual({ v: 1, title: 'And swap', english: 'If P and Q then Q and P.', source: src, by: 'Ada', kind: 'level', ref: 'logic-03' });
  });
  it('caps the source and says so', () => {
    const r = encodeProof({ title: 't', source: 'x'.repeat(SOURCE_MAX + 1), kind: 'sandbox' });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('too-long'); expect(r.message).toContain('4,000'); }
    expect(encodeProof({ title: 't', source: 'x'.repeat(SOURCE_MAX), kind: 'sandbox' }).ok).toBe(true);
    expect(encodeProof({ title: 't', source: '  \n', kind: 'sandbox' }).ok).toBe(false);
  });
  it('rejects garbage and oversize codes', () => {
    for (const j of ['', 'p1', 'p1' + 'A'.repeat(30000), 'c1abcd', 'p1' + b64urlEncode(new TextEncoder().encode('{"k":9,"s":"x","t":"y"}')), 'p1' + b64urlEncode(new TextEncoder().encode('{"k":0,"s":5,"t":"y"}'))]) expect(decodeProof(j)).toBeNull();
  });
  it('strips private-use and control characters from untrusted text', () => {
    const body = JSON.stringify({ t: 'T\u0001', s: 'ab\u0007c', k: 0, b: 'N\u0000' });
    const d = decodeProof('p1' + b64urlEncode(new TextEncoder().encode(body)))!;
    expect(d.title).toBe('T');
    expect(d.by).toBe('N');
    expect(d.source).toBe('a' + DICT_5 + 'bc');
  });
});
//  is the dictionary entry 5 ("apply ") and legitimately expands; control chars are dropped.
const DICT_5 = 'apply ';

describe('protocol validation', () => {
  it('accepts well-formed messages', () => {
    expect(validateMessage({ t: 'hello', v: 1, gen: 1, name: 'Ada' })).toEqual({ t: 'hello', v: 1, gen: 1, name: 'Ada' });
    expect(validateMessage({ t: 'setup', seed: 'ab12', format: 'blitz' })).toEqual({ t: 'setup', seed: 'ab12', format: 'blitz' });
    expect(validateMessage({ t: 'progress', i: 2, solved: true, ms: 1234 })).not.toBeNull();
    expect(validateMessage({ t: 'go', startAt: 4000 })).not.toBeNull();
    for (const t of ['ready', 'done', 'rematch', 'bye']) expect(validateMessage({ t })).toEqual({ t });
  });
  it('drops malformed and hostile messages', () => {
    const bad: unknown[] = [null, 1, 'x', [], {}, { t: 5 }, { t: 'eval', code: 'x' }, { t: 'hello', v: '1', gen: 1, name: 'a' }, { t: 'hello', v: 1, gen: 1 }, { t: 'setup', seed: '../../x', format: 'blitz' }, { t: 'setup', seed: 'ab', format: 'toString' }, { t: 'setup', seed: 'ab', format: '__proto__' }, { t: 'progress', i: -1, solved: true, ms: 1 }, { t: 'progress', i: 1.5, solved: true, ms: 1 }, { t: 'progress', i: 1, solved: 'yes', ms: 1 }, { t: 'progress', i: 1, solved: true, ms: 1e12 }, { t: 'go', startAt: 1e9 }, { t: 'go', startAt: NaN }];
    for (const b of bad) expect(validateMessage(b)).toBeNull();
    expect(parseWire('{not json')).toBeNull();
    expect(parseWire('x'.repeat(5000))).toBeNull();
    expect(parseWire(42)).toBeNull();
  });
  it('caps and cleans names; never keeps markup beyond plain text length', () => {
    const m = validateMessage({ t: 'hello', v: 1, gen: 1, name: '<img src=x onerror=1>'.repeat(5) }) as Extract<DuelMessage, { t: 'hello' }>;
    expect(m.name.length).toBeLessThanOrEqual(20);
  });
});

/** Play a whole two-party duel over a transport pair and check both ends agree. */
async function playOver(host: DuelTransport, guest: DuelTransport, join: (room: string) => Promise<void>, room: Promise<string>) {
  let clock = 0;
  const now = () => clock;
  let n = 0;
  const hs = createSession({ transport: host, role: 'host', name: 'Host', gen: 1, format: 'blitz', newSeed: () => `seed${++n}`, now, countdownMs: 100 });
  const gs = createSession({ transport: guest, role: 'guest', name: 'Guest', gen: 1, now, countdownMs: 100 });
  const roomId = await room;
  await join(roomId);
  const until = async (f: () => boolean) => { for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 5)); expect(f()).toBe(true); };
  await until(() => hs.getState().phase === 'running' && gs.getState().phase === 'running');
  expect(hs.getState().opponent).toBe('Guest');
  expect(gs.getState().opponent).toBe('Host');
  expect(gs.getState().seed).toBe('seed1');
  expect(gs.getState().format).toBe('blitz');

  let hd = duelReduce(newDuel('seed1', 'blitz'), { type: 'start', at: 0 });
  let gd = hd;
  hs.onProgress((i, r) => (hd = duelReduce(hd, { type: 'remoteProgress', i, r })));
  gs.onProgress((i, r) => (gd = duelReduce(gd, { type: 'remoteProgress', i, r })));
  for (let i = 0; i < 8; i++) {
    const hr = { solved: i % 2 === 0, ms: 5000 + i };
    const gr = { solved: i !== 3, ms: 6000 + i };
    hd = duelReduce(hd, { type: 'localResult', i, r: hr }); hs.sendProgress(i, hr);
    gd = duelReduce(gd, { type: 'localResult', i, r: gr }); gs.sendProgress(i, gr);
  }
  await until(() => duelView(hd).finished && duelView(gd).finished);
  expect(duelView(hd).scores).toEqual({ me: 4, them: 7 });
  expect(duelView(gd).scores).toEqual({ me: 7, them: 4 });
  expect(duelView(hd).winner).toBe('them');
  expect(duelView(gd).winner).toBe('me');
  hs.finish(); gs.finish();

  // Rematch needs both players.
  hs.requestRematch();
  await new Promise((r) => setTimeout(r, 30));
  expect(hs.getState().round).toBe(1);
  gs.requestRematch();
  await until(() => hs.getState().phase === 'running' && gs.getState().phase === 'running' && hs.getState().round === 2);
  expect(gs.getState().seed).toBe('seed2');

  // Leaving is reported.
  gs.close();
  await until(() => hs.getState().opponentLeft);
  hs.close();
}

describe('two-party duel', () => {
  it('works over the in-memory transport', async () => {
    const p = memoryPair();
    await playOver(p.host, p.guest, (r) => p.guest.join(r), p.host.host());
  });
  it.runIf(typeof BroadcastChannel !== 'undefined')('works over the local (BroadcastChannel) transport', async () => {
    const host = new LocalTransport(2000);
    const guest = new LocalTransport(2000);
    await playOver(host, guest, (r) => guest.join(r), host.host());
  });
  it('stops with an explanation on a generator-version mismatch', async () => {
    const p = memoryPair();
    const now = () => 0;
    const hs = createSession({ transport: p.host, role: 'host', name: 'H', gen: 1, format: 'blitz', newSeed: () => 'aa', now });
    const gs = createSession({ transport: p.guest, role: 'guest', name: 'G', gen: 2, now });
    await p.host.host();
    await p.guest.join(p.room);
    for (let i = 0; i < 100 && !(hs.getState().versionMismatch && gs.getState().versionMismatch); i++) await new Promise((r) => setTimeout(r, 5));
    expect(hs.getState().phase).toBe('failed');
    expect(gs.getState().versionMismatch).toBe(true);
    expect(hs.getState().detail).toMatch(/different version/);
  });
  it('local transport join times out with a readable reason', async () => {
    if (typeof BroadcastChannel === 'undefined') return;
    const g = new LocalTransport(60);
    await expect(g.join('local-nobody')).rejects.toThrow(/No tab answered/);
    g.close();
  });
});
