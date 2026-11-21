/**
 * "What next?" recommender. Pure: no React, no storage, no engine.
 *
 * It ranks a small set of candidate actions with a transparent utility score, each with a one-line reason,
 * then picks a short, varied slate. The ideas come from how learning apps and games keep people going:
 *   - spaced repetition (Anki, Duolingo): due reviews first, and first after time away ("warm up");
 *   - weakness targeting (Chess.com/Lichess puzzle themes, Khan Academy mastery): practice the levels
 *     that went shakiest (shown solutions, hints, "hard" ratings, review lapses);
 *   - goal gradient: a world that's nearly done pulls harder ("2 levels left");
 *   - flow: after a struggle, ease off with practice or a visual; on a clean run, offer the boss early;
 *   - session pacing: after a long session, suggest a short review or something to look at;
 *   - loss aversion, gently: a streak at risk prefers the shortest useful action;
 *   - "because you just…" content links (chapter explainer, Gallery exhibit for the current world);
 *   - slate diversity (maximal marginal relevance): alternatives are different kinds of thing;
 *   - implicit feedback: "Not now" hides a suggestion for the rest of the day.
 * Scores are on a 0–100 scale; only their order matters.
 */
import { DAY, dueIds, SESSION_SIZE, type DeckItem } from './leitner.ts';
import { canTestOut, bossIndex, continueLevel, isPassed, requiredLevels, worldComplete, type Progress, type WorldLike } from './progress.ts';

export type RecKind = 'continue' | 'review' | 'redo' | 'practice' | 'boss' | 'daily' | 'chapter' | 'gallery' | 'workshop';

export interface Rec {
  /** Stable key, also used for "Not now" (e.g. `practice:props-04`). */
  key: string;
  kind: RecKind;
  href: string;
  title: string;
  /** One plain sentence: why this, now. */
  reason: string;
  minutes: number;
  score: number;
  levelId?: string;
  worldId?: string;
}

export interface RecLevel { id: string; title: string; kind: string; boss?: boolean; optional?: boolean }
export interface RecWorld extends WorldLike { title: string; levels: RecLevel[] }

export interface RecInput {
  worlds: RecWorld[];
  levels: Progress;
  deck: Record<string, DeckItem>;
  /** Seen markers: `chapter:<world>`, `gallery:<id>`, `skip:<YYYY-MM-DD>:<key>`. */
  seen: Record<string, number>;
  /** Today's counts (`levels`, `reviews`, …) and the local day key `YYYY-MM-DD`. */
  today: { day: string; counts: Record<string, number> };
  /** Active days, `YYYY-MM-DD`, any order. */
  activeDays: string[];
  streak: { current: number; activeToday: boolean };
  now: number;
  /** Local day key for `now` (the caller owns the time zone). */
  dayKey: string;
  /** Daily Proof finished today; null when unknown. */
  dailyDone: boolean | null;
  /** Can generated practice serve this level? */
  practiceable: (levelId: string) => boolean;
  /** Worlds with a chapter explainer. */
  chapters: ReadonlySet<string>;
  /** Gallery exhibits for a world. */
  exhibitsFor: (worldId: string) => { id: string; title: string }[];
  /** Links (kept out of this module so it stays free of the router). */
  links: {
    level: (id: string) => string;
    practice: (id: string) => string;
    chapter: (id: string) => string;
    gallery: (id: string) => string;
    review: string;
    daily: string;
    workshop: string;
  };
  /** The level just finished, when recommending from the success card. */
  after?: { levelId: string; hints: number; studied: boolean };
}

