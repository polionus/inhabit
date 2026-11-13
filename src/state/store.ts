/** Zustand store: persisted SaveData + a few ephemeral UI fields. */
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  addDay,
  bumpDay,
  bumpStat,
  logFor,
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
import { settleQuests } from './meta.ts';
import { exportSections, importSections, resetSections } from './sections.ts';

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
  /** Remember that something was seen (screen intro, primer, article). Idempotent. */
  markSeen(key: string): void;
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

    /** Settle quests (XP once each), then badges, then commit with all toasts. Returns quest XP. */
    const settle = (save: SaveData, toasts: string[] = []): number => {
      const q = settleQuests(save, deps.worlds(), now());
      const b = withBadges(q.save, deps.worlds(), now());
      commit(b.save, [...toasts, ...q.toasts, ...badgeToasts(b.earned)]);
      return q.xp;
    };

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
        settle(r.save, toasts);
        return { xp: r.xp, firstPass: r.firstPass };
      },
      rateLevel(id, r) {
        commit(applyRating(get().save, id, r));
      },
      reviewResult(id, passed) {
        const r = applyReview(get().save, deps.worlds(), id, passed, now());
        settle(r.save, badgeToasts(r.earned));
      },
      recordEvent(e) {
        const t = now();
        let s = get().save;
        let xp = 0;
        const firstSeen = (key: string): boolean => {
          if (s.seen[key]) return false;
          s = { ...s, seen: { ...s.seen, [key]: t } };
          return true;
        };
        switch (e.type) {
          case 'arena-puzzle':
            if (e.solved) {
              xp = Math.round(Math.max(4, Math.min(10, 4 + (e.puzzleRating - 800) / 200)));
              s = bumpStat(s, 'puzzles');
              if (e.rated) {
                s = bumpStat(s, 'ratedSolved');
                s = bumpDay(s, t, 'puzzles');
              }
            }
            break;
          case 'arena-daily':
            if (firstSeen(`daily:${e.dateKey}`)) {
              xp = 15 + 5 * Math.max(0, e.solved);
              s = bumpStat(s, 'daily');
              s = bumpDay(s, t, 'daily');
            }
            break;
          case 'arena-rush':
            xp = Math.max(0, Math.min(20, Math.floor(e.score)));
            s = bumpStat(s, 'rushBest', e.score, true);
            s = bumpDay(s, t, 'rushBest', e.score, true);
            break;
          case 'arena-duel':
            xp = e.won ? 15 : 5;
            if (e.won) {
              s = bumpStat(s, 'duelWins');
              s = bumpDay(s, t, 'duelWins');
            }
            break;
          case 'guide-read':
            if (firstSeen(`guide:${e.articleId}`)) {
              xp = 10;
              s = bumpStat(s, 'guide');
            }
            s = bumpDay(s, t, 'guide');
            break;
          case 'primer-read':
            if (firstSeen(`primer:${e.worldId}`)) {
              xp = 10;
              s = bumpStat(s, 'primers');
            }
            break;
        }
        s = { ...s, xp: s.xp + xp, activeDays: addDay(s.activeDays, t), today: logFor(s, t) };
        settle(s);
        return { xp };
      },
      markSeen(key) {
        const s = get().save;
        if (s.seen[key]) return;
        commit({ ...s, seen: { ...s.seen, [key]: now() } });
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
        return JSON.stringify({ app: 'inhabit', ...get().save, sections: exportSections() }, null, 2);
      },
      importJson(text) {
        try {
          const raw = JSON.parse(text);
          if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || !('levels' in raw)) {
            return { ok: false, error: 'This does not look like an Inhabit save file.' };
          }
          commit(migrate(raw));
          importSections((raw as Record<string, unknown>).sections);
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
        resetSections();
        set({ save: defaultSave(), toasts: [] });
      },
      dismissToast(id) {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },
    };
  });
}
