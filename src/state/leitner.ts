/** Leitner spaced-repetition scheduling (SPEC §5.4). Pure. */
import type { Rating } from './progress.ts';

export const DAY = 86_400_000;
/** Days until next review, by box 1..5. */
export const INTERVALS = [1, 3, 7, 16, 35] as const;
export const MAX_BOX = 5;

export interface DeckItem {
  box: number;
  due: number;
  last: number;
  reps: number;
  lapses: number;
}

const clampBox = (b: number) => Math.max(1, Math.min(MAX_BOX, Math.round(b)));
export const intervalDays = (box: number): number => INTERVALS[clampBox(box) - 1];

/** Entering the deck. The self-rating tunes the first interval; "studied" levels come back tomorrow. */
export function newItem(now: number, rating?: Rating, studied = false): DeckItem {
  let box = 1;
  let days: number = INTERVALS[0];
  if (!studied) {
    if (rating === 'easy') {
      box = 2;
      days = INTERVALS[1];
    } else if (rating === 'hard') days = 0.5;
  }
  return { box, due: now + days * DAY, last: now, reps: 0, lapses: 0 };
}

/** Re-tune an item that has not been reviewed yet, when the learner rates after the fact. */
export function retune(item: DeckItem, rating: Rating): DeckItem {
  if (item.reps > 0) return item;
  const fresh = newItem(item.last, rating);
  return { ...item, box: fresh.box, due: fresh.due };
}

export function afterReview(item: DeckItem, passed: boolean, now: number): DeckItem {
  if (passed) {
    const box = clampBox(item.box + 1);
    return { box, due: now + intervalDays(box) * DAY, last: now, reps: item.reps + 1, lapses: item.lapses };
  }
  return { box: 1, due: now + INTERVALS[0] * DAY, last: now, reps: item.reps + 1, lapses: item.lapses + 1 };
}

export const isDue = (item: DeckItem, now: number): boolean => item.due <= now;

/** Due item ids, most overdue first. */
export function dueIds(deck: Record<string, DeckItem>, now: number): string[] {
  return Object.keys(deck)
    .filter((id) => isDue(deck[id], now))
    .sort((a, b) => deck[a].due - deck[b].due);
}

/** Up to `n` due items, interleaved round-robin across worlds (interleaving effect). */
export function pickSession(
  deck: Record<string, DeckItem>,
  worldOf: (levelId: string) => string | undefined,
  now: number,
  n = 8,
): string[] {
  const groups = new Map<string, string[]>();
  for (const id of dueIds(deck, now)) {
    const w = worldOf(id);
    if (w === undefined) continue;
    if (!groups.has(w)) groups.set(w, []);
    groups.get(w)!.push(id);
  }
  const queues = [...groups.values()].sort((a, b) => deck[a[0]].due - deck[b[0]].due);
  const out: string[] = [];
  while (out.length < n && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (q.length && out.length < n) out.push(q.shift()!);
    }
  }
  return out;
}

/** Human wording for when something is next due. */
export function dueLabel(item: DeckItem, now: number): string {
  const d = (item.due - now) / DAY;
  if (d <= 0) return 'due now';
  if (d < 1) return 'later today';
  const days = Math.round(d);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}
