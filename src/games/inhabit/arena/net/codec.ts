/**
 * Link codecs: challenge links and proof cards. A code is `<kind><version>` + base64url of
 * UTF-8 JSON with short keys (and a tiny dictionary for common Lean words). Decoding is tolerant:
 * it returns null on anything malformed or oversized and never throws. Runs under Node.
 */
import { generator } from '../gen/index.ts';
import { DUEL_FORMATS, type DuelFormat } from '../plan.ts';

export const NAME_MAX = 20;
export const SOURCE_MAX = 4000;
export const CODE_MAX = 16_000;
const SEED_MAX = 64;
const TITLE_MAX = 120;
const ENGLISH_MAX = 600;
const REF_MAX = 80;
const MAX_RESULTS = 12;
const MAX_MS = 3_600_000;

/* ---------------- base64url ---------------- */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX: Record<string, number> = Object.fromEntries([...B64].map((c, i) => [c, i]));

export function b64urlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function b64urlDecode(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = B64_INDEX[s[i]];
    const b = B64_INDEX[s[i + 1]];
    const c = i + 2 < s.length ? B64_INDEX[s[i + 2]] : 0;
    const d = i + 3 < s.length ? B64_INDEX[s[i + 3]] : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (n >> 16) & 255;
    if (i + 2 < s.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < s.length) out[o++] = n & 255;
  }
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

function pack(kind: string, version: number, value: unknown): string {
  return `${kind}${version}${b64urlEncode(enc.encode(JSON.stringify(value)))}`;
}

function unpack(code: string, kind: string, version: number): unknown {
  try {
    if (typeof code !== 'string' || code.length > CODE_MAX) return null;
    const prefix = `${kind}${version}`;
    if (!code.startsWith(prefix)) return null;
    const bytes = b64urlDecode(code.slice(prefix.length));
    if (!bytes) return null;
    return JSON.parse(dec.decode(bytes));
  } catch {
    return null;
  }
}

/* ---------------- small helpers ---------------- */

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
// Control characters and the private-use area (used by the dictionary) never appear in text we accept.
const PLAIN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ue000-\uf8ff]/g;

const HAS_JUNK = new RegExp(PLAIN.source);

/** Plain text, at most `max` characters, no control characters. */
export function plainText(x: unknown, max: number): string {
  return typeof x === 'string' ? x.replace(PLAIN, '').slice(0, max) : '';
}
export const cleanName = (x: unknown): string => plainText(x, NAME_MAX).replace(/\s+/g, ' ').trim();

const FORMAT_LIST = Object.keys(DUEL_FORMATS) as DuelFormat[];

/* ---------------- challenge ---------------- */

export interface ChallengeResult {
  solved: boolean;
  ms: number;
}

export interface Challenge {
  v: 1;
  gen: number;
  seed: string;
  format: DuelFormat;
  from: string;
  results: ChallengeResult[];
  at: number;
  /** Present on a reply: the original challenger's name and results, so both are in one link. */
  vs?: { from: string; results: ChallengeResult[] };
}

const packResults = (rs: ChallengeResult[]): string => rs.map((r) => `${r.solved ? 1 : 0}${Math.round(r.ms)}`).join(',');

function unpackResults(x: unknown, n: number): ChallengeResult[] | null {
  if (typeof x !== 'string') return null;
  if (x === '') return [];
  const parts = x.split(',');
  if (parts.length > MAX_RESULTS || parts.length > n) return null;
  const out: ChallengeResult[] = [];
  for (const p of parts) {
    const m = /^([01])(\d{1,7})$/.exec(p);
    if (!m) return null;
    const ms = Number(m[2]);
    if (ms > MAX_MS) return null;
    out.push({ solved: m[1] === '1', ms });
  }
  return out;
}

export function encodeChallenge(c: Challenge): string {
  const body: unknown[] = [c.gen, c.seed.slice(0, SEED_MAX), FORMAT_LIST.indexOf(c.format), cleanName(c.from), packResults(c.results), Math.round(c.at / 1000)];
  if (c.vs) body.push(cleanName(c.vs.from), packResults(c.vs.results));
  return pack('c', 1, body);
}

