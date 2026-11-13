/**
 * Live transport: a WebRTC data channel via PeerJS, using its default public cloud broker for
 * signalling and public STUN servers. PeerJS is loaded with a dynamic import only when a live
 * duel starts, so it stays out of the main bundle and no third-party request is made otherwise.
 * Room ids are random and unguessable, prefixed `inhabit-`.
 */
import type { DataConnection, Peer } from 'peerjs';
import { parseWire, toWire, WIRE_MAX, type DuelMessage } from './protocol.ts';
import { CONNECT_TIMEOUT_MS, Emitter, type DuelTransport, type TransportState } from './transport.ts';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomId(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const reasonOf = (e: unknown): string => {
  const type = typeof e === 'object' && e && 'type' in e ? String((e as { type: unknown }).type) : '';
  if (type === 'peer-unavailable') return 'That room does not exist any more (or the host closed it).';
  if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') return 'Could not reach the signalling service. Check your connection, or try a challenge link instead.';
  if (type === 'browser-incompatible') return 'This browser cannot make direct connections.';
  return 'The connection failed. Some networks block direct connections; a challenge link works anywhere.';
};

export class PeerTransport implements DuelTransport {
  readonly kind = 'peer' as const;
  private em = new Emitter();
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timeoutMs: number;
  private closed = false;

  constructor(timeoutMs: number = CONNECT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  onMessage(cb: (m: DuelMessage) => void): void { this.em.onMessage(cb); }
  onState(cb: (s: TransportState, d?: string) => void): void { this.em.onState(cb); }

  private fail(detail: string): void {
    this.clearTimer();
    this.em.setState('failed', detail);
    this.teardown();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private teardown(): void {
    try { this.conn?.close(); } catch { /* ignore */ }
    try { this.peer?.destroy(); } catch { /* ignore */ }
    this.conn = null;
    this.peer = null;
  }

  private attach(conn: DataConnection): void {
    this.conn = conn;
    conn.on('data', (d) => {
      const m = parseWire(typeof d === 'string' ? d : null);
      if (m) this.em.emit(m);
    });
    conn.on('close', () => { if (!this.closed) this.em.setState('closed', 'The other player disconnected.'); });
    conn.on('error', (e) => this.fail(reasonOf(e)));
    const open = () => { this.clearTimer(); this.em.setState('open'); };
    if (conn.open) open(); else conn.on('open', open);
  }

  private async makePeer(id?: string): Promise<Peer> {
    const { Peer: PeerCtor } = await import('peerjs');
    // Public STUN only (no relay): the two browsers talk directly or not at all.
    const options = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };
    return id ? new PeerCtor(id, options) : new PeerCtor(options);
  }

  async host(): Promise<string> {
    const id = `inhabit-${randomId(12)}`;
    let peer: Peer;
    try { peer = await this.makePeer(id); } catch (e) { this.fail(reasonOf(e)); throw new Error(reasonOf(e)); }
    this.peer = peer;
    return new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => { const m = 'Could not reach the signalling service in time.'; this.fail(m); reject(new Error(m)); }, this.timeoutMs);
      peer.on('open', (pid) => { clearTimeout(t); resolve(pid); });
      peer.on('error', (e) => { clearTimeout(t); const m = reasonOf(e); this.fail(m); reject(new Error(m)); });
      peer.on('connection', (conn) => {
        if (this.conn) { try { conn.close(); } catch { /* ignore */ } return; } // one guest only
        this.attach(conn);
      });
      peer.on('disconnected', () => { /* the broker is not needed once connected */ });
    });
  }

  async join(roomId: string): Promise<void> {
    let peer: Peer;
    try { peer = await this.makePeer(); } catch (e) { this.fail(reasonOf(e)); throw new Error(reasonOf(e)); }
    this.peer = peer;
    return new Promise<void>((resolve, reject) => {
      const bail = (m: string) => { this.fail(m); reject(new Error(m)); };
      this.timer = setTimeout(() => bail('No connection formed in 15 seconds. Some networks block direct connections; a challenge link works anywhere.'), this.timeoutMs);
      peer.on('error', (e) => bail(reasonOf(e)));
      peer.on('open', () => {
        const conn = peer.connect(roomId, { reliable: true, serialization: 'json' });
        this.attach(conn);
        conn.on('open', () => resolve());
      });
    });
  }

  send(msg: DuelMessage): void {
    const text = toWire(msg);
    if (text.length > WIRE_MAX || !this.conn?.open) return;
    try { this.conn.send(text); } catch { /* connection went away; state callback follows */ }
  }

  close(): void {
    this.closed = true;
    this.clearTimer();
    if (this.conn?.open) { try { this.conn.send(toWire({ t: 'bye' })); } catch { /* ignore */ } }
    this.teardown();
    this.em.setState('closed');
  }
}
