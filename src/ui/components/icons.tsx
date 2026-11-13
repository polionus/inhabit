/**
 * Inline SVG icons (24×24 grid, stroke = currentColor) and world emblems.
 *
 *   <Icon name="star" />                 decorative (aria-hidden); label the control around it
 *   <Icon name="lock" title="Locked" />  standalone meaning: gets role="img" and a title
 *   <WorldEmblem worldId="logic" />      the world's glyph (∧, ∀, …) or the forge mark
 *   worldHue(worldId)                    the world's hue (0–360) for its token colour
 */
import type { CSSProperties } from 'react';

const P = {
  home: 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z',
  map: 'M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z M9 4v14 M15 6v14',
  arena: 'M14.5 17.5 3 6V3h3l11.5 11.5 M13 19l6-6 M16 16l4 4 M19 21l2-2 M9.5 17.5 21 6V3h-3L6.5 14.5 M11 19l-6-6 M8 16l-4 4 M5 21l-2-2',
  review: 'M3.5 12a8.5 8.5 0 0 1 14.7-5.8L20.5 8.5 M20.5 3.5v5h-5 M20.5 12a8.5 8.5 0 0 1-14.7 5.8L3.5 15.5 M3.5 20.5v-5h5',
  guide: 'M2.5 5.5C5 4 8.5 4 12 6c3.5-2 7-2 9.5-.5V19c-2.5-1.5-6-1.5-9.5.5-3.5-2-7-2-9.5-.5z M12 6v13.5',
  codex: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3 M9 7.5h6 M9 11h4',
  sandbox: 'm8 7-5 5 5 5 M16 7l5 5-5 5 M13.5 4l-3 16',
  workshop: 'M14 10 4.5 19.5a1.8 1.8 0 0 1-2.5-2.5L11.5 7.5 M12.5 4.5 15 2l7 7-2.5 2.5z M10.5 6.5l7 7',
  graduate: 'M2 9.5 12 4.5l10 5-10 5z M6 11.5v5c3.5 2.5 8.5 2.5 12 0v-5 M22 9.5V15',
  about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5.5 M12 7.6v.01',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1.4-3.8 4.4-5.8 8-5.8s6.6 2 8 5.8',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  sound: 'M4 9h3.5L13 4.5v15L7.5 15H4z M16.5 8.8a4.5 4.5 0 0 1 0 6.4 M19 6.3a8 8 0 0 1 0 11.4',
  mute: 'M4 9h3.5L13 4.5v15L7.5 15H4z M17 9.5l5 5 M22 9.5l-5 5',
  bolt: 'M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z',
  trophy: 'M8 21h8 M12 16.5V21 M7 3.5h10V9a5 5 0 0 1-10 0z M7 5.5H3.5v1.2A3.3 3.3 0 0 0 7 10 M17 5.5h3.5v1.2A3.3 3.3 0 0 1 17 10',
  lock: 'M6.5 11h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11z M8 11V8a4 4 0 0 1 8 0v3',
  check: 'M4.5 12.5 9.5 17.5 19.5 7',
  'chevron-right': 'm9 5.5 6.5 6.5L9 18.5',
  'chevron-left': 'M15 5.5 8.5 12l6.5 6.5',
  'chevron-down': 'm5.5 9 6.5 6.5L18.5 9',
  'arrow-right': 'M4.5 12h15 M13 5.5l6.5 6.5-6.5 6.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3.5 2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 12.6a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2z',
  crown: 'M3.5 8 7.8 12 12 5l4.2 7 4.3-4-1.8 11H5.3z',
  close: 'M6 6l12 12 M18 6 6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20.5 20.5 16 16',
  calendar: 'M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5z M3.5 10h17 M8 3v4 M16 3v4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  list: 'M9 6h12 M9 12h12 M9 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12.3l2.8 2.8L16.5 9.5',
  translate: 'M4 7h11 M11.5 3.5 15 7l-3.5 3.5 M20 17H9 M12.5 13.5 9 17l3.5 3.5',
  turnstile: 'M6.5 4v16 M6.5 12h12',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z',
  bag: 'M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z M9 8V6.5a3 3 0 0 1 6 0V8',
  warn: 'M12 3.5 2.5 20h19z M12 10v4.5 M12 17.3v.01',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  sparkle: 'M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z M19 15.5c.3 1.9 1 2.6 2.5 2.9-1.5.3-2.2 1-2.5 2.9-.3-1.9-1-2.6-2.5-2.9 1.5-.3 2.2-1 2.5-2.9z',
  download: 'M12 3.5v12 M6.5 10.5 12 16l5.5-5.5 M4.5 20.5h15',
  upload: 'M12 16V4 M6.5 9.5 12 4l5.5 5.5 M4.5 20.5h15',
  reset: 'M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8.5 M3.5 3.5v5h5',
  play: 'M7.5 4.8v14.4L19.5 12z',
  book: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H11v16H5.5A1.5 1.5 0 0 0 4 20.5z M20 4.5A1.5 1.5 0 0 0 18.5 3H13v16h5.5a1.5 1.5 0 0 1 1.5 1.5z',
  copy: 'M9 9h10.5v11.5H9z M15 9V4.5H4.5V15H9',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  quest: 'M6 21V4 M6 4.5h11.5l-2.5 4 2.5 4H6',
} satisfies Record<string, string>;

