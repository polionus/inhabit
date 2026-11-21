import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { hasPractice } from './practice.ts';
import { worlds } from '../content/index.ts';
import { practiceLevels } from './practiceLevels.ts';

describe('practiceLevels', () => {
  it('lists exactly the levels generated practice can serve (regenerate with UPDATE_PRACTICE=1)', () => {
    const ids = worlds.flatMap((w) => w.levels.map((l) => l.id)).filter(hasPractice);
    if (process.env.UPDATE_PRACTICE) {
      writeFileSync(new URL('./practiceLevels.ts', import.meta.url), `/** Levels generated practice can serve. Kept in sync by practiceLevels.test.ts; lets light screens know without loading the generator. */\nexport const practiceLevels: ReadonlySet<string> = new Set(${JSON.stringify(ids, null, 2).replace(/"/g, "'")});\n`);
    }
    expect([...practiceLevels]).toEqual(ids);
  }, 120_000);
});
