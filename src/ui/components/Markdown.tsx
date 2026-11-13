import { useMemo, useState } from 'react';
import { Marked } from 'marked';
import { highlightHtml } from '../lean/highlight.ts';
import { getCodex } from '../data.ts';
import { CodexModal } from './CodexCard.tsx';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Fence convention (content/types.ts): lean, lean-real, lean-mathlib, text. */
function renderFence(code: string, lang: string): string {
  if (lang === 'text') return `<div class="codeblock text"><pre class="code"><code>${esc(code)}</code></pre></div>`;
  const pre = `<pre class="code"><code>${highlightHtml(code)}</code></pre>`;
  if (lang === 'lean-real') return `<div class="codeblock real"><span class="code-label">Real Lean only</span>${pre}</div>`;
  if (lang === 'lean-mathlib') return `<div class="codeblock mathlib"><span class="code-label">Needs Mathlib</span>${pre}</div>`;
  return pre;
}

const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => esc(text),
    code: ({ text, lang }: { text: string; lang?: string }) => renderFence(text.replace(/\n$/, ''), (lang ?? '').trim().split(/\s+/)[0]),
    codespan: ({ text }) => `<code class="inline">${highlightHtml(text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'))}</code>`,
    link(this: any, { href, tokens, text }: { href: string; tokens?: unknown[]; text: string }): string {
      const inner: string = (tokens ? this.parser.parseInline(tokens) : '') || text;
      if (href.startsWith('codex:')) {
        const id = decodeURIComponent(href.slice(6));
        return `<a href="#/codex/${encodeURIComponent(id)}" class="codex-link" data-codex="${esc(id)}">${inner}</a>`;
      }
      return /^https?:/.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
    },
  },
});

export function renderMarkdown(src: string, inline = false): string {
  const withLinks = src.replace(/\[\[([^\]\s]+)\]\]/g, (_m, id: string) => {
    const e = getCodex(id);
    const label = (e ? e.name : id).replace(/[\[\]`]/g, '');
    return e ? `[${label}](codex:${encodeURIComponent(id)})` : label;
  });
  try {
    return (inline ? md.parseInline(withLinks, { async: false }) : md.parse(withLinks, { async: false })) as string;
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

/** Inline markdown (backticks, emphasis) as a span, for one-line summaries. */
export function InlineMd({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text, true), [text]);
  return <span className={`md-inline ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Lean({ code, className = '' }: { code: string; className?: string }) {
  const html = useMemo(() => highlightHtml(code), [code]);
  return <pre className={`code ${className}`}><code dangerouslySetInnerHTML={{ __html: html }} /></pre>;
}

export function LeanInline({ code }: { code: string }) {
  const html = useMemo(() => highlightHtml(code), [code]);
  return <code className="inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