/** Icons drawn filled rather than stroked. */
const FILLED = new Set(['star', 'flame', 'play', 'crown-fill']);
const FILLED_PATH: Record<string, string> = {
  star: 'M12 2.6l2.85 5.95 6.55.85-4.8 4.55 1.22 6.5L12 17.3l-5.82 3.15 1.22-6.5L2.6 9.4l6.55-.85z',
  flame: 'M12 22c4.2 0 7.3-2.8 7.3-7.1 0-3.4-2-6.4-3.9-8.1.1 2.2-.9 3.8-2.3 4.5C13.1 8.4 11.6 4.9 8.6 2.4c.3 3.6-3.9 6.6-3.9 12.5C4.7 19.2 7.8 22 12 22zm0-2.2c-1.9 0-3.2-1.2-3.2-3 0-2 1.6-3.2 2.2-5 .9 1.7 4.2 2.6 4.2 5 0 1.8-1.3 3-3.2 3z',
  play: 'M7.5 4.8v14.4L19.5 12z',
  'crown-fill': 'M3.5 8 7.8 12 12 5l4.2 7 4.3-4-1.8 11H5.3z',
};

export type IconName = keyof typeof P | 'star' | 'flame' | 'crown-fill';

export function Icon({ name, size = 20, className = '', title, style, strokeWidth = 2 }: { name: IconName; size?: number | string; className?: string; title?: string; style?: CSSProperties; strokeWidth?: number }) {
  const filled = FILLED.has(name);
  const d = filled ? FILLED_PATH[name] : (P as Record<string, string>)[name];
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true as const };
  return (
    <svg
      className={`icon icon-${name} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      style={style}
      {...a11y}
    >
      {title && <title>{title}</title>}
      <path d={d} fillRule={name === 'flame' ? 'evenodd' : undefined} />
    </svg>
  );
}

/** Each world's glyph emblem. The forge gets a drawn mark (null here). */
const EMBLEMS: Record<string, string | null> = {
  types: 'λ', props: '⊢', logic: '∧', quant: '∀', eq: '=', nat: 'ℕ', sets: '∈', fun: '∘', num: '∣', forge: null,
  // fixture worlds
  basics: 'λ', empty: '∅',
};
const HUES: Record<string, number> = {
  types: 258, props: 222, logic: 192, quant: 168, eq: 140, nat: 42, sets: 328, fun: 292, num: 22, forge: 4,
  basics: 258, empty: 210,
};

export const worldGlyph = (id: string, title = ''): string | null => (id in EMBLEMS ? EMBLEMS[id] : (title.trim()[0] ?? '?').toUpperCase());
export const worldHue = (id: string): number => HUES[id] ?? ([...id].reduce((h, c) => h + c.charCodeAt(0) * 37, 0) % 360);

/** A world's emblem glyph, sized by the parent's font-size. Decorative. */
export function WorldEmblem({ worldId, title = '', className = '' }: { worldId: string; title?: string; className?: string }) {
  const g = worldGlyph(worldId, title);
  if (g === null) {
    // the forge: an anvil with a spark
    return (
      <svg className={`emblem-glyph emblem-svg ${className}`} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M2.5 8.2h12.8c.4 2.4 2.4 3.6 6.2 3.6v1.4c-2.4.1-3.9 1-4.5 2.6v1.4h1.7v2.6H5.6v-2.6h1.9v-1.6c0-2-1.6-3.6-5-4.3z" />
        <path fill="currentColor" d="M18.6 2.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" opacity=".85" />
      </svg>
    );
  }
  return <span className={`emblem-glyph ${className}`} aria-hidden="true">{g}</span>;
}