/** How shaky a passed level looks, 0 (clean) to about 2 (solution shown, lapsed in review). */
export function shakiness(p: Progress[string] | undefined, d: DeckItem | undefined): number {
  if (!p || !isPassed(p) || p.testedOut) return 0;
  let s = 0;
  if (p.status === 'studied') s += 1;
  else if (!p.clean) s += Math.min(0.75, 0.25 * Math.max(1, p.hintsUsed));
  if (p.rating === 'hard') s += 0.5;
  if (d) s += 0.4 * Math.min(3, d.lapses) - (d.box >= 3 ? 0.5 : 0);
  return Math.max(0, s);
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** Days since the most recent active day before today (Infinity if none). */
function daysAway(activeDays: string[], dayKey: string): number {
  const before = activeDays.filter((d) => d < dayKey).sort();
  if (!before.length) return Infinity;
  const last = Date.parse(before[before.length - 1] + 'T00:00:00Z');
  const today = Date.parse(dayKey + 'T00:00:00Z');
  return Math.round((today - last) / DAY);
}

/** Every candidate, scored, best first. Exported for tests; the UI wants `recommend`. */
export function candidates(inp: RecInput): Rec[] {
  const { worlds, levels, deck, now, links } = inp;
  const out: Rec[] = [];
  const find = (id: string) => {
    for (const w of worlds) {
      const i = w.levels.findIndex((l) => l.id === id);
      if (i >= 0) return { w, l: w.levels[i], i };
    }
    return null;
  };
  const started = Object.values(levels).some(isPassed);
  const away = daysAway(inp.activeDays, inp.dayKey);
  const todayLevels = inp.today.day === inp.dayKey ? inp.today.counts.levels ?? 0 : 0;
  const atRisk = inp.streak.current >= 2 && !inp.streak.activeToday;

  // Recent form: the last three passes, newest first.
  const recent = Object.entries(levels)
    .filter(([id, p]) => isPassed(p) && !p.testedOut && p.firstPassAt && find(id))
    .sort((a, b) => (b[1].firstPassAt ?? 0) - (a[1].firstPassAt ?? 0))
    .slice(0, 3);
  const struggled = inp.after ? inp.after.studied || inp.after.hints >= 2 : recent.length > 0 && shakiness(recent[0][1], deck[recent[0][0]]) >= 0.75;
  const onARoll = !inp.after?.hints && !inp.after?.studied && recent.length === 3 && recent.every(([, p]) => p.clean);

  // 1. Continue the path.
  const contId = continueLevel(worlds, levels);
  const cont = contId ? find(contId) : null;
  if (cont) {
    const req = requiredLevels(cont.w);
    const left = req.filter((l) => !isPassed(levels[l.id])).length;
    const nearly = req.length >= 4 && left <= 3 && left <= req.length / 3;
    let score = started ? 60 : 95;
    let reason = started ? `Next on your path in ${cont.w.title}.` : 'The first level. Everything else builds from here.';
    if (nearly) {
      score += 10;
      reason = `${plural(left, 'level')} left to finish ${cont.w.title}.`;
    }
    if (struggled) score -= 15;
    if (todayLevels >= 6) score -= 15;
    if (cont.l.boss) reason = `The boss of ${cont.w.title}. It uses everything from this world.`;
    out.push({ key: `continue:${cont.l.id}`, kind: 'continue', href: links.level(cont.l.id), title: cont.l.title, reason, minutes: cont.l.boss ? 8 : 4, score, levelId: cont.l.id, worldId: cont.w.id });
  } else if (started) {
    out.push({ key: 'workshop', kind: 'workshop', href: links.workshop, title: 'Prove something of your own', reason: 'Every world is done. The Workshop takes an English statement to a proved theorem.', minutes: 15, score: 55 });
  }

  // 2. Spaced review.
  const due = dueIds(deck, now).filter((id) => find(id));
  if (due.length) {
    const overdueDays = Math.max(0, (now - deck[due[0]].due) / DAY);
    const n = Math.min(SESSION_SIZE, due.length);
    let score = 45 + 4 * n + Math.min(15, 5 * overdueDays);
    let reason = `${plural(n, 'level')} ready to solve again. Coming back to them now is what makes them stick.`;
    if (away >= 4 && away !== Infinity) {
      score += 25;
      reason = `You've been away ${away} days. A short review warms you up before anything new.`;
    }
    if (todayLevels >= 6) score += 10;
    if (atRisk) score += 5;
    out.push({ key: 'review', kind: 'review', href: links.review, title: 'Today’s review', reason, minutes: 2 * n, score });
  }

  // 3. Weak spots: redo a studied level, or practice the shakiest level the generator can serve.
  const shaky = Object.keys(levels)
    .map((id) => ({ id, f: find(id), s: shakiness(levels[id], deck[id]) }))
    .filter((x) => x.f && x.s > 0)
    .sort((a, b) => b.s - a.s || (levels[b.id].firstPassAt ?? 0) - (levels[a.id].firstPassAt ?? 0));
  // A studied level that review isn't already bringing back today.
  const studied = shaky.find((x) => levels[x.id].status === 'studied' && !(deck[x.id] && deck[x.id].due <= now));
  if (studied?.f) {
    out.push({
      key: `redo:${studied.id}`, kind: 'redo', href: links.level(studied.id), title: studied.f.l.title,
      reason: 'You saw the solution here. Solving it yourself now counts in full.', minutes: 4, score: 48 + (struggled ? 8 : 0), levelId: studied.id, worldId: studied.f.w.id,
    });
  }
  const forPractice = (inp.after && inp.practiceable(inp.after.levelId) && struggled ? [{ id: inp.after.levelId, f: find(inp.after.levelId), s: 1 }] : [])
    .concat(shaky.filter((x) => x.id !== studied?.id))
    .find((x) => x.f && inp.practiceable(x.id));
  if (forPractice?.f) {
    const just = inp.after?.levelId === forPractice.id;
    out.push({
      key: `practice:${forPractice.id}`, kind: 'practice', href: links.practice(forPractice.id), title: `Practice: ${forPractice.f.l.title}`,
      reason: just ? 'That one took some help. Three fresh ones like it make the idea yours.' : `${forPractice.f.l.title} took some help. Three fresh problems like it firm it up.`,
      minutes: 5, score: 38 + 10 * Math.min(2, forPractice.s) + (struggled ? 12 : 0), levelId: forPractice.id, worldId: forPractice.f.w.id,
    });
  }

  // 4. Test out: on a clean run, the boss of the current world is worth a try.
  if (cont && onARoll && !cont.l.boss && canTestOut(cont.w, worlds, levels)) {
    const b = cont.w.levels[bossIndex(cont.w)];
    out.push({
      key: `boss:${b.id}`, kind: 'boss', href: links.level(b.id), title: b.title,
      reason: `Three clean solves in a row. Beat the boss of ${cont.w.title} to skip what's left of it.`, minutes: 8, score: 58, levelId: b.id, worldId: cont.w.id,
    });
  }

  // 5. Daily Proof: a habit slot, more valuable when the streak is at risk.
  if (inp.dailyDone === false && started) {
    out.push({ key: 'daily', kind: 'daily', href: links.daily, title: 'Daily Proof', reason: atRisk ? `Three short puzzles keep your ${inp.streak.current}-day streak going.` : 'Three short puzzles, the same for everyone today.', minutes: 5, score: 40 + (atRisk ? 15 : 0) });
  }

  // 6. Explain and show: the chapter explainer and an exhibit for the world in play (or just finished).
  const afterWorld = inp.after ? find(inp.after.levelId)?.w : undefined;
  const focusWorld = afterWorld && worldComplete(afterWorld, levels) ? afterWorld : cont?.w;
  if (focusWorld && started) {
    const done = worldComplete(focusWorld, levels);
    if (inp.chapters.has(focusWorld.id) && !inp.seen[`chapter:${focusWorld.id}`]) {
      out.push({
        key: `chapter:${focusWorld.id}`, kind: 'chapter', href: links.chapter(focusWorld.id), title: `Read: ${focusWorld.title}`,
        reason: done ? `You finished ${focusWorld.title}. The explainer ties its ideas together.` : `The big picture of ${focusWorld.title}, in a few minutes of reading.`,
        minutes: 6, score: 30 + (done ? 25 : 0) + (struggled ? 10 : 0), worldId: focusWorld.id,
      });
    }
    const ex = inp.exhibitsFor(focusWorld.id).find((e) => !inp.seen[`gallery:${e.id}`]);
    if (ex) {
      out.push({
        key: `gallery:${ex.id}`, kind: 'gallery', href: links.gallery(ex.id), title: ex.title,
        reason: struggled ? `See the idea move before the next proof.` : `An interactive picture of what ${focusWorld.title} is about.`,
        minutes: 3, score: 32 + (struggled ? 18 : 0) + (todayLevels >= 6 ? 15 : 0) + (done ? 10 : 0), worldId: focusWorld.id,
      });
    }
  }

  // Streak at risk: prefer what's short.
  if (atRisk) for (const r of out) r.score += Math.max(0, 8 - r.minutes);

  const skipped = (k: string) => !!inp.seen[`skip:${inp.dayKey}:${k}`];
  return out.filter((r) => !skipped(r.key)).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/** Kinds that are "reading or looking" rather than doing; a slate holds at most one. */
const PASSIVE: ReadonlySet<RecKind> = new Set(['chapter', 'gallery']);

/** The top pick and up to `n - 1` alternatives of different kinds (diversified slate). */
export function recommend(inp: RecInput, n = 3): Rec[] {
  const all = candidates(inp);
  const slate: Rec[] = [];
  for (const r of all) {
    if (slate.length >= n) break;
    if (slate.some((s) => s.kind === r.kind)) continue;
    if (PASSIVE.has(r.kind) && slate.some((s) => PASSIVE.has(s.kind))) continue;
    slate.push(r);
  }
  return slate;
}

/** Seen key that hides a suggestion for the rest of the day. */
export const skipKey = (dayKey: string, recKey: string): string => `skip:${dayKey}:${recKey}`;

