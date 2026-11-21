import { describe, expect, it } from 'vitest';
import { availablePresetsFor, resolveTheme } from '../../template/theme/index.ts';
import { evaluatePattern, type PatternLevel } from './PatternLevel.tsx';
import { starterWorlds } from './content.ts';
import { starterDisc } from './disc.tsx';
import { meta } from './meta.ts';

describe('starter disc (Patterncraft)', () => {
  it('validates all built-in and custom levels cleanly', () => {
    const codexIds = new Set(starterDisc.allCodex.map((c) => c.id));
    for (const w of starterWorlds) {
      for (const lvl of w.levels) {
        for (const id of lvl.unlocks?.codex ?? []) {
          expect(codexIds.has(id)).toBe(true);
        }
        if (lvl.kind === 'choice') {
          expect(lvl.options.filter((o) => o.correct)).toHaveLength(1);
        } else if (lvl.kind === 'order') {
          expect(lvl.lines.length).toBeGreaterThan(1);
          for (const d of lvl.distractors ?? []) {
            expect(lvl.lines.includes(d)).toBe(false);
          }
        } else if (lvl.kind === 'text') {
          expect(lvl.accept.length).toBeGreaterThan(0);
        } else if (lvl.kind === 'pattern') {
          const pl = lvl as PatternLevel;
          expect(pl.solutions.length).toBeGreaterThan(0);
          for (const sol of pl.solutions) {
            const r = evaluatePattern(sol, pl);
            expect(r.valid).toBe(true);
            expect(r.solved).toBe(true);
          }
          const empty = evaluatePattern('', pl);
          expect(empty.solved).toBe(false);
        }
      }
    }
  });

  it('rejects invalid regex syntax safely in evaluatePattern', () => {
    const res = evaluatePattern('[unclosed', { positive: ['abc'], negative: ['xyz'] });
    expect(res.valid).toBe(false);
    expect(res.solved).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('uses distinct Terracotta theme and isolated storage key', () => {
    const resolved = resolveTheme(starterDisc.theme);
    expect(resolved.presetId).toBe('terracotta');
    expect(meta.storageKey).toBe('patterncraft.save');
    expect(availablePresetsFor(starterDisc.theme).length).toBeGreaterThanOrEqual(6);
  });
});
