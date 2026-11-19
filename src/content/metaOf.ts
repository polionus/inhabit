import type { ChapterExplainer, GuideArticle } from './types.ts';

/** Reading minutes for a chapter body (same rule the roadmap used: 220 words a minute). */
export const minutesOf = (text: string): number => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));

export const guideMetaOf = (guide: GuideArticle[]) => guide.map((a) => ({ id: a.id, section: a.section, title: a.title, summary: a.summary, minutes: a.minutes }));
export const chapterMetaOf = (chapters: ChapterExplainer[]) => chapters.map((c) => ({ worldId: c.worldId, title: c.title, minutes: minutesOf(c.body) }));
