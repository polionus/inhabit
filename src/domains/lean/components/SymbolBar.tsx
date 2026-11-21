import { useMemo, useState } from 'react';
import { useDisc } from '../../../template/context.tsx';
import { symbolBar, symbolFirstWorld } from '../editor/abbreviations.ts';
import type { LeanLevel } from '../types.ts';

function computeFirstUse(worlds: readonly { id: string; levels: readonly LeanLevel[] }[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const met = new Set<string>();
  for (const w of worlds) {
    for (const l of w.levels) {
      const text = l.kind === 'proof' ? (l.solutions[0] ?? '') : l.kind === 'formalize' ? (l.accept[0] ?? '') : '';
      const given = l.kind === 'proof' ? l.starter : '';
      const count = (s: string, sym: string) => s.split(sym).length - 1;
      const fresh = new Set<string>();
      for (const s of symbolBar) {
        if (count(text, s.symbol) > count(given, s.symbol) && !met.has(s.symbol)) fresh.add(s.symbol);
      }
      for (const s of fresh) met.add(s);
      map.set(l.id, fresh);
    }
  }
  return map;
}

export function SymbolBar({
  onInsert,
  unlocked,
  levelId,
}: {
  levelId?: string;
  onInsert: (s: string) => void;
  unlocked?: string[];
}) {
  const disc = useDisc();
  const [expanded, setExpanded] = useState(false);

  const { shown, more, fresh } = useMemo(() => {
    const worldOfCodex = new Map<string, number>();
    const worldIndex = new Map<string, number>();
    disc.worlds.forEach((w, i) => {
      worldIndex.set(w.id, i);
      w.codex.forEach((c) => worldOfCodex.set(c.id, i));
    });
    let maxReached = 0;
    for (const id of unlocked ?? []) maxReached = Math.max(maxReached, worldOfCodex.get(id) ?? 0);

    const shownList: typeof symbolBar = [];
    const moreList: typeof symbolBar = [];
    if (unlocked) {
      for (const s of symbolBar) {
        const wIdx = worldIndex.get(symbolFirstWorld[s.symbol] ?? 'types') ?? 0;
        (wIdx <= maxReached ? shownList : moreList).push(s);
      }
    } else {
      shownList.push(...symbolBar);
    }
    const firstMap = computeFirstUse(disc.worlds as unknown as readonly { id: string; levels: readonly LeanLevel[] }[]);
    return {
      shown: shownList,
      more: moreList,
      fresh: (levelId && firstMap.get(levelId)) || new Set<string>(),
    };
  }, [disc.worlds, unlocked, levelId]);

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
        <button
          className="sym sym-more"
          aria-expanded={expanded}
          title="Show every symbol"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Fewer' : 'More symbols'}
        </button>
      )}
      <span className="sym-tip" aria-hidden="true">or type <code>\to</code> + space</span>
    </div>
  );
}
