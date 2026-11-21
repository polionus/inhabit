/** Light chapter registry (title and reading time only) for screens that just link to a chapter.
 *  The article text lives in ./full.ts and loads with the chapter screen. */
import { chapterMeta, type ChapterMeta } from './meta.ts';

const byWorld = new Map(chapterMeta.map((c) => [c.worldId, c]));

export const chapterFor = (worldId: string): ChapterMeta | undefined => byWorld.get(worldId);
