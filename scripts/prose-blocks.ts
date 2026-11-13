/**
 * Fenced code blocks in prose (lessons, primers, guide). See the fence convention in
 * src/content/types.ts ("Prose layers"). Shared by verify-mini.ts and verify-lean.ts.
 */
import type { GuideArticle, WorldLessons } from '../src/content/types.ts';

export interface ProseBlock {
  /** Where it came from, for error reports: e.g. `lesson logic-03 body #1`. */
  label: string;
  lang: string;
  code: string;
}

const FENCE = /```([\w-]*)[^\n]*\n([\s\S]*?)```/g;

export function fenced(markdown: string | undefined, label: string): ProseBlock[] {
  if (!markdown) return [];
  const out: ProseBlock[] = [];
  let n = 0;
  for (const m of markdown.matchAll(FENCE)) {
    n++;
    out.push({ label: `${label} #${n}`, lang: m[1] ?? '', code: m[2].replace(/\n$/, '') });
  }
  return out;
}

export const KNOWN_LANGS = new Set(['lean', 'lean-real', 'lean-mathlib', 'text']);

/** Blocks of a level's lesson (all three fields). */
export function lessonBlocks(lessons: WorldLessons | undefined, levelId: string): ProseBlock[] {
  const l = lessons?.levels[levelId];
  if (!l) return [];
  return [
    ...fenced(l.body, `lesson ${levelId} body`),
    ...fenced(l.pitfall, `lesson ${levelId} pitfall`),
    ...fenced(l.realLean, `lesson ${levelId} realLean`),
  ];
}

export function worldProseBlocks(lessons: WorldLessons | undefined): ProseBlock[] {
  if (!lessons) return [];
  return [...fenced(lessons.primer, `primer ${lessons.worldId}`), ...fenced(lessons.recap, `recap ${lessons.worldId}`)];
}

export function guideBlocks(articles: GuideArticle[]): ProseBlock[] {
  return articles.flatMap((a) => fenced(a.body, `guide ${a.id}`));
}

export const words = (markdown: string | undefined): number =>
  (markdown ?? '')
    .replace(FENCE, ' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

export const nsOf = (label: string): string => 'P_' + label.replace(/[^A-Za-z0-9]/g, '_');
