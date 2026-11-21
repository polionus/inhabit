/**
 * Shared building blocks for Gallery exhibits, so every exhibit reads the same way:
 *   ExhibitIntro  one plain sentence up front; the rest behind "How to read it" (less to take in at once).
 *   TryThis       one row of presets; the active one is marked; scrolls sideways on phones instead of wrapping.
 *   Zone          a labeled region: "play" (the interactive part), "lean" (what Lean says, engine-checked),
 *                 or "explain" (a side note). Distinct surfaces so the eye knows what kind of thing it's reading.
 *   Verdict       one status line: ok / no / info.
 *   TaughtIn      "Where this is taught" links.
 * Styles: src/ui/styles/gallery.css (section "exhibit kit").
 */
import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../components/kit.tsx';

export function ExhibitIntro({ lead, children }: { lead: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="xk-intro">
      <p className="xk-lead">{lead}</p>
      {children && (
        <>
          <button type="button" className="xk-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            <Icon name="chevron-down" size={16} className={open ? 'xk-chev open' : 'xk-chev'} /> How to read it
          </button>
          <div id={id} className="xk-more-body" hidden={!open}>{children}</div>
        </>
      )}
    </div>
  );
}

export interface Preset { label: string; active?: boolean; onPick: () => void; title?: string }

export function TryThis({ presets, label = 'Try this', extra }: { presets: Preset[]; label?: string; extra?: ReactNode }) {
  return (
    <div className="xk-try" role="group" aria-label={label}>
      <span className="xk-try-label">{label}</span>
      <div className="xk-try-row">
        {presets.map((p, i) => (
          <button key={p.label} type="button" className={`xk-chip${p.active ? ' on' : ''}`} aria-pressed={!!p.active} title={p.title} onClick={p.onPick}>
            <span className="xk-chip-n" aria-hidden="true">{i + 1}</span>
            {p.label}
          </button>
        ))}
        {extra}
      </div>
    </div>
  );
}

const ZONE_LABEL = { play: 'Play', lean: 'What Lean says', explain: 'What it means' } as const;

export function Zone({ kind, label, aside, className = '', children }: { kind: keyof typeof ZONE_LABEL; label?: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`xk-zone xk-${kind} ${className}`} aria-label={label ?? ZONE_LABEL[kind]}>
      <header className="xk-zone-head">
        <span className="xk-zone-label">
          {kind === 'lean' && <Icon name="check-circle" size={14} />}
          {label ?? ZONE_LABEL[kind]}
        </span>
        {aside && <span className="xk-zone-aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function Verdict({ tone, children }: { tone: 'ok' | 'no' | 'info'; children: ReactNode }) {
  return (
    <p className={`xk-verdict xk-${tone}`} role="status" aria-live="polite">
      <Icon name={tone === 'ok' ? 'check-circle' : tone === 'no' ? 'warn' : 'bulb'} size={18} />
      <span>{children}</span>
    </p>
  );
}

export function TaughtIn({ links }: { links: { href: string; title: string }[] }) {
  if (!links.length) return null;
  return (
    <p className="xk-taught">
      <Icon name="book" size={15} /> Where this is taught:{' '}
      {links.map((l, i) => (
        <span key={l.href}>{i > 0 && ' · '}<a href={l.href}>{l.title}</a></span>
      ))}
    </p>
  );
}
