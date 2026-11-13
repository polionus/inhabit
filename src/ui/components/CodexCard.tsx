import type { CodexEntry } from '../../content/types.ts';
import { getCodex } from '../data.ts';
import { InlineMd, Lean, Markdown } from './Markdown.tsx';
import { Modal } from './kit.tsx';

export function CodexCard({ entry, headingLevel = 3 }: { entry: CodexEntry; headingLevel?: 2 | 3 | 4 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <article className="codex-card">
      <H>
        <span className="tag">{entry.kind}</span> <span className="lean-name">{entry.name}</span>
      </H>
      <p className="summary"><InlineMd text={entry.summary} /></p>
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
  if (!entry) return null;
  return (
    <Modal open onClose={onClose} title={entry.name} hideTitle className="codex-modal">
      <CodexCard entry={entry} headingLevel={2} />
      <p className="meta"><a href={`#/codex/${encodeURIComponent(entry.id)}`} onClick={onClose}>Open in the Codex</a></p>
    </Modal>
  );
}
