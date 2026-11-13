/** Zustand store: persisted SaveData + a few ephemeral UI fields. */
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  addDay,
  applyCompletion,
  applyRating,
  applyReview,
  defaultSave,
  emptyWorkshop,
  migrate,
  withBadges,
  type Completion,
  type SaveData,
  type SavedTheorem,
  type Settings,
  type WorkshopDraft,
  BADGES,
} from './game.ts';
import { emptyProgress, type Rating, type WorldLike } from './progress.ts';
import type { EventResult, GameEvent } from './events.ts';

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface Toast {
  id: number;
  text: string;
}

export interface GameState {
  save: SaveData;
  toasts: Toast[];
  /** Set when storage failed, so the UI can say progress is not being saved. */
  storageError: boolean;

  touch(): void;
  visitLevel(id: string): void;
  recordHints(id: string, n: number): void;
  recordAttempt(id: string): void;
  completeLevel(id: string, c: Completion): { xp: number; firstPass: boolean };
  rateLevel(id: string, r: Rating): void;
  reviewResult(id: string, passed: boolean): void;
  /** Report something that happened outside the level flow (Arena, Guide). See events.ts. */
  recordEvent(e: GameEvent): EventResult;
  setDraft(id: string, text: string): void;
  welcome(): void;
  setSettings(s: Partial<Settings>): void;
  saveTheorem(t: Omit<SavedTheorem, 'id' | 'createdAt'>): void;
  deleteTheorem(id: string): void;
  setWorkshop(w: Partial<WorkshopDraft>): void;
  resetWorkshop(): void;
  setSandbox(text: string): void;
  exportJson(): string;
  importJson(text: string): { ok: boolean; error?: string };
  resetAll(): void;
  dismissToast(id: number): void;
}

export interface StoreDeps {
  worlds: () => WorldLike[];
  storage?: StorageLike | null;
  key: string;
  now?: () => number;
}

export function loadSave(storage: StorageLike | null | undefined, key: string): SaveData {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return defaultSave();
    return migrate(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function createGameStore(deps: StoreDeps): StoreApi<GameState> {
  const now = deps.now ?? (() => Date.now());
  let toastId = 1;

  return createStore<GameState>((set, get) => {
    const commit = (save: SaveData, toasts: string[] = []) => {
      let storageError = false;
      try {
        deps.storage?.setItem(deps.key, JSON.stringify(save));
      } catch {
        storageError = true;
      }
      set((s) => ({
        save,
        storageError,
        toasts: [...s.toasts, ...toasts.map((text) => ({ id: toastId++, text }))],
      }));
    };
    const badgeToasts = (ids: string[]) =>
      ids.map((id) => `Badge: ${BADGES.find((b) => b.id === id)?.title ?? id}`);

    return {
      save: loadSave(deps.storage, deps.key),
      toasts: [],
      storageError: false,

      touch() {
        const s = get().save;
        const days = addDay(s.activeDays, now());
        if (days !== s.activeDays) {
          const b = withBadges({ ...s, activeDays: days }, deps.worlds(), now());
          commit(b.save, badgeToasts(b.earned));
        }
      },
      visitLevel(id) {
        const s = get().save;
        if (s.levels[id]) return;
        commit({ ...s, levels: { ...s.levels, [id]: emptyProgress() } });
      },
      recordHints(id, n) {
        const s = get().save;
        const p = s.levels[id] ?? emptyProgress();
        if (n <= p.hintsUsed) return;
        commit({ ...s, levels: { ...s.levels, [id]: { ...p, hintsUsed: n } } });
      },
      recordAttempt(id) {
        const s = get().save;
        const p = s.levels[id] ?? emptyProgress();
        commit({ ...s, levels: { ...s.levels, [id]: { ...p, attempts: p.attempts + 1 } } });
      },
      completeLevel(id, c) {
        const r = applyCompletion(get().save, deps.worlds(), id, c, now());
        const toasts = badgeToasts(r.earned);
        if (r.testedOutWorld) toasts.unshift('Tested out. The rest of the world counts as passed.');
        commit(r.save, toasts);
        return { xp: r.xp, firstPass: r.firstPass };
      },
      rateLevel(id, r) {
        commit(applyRating(get().save, id, r));
      },
      reviewResult(id, passed) {
        const r = applyReview(get().save, deps.worlds(), id, passed, now());
        commit(r.save, badgeToasts(r.earned));
      },
      recordEvent(_e) {
        // Stub: the core-game agent turns events into XP, quests and badges.
        const s = get().save;
        const days = addDay(s.activeDays, now());
        if (days !== s.activeDays) commit({ ...s, activeDays: days });
        return { xp: 0 };
      },
      setDraft(id, text) {
        const s = get().save;
        if (s.drafts[id] === text) return;
        commit({ ...s, drafts: { ...s.drafts, [id]: text } });
      },
      welcome() {
        commit({ ...get().save, welcomed: true });
      },
      setSettings(p) {
        const s = get().save;
        commit({ ...s, settings: { ...s.settings, ...p } });
      },
      saveTheorem(t) {
        const s = get().save;
        const theorem: SavedTheorem = { ...t, id: `t${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: now() };
        const b = withBadges({ ...s, theorems: [theorem, ...s.theorems], xp: s.xp + (t.complete ? 50 : 0) }, deps.worlds(), now());
        commit(b.save, badgeToasts(b.earned));
      },
      deleteTheorem(id) {
        const s = get().save;
        commit({ ...s, theorems: s.theorems.filter((t) => t.id !== id) });
      },
      setWorkshop(w) {
        const s = get().save;
        commit({ ...s, workshop: { ...s.workshop, ...w } });
      },
      resetWorkshop() {
        commit({ ...get().save, workshop: emptyWorkshop() });
      },
      setSandbox(text) {
        const s = get().save;
        if (s.sandbox === text) return;
        commit({ ...s, sandbox: text });
      },
      exportJson() {
        return JSON.stringify({ app: 'inhabit', ...get().save }, null, 2);
      },
      importJson(text) {
        try {
          const raw = JSON.parse(text);
          if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || !('levels' in raw)) {
            return { ok: false, error: 'This does not look like an Inhabit save file.' };
          }
          commit(migrate(raw));
          return { ok: true };
        } catch {
          return { ok: false, error: 'Could not read that file as JSON.' };
        }
      },
      resetAll() {
        try {
          deps.storage?.removeItem(deps.key);
        } catch {
          /* ignore */
        }
        set({ save: defaultSave(), toasts: [] });
      },
      dismissToast(id) {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },
    };
  });
}
