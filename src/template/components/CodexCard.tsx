import { useDisc } from '../context.tsx';
import type { TemplateCodexEntry } from '../types.ts';
import { CodeBlock, InlineMd, Markdown } from './Markdown.tsx';
import { Modal } from './kit.tsx';

export function CodexCard({ entry, headingLevel = 3 }: { entry: TemplateCodexEntry; headingLevel?: 2 | 3 | 4 }) {
  const disc = useDisc();
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <article className="codex-card">
      <H>
        <span className="tag">{entry.kind}</span> <span className="entry-name">{entry.name}</span>
      </H>
      <p className="summary"><InlineMd text={entry.summary} /></p>
      <Markdown text={entry.body} />
      {entry.example && (
        <>
          <div className="label">Example</div>
          <CodeBlock code={entry.example} />
        </>
      )}
      {entry.meta?.map((m) => (
        <p key={m.label} className="meta">
          {m.label}: {m.code ? <code className="inline">{m.value}</code> : m.value}
        </p>
      ))}
      {disc.hooks?.renderCodexExtras?.(entry)}
    </article>
  );
}

/** Accessible modal dialog showing one codex entry. */
export function CodexModal({ id, onClose }: { id: string; onClose: () => void }) {
  const disc = useDisc();
  const entry = disc.allCodex.find((c) => c.id === id);
  if (!entry) return null;
  return (
    <Modal open onClose={onClose} title={entry.name} hideTitle className="codex-modal">
      <CodexCard entry={entry} headingLevel={2} />
      <p className="meta"><a href={`#/codex/${encodeURIComponent(entry.id)}`} onClick={onClose}>Open in the Codex</a></p>
    </Modal>
  );
}
