/** Calendar-day helpers (local time). Pure, no imports. */

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole-day index of a `YYYY-MM-DD` key (DST-safe: computed in UTC). NaN for a malformed key. */
export function dayIndex(key: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return NaN;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000);
}

export function addDay(days: string[], now: number): string[] {
  const k = dayKey(now);
  return days.includes(k) ? days : [...days, k].sort();
}

/** Consecutive active days ending today, or yesterday (a missed day today is not shown as a loss). No rest days. */
export function currentStreak(days: string[], now: number): number {
  const set = new Set(days);
  let t = now;
  if (!set.has(dayKey(t))) t -= 86_400_000;
  let n = 0;
  while (set.has(dayKey(t))) {
    n++;
    t -= 86_400_000;
  }
  return n;
}
