import { useStore } from 'zustand';
import { createGameStore, type GameState } from '../state/store.ts';
import { data } from './data.ts';

function safeStorage() {
  try {
    const s = window.localStorage;
    s.getItem('inhabit.probe');
    return s;
  } catch {
    return null;
  }
}

export const store = createGameStore({ worlds: () => data.worlds, storage: safeStorage(), key: data.storageKey });

export function useGame<T>(sel: (s: GameState) => T): T {
  return useStore(store, sel);
}
export const game = () => store.getState();
