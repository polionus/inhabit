import type { GuideArticle, GuideSection } from './types.ts';

/** Display order and titles of the Guide's sections. */
export const guideSections: { id: GuideSection; title: string; blurb: string }[] = [
  { id: 'lean', title: 'Lean', blurb: '' },
  { id: 'theory', title: 'Theory', blurb: '' },
  { id: 'practice', title: 'Practice', blurb: '' },
  { id: 'ecosystem', title: 'Ecosystem', blurb: '' },
];

/** The Guide: long-form reading about Lean. In reading order. */
export const guide: GuideArticle[] = [];

export const getArticle = (id: string): GuideArticle | undefined => guide.find((a) => a.id === id);
