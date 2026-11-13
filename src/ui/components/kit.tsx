/**
 * Inhabit UI kit (design system v2). Reuse these instead of hand-rolling markup.
 * Styles live in `src/ui/styles/kit.css`; tokens in `src/ui/styles/tokens.css`.
 *
 * Layout & copy
 *   ScreenHeader  Title + lede + collapsible "How this works" (about + tips) from `screens.ts`.
 *                 Expanded on the first visit, then remembered as seen via markSeen('intro:<id>').
 *                 Props: id (ScreenId), title (fallback), eyebrow, icon, actions (right side), children (under lede).
 *   Card          Surface with depth. Props: as ('div'|'section'|'article'|'a'|'li'), href, tone
 *                 ('default'|'primary'|'gold'|'ok'|'flat'), interactive (hover lift), className.
 *   EmptyState    Centered message for "nothing here yet". Props: icon | glyph, title, action, children.
 *   Modal         Accessible dialog in a portal (focus moves in, Escape closes, focus restored, Tab trapped).
 *                 Props: open, onClose, title (shown + aria-label), size ('sm'|'md'|'lg'), tone, className.
 *   Tabs          Tab list with arrow-key navigation (render panels yourself; give them id `${idBase}-panel-${tab.id}`).
 *                 Props: tabs [{id,label,badge?}], value, onChange, label (aria-label), idBase.
 *
 * Numbers & progress
 *   Stars         Row of 0–3 (or `max`) stars. Props: value, max, size ('sm'|'md'|'lg'), animate (pop in, with sound
 *                 when `sound`), label (overrides the aria-label).
 *   ProgressBar   Horizontal bar, role=progressbar. Props: value 0–1, tone ('primary'|'gold'|'ok'|'flame'), size ('xs'|'sm'|'md'|'lg'),
 *                 label (aria-label), from (animate from this value on mount).
 *   ProgressRing  Circular progress with content in the middle. Props: value 0–1, size px, stroke px, tone, label, children.
 *   StatTile      Big number with label. Props: label, value, sub, icon, tone, href.
 *   Pill          Small rounded counter/label. Props: tone ('neutral'|'primary'|'gold'|'ok'|'err'|'warn'|'flame'), icon, title, className.
 *   Clock         Static time display m:ss (or h:mm:ss). Props: ms, label, tone. Also `formatClock(ms)`.
 *   Countdown     Live countdown to a timestamp; turns urgent under 10 s. Props: until (epoch ms), onDone, label.
 *   Stopwatch     Live count-up from a timestamp (the Daily Proof clock). Props: since (epoch ms), stopped (ms to freeze at), label.
 *
 * Feedback
 *   celebrate(kind, at?)  Particle burst/confetti: 'tick'|'solve'|'star'|'quest'|'levelup'|'boss'|'win'|'world'.
 *                         Respects reduced motion. `centerOf(el)` gives an origin.
 *   sfx.play(name)        Synthesised sound: 'tap'|'correct'|'wrong'|'solve'|'star'|'levelup'|'quest'|'win'|'lose'|'tick'|'badge'|'open'.
 *                         Quiet, gated by settings.sound, only after a user gesture, never throws.
 *   Icon, WorldEmblem     Inline SVG icons and world glyph emblems (see icons.tsx).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ScreenId } from '../../content/types.ts';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { Icon, type IconName } from './icons.tsx';
import { Markdown } from './Markdown.tsx';
import { sfx } from './sfx.ts';
import { motionReduced } from './celebrate.ts';

export { celebrate, centerOf, motionReduced } from './celebrate.ts';
export type { CelebrateKind } from './celebrate.ts';
export { sfx } from './sfx.ts';
export type { SfxName } from './sfx.ts';
export { Icon, WorldEmblem, worldGlyph, worldHue } from './icons.tsx';
export type { IconName } from './icons.tsx';

type Tone = 'default' | 'primary' | 'gold' | 'ok' | 'flat' | 'err' | 'warn';

/* ───────────────────────── ScreenHeader ───────────────────────── */

