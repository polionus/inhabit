/**
 * Persisted duel data: one JSON-able value kept in the arena store's `duel` field. `migrateDuel`
 * accepts anything (including garbage) and returns a valid value; it never throws.
 */
import { DUEL_FORMATS, type DuelFormat } from '../plan.ts';
import { BOTS } from './duelBots.ts';

export interface BotRecord {
  w: number;
  l: number;
  d: number;
}

export type DuelOpponent = 'bot' | 'friend' | 'challenge';

export interface DuelHistoryEntry {
  at: number;
  opponent: DuelOpponent;
  name: string;
  format: DuelFormat;
  seed: string;
  me: number;
  them: number;
  result: 'win' | 'loss' | 'draw';
  /** The opponent left before the end. */
  left?: boolean;
}

export interface DuelData {
  v: 1;
  bots: Record<string, BotRecord>;
  history: DuelHistoryEntry[];
  friend: BotRecord;
}

export const HISTORY_MAX = 30;

export const emptyDuel = (): DuelData => ({ v: 1, bots: {}, history: [], friend: { w: 0, l: 0, d: 0 } });

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1_000_000, Math.floor(x))) : 0);
const rec = (x: unknown): BotRecord => (isObj(x) ? { w: count(x.w), l: count(x.l), d: count(x.d) } : { w: 0, l: 0, d: 0 });
const str = (x: unknown, max: number): string => (typeof x === 'string' ? x.slice(0, max) : '');

export function migrateDuel(raw: unknown): DuelData {
  const out = emptyDuel();
  if (!isObj(raw)) return out;
  try {
    if (isObj(raw.bots)) for (const b of BOTS) if (b.id in raw.bots) out.bots[b.id] = rec(raw.bots[b.id]);
    out.friend = rec(raw.friend);
    if (Array.isArray(raw.history)) {
      for (const h of raw.history.slice(0, HISTORY_MAX)) {
        if (!isObj(h)) continue;
        const format = h.format as DuelFormat;
        if (!(format in DUEL_FORMATS)) continue;
        const opponent = h.opponent === 'bot' || h.opponent === 'friend' || h.opponent === 'challenge' ? h.opponent : null;
        const result = h.result === 'win' || h.result === 'loss' || h.result === 'draw' ? h.result : null;
        if (!opponent || !result) continue;
        out.history.push({
          at: count(h.at),
          opponent,
          name: str(h.name, 20),
          format,
          seed: str(h.seed, 64),
          me: count(h.me),
          them: count(h.them),
          result,
          ...(h.left === true ? { left: true } : {}),
        });
      }
    }
  } catch {
    return emptyDuel();
  }
  return out;
}

/** Record a finished duel: updates the per-bot (or friend) record and prepends to history. */
export function recordDuel(d: DuelData, e: DuelHistoryEntry, botId?: string): DuelData {
  const k = e.result === 'win' ? 'w' : e.result === 'loss' ? 'l' : 'd';
  const bump = (r: BotRecord): BotRecord => ({ ...r, [k]: r[k] + 1 });
  const next: DuelData = { ...d, bots: { ...d.bots }, history: [e, ...d.history].slice(0, HISTORY_MAX) };
  if (e.opponent === 'bot' && botId) next.bots[botId] = bump(d.bots[botId] ?? { w: 0, l: 0, d: 0 });
  else next.friend = bump(d.friend);
  return next;
}
