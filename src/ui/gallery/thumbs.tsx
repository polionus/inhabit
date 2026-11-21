/** Small static pictures for the Gallery index cards (viewBox 240×128, colors from tokens via gallery.css). */
import type { ReactElement } from 'react';
import type { ExhibitId } from '../../gallery/registry.ts';

const box = (children: ReactElement | ReactElement[]) => (
  <svg viewBox="0 0 240 128" aria-hidden="true" preserveAspectRatio="xMidYMid meet">{children}</svg>
);

export const thumbs: Record<ExhibitId, () => ReactElement> = {
  'proof-replay': () => box([
    <rect key="a" x="24" y="22" width="86" height="84" rx="8" className="th-cell" />,
    <text key="b" x="36" y="46" className="th-muted">intro h</text>,
    <rect key="c" x="30" y="54" width="74" height="18" rx="4" className="th-fill" />,
    <text key="d" x="36" y="67" className="th-text" style={{ fontSize: 12 }}>apply f</text>,
    <text key="e" x="36" y="92" className="th-muted">exact h</text>,
    <path key="f" d="M118 64 h18" className="th-arrow" />,
    <path key="g" d="M131 58 l6 6 -6 6" className="th-arrow" />,
    <rect key="h" x="146" y="40" width="72" height="48" rx="8" className="th-soft" />,
    <text key="i" x="156" y="70" className="th-text">⊢ Q</text>,
  ]),
  'truth-table': () => box([
    ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => (
      <rect key={`${r}${c}`} x={52 + c * 46} y={16 + r * 25} width="40" height="20" rx="4" className={c === 2 ? (r === 3 ? 'th-err' : 'th-ok') : 'th-cell'} opacity={c === 2 ? 0.75 : 1} />
    ))),
  ]),
  'quantifier-game': () => box([
    <text key="a" x="64" y="124" className="th-muted">∀ x</text>,
    <text key="b" x="162" y="124" className="th-muted">∃ y</text>,
    ...[0, 1, 2, 3].map((i) => <circle key={`l${i}`} cx="70" cy={18 + i * 24} r="8" className="th-node" />),
    ...[0, 1, 2, 3].map((i) => <circle key={`r${i}`} cx="170" cy={18 + i * 24} r="8" className="th-node" />),
    ...[[0, 1], [1, 2], [2, 3], [3, 3]].map(([a, b], i) => <path key={`e${i}`} d={`M78 ${18 + a * 24} L162 ${18 + b * 24}`} className="th-arrow" opacity={0.8} />),
  ]),
  'rewrite-compute': () => box([
    <text key="a" x="26" y="52" className="th-text">a + 0 = b</text>,
    <rect key="b" x="22" y="36" width="44" height="22" rx="4" className="th-fill" opacity={0.35} />,
    <path key="c" d="M60 64 q30 26 60 0" className="th-arrow" />,
    <text key="d" x="96" y="98" className="th-text">a = b</text>,
    <text key="e" x="170" y="52" className="th-muted">rw [h]</text>,
  ]),
  'induction-dominoes': () => box(
    [0, 1, 2, 3, 4, 5, 6].map((i) => (
      <rect key={i} x={30 + i * 28} y="34" width="12" height="60" rx="3" className={i < 4 ? 'th-fill' : 'th-cell'}
        transform={i < 3 ? `rotate(${58 - i * 4} ${42 + i * 28} 94)` : undefined} />
    )),
  ),
  venn: () => box([
    <circle key="a" cx="98" cy="54" r="34" className="th-soft" opacity={0.85} />,
    <circle key="b" cx="142" cy="54" r="34" className="th-soft" opacity={0.85} />,
    <circle key="c" cx="120" cy="88" r="34" className="th-soft" opacity={0.85} />,
    <path key="d" d="M120 27 a34 34 0 0 1 0 54 a34 34 0 0 1 0 -54" className="th-fill" />,
  ]),
  'function-arrows': () => box([
    <ellipse key="a" cx="70" cy="64" rx="34" ry="50" className="th-cell" />,
    <ellipse key="b" cx="170" cy="64" rx="34" ry="50" className="th-cell" />,
    ...[0, 1, 2].map((i) => <circle key={`l${i}`} cx="70" cy={32 + i * 32} r="6" className="th-gold" />),
    ...[0, 1, 2, 3].map((i) => <circle key={`r${i}`} cx="170" cy={24 + i * 27} r="6" className="th-gold" />),
    ...[[0, 0], [1, 2], [2, 3]].map(([a, b], i) => <path key={`e${i}`} d={`M77 ${32 + a * 32} L162 ${24 + b * 27}`} className="th-arrow" />),
  ]),
  'cantor-diagonal': () => box([
    ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => (
      <rect key={`${r}${c}`} x={64 + c * 28} y={10 + r * 28} width="24" height="24" rx="4" className={r === c ? 'th-fill' : 'th-cell'} />
    ))),
    <path key="d" d="M60 6 L184 118" className="th-arrow" strokeDasharray="4 4" />,
  ]),
};