export function ScreenHeader({
  id,
  title,
  eyebrow,
  icon,
  actions,
  children,
  className = '',
}: {
  id: ScreenId;
  title?: string;
  eyebrow?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const copy = data.screen(id);
  const key = `intro:${id}`;
  const seenAt = useGame((s) => s.save.seen[key]);
  // Decide once per mount: expanded on the first visit, except on play screens, where the
  // puzzle must stay above the fold (the explanation is one click away).
  const playScreen = id === 'arena-daily' || id === 'arena-puzzles' || id === 'arena-rush';
  const [open, setOpen] = useState(() => !seenAt && !playScreen);
  const panelId = useId();
  useEffect(() => {
    if (copy?.about && !seenAt) game().markSeen(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const t = copy?.title ?? title ?? '';
  const hasAbout = !!copy?.about?.trim();
  const tips = (copy?.tips ?? []).filter((x) => x.trim());
  return (
    <header className={`screen-header ${className}`}>
      <div className="sh-main">
        <div className="sh-text">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="sh-title">
            {icon && <span className="sh-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>}
            {t}
          </h1>
          {copy?.lede && <div className="lede sh-lede"><Markdown text={copy.lede} /></div>}
          {children}
        </div>
        {actions && <div className="sh-actions">{actions}</div>}
      </div>
      {hasAbout && (
        <div className={`sh-about ${open ? 'open' : ''}`}>
          <button type="button" className="sh-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
            <Icon name="about" size={16} />
            <span>How this works</span>
            <Icon name="chevron-down" size={16} className="sh-chev" />
          </button>
          {open && (
            <div className="sh-panel" id={panelId}>
              <Markdown text={copy!.about} className="sh-about-md" />
              {tips.length > 0 && (
                <ul className="sh-tips" aria-label="Tips">
                  {tips.map((tip, i) => (
                    <li key={i}><Icon name="bulb" size={16} /><Markdown text={tip} className="inline-md" /></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

/* ───────────────────────── Card, EmptyState ───────────────────────── */

export function Card({
  as = 'div',
  href,
  tone = 'default',
  interactive = false,
  className = '',
  children,
  style,
  ...rest
}: {
  as?: 'div' | 'section' | 'article' | 'a' | 'li' | 'aside';
  href?: string;
  tone?: Tone;
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const cls = `card tone-${tone}${interactive || href ? ' interactive' : ''} ${className}`;
  if (as === 'a' || href) return <a className={cls} href={href} style={style} {...rest}>{children}</a>;
  const T = as;
  return <T className={cls} style={style} {...rest}>{children}</T>;
}

export function EmptyState({ icon, glyph, title, action, children }: { icon?: IconName; glyph?: string; title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="es-mark" aria-hidden="true">{glyph ? <span className="es-glyph">{glyph}</span> : <Icon name={icon ?? 'sparkle'} size={28} />}</div>
      <h2 className="es-title">{title}</h2>
      {children && <div className="es-body">{children}</div>}
      {action && <div className="es-action">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Pill, Stars ───────────────────────── */

export function Pill({ tone = 'neutral', icon, title, className = '', children }: { tone?: 'neutral' | 'primary' | 'gold' | 'ok' | 'err' | 'warn' | 'flame'; icon?: IconName; title?: string; className?: string; children?: ReactNode }) {
  return (
    <span className={`pill pill-${tone} ${className}`} title={title}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export function Stars({ value, max = 3, size = 'md', animate = false, sound = false, label, className = '' }: { value: number; max?: number; size?: 'sm' | 'md' | 'lg' | 'xl'; animate?: boolean; sound?: boolean; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(max, Math.round(value)));
  useEffect(() => {
    if (!animate || !sound || v === 0) return;
    const ids: number[] = [];
    for (let i = 0; i < v; i++) ids.push(window.setTimeout(() => sfx.play('star'), 260 + i * 230));
    return () => ids.forEach(clearTimeout);
  }, [animate, sound, v]);
  return (
    <span className={`stars stars-${size} ${animate ? 'animate' : ''} ${className}`} role="img" aria-label={label ?? `${v} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`star ${i < v ? 'on' : 'off'}`} style={animate ? ({ animationDelay: `${200 + i * 230}ms` } as CSSProperties) : undefined}>
          <Icon name="star" size="1em" />
        </span>
      ))}
    </span>
  );
}

/* ───────────────────────── ProgressBar, ProgressRing ───────────────────────── */

export function ProgressBar({ value, tone = 'primary', size = 'sm', label, from, className = '', showValue = false }: { value: number; tone?: 'primary' | 'gold' | 'ok' | 'flame'; size?: 'xs' | 'sm' | 'md' | 'lg'; label?: string; from?: number; className?: string; showValue?: boolean }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const [shown, setShown] = useState(from !== undefined ? Math.max(0, Math.min(1, from)) : v);
  useEffect(() => {
    if (from === undefined || motionReduced()) {
      setShown(v);
      return;
    }
    const id = window.setTimeout(() => setShown(v), 350);
    return () => clearTimeout(id);
  }, [v, from]);
  return (
    <div
      className={`pbar pbar-${tone} pbar-${size} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <span className="pbar-fill" style={{ width: `${shown * 100}%` }} />
      {showValue && <span className="pbar-value">{Math.round(v * 100)}%</span>}
    </div>
  );
}

export function ProgressRing({ value, size = 64, stroke = 6, tone = 'primary', label, className = '', children, track = true }: { value: number; size?: number; stroke?: number; tone?: 'primary' | 'gold' | 'ok' | 'flame' | 'muted'; label?: string; className?: string; children?: ReactNode; track?: boolean }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={`pring pring-${tone} ${className}`} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        {track && <circle className="pring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />}
        <circle
          className="pring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ opacity: v > 0 ? 1 : 0 }}
        />
      </svg>
      {children !== undefined && <span className="pring-in">{children}</span>}
    </span>
  );
}

/* ───────────────────────── StatTile ───────────────────────── */

export function StatTile({ label, value, sub, icon, tone = 'neutral', href, className = '' }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: 'neutral' | 'primary' | 'gold' | 'ok' | 'flame'; href?: string; className?: string }) {
  const inner = (
    <>
      {icon && <span className="st-icon" aria-hidden="true"><Icon name={icon} size={20} /></span>}
      <span className="st-value tnum">{value}</span>
      <span className="st-label">{label}</span>
      {sub && <span className="st-sub">{sub}</span>}
    </>
  );
  return href ? <a className={`stat-tile st-${tone} interactive ${className}`} href={href}>{inner}</a> : <div className={`stat-tile st-${tone} ${className}`}>{inner}</div>;
}

/* ───────────────────────── Tabs ───────────────────────── */

export function Tabs<T extends string>({ tabs, value, onChange, label, idBase = 'tabs', className = '' }: { tabs: { id: T; label: ReactNode; badge?: ReactNode; icon?: IconName }[]; value: T; onChange: (id: T) => void; label: string; idBase?: string; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j >= 0) {
      e.preventDefault();
      onChange(tabs[j].id);
      refs.current[j]?.focus();
    }
  };
  return (
    <div className={`tabbar ${className}`} role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`${idBase}-panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          className={`tab ${value === t.id ? 'on' : ''}`}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
          {t.badge !== undefined && t.badge !== null && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Modal ───────────────────────── */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, hideTitle = false, size = 'md', tone = 'default', className = '', children }: { open: boolean; onClose: () => void; title: string; hideTitle?: boolean; size?: 'sm' | 'md' | 'lg' | 'sheet'; tone?: Tone; className?: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', k);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', k);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className={`modal-back ${size === 'sheet' ? 'sheet-back' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size} tone-${tone} ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className={`modal-head ${hideTitle ? 'sr-only' : ''}`}>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button type="button" className="btn ghost icon modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ───────────────────────── Clock, Countdown, Stopwatch ───────────────────────── */

export function formatClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export function Clock({ ms, label, tone = 'neutral', className = '' }: { ms: number; label?: string; tone?: 'neutral' | 'urgent' | 'ok' | 'gold'; className?: string }) {
  return (
    <span className={`clock clock-${tone} ${className}`} role="timer" aria-label={label ? `${label}: ${formatClock(ms)}` : undefined}>
      <Icon name="clock" size={16} />
      <span className="clock-digits tnum">{formatClock(ms)}</span>
    </span>
  );
}

function useTick(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

export function Countdown({ until, onDone, label = 'Time left', className = '' }: { until: number; onDone?: () => void; label?: string; className?: string }) {
  const now = useTick(true);
  const left = Math.max(0, until - now);
  const fired = useRef(false);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onDone?.();
    }
  }, [left, onDone]);
  return <Clock ms={left + 999} label={label} tone={left < 10_000 ? 'urgent' : 'neutral'} className={className} />;
}

export function Stopwatch({ since, stopped, label = 'Time', className = '' }: { since: number; stopped?: number; label?: string; className?: string }) {
  const now = useTick(stopped === undefined, 500);
  return <Clock ms={stopped ?? now - since} label={label} className={className} />;
}
