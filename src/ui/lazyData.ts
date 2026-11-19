/** Long-form content (Guide, Workshop ideas, Graduate). Imported only by the lazy screens that show it,
 *  so none of this text is in the first-paint bundle. Same fixture switch as ./data.ts. */
import { data } from './data.ts';
import { guide as realGuide, guideSections as realGuideSections } from '../content/guide.ts';
import { ideas as realIdeas } from '../content/ideas.ts';
import { graduate as realGraduate, phrasebook as realPhrasebook } from '../content/graduate.ts';
import { fxGraduate, fxIdeas, fxPhrasebook } from './dev/fixtures.ts';
import { fxGuide } from './dev/proseFixtures.ts';
import type { GuideArticle } from '../content/types.ts';

export const lazyData = data.fixtures
  ? { guide: fxGuide, guideSections: realGuideSections, ideas: fxIdeas, graduate: fxGraduate, phrasebook: fxPhrasebook }
  : { guide: realGuide, guideSections: realGuideSections, ideas: realIdeas, graduate: realGraduate, phrasebook: realPhrasebook };
export const getArticle = (id: string): GuideArticle | undefined => lazyData.guide.find((a) => a.id === id);
