/**
 * Print a save file with progress, for screenshots and manual testing.
 *   node scripts/dev-save.ts eq > /tmp/save.json     # every world up to and including `eq` solved
 *   node scripts/dev-save.ts eq 4 > /tmp/save.json   # ...plus the first 4 levels of the next world
 * Use with: node scripts/shot.ts --save /tmp/save.json …
 */
import { worlds } from '../src/content/index.ts';
import { defaultSave } from '../src/state/game.ts';

const upTo = process.argv[2] ?? 'logic';
const extra = Number(process.argv[3] ?? 0);
const save = defaultSave();
const now = Date.now();
const idx = worlds.findIndex((w) => w.id === upTo);
let i = 0;
worlds.forEach((w, wi) => {
  const n = wi <= idx ? w.levels.length : wi === idx + 1 ? extra : 0;
  w.levels.slice(0, n).forEach((l) => {
    i++;
    const clean = i % 3 !== 0;
    save.levels[l.id] = { status: i % 11 === 0 ? 'studied' : 'solved', hintsUsed: clean ? 0 : 1, attempts: 1, firstPassAt: now - (200 - i) * 3_600_000, ...(clean ? { clean: true } : {}) };
    save.deck[l.id] = { box: 1 + (i % 4), due: now + ((i % 5) - 1) * 86_400_000, last: now - 86_400_000, reps: i % 3, lapses: 0 };
    save.xp += 20;
  });
});
for (let d = 0; d < 5; d++) {
  const t = new Date(now - d * 86_400_000);
  save.activeDays.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
}
save.activeDays.sort();
save.welcomed = true;
console.log(JSON.stringify(save));