export function decodeChallenge(code: string): Challenge | null {
  const a = unpack(code, 'c', 1);
  if (!Array.isArray(a) || (a.length !== 6 && a.length !== 8)) return null;
  const [gen, seed, fi, from, res, at] = a;
  if (typeof gen !== 'number' || !Number.isInteger(gen) || gen < 0 || gen > 1e6) return null;
  if (typeof seed !== 'string' || seed.length === 0 || seed.length > SEED_MAX || HAS_JUNK.test(seed)) return null;
  const format = typeof fi === 'number' ? FORMAT_LIST[fi] : undefined;
  if (!format) return null;
  const n = DUEL_FORMATS[format].slots.length;
  const results = unpackResults(res, n);
  if (!results || results.length !== n) return null;
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at > 1e10) return null;
  const out: Challenge = { v: 1, gen, seed, format, from: cleanName(from) || 'Someone', results, at: at * 1000 };
  if (a.length === 8) {
    const vsRes = unpackResults(a[7], n);
    if (!vsRes || vsRes.length !== n) return null;
    out.vs = { from: cleanName(a[6]) || 'Someone', results: vsRes };
  }
  return out;
}

/** `null` when the link was made by a different version of the generator (the sets differ). */
export const challengeIsCurrent = (c: Challenge): boolean => c.gen === generator.version;

export const challengeHash = (c: Challenge): string => `#/arena/challenge/${encodeChallenge(c)}`;

/* ---------------- proof card ---------------- */

export type ProofKind = 'level' | 'workshop' | 'sandbox' | 'arena';

export interface ProofCard {
  v: 1;
  title: string;
  english?: string;
  /** The full Lean source: optional definitions, the theorem and its proof. */
  source: string;
  by?: string;
  kind: ProofKind;
  ref?: string;
}

const KINDS: ProofKind[] = ['level', 'workshop', 'sandbox', 'arena'];

// A tiny dictionary: common Lean words become single private-use characters before packing.
const DICT = ['theorem ', ' := by\n  ', 'intro ', 'exact ', 'constructor', 'apply ', 'cases ', 'rcases ', 'Nat.', '(P Q R : Prop)', ' : Prop', '\n  '];
const DICT_BASE = 0xe000;
const squeeze = (s: string): string => DICT.reduce((t, w, i) => t.split(w).join(String.fromCharCode(DICT_BASE + i)), s);
const expand = (s: string): string => s.replace(/[\ue000-\ue0ff]/g, (c) => DICT[c.charCodeAt(0) - DICT_BASE] ?? '');

export type EncodeProofResult = { ok: true; code: string } | { ok: false; reason: 'too-long' | 'empty'; message: string };

export function encodeProof(card: Omit<ProofCard, 'v'>): EncodeProofResult {
  const source = plainText(card.source, 1_000_000).replace(/\r\n?/g, '\n');
  if (!source.trim()) return { ok: false, reason: 'empty', message: 'There is nothing to share yet.' };
  if (source.length > SOURCE_MAX) {
    return { ok: false, reason: 'too-long', message: `This source is ${source.length.toLocaleString('en')} characters; a shared proof is limited to ${SOURCE_MAX.toLocaleString('en')}, because it all travels inside the link.` };
  }
  const body: Record<string, unknown> = { t: plainText(card.title, TITLE_MAX), s: squeeze(source), k: KINDS.indexOf(card.kind) };
  if (card.english) body.e = plainText(card.english, ENGLISH_MAX);
  if (card.by) body.b = cleanName(card.by);
  if (card.ref) body.r = plainText(card.ref, REF_MAX);
  return { ok: true, code: pack('p', 1, body) };
}

export function decodeProof(code: string): ProofCard | null {
  const o = unpack(code, 'p', 1);
  if (!isObj(o)) return null;
  const k = typeof o.k === 'number' ? KINDS[o.k] : undefined;
  if (!k || typeof o.s !== 'string' || typeof o.t !== 'string') return null;
  // The dictionary characters are expanded first; whatever remains is plain-checked.
  const source = plainText(expand(o.s.slice(0, SOURCE_MAX * 2)), SOURCE_MAX);
  if (!source.trim()) return null;
  const card: ProofCard = { v: 1, title: plainText(o.t, TITLE_MAX).trim() || 'A proof', source, kind: k };
  if (typeof o.e === 'string' && o.e) card.english = plainText(o.e, ENGLISH_MAX);
  const by = cleanName(o.b);
  if (by) card.by = by;
  if (typeof o.r === 'string' && o.r) card.ref = plainText(o.r, REF_MAX);
  return card;
}

export const proofHash = (code: string): string => `#/share/${code}`;

/** Absolute URL of a hash route on this site (for copying and sharing). */
export function absoluteLink(hash: string): string {
  if (typeof window === 'undefined') return hash;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${hash}`;
}
