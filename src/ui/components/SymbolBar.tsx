import { useState } from 'react';
import { symbolBar, symbolFirstWorld } from '../../content/abbreviations.ts';
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

export function SymbolBar({ onInsert, unlocked }: { onInsert: (s: string) => void; /** Codex ids the player has unlocked; when given, the bar shows only the symbols met so far (the rest behind "More"). */ unlocked?: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const { shown, more } = unlocked ? splitSymbols(unlocked) : { shown: symbolBar, more: [] };
  const list = expanded ? [...shown, ...more] : shown;
  return (
    <div className="symbolbar" role="toolbar" aria-label="Symbols">
      {list.map((s) => (
        <button
          key={s.symbol + s.abbr}
          className="sym"
          title={`${s.name}  (type \\${s.abbr})`}
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
