/**
 * Same-browser transport over BroadcastChannel: two tabs, no network. Used for development, tests,
 * and as an honest "try it in two tabs" path. Room ids look like `local-ab12cd`.
 */
import { parseWire, toWire, type DuelMessage } from './protocol.ts';
import { CONNECT_TIMEOUT_MS, Emitter, type DuelTransport, type TransportState } from './transport.ts';

interface Frame {
  from: string;
  sys?: 'join' | 'welcome' | 'leave';
  to?: string;
  wire?: string;
}

const rand = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 36).toString(36)).join('');

export class LocalTransport implements DuelTransport {
  readonly kind = 'local' as const;
  private em = new Emitter();
  private ch: BroadcastChannel | null = null;
  private me = rand(10);
  private peerId: string | null = null;
  private role: 'host' | 'guest' | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private timeoutMs: number;
  constructor(timeoutMs: number = CONNECT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  onMessage(cb: (m: DuelMessage) => void): void { this.em.onMessage(cb); }
  onState(cb: (s: TransportState, d?: string) => void): void { this.em.onState(cb); }

  private open(room: string): void {
    this.ch = new BroadcastChannel(`inhabit-duel:${room}`);
    this.ch.onmessage = (e: MessageEvent) => this.receive(e.data as Frame);
  }

  private receive(f: Frame): void {
    if (!f || typeof f !== 'object' || typeof f.from !== 'string' || f.from === this.me) return;
    if (f.to !== undefined && f.to !== this.me) return;
    if (f.sys === 'join' && this.role === 'host' && this.peerId === null) {
      this.peerId = f.from;
      this.ch?.postMessage({ from: this.me, to: f.from, sys: 'welcome' } satisfies Frame);
      this.clearTimer();
      this.em.setState('open');
    } else if (f.sys === 'welcome' && this.role === 'guest' && this.peerId === null) {
      this.peerId = f.from;
      this.clearTimer();
      this.em.setState('open');
    } else if (f.sys === 'leave' && f.from === this.peerId) {
      this.em.setState('closed', 'The other tab was closed.');
    } else if (f.wire !== undefined && f.from === this.peerId) {
      const m = parseWire(f.wire);
      if (m) this.em.emit(m);
    }
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  host(): Promise<string> {
    this.role = 'host';
    const room = `local-${rand(6)}`;
    this.open(room);
    return Promise.resolve(room);
  }

  join(roomId: string): Promise<void> {
    this.role = 'guest';
    this.open(roomId);
    return new Promise((resolve, reject) => {
      this.timer = setTimeout(() => {
        this.em.setState('failed', 'No tab answered. Is the room still open in this browser?');
        reject(new Error('No tab answered. Is the room still open in this browser?'));
      }, this.timeoutMs);
      this.em.onState((s, d) => (s === 'open' ? resolve() : s === 'failed' || s === 'closed' ? reject(new Error(d ?? 'Closed.')) : undefined));
      this.ch?.postMessage({ from: this.me, sys: 'join' } satisfies Frame);
    });
  }

  send(msg: DuelMessage): void {
    if (this.em.state !== 'open' || !this.peerId) return;
    this.ch?.postMessage({ from: this.me, to: this.peerId, wire: toWire(msg) } satisfies Frame);
  }

  close(): void {
    this.clearTimer();
    if (this.ch) {
      try { this.ch.postMessage({ from: this.me, sys: 'leave' } satisfies Frame); } catch { /* closed */ }
      this.ch.close();
      this.ch = null;
    }
    this.em.setState('closed');
  }
}
