/**
 * Pure progress / unlocking logic. No React, no engine, no storage.
 * Works on minimal structural views of worlds so it can be tested with tiny fixtures.
 */
export type Status = 'unseen' | 'solved' | 'studied';
export type Rating = 'easy' | 'right' | 'hard';

export interface LevelProgress {
  status: Status;
  hintsUsed: number;
  attempts: number;
  /** Best (most recent passing) solution text for body levels. */
  best?: string;
  /** Solved with no hints and without revealing the solution. */
  clean?: boolean;
  /** Passed by beating the world's boss rather than playing this level. */
  testedOut?: boolean;
  /** Formalize level passed by the learner's own judgement. */
  selfAssessed?: boolean;
  rating?: Rating;
  firstPassAt?: number;
}

export type Progress = Record<string, LevelProgress>;

export interface LevelLike {
  id: string;
  kind: string;
  mode?: string;
  boss?: boolean;
  optional?: boolean;
}
export interface WorldLike {
  id: string;
  requires: string[];
  levels: LevelLike[];
}

export const emptyProgress = (): LevelProgress => ({ status: 'unseen', hintsUsed: 0, attempts: 0 });

export const isPassed = (p: LevelProgress | undefined): boolean =>
  p?.status === 'solved' || p?.status === 'studied';

export const requiredLevels = (w: WorldLike): LevelLike[] => w.levels.filter((l) => !l.optional);

export const worldIsEmpty = (w: WorldLike): boolean => w.levels.length === 0;

/**
 * A world is complete when all its required levels are passed. A world with no levels at all is
 * treated as passable (so unfinished content never dead-ends the map); badges ignore such worlds.
 */
export function worldComplete(w: WorldLike, progress: Progress): boolean {
  return requiredLevels(w).every((l) => isPassed(progress[l.id]));
}

export function worldProgress(w: WorldLike, progress: Progress): { done: number; total: number } {
  const req = requiredLevels(w);
  return { done: req.filter((l) => isPassed(progress[l.id])).length, total: req.length };
}

export function worldUnlocked(w: WorldLike, all: WorldLike[], progress: Progress): boolean {
  return w.requires.every((id) => {
    const r = all.find((x) => x.id === id);
    return !r || worldComplete(r, progress);
  });
}

export type LevelState = 'done' | 'open' | 'locked';

/** Levels unlock sequentially: every earlier required level must be passed. Optional levels never gate. */
export function levelState(w: WorldLike, index: number, all: WorldLike[], progress: Progress): LevelState {
  const l = w.levels[index];
  if (!l) return 'locked';
  if (isPassed(progress[l.id])) return 'done';
  if (!worldUnlocked(w, all, progress)) return 'locked';
  for (let i = 0; i < index; i++) {
    const e = w.levels[i];
    if (!e.optional && !isPassed(progress[e.id])) return 'locked';
  }
  return 'open';
}

export function bossIndex(w: WorldLike): number {
  for (let i = w.levels.length - 1; i >= 0; i--) if (w.levels[i].boss) return i;
  return -1;
}

/** The boss can be attempted any time once the world itself is reachable. */
export function canTestOut(w: WorldLike, all: WorldLike[], progress: Progress): boolean {
  const b = bossIndex(w);
  return b >= 0 && worldUnlocked(w, all, progress) && !isPassed(progress[w.levels[b].id]);
}

/** A level can be opened if open/done, or if it is the boss of a reachable world. */
export function levelPlayable(w: WorldLike, index: number, all: WorldLike[], progress: Progress): boolean {
  const s = levelState(w, index, all, progress);
  if (s !== 'locked') return true;
  return index === bossIndex(w) && worldUnlocked(w, all, progress);
}

/** Mark every required level of `w` that is not yet passed as solved-by-test-out. */
export function applyTestOut(w: WorldLike, progress: Progress, now: number): Progress {
  const next: Progress = { ...progress };
  for (const l of requiredLevels(w)) {
    if (!isPassed(next[l.id])) {
      next[l.id] = { ...(next[l.id] ?? emptyProgress()), status: 'solved', testedOut: true, firstPassAt: now };
    }
  }
  return next;
}

export interface NextTarget {
  kind: 'level' | 'world-complete' | 'none';
  levelId?: string;
}

/** Where "Next" goes from level `index` of `w`. */
export function nextAfter(w: WorldLike, index: number, all: WorldLike[], progress: Progress): NextTarget {
  for (let i = index + 1; i < w.levels.length; i++) {
    if (levelState(w, i, all, progress) === 'open') return { kind: 'level', levelId: w.levels[i].id };
  }
  // anything earlier still open (e.g. skipped optional)? prefer finishing required ones
  for (let i = 0; i < w.levels.length; i++) {
    if (!w.levels[i].optional && levelState(w, i, all, progress) === 'open') {
      return { kind: 'level', levelId: w.levels[i].id };
    }
  }
  return worldComplete(w, progress) ? { kind: 'world-complete' } : { kind: 'none' };
}

/** First open, not-yet-passed required level across the whole map ("continue"). */
export function continueLevel(all: WorldLike[], progress: Progress): string | null {
  for (const w of all) {
    if (!worldUnlocked(w, all, progress)) continue;
    for (let i = 0; i < w.levels.length; i++) {
      if (!w.levels[i].optional && levelState(w, i, all, progress) === 'open') return w.levels[i].id;
    }
  }
  return null;
}

/** Layered layout for the map: layer = longest path from a root; order within a layer by parents' mean slot. */
export function layoutWorlds(all: WorldLike[]): { id: string; layer: number; slot: number; slots: number }[] {
  const layer = new Map<string, number>();
  const byId = new Map(all.map((w) => [w.id, w]));
  const depth = (id: string, seen: string[] = []): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (seen.includes(id)) return 0;
    const w = byId.get(id);
    const d = !w || w.requires.length === 0 ? 0 : 1 + Math.max(...w.requires.map((r) => depth(r, [...seen, id])));
    layer.set(id, d);
    return d;
  };
  all.forEach((w) => depth(w.id));
  const maxLayer = Math.max(0, ...layer.values());
  const slotOf = new Map<string, number>();
  const out: { id: string; layer: number; slot: number; slots: number }[] = [];
  for (let L = 0; L <= maxLayer; L++) {
    const ids = all.filter((w) => layer.get(w.id) === L).map((w) => w.id);
    const key = (id: string) => {
      const rs = byId.get(id)!.requires.map((r) => slotOf.get(r)).filter((x): x is number => x !== undefined);
      return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
    };
    ids.sort((a, b) => key(a) - key(b));
    // spread: slot positions are fractional columns in [0,1]
    ids.forEach((id, i) => {
      const frac = (i + 0.5) / ids.length;
      slotOf.set(id, frac);
      out.push({ id, layer: L, slot: i, slots: ids.length });
    });
  }
  return out;
}
