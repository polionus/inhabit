/**
 * The live-duel handshake and message flow on top of a `DuelTransport`. No browser APIs: time and
 * randomness are injected, so it runs under Node and is tested over an in-memory transport.
 *
 *   both: hello {v, gen, name}   (mismatch of gen or v: explain and stop)
 *   host: setup {seed, format}   guest: ready   host: go {startAt}   each side counts down locally
 *   then progress / done; rematch needs both players; bye on leaving.
 */
import type { DuelFormat } from '../plan.ts';
import { PROTOCOL_VERSION, type DuelMessage } from './protocol.ts';
import type { DuelTransport } from './transport.ts';

export type SessionPhase = 'connecting' | 'lobby' | 'running' | 'ended' | 'failed' | 'closed';

export interface SessionState {
  phase: SessionPhase;
  role: 'host' | 'guest';
  opponent: string | null;
  seed: string | null;
  format: DuelFormat;
  /** Local epoch ms at which puzzle 1 begins (set when `go` is sent or received). */
  startAt: number | null;
  detail: string | null;
  versionMismatch: boolean;
  rematch: { me: boolean; them: boolean };
  opponentLeft: boolean;
  /** Bumps on every new set (first game, each rematch). */
  round: number;
}

export interface SessionOptions {
  transport: DuelTransport;
  role: 'host' | 'guest';
  name: string;
  gen: number;
  /** Host only: the format to play. */
  format?: DuelFormat;
  newSeed: () => string;
  now: () => number;
  countdownMs?: number;
}

export interface Session {
  getState(): SessionState;
  subscribe(cb: (s: SessionState) => void): () => void;
  onProgress(cb: (i: number, r: { solved: boolean; ms: number }) => void): void;
  sendProgress(i: number, r: { solved: boolean; ms: number }): void;
  /** The local duel is over (so a `setup` for a rematch is accepted). */
  finish(): void;
  requestRematch(): void;
  close(): void;
}

export function createSession(o: SessionOptions): Session {
  const tr = o.transport;
  const countdown = o.countdownMs ?? 4000;
  let s: SessionState = {
    phase: 'connecting', role: o.role, opponent: null, seed: null, format: o.format ?? 'standard', startAt: null,
    detail: null, versionMismatch: false, rematch: { me: false, them: false }, opponentLeft: false, round: 0,
  };
  const subs = new Set<(s: SessionState) => void>();
  const progressCbs: ((i: number, r: { solved: boolean; ms: number }) => void)[] = [];
  let helloSent = false;
  let gotHello = false;
  let sentSetup = false;
  let over = false;

  const set = (p: Partial<SessionState>) => {
    s = { ...s, ...p };
    subs.forEach((cb) => cb(s));
  };
  const send = (m: DuelMessage) => tr.send(m);
  const stop = (phase: 'failed' | 'closed', detail: string, extra: Partial<SessionState> = {}) => {
    if (over) return;
    over = true;
    set({ phase, detail, ...extra });
  };

  const sendSetup = () => {
    const seed = o.newSeed();
    sentSetup = true;
    set({ seed, phase: 'lobby', startAt: null, rematch: { me: false, them: false }, round: s.round + 1 });
    send({ t: 'setup', seed, format: s.format });
  };

  const sendGo = () => {
    send({ t: 'go', startAt: countdown });
    set({ phase: 'running', startAt: o.now() + countdown });
  };

  tr.onState((st, detail) => {
    if (over) return;
    if (st === 'open' && !helloSent) {
      helloSent = true;
      send({ t: 'hello', v: PROTOCOL_VERSION, gen: o.gen, name: o.name });
    } else if (st === 'failed') {
      stop('failed', detail ?? 'The connection failed.');
    } else if (st === 'closed') {
      if (s.phase === 'connecting' || s.phase === 'lobby') stop('closed', detail ?? 'The other player left before the duel started.', { opponentLeft: true });
      else set({ opponentLeft: true, detail: detail ?? 'The other player left.' });
    }
  });

  tr.onMessage((m) => {
    if (over && m.t !== 'bye') return;
    switch (m.t) {
      case 'hello': {
        if (gotHello) return;
        if (m.v !== PROTOCOL_VERSION || m.gen !== o.gen) {
          stop('failed', 'The other player has a different version of the game, so the two of you would not get the same puzzles. One of you needs to reload the page (or use a challenge link made on the same version).', { versionMismatch: true, opponent: m.name });
          tr.close();
          return;
        }
        gotHello = true;
        set({ opponent: m.name });
        if (o.role === 'host' && !sentSetup) sendSetup();
        return;
      }
      case 'setup': {
        if (o.role !== 'guest' || !gotHello || (s.phase !== 'lobby' && s.phase !== 'connecting' && s.phase !== 'ended')) return;
        set({ seed: m.seed, format: m.format, phase: 'lobby', startAt: null, rematch: { me: false, them: false }, round: s.round + 1, opponentLeft: false });
        send({ t: 'ready' });
        return;
      }
      case 'ready': {
        if (o.role === 'host' && sentSetup && s.phase === 'lobby') sendGo();
        return;
      }
      case 'go': {
        if (o.role === 'guest' && s.phase === 'lobby' && s.seed) set({ phase: 'running', startAt: o.now() + m.startAt });
        return;
      }
      case 'progress': {
        if (s.phase === 'running' || s.phase === 'ended') progressCbs.forEach((cb) => cb(m.i, { solved: m.solved, ms: m.ms }));
        return;
      }
      case 'rematch': {
        const rematch = { ...s.rematch, them: true };
        set({ rematch });
        if (o.role === 'host' && rematch.me && rematch.them) sendSetup();
        return;
      }
      case 'bye': {
        if (s.phase === 'connecting' || s.phase === 'lobby') stop('closed', 'The other player left before the duel started.', { opponentLeft: true });
        else set({ opponentLeft: true, detail: 'The other player left.' });
        return;
      }
      case 'done':
        return;
    }
  });

  return {
    getState: () => s,
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    onProgress(cb) {
      progressCbs.push(cb);
    },
    sendProgress(i, r) {
      send({ t: 'progress', i, solved: r.solved, ms: Math.max(0, Math.round(r.ms)) });
    },
    finish() {
      if (s.phase === 'running') {
        send({ t: 'done' });
        set({ phase: 'ended' });
      }
    },
    requestRematch() {
      const rematch = { ...s.rematch, me: true };
      set({ rematch });
      send({ t: 'rematch' });
      if (o.role === 'host' && rematch.me && rematch.them) sendSetup();
    },
    close() {
      if (!over) {
        send({ t: 'bye' });
        over = true;
        set({ phase: 'closed' });
      }
      tr.close();
    },
  };
}
