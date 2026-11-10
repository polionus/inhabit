import { symbolBar } from '../../content/abbreviations.ts';

export function SymbolBar({ onInsert }: { onInsert: (s: string) => void }) {
  return (
    <div className="symbolbar" role="toolbar" aria-label="Symbols">
      {symbolBar.map((s) => (
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
      <span className="sym-tip" aria-hidden="true">or type <code>\to</code> + space</span>
    </div>
  );
}
