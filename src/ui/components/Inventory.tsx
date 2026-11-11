import { useEffect, useRef, useState } from 'react';
import type { LevelContext } from '../../content/index.ts';
import { getCodex } from '../data.ts';
import { CodexCard } from './CodexCard.tsx';
import { InlineMd, Lean, Markdown } from './Markdown.tsx';

export function Inventory({ ctx, onInsert, onClose }: { ctx: LevelContext; onInsert?: (s: string) => void; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const tacticEntries = ctx.allowedTactics.map((t) => ({ id: t, entry: getCodex(t) }));
  const otherCodex = ctx.codex.filter((c) => !ctx.allowedTactics.includes(c)).map((c) => getCodex(c)).filter((c): c is NonNullable<typeof c> => !!c);
  const Row = ({ id, name, summary, insert }: { id: string; name: string; summary?: string; insert?: string }) => (
    <li className="inv-row">
      <button className="inv-name" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
        <span className="lean-name">{name}</span>
        {summary && <span className="muted small"> <InlineMd text={summary} /></span>}
      </button>
      {onInsert && insert && (
        <button className="btn small" title={`Insert ${insert} at the cursor`} onClick={() => onInsert(insert)}>insert</button>
      )}
      {open === id && (
        <div className="inv-doc">
          {id.startsWith('lemma:') ? (
            (() => {
              const l = ctx.lemmas.find((x) => 'lemma:' + x.name === id);
              return l ? <><Markdown text={l.doc} /><Lean code={l.source.split(':=')[0].trim()} /></> : null;
            })()
          ) : (
            (() => {
              const e = getCodex(id);
              return e ? <CodexCard entry={e} headingLevel={4} /> : <p className="muted">No entry yet.</p>;
            })()
          )}
        </div>
      )}
    </li>
  );
  return (
    <aside className="drawer" role="dialog" aria-label="Inventory" tabIndex={-1} ref={ref}>
      <div className="drawer-head">
        <h2>Inventory</h2>
        <button className="btn ghost" onClick={onClose} aria-label="Close inventory">×</button>
      </div>
      <h3>Tactics</h3>
      {tacticEntries.length ? (
        <ul className="inv">{tacticEntries.map(({ id, entry }) => <Row key={id} id={id} name={entry?.name ?? id} summary={entry?.summary} insert={id + ' '} />)}</ul>
      ) : (
        <p className="muted">None yet. This level uses terms only.</p>
      )}
      <h3>Lemmas</h3>
      {ctx.lemmas.length ? (
        <ul className="inv">{ctx.lemmas.map((l) => <Row key={l.name} id={'lemma:' + l.name} name={l.name} summary={l.doc} insert={l.name} />)}</ul>
      ) : (
        <p className="muted">No library lemmas unlocked yet.</p>
      )}
      <h3>Codex</h3>
      {otherCodex.length ? (
        <ul className="inv">{otherCodex.map((c) => <Row key={c.id} id={c.id} name={c.name} summary={c.summary} />)}</ul>
      ) : (
        <p className="muted">Nothing here yet.</p>
      )}
    </aside>
  );
}
