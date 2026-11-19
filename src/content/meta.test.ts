import { expect, test } from 'vitest';
import { guide, guideSections } from './guide.ts';
import { chapters } from './chapters/full.ts';
import { guideMeta, guideSections as metaSections } from './guideMeta.ts';
import { chapterMeta } from './chapters/meta.ts';
import { chapterMetaOf, guideMetaOf } from './metaOf.ts';

test('generated metadata matches the content (run `node scripts/gen-meta.ts`)', () => {
  expect(guideMeta).toEqual(guideMetaOf(guide));
  expect(metaSections).toEqual(guideSections);
  expect(chapterMeta).toEqual(chapterMetaOf(chapters));
});
