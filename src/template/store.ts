import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { createGameStore, type GameState } from './state/store.ts';
import type { GameDisc } from './types.ts';

function safeStorage(probeKey: string) {
  try {
    const s = window.localStorage;
    s.getItem(probeKey);
    return s;
  } catch {
    return null;
  }
}

let activeStore: StoreApi<GameState> | null = null;
let activeStoreKey: string | null = null;

export function buildBaseXp(disc: GameDisc): Record<string, number> {
  const out: Record<string, number> = {};
  if (disc.levelKinds) {
    for (const [k, def] of Object.entries(disc.levelKinds)) {
      if (def.baseXp !== undefined) out[k] = def.baseXp;
    }
  }
  return out;
}

export function initStore(disc: GameDisc): StoreApi<GameState> {
  const key = disc.brand.storageKey ?? `${disc.brand.id}.save`;
  if (activeStore && activeStoreKey === key) return activeStore;
  activeStoreKey = key;
  activeStore = createGameStore({
    worlds: () => disc.worlds,
    storage: typeof window !== 'undefined' ? safeStorage(`${disc.brand.id}.probe`) : null,
    key,
    appId: disc.brand.saveAppId ?? disc.brand.id,
    appName: disc.brand.name,
    badges: disc.progression?.badges,
    questOptions: disc.progression?.questOptions,
    baseXp: buildBaseXp(disc),
    defaultSandbox: disc.hooks?.defaultSandbox ?? '',
  });
  return activeStore;
}

export function getStore(): StoreApi<GameState> {
  if (!activeStore) {
    throw new Error('Game store has not been initialized.');
  }
  return activeStore;
}

export function useGame<T>(sel: (s: GameState) => T): T {
  return useStore(getStore(), sel);
}

export const game = (): GameState => getStore().getState();
