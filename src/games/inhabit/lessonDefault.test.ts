import { describe, expect, it } from 'vitest';
import { worlds } from './content/index.ts';
import { lessonDefaultOpen } from '../../template/levels/lessonDefault.ts';

describe('inhabit lesson default open rate', () => {
  it('opens automatically on new tactics and opening levels (~45-70% of levels)', () => {
    const config = {
      firstWorldId: 'types',
      openingCount: 4,
      isIntroducing: (_w: unknown, l: { unlocks?: { tactics?: string[]; codex?: string[] } }, index: number) =>
        index === 0 || (l.unlocks?.tactics?.length ?? 0) > 0 || (l.unlocks?.codex?.length ?? 0) > 0,
    };
    let open = 0;
    let total = 0;
    for (const world of worlds) {
      for (let index = 0; index < world.levels.length; index++) {
        total++;
        if (
          lessonDefaultOpen({
            world,
            level: world.levels[index],
            index,
            mode: 'play',
            passed: false,
            settings: { lessonMode: 'auto', lessonsOpen: true },
            narrow: false,
            config,
          })
        ) {
          open++;
        }
      }
    }
    const pct = open / total;
    expect(pct).toBeGreaterThan(0.4);
    expect(pct).toBeLessThan(0.8);
  });
});
