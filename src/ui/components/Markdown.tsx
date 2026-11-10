import { useMemo, useState } from 'react';
import { Marked } from 'marked';
import { highlightHtml } from '../lean/highlight.ts';
import { getCodex } from '../data.ts';
import { CodexModal } from './CodexCard.tsx';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => esc(text),
    code: ({ text }) => `<pre class="code"><code>${highlightHtml(text.replace(/\n$/, ''))}</code></pre>`,
    codespan: ({ text }) => `<code class="inline">${highlightHtml(text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'))}</code>`,
    link: ({ href, text }) => (/^(https?:|#)/.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>` : text),
  },
});

export function renderMarkdown(src: string): string {
  const withLinks = src.replace(/\[\[([^\]\s]+)\]\]/g, (_m, id: string) => {
    const e = getCodex(id);
    const label = e ? e.name : id;
    return e
      ? `<a href="#/codex/${encodeURIComponent(id)}" class="codex-link" data-codex="${esc(id)}">${esc(label)}</a>`
      : esc(label);
  });
  try {
    return md.parse(withLinks, { async: false }) as string;
  } catch {
    return `<p>${esc(src)}</p>`;
  }
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div
        className={`md ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest('a.codex-link') as HTMLElement | null;
          if (a) {
            e.preventDefault();
            setOpen(a.dataset.codex ?? null);
          }
        }}
      />
      {open && <CodexModal id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function Lean({ code, className = '' }: { code: string; className?: string }) {
  const html = useMemo(() => highlightHtml(code), [code]);
  return <pre className={`code ${className}`}><code dangerouslySetInnerHTML={{ __html: html }} /></pre>;
}

export function LeanInline({ code }: { code: string }) {
  const html = useMemo(() => highlightHtml(code), [code]);
  return <code className="inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
