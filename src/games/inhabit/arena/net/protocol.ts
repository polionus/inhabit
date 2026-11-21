/**
 * Live-duel wire protocol. Everything that arrives from the other browser is untrusted:
 * `validateMessage` type-checks every field, caps string lengths and drops anything unknown.
 * Pure; runs under Node.
 */
import { DUEL_FORMATS, type DuelFormat } from '../plan.ts';
import { cleanName } from './codec.ts';

export const PROTOCOL_VERSION = 1;
export const WIRE_MAX = 2000;

export type DuelMessage =
  | { t: 'hello'; v: number; gen: number; name: string }
  | { t: 'setup'; seed: string; format: DuelFormat }
  | { t: 'ready' }
  /** `startAt`: milliseconds from the moment of receipt until the first puzzle (each side counts on its own clock). */
  | { t: 'go'; startAt: number }
  | { t: 'progress'; i: number; solved: boolean; ms: number }
  | { t: 'done' }
  | { t: 'rematch' }
  | { t: 'bye' };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const int = (x: unknown, lo: number, hi: number): number | null => (typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi ? x : null);

export function validateMessage(raw: unknown): DuelMessage | null {
  if (!isObj(raw) || typeof raw.t !== 'string') return null;
  switch (raw.t) {
    case 'hello': {
      const v = int(raw.v, 0, 1000);
      const gen = int(raw.gen, 0, 1_000_000);
      if (v === null || gen === null || typeof raw.name !== 'string') return null;
      return { t: 'hello', v, gen, name: cleanName(raw.name) || 'Friend' };
    }
    case 'setup': {
      if (typeof raw.seed !== 'string' || !/^[a-z0-9]{1,16}$/.test(raw.seed)) return null;
      if (typeof raw.format !== 'string' || !Object.prototype.hasOwnProperty.call(DUEL_FORMATS, raw.format)) return null;
      return { t: 'setup', seed: raw.seed, format: raw.format as DuelFormat };
    }
    case 'go': {
      const startAt = int(raw.startAt, 0, 30_000);
      return startAt === null ? null : { t: 'go', startAt };
    }
    case 'progress': {
      const i = int(raw.i, 0, 31);
      const ms = int(raw.ms, 0, 3_600_000);
      if (i === null || ms === null || typeof raw.solved !== 'boolean') return null;
      return { t: 'progress', i, solved: raw.solved, ms };
    }
    case 'ready':
    case 'done':
    case 'rematch':
    case 'bye':
      return { t: raw.t };
    default:
      return null;
  }
}

/** Parse and validate a raw wire string. */
export function parseWire(text: unknown): DuelMessage | null {
  if (typeof text !== 'string' || text.length > WIRE_MAX) return null;
  try {
    return validateMessage(JSON.parse(text));
  } catch {
    return null;
  }
}

export const toWire = (m: DuelMessage): string => JSON.stringify(m);
