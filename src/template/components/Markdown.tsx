import { useMemo, useState } from 'react';
import { Marked } from 'marked';
import { tryGetDisc } from '../context.tsx';
import { CodexModal } from './CodexCard.tsx';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function highlightFor(code: string, lang?: string): string {
  const disc = tryGetDisc();
  if (disc?.code?.highlightHtml) return disc.code.highlightHtml(code, lang);
  return esc(code);
}

function renderFence(code: string, lang: string): string {
  if (lang === 'text' || lang === '') {
    return `<div class="codeblock text"><pre class="code"><code>${esc(code)}</code></pre></div>`;
  }
  const disc = tryGetDisc();
  const badge = disc?.code?.fenceLabels?.[lang];
  const pre = `<pre class="code"><code>${highlightFor(code, lang)}</code></pre>`;
  if (badge) {
    return `<div class="codeblock ${esc(badge.className)}"><span class="code-label">${esc(badge.label)}</span>${pre}</div>`;
  }
  return pre;
}

const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => esc(text),
    code: ({ text, lang }: { text: string; lang?: string }) =>
      renderFence(text.replace(/\n$/, ''), (lang ?? '').trim().split(/\s+/)[0]),
    codespan: ({ text }) => {
      const decoded = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      return `<code class="inline">${highlightFor(decoded)}</code>`;
    },
    link(this: unknown, { href, tokens, text }: { href: string; tokens?: unknown[]; text: string }): string {
      const parser = (this as { parser?: { parseInline: (t: unknown[]) => string } }).parser;
      const inner: string = (tokens && parser ? parser.parseInline(tokens) : '') || text;
      if (href.startsWith('codex:')) {
        const id = decodeURIComponent(href.slice(6));
        return `<a href="#/codex/${encodeURIComponent(id)}" class="codex-link" data-codex="${esc(id)}">${inner}</a>`;
      }
      return /^https?:/.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
    },
  },
});

export function renderMarkdown(src: string, inline = false): string {
  const codex = tryGetDisc()?.allCodex ?? [];
  const withLinks = src.replace(/\[\[([^\]\s]+)\]\]/g, (_m, id: string) => {
    const e = codex.find((x) => x.id === id);
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

export function CodeBlock({ code, lang, className = '' }: { code: string; lang?: string; className?: string }) {
  const html = useMemo(() => highlightFor(code, lang), [code, lang]);
  return <pre className={`code ${className}`}><code dangerouslySetInnerHTML={{ __html: html }} /></pre>;
}

export function CodeInline({ code, lang }: { code: string; lang?: string }) {
  const html = useMemo(() => highlightFor(code, lang), [code, lang]);
  return <code className="inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
