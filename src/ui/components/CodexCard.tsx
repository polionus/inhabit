import { useEffect, useRef } from 'react';
import type { CodexEntry } from '../../content/types.ts';
import { getCodex } from '../data.ts';
import { Lean, Markdown } from './Markdown.tsx';

export function CodexCard({ entry, headingLevel = 3 }: { entry: CodexEntry; headingLevel?: 2 | 3 | 4 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <article className="codex-card">
      <H>
        <span className="tag">{entry.kind}</span> <span className="lean-name">{entry.name}</span>
      </H>
      <p className="summary">{entry.summary}</p>
      <Markdown text={entry.body} />
      {entry.example && (
        <>
          <div className="label">Example</div>
          <Lean code={entry.example} />
        </>
      )}
      {entry.term && (
        <>
          <div className="label">The term it builds</div>
          <Lean code={entry.term} />
        </>
      )}
      {entry.input && (
        <p className="meta">
          Type it: <code className="inline">{entry.input.replace(/\\\\/g, '\\')}</code>
        </p>
      )}
      {entry.mathlib && <p className="meta">In real Lean / Mathlib: {entry.mathlib}</p>}
    </article>
  );
}

/** Accessible modal dialog showing one codex entry. */
export function CodexModal({ id, onClose }: { id: string; onClose: () => void }) {
  const entry = getCodex(id);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
      prev?.focus?.();
    };
  }, [onClose]);
  if (!entry) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={entry.name} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost close" onClick={onClose} aria-label="Close">×</button>
        <CodexCard entry={entry} headingLevel={2} />
        <p className="meta"><a href={`#/codex/${encodeURIComponent(entry.id)}`} onClick={onClose}>Open in the Codex</a></p>
      </div>
    </div>
  );
}
