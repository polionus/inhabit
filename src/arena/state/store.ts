/**
 * The Arena store: its own localStorage key (`inhabit.arena`), included in the save export through
 * `registerSaveSection`. Pure TS: storage and randomness are injected; the singleton binds them lazily.
 */
import { createStore, useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { registerSaveSection } from '../../state/sections.ts';
import type { GameEvent } from '../../state/events.ts';
import type { Puzzle, PuzzleFamily } from '../types.ts';
import type { RatedOutcome } from './rating.ts';
import {
  applyDailyMark,
  applyRated,
  applyRush,
  chooseRated,
  defaultState,
  markOf,
  migrate,
  startDaily,
  type ArenaState,
  type DailyResult,
  type PuzzleProgress,
  type RatedCurrent,
  type RatedResult,
  type RushMode,
} from './model.ts';

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const ARENA_KEY = 'inhabit.arena';

export interface ArenaActions {
  setDisplayName(name: string): void;
  setFilter(f: PuzzleFamily[]): void;
  /** The duel code's slice; opaque to the Arena. */
  setDuelState(next: unknown): void;
  /** Current rated puzzle position, created if there is none. */
  ensureRated(): RatedCurrent;
  saveRatedProgress(p: PuzzleProgress): void;
  /** Finish the current rated puzzle. Reports an `arena-puzzle` event. */
  finishRated(puzzle: Puzzle, o: RatedOutcome): RatedResult;
  startDaily(dateKey: string): DailyResult;
  saveDailyProgress(dateKey: string, p: PuzzleProgress): void;
  /** Record daily puzzle `index`. Reports `arena-daily` once, when the set completes. */
  finishDaily(dateKey: string, index: number, o: { solved: boolean; hintsUsed: number; revealed: boolean; skipped: boolean; ms: number }): void;
  /** Record a Rush run. Reports `arena-rush`. */
  finishRush(mode: RushMode, score: number): { best: boolean; previous: number };
}

export type ArenaStore = ArenaState & ArenaActions;

export interface ArenaDeps {
  storage?: StorageLike | null;
  key?: string;
  now?: () => number;
  /** Random base-36 string source for the per-player salt. */
  random?: () => number;
  onEvent?: (e: GameEvent) => void;
}

const dataOf = (s: ArenaStore): ArenaState => {
  const { setDisplayName, setFilter, setDuelState, ensureRated, saveRatedProgress, finishRated, startDaily, saveDailyProgress, finishDaily, finishRush, ...d } = s;
  void setDisplayName; void setFilter; void setDuelState; void ensureRated; void saveRatedProgress; void finishRated; void startDaily; void saveDailyProgress; void finishDaily; void finishRush;
  return d;
};

export function createArenaStore(deps: ArenaDeps = {}): StoreApi<ArenaStore> {
  const key = deps.key ?? ARENA_KEY;
  const now = deps.now ?? (() => Date.now());
  const rand = deps.random ?? Math.random;
  const newSalt = () => Array.from({ length: 3 }, () => Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0')).join('');
  const emit = (e: GameEvent) => {
    try {
      deps.onEvent?.(e);
    } catch {
      // reporting must never break play
    }
  };

  let initial: ArenaState;
  let hadSaved = false;
  try {
    const raw = deps.storage?.getItem(key);
    hadSaved = !!raw;
    initial = raw ? migrate(JSON.parse(raw), newSalt) : defaultState(newSalt());
  } catch {
    initial = defaultState(newSalt());
  }

  return createStore<ArenaStore>()((set, get) => {
    const persist = (d: ArenaState) => {
      try {
        deps.storage?.setItem(key, JSON.stringify(d));
      } catch {
        // storage full or blocked: play continues in memory
      }
    };
    const commit = (patch: Partial<ArenaState>) => {
      set(patch);
      persist(dataOf(get()));
    };
    const commitState = (d: ArenaState) => commit(d);

    // The salt is created once and stored right away.
    if (!hadSaved) persist(initial);

    return {
      ...initial,
      setDisplayName: (name) => commit({ displayName: name.slice(0, 20) }),
      setFilter: (f) => {
        const next = f.length ? f : get().filter;
        // Changing the filter changes how the *next* position is drawn; the current one stays.
        commit({ filter: next });
      },
      setDuelState: (next) => commit({ duel: next }),
      ensureRated() {
        const s = get();
        if (s.current) return s.current;
        const current = chooseRated(s);
        commit({ current });
        return current;
      },
      saveRatedProgress(p) {
        const c = get().current;
        if (c) commit({ current: { ...c, progress: p } });
      },
      finishRated(puzzle, o) {
        const { state, result } = applyRated(dataOf(get()), puzzle, o, now());
        commitState(state);
        emit({ type: 'arena-puzzle', solved: o.solved && !o.skipped && !o.revealed, rated: true, puzzleRating: puzzle.rating });
        return result;
      },
      startDaily(dateKey) {
        commitState(startDaily(dataOf(get()), dateKey, now()));
        return get().daily[dateKey];
      },
      saveDailyProgress(dateKey, p) {
        const r = get().daily[dateKey];
        if (!r || r.completed) return;
        commit({ daily: { ...get().daily, [dateKey]: { ...r, progress: p } } });
      },
      finishDaily(dateKey, index, o) {
        const { state, completedNow } = applyDailyMark(dataOf(get()), dateKey, index, markOf(o), now());
        commitState(state);
        if (completedNow) {
          const r = state.daily[dateKey];
          emit({ type: 'arena-daily', solved: r.marks.filter((m) => m.state !== 'failed').length, total: 3, dateKey });
        }
      },
      finishRush(mode, score) {
        const { state, best, previous } = applyRush(dataOf(get()), mode, score, now());
        commitState(state);
        emit({ type: 'arena-rush', score, best });
        return { best, previous };
      },
    };
  });
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    localStorage.getItem('inhabit.probe');
    return localStorage;
  } catch {
    return null;
  }
}

let sink: ((e: GameEvent) => void) | null = null;
/** The UI layer connects the Arena to the game store's event stream (kept out of this pure module). */
export function setArenaEventSink(f: ((e: GameEvent) => void) | null): void {
  sink = f;
}

export const arenaStore = createArenaStore({ storage: browserStorage(), onEvent: (e) => sink?.(e) });

export function useArena<T>(selector: (s: ArenaStore) => T): T {
  return useStore(arenaStore, selector);
}

/** Save-file section: the Arena's data rides along with the game's export. */
export function sectionFor(store: StoreApi<ArenaStore>, newSalt: () => string = () => Math.random().toString(36).slice(2, 12)) {
  return {
    export: (): unknown => dataOf(store.getState()),
    import(raw: unknown) {
      const next = migrate(raw, newSalt);
      store.setState(next);
      try {
        // persist through a no-op action so storage stays in sync
        store.getState().setDuelState(next.duel);
      } catch {
        // ignore
      }
    },
    reset() {
      const next = defaultState(newSalt());
      store.setState(next);
      store.getState().setDuelState(null);
    },
  };
}

registerSaveSection('arena', sectionFor(arenaStore));
