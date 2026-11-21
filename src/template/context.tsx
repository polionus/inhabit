import { createContext, useContext } from 'react';
import type { GameDisc } from './types.ts';

let activeDisc: GameDisc | null = null;
const DiscContext = createContext<GameDisc | null>(null);

export const DiscProvider = DiscContext.Provider;

export function initDisc(disc: GameDisc): void {
  activeDisc = disc;
}

export function getDisc(): GameDisc {
  if (!activeDisc) {
    throw new Error('GameDisc has not been initialized. Mount <GameApp disc={...} /> or call initDisc(disc).');
  }
  return activeDisc;
}

export function tryGetDisc(): GameDisc | null {
  return activeDisc;
}

export function useDisc(): GameDisc {
  const fromCtx = useContext(DiscContext);
  return fromCtx ?? getDisc();
}
