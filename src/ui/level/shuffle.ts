import { useRef } from 'react';

/** Fisher-Yates over 0..n-1. `rng` returns a float in [0, 1). */
export function shuffledOrder(n: number, rng: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A display order chosen once per mount (and again if the level changes). */
export function useShuffledOrder(key: string, n: number): number[] {
  const ref = useRef<{ key: string; n: number; order: number[] } | null>(null);
  if (!ref.current || ref.current.key !== key || ref.current.n !== n) {
    ref.current = { key, n, order: shuffledOrder(n) };
  }
  return ref.current.order;
}
