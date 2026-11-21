/** The seam between the duel session and the network. Implementations: local (two tabs), peer (WebRTC), memory (tests). */
import type { DuelMessage } from './protocol.ts';

export type TransportState = 'connecting' | 'open' | 'closed' | 'failed';

export interface DuelTransport {
  readonly kind: 'peer' | 'local';
  /** Host: create a room and resolve with its id. Guest: join the room. Rejects with a readable reason on failure/timeout. */
  host(): Promise<string>;
  join(roomId: string): Promise<void>;
  send(msg: DuelMessage): void;
  onMessage(cb: (msg: DuelMessage) => void): void;
  onState(cb: (s: TransportState, detail?: string) => void): void;
  close(): void;
}

export const CONNECT_TIMEOUT_MS = 15_000;

/** Room ids: `inhabit-…` for peer rooms, `local-…` for same-browser rooms. */
export const roomKind = (id: string): 'peer' | 'local' | null => (/^inhabit-[a-z0-9]{8,32}$/.test(id) ? 'peer' : /^local-[a-z0-9]{4,32}$/.test(id) ? 'local' : null);

/** Shared plumbing for transports: listener lists and a state machine that only moves forward. */
export class Emitter {
  private msgCbs: ((m: DuelMessage) => void)[] = [];
  private stateCbs: ((s: TransportState, d?: string) => void)[] = [];
  state: TransportState = 'connecting';
  onMessage(cb: (m: DuelMessage) => void): void {
    this.msgCbs.push(cb);
  }
  onState(cb: (s: TransportState, d?: string) => void): void {
    this.stateCbs.push(cb);
  }
  emit(m: DuelMessage): void {
    for (const cb of this.msgCbs.slice()) cb(m);
  }
  setState(s: TransportState, detail?: string): void {
    if (this.state === s || this.state === 'closed' || this.state === 'failed') return;
    this.state = s;
    for (const cb of this.stateCbs.slice()) cb(s, detail);
  }
}
