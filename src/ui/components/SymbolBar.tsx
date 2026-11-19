import { useState } from 'react';
import { symbolBar, symbolFirstWorld } from '../../content/abbreviations.ts';
import type { Level } from '../../content/types.ts';
import { worlds } from '../../content/index.ts';

const worldOfCodex = new Map<string, number>();
worlds.forEach((w, i) => w.codex.forEach((c) => worldOfCodex.set(c.id, i)));
const worldIndex = new Map(worlds.map((w, i) => [w.id, i]));

/** Index of the furthest world that has an unlocked codex entry (0 when none). */
export function reachedWorld(unlocked: string[]): number {
  let max = 0;
  for (const id of unlocked) max = Math.max(max, worldOfCodex.get(id) ?? 0);
  return max;
}

/** Split the bar into the symbols usable so far and the rest. */
export function splitSymbols(unlocked: string[]): { shown: typeof symbolBar; more: typeof symbolBar } {
  const reached = reachedWorld(unlocked);
  const shown: typeof symbolBar = [];
  const more: typeof symbolBar = [];
  for (const s of symbolBar) (worldIndex.get(symbolFirstWorld[s.symbol] ?? 'types')! <= reached ? shown : more).push(s);
  return { shown, more };
}

const refText = (l: Level): string => (l.kind === 'proof' ? (l.solutions[0] ?? '') : l.kind === 'formalize' ? (l.accept[0] ?? '') : '');

let firstUse: Map<string, Set<string>> | null = null;
/** For each level id, the bar symbols its reference solution uses that no earlier level's solution used. Computed once. */
export function newSymbolsOf(levelId: string | undefined): Set<string> {
  if (!firstUse) {
    firstUse = new Map();
    const met = new Set<string>();
    for (const w of worlds) {
      for (const l of w.levels) {
        const text = refText(l);
        const fresh = new Set<string>();
        for (const s of symbolBar) if (text.includes(s.symbol) && !met.has(s.symbol)) fresh.add(s.symbol);
        for (const s of fresh) met.add(s);
        firstUse.set(l.id, fresh);
      }
    }
  }
  return (levelId && firstUse.get(levelId)) || new Set();
}

export function SymbolBar({ onInsert, unlocked, levelId }: { /** Level whose first-use symbols get a cue. */ levelId?: string; onInsert: (s: string) => void; /** Codex ids the player has unlocked; when given, the bar shows only the symbols met so far (the rest behind "More"). */ unlocked?: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const { shown, more } = unlocked ? splitSymbols(unlocked) : { shown: symbolBar, more: [] };
  const fresh = newSymbolsOf(levelId);
  const list = expanded ? [...shown, ...more] : shown;
  return (
    <div className="symbolbar" role="toolbar" aria-label="Symbols">
      {list.map((s) => (
        <button
          key={s.symbol + s.abbr}
          className={`sym${fresh.has(s.symbol) ? ' sym-new' : ''}`}
          title={fresh.has(s.symbol) ? `New here: type \\${s.abbr} or click` : `${s.name}  (type \\${s.abbr})`}
          aria-label={`${s.name}, typed as backslash ${s.abbr}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(s.symbol)}
        >
          {s.symbol}
        </button>
      ))}
      {more.length > 0 && (
        <button className="sym sym-more" aria-expanded={expanded} title="Show every symbol" onMouseDown={(e) => e.preventDefault()} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Fewer' : 'More symbols'}
        </button>
      )}
      <span className="sym-tip" aria-hidden="true">or type <code>\to</code> + space</span>
    </div>
  );
}
