/** An in-memory pair implementing the same interface; for tests and environments without BroadcastChannel. */
import type { DuelMessage } from './protocol.ts';
import { parseWire, toWire } from './protocol.ts';
import { Emitter, type DuelTransport, type TransportState } from './transport.ts';

class End implements DuelTransport {
  readonly kind = 'local' as const;
  em = new Emitter();
  other: End | null = null;
  private hub: { room: string; joined: boolean; host: End | null };
  constructor(hub: { room: string; joined: boolean; host: End | null }) {
    this.hub = hub;
  }
  onMessage(cb: (m: DuelMessage) => void): void { this.em.onMessage(cb); }
  onState(cb: (s: TransportState, d?: string) => void): void { this.em.onState(cb); }
  host(): Promise<string> {
    this.hub.host = this;
    return Promise.resolve(this.hub.room);
  }
  join(roomId: string): Promise<void> {
    if (roomId !== this.hub.room || !this.hub.host) return Promise.reject(new Error('No such room.'));
    this.other = this.hub.host;
    this.hub.host.other = this;
    queueMicrotask(() => { this.em.setState('open'); this.hub.host?.em.setState('open'); });
    return Promise.resolve();
  }
  send(msg: DuelMessage): void {
    const o = this.other;
    if (!o || this.em.state !== 'open') return;
    const m = parseWire(toWire(msg));
    if (m) queueMicrotask(() => o.em.emit(m));
  }
  close(): void {
    const o = this.other;
    this.em.setState('closed');
    if (o) queueMicrotask(() => o.em.setState('closed', 'The other player left.'));
  }
}

export function memoryPair(): { host: DuelTransport; guest: DuelTransport; room: string } {
  const hub = { room: 'local-mem000', joined: false, host: null as End | null };
  return { host: new End(hub), guest: new End(hub), room: hub.room };
}
