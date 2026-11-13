/**
 * Seeded deterministic PRNG for the Arena generator.
 *
 * A string seed is hashed with xmur3 into four 32-bit words that seed sfc32 (Chris Doty-Humphrey's
 * small fast counter generator). Both use only 32-bit integer arithmetic (`Math.imul`, `>>>`), so
 * every JavaScript engine produces the same stream. `fork(label)` derives a child stream from the
 * parent's *seed path* and the label only, so a child does not depend on how many numbers the
 * parent has drawn: adding a draw in one place never shifts another stream.
 */
import type { Rng } from '../types.ts';

/** xmur3 string hash: returns a generator of 32-bit seeds. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** sfc32: returns uniform 32-bit unsigned integers. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
}

/** A deterministic stream for the given seed path. */
export function makeRng(path: string): Rng {
  const h = xmur3(path);
  const raw = sfc32(h(), h(), h(), h());
  // Warm up: the first outputs of sfc32 are weakly mixed.
  for (let i = 0; i < 12; i++) raw();
  const next = () => raw() / 4294967296;
  const int = (n: number) => (n <= 1 ? 0 : Math.floor(next() * n));
  return {
    next,
    int,
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new Error('rng.pick: empty list');
      return xs[int(xs.length)];
    },
    shuffle<T>(xs: readonly T[]): T[] {
      const out = xs.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const t = out[i];
        out[i] = out[j];
        out[j] = t;
      }
      return out;
    },
    fork(label: string): Rng {
      return makeRng(path + '\u0000' + label);
    },
  };
}

/** Pick by integer weights. */
export function weighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let r = rng.next() * total;
  for (const [x, w] of items) {
    if ((r -= w) < 0) return x;
  }
  return items[items.length - 1][0];
}
