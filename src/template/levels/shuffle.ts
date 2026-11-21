import { useRef } from 'react';

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates over 0..n-1. `rng` returns a float in [0, 1). */
export function shuffledOrder(n: number, rng: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle items, deterministically when `seed` is provided. */
export function shuffleItems<T>(items: readonly T[], seed?: string): T[] {
  const rng = seed !== undefined ? mulberry32(hashSeed(seed)) : Math.random;
  return shuffledOrder(items.length, rng).map((i) => items[i]);
}

/** A display order chosen once per mount (and again if the level changes). */
export function useShuffledOrder(key: string, n: number): number[] {
  const ref = useRef<{ key: string; n: number; order: number[] } | null>(null);
  if (!ref.current || ref.current.key !== key || ref.current.n !== n) {
    ref.current = { key, n, order: shuffledOrder(n) };
  }
  return ref.current.order;
}
