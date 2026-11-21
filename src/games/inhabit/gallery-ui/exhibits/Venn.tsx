/** Gallery exhibit 'venn': type set expressions in Lean notation, see their regions shaded, test equalities. */
import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ExhibitProps } from '../types.ts';
import { href } from '../../routes.ts';
import { hasRegion, memberPhrase, parseSet, regionsOf, verdict } from '../../gallery/venn.ts';
import type { ParseResult, Relation } from '../../gallery/venn.ts';
import { leanInfo } from '../../gallery/venn-lean.ts';
import { ExhibitIntro, TryThis, Zone, Verdict, TaughtIn } from '../kit.tsx';
import '../gallery-venn.css';

const W = 400;
const H = 330;
const R = 85;
const CIRCLES = [
  { n: 'A', x: 155, y: 125 },
  { n: 'B', x: 245, y: 125 },
  { n: 'C', x: 200, y: 200 },
];
/** Where to put a marker in each region (mask 0..7). */
const CENTERS: [number, number][] = [[40, 295], [112, 98], [288, 98], [200, 80], [200, 258], [150, 188], [250, 188], [200, 150]];

const outPath = (c: { x: number; y: number }) =>
  `M0 0H${W}V${H}H0Z M${c.x - R} ${c.y}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;

const PRESETS: { label: string; left: string; right: string; rel: Relation }[] = [
  { label: 'Distributivity', left: 'A ∩ (B ∪ C)', right: '(A ∩ B) ∪ (A ∩ C)', rel: 'eq' },
  { label: 'De Morgan', left: '(A ∪ B)ᶜ', right: 'Aᶜ ∩ Bᶜ', rel: 'eq' },
  { label: 'A \\ B is A ∩ Bᶜ', left: 'A \\ B', right: 'A ∩ Bᶜ', rel: 'eq' },
  { label: 'Absorption', left: 'A ∩ (A ∪ B)', right: 'A', rel: 'eq' },
  { label: 'Not equal: A ∪ B vs A', left: 'A ∪ B', right: 'A', rel: 'eq' },
  { label: 'A ∩ B is inside A', left: 'A ∩ B', right: 'A', rel: 'subset' },
];

const SYMBOLS = ['∩', '∪', '\\', 'ᶜ', '(', ')', '∅'];

export default function Venn(_props: ExhibitProps) {
  const [left, setLeft] = useState(PRESETS[0].left);
  const [right, setRight] = useState(PRESETS[0].right);
  const [rel, setRel] = useState<Relation>('eq');
  const [sel, setSel] = useState<number | null>(null);
  const [preset, setPreset] = useState<string | null>(PRESETS[0].label);
  const focused = useRef<'left' | 'right'>('left');
  const refs = { left: useRef<HTMLInputElement>(null), right: useRef<HTMLInputElement>(null) };

  const pl: ParseResult = useMemo(() => parseSet(left), [left]);
  const pr: ParseResult = useMemo(() => parseSet(right), [right]);
  const ok = pl.ok && pr.ok;
  const lm = pl.ok ? regionsOf(pl.e) : 0;
  const shaded = (m: number) => { let n = 0; for (let x = m; x; x &= x - 1) n++; return n; };
  const rm = pr.ok ? regionsOf(pr.e) : 0;
  const v = ok ? verdict(lm, rm, rel) : null;
  const lean = useMemo(() => (pl.ok && pr.ok && v ? leanInfo(pl.e, pr.e, rel, v.holds) : null), [pl, pr, rel, v?.holds]); // eslint-disable-line react-hooks/exhaustive-deps

  const insert = (s: string) => {
    const side = focused.current;
    const el = refs[side].current;
    const cur = side === 'left' ? left : right;
    const set = side === 'left' ? setLeft : setRight;
    const a = el?.selectionStart ?? cur.length;
    const b = el?.selectionEnd ?? cur.length;
    set(cur.slice(0, a) + s + cur.slice(b));
    setPreset(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(a + s.length, a + s.length);
    });
  };

  const load = (p: (typeof PRESETS)[number]) => {
    setLeft(p.left);
    setRight(p.right);
    setRel(p.rel);
    setSel(null);
    setPreset(p.label);
  };

  const wrap = (r: number, inner: React.ReactNode) => {
    let node = inner;
    for (let i = 2; i >= 0; i--) {
      node = <g clipPath={`url(#venn-${r & (1 << i) ? 'in' : 'out'}-${CIRCLES[i].n})`}>{node}</g>;
    }
    return node;
  };
  const key = (e: KeyboardEvent, r: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSel(sel === r ? null : r);
    }
  };

  return (
    <div className="venn">
      <ExhibitIntro lead="Pick a preset and see whether the two shaded pictures match.">
        <p>
          Three sets sit inside a universe, which cuts it into eight regions. Type an expression on each side and its regions
          get shaded, so you can see at a glance whether two expressions describe the same set. Click a region to ask what
          it means for an element to live there.
        </p>
      </ExhibitIntro>
      <TryThis presets={PRESETS.map((p) => ({ label: p.label, active: preset === p.label, onPick: () => load(p) }))} />

      <Zone kind="play" label="Your expressions" className="venn-inputzone">
      <div className="venn-inputs">
        {(['left', 'right'] as const).map((side) => {
          const p = side === 'left' ? pl : pr;
          const val = side === 'left' ? left : right;
          return (
            <label key={side} className="venn-field">
              <span className={`venn-key venn-key-${side}`}>{side === 'left' ? 'Left (solid)' : 'Right (hatched)'}</span>
              <input
                ref={refs[side]}
                className={'venn-input' + (p.ok ? '' : ' bad')}
                value={val}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!p.ok}
                onFocus={() => (focused.current = side)}
                onChange={(e) => { (side === 'left' ? setLeft : setRight)(e.target.value); setPreset(null); }}
              />
              {!p.ok && <span className="venn-err" role="alert">{p.error}</span>}
            </label>
          );
        })}
        <div className="venn-symbols" role="group" aria-label="Symbols">
          {SYMBOLS.map((s) => (
            <button key={s} type="button" className="btn btn-sm venn-sym" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)} aria-label={`insert ${s}`}>{s}</button>
          ))}
          <button type="button" className="btn btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => insert('Set.univ')}>Set.univ</button>
          <span className="venn-rel" role="group" aria-label="Relation">
            <button type="button" className={'btn btn-sm' + (rel === 'eq' ? ' on' : '')} aria-pressed={rel === 'eq'} onClick={() => { setRel('eq'); setPreset(null); }}>=</button>
            <button type="button" className={'btn btn-sm' + (rel === 'subset' ? ' on' : '')} aria-pressed={rel === 'subset'} onClick={() => { setRel('subset'); setPreset(null); }}>⊆</button>
          </span>
        </div>
      </div>
      </Zone>

      <div className="venn-main">
        <Zone kind="play" label="Diagram" className="venn-diagram">
        <svg className="venn-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Venn diagram of A, B and C inside a universe">
          <defs>
            <pattern id="venn-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="9" className="venn-hatch-line" />
            </pattern>
            {CIRCLES.map((c) => (
              <clipPath key={'i' + c.n} id={`venn-in-${c.n}`}>
                <circle cx={c.x} cy={c.y} r={R} />
              </clipPath>
            ))}
            {CIRCLES.map((c) => (
              <clipPath key={'o' + c.n} id={`venn-out-${c.n}`}>
                <path d={outPath(c)} clipRule="evenodd" />
              </clipPath>
            ))}
          </defs>
          <rect x="1" y="1" width={W - 2} height={H - 2} rx="10" className="venn-universe" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
            <g
              key={r}
              className={'venn-region' + (sel === r ? ' sel' : '')}
              role="button"
              tabIndex={0}
              aria-pressed={sel === r}
              aria-label={`Region ${memberPhrase(r)}. Left: ${hasRegion(lm, r) ? 'shaded' : 'not shaded'}. Right: ${hasRegion(rm, r) ? 'shaded' : 'not shaded'}.`}
              onClick={() => setSel(sel === r ? null : r)}
              onKeyDown={(e) => key(e, r)}
            >
              {wrap(
                r,
                <>
                  <rect width={W} height={H} className="venn-hit" />
                  {ok && hasRegion(lm, r) && <rect width={W} height={H} className="venn-left" />}
                  {ok && hasRegion(rm, r) && <rect width={W} height={H} fill="url(#venn-hatch)" />}
                  {sel === r && <rect width={W} height={H} className="venn-sel" />}
                </>,
              )}
            </g>
          ))}
          {CIRCLES.map((c) => (
            <circle key={c.n} cx={c.x} cy={c.y} r={R} className="venn-ring" />
          ))}
          {v && !v.holds && v.witnesses.map((r) => (
            <g key={r} className="venn-witness" aria-hidden="true">
              <circle cx={CENTERS[r][0]} cy={CENTERS[r][1]} r="11" />
              <text x={CENTERS[r][0]} y={CENTERS[r][1] + 5} textAnchor="middle">≠</text>
            </g>
          ))}
          <text x="88" y="48" className="venn-name">A</text>
          <text x="312" y="48" className="venn-name">B</text>
          <text x="200" y="312" textAnchor="middle" className="venn-name">C</text>
          <text x="20" y="30" className="venn-name venn-uni">universe</text>
        </svg>
        <p className="venn-legend small muted">
          <span className="sw sw-left" /> left <span className="sw sw-right" /> right <span className="sw sw-sel" /> selected
          {' '}<span className="venn-ne">≠</span> region where they differ. Notation: <code>∩</code> and <code>\</code> bind tighter than <code>∪</code>; <code>ᶜ</code> is the complement.
        </p>
        </Zone>

        <div className="venn-side">
          <Verdict tone={v ? (v.holds ? 'ok' : 'no') : 'info'}>{v ? v.text : 'Fix the expression to compare.'}{v && <span className="sr-only"> Left shades {shaded(lm)} of 8 regions; right shades {shaded(rm)}.</span>}</Verdict>

          <Zone kind="explain" label="Region" className="venn-card">
            {sel === null ? (
              <p className="muted small">Click a region of the diagram to see which expressions contain it.</p>
            ) : (
              <>
                <p><strong>{memberPhrase(sel)}.</strong></p>
                <p className="small">
                  Left <code>{left}</code>: {ok ? (hasRegion(lm, sel) ? 'contains x' : 'does not contain x') : '?'}.<br />
                  Right <code>{right}</code>: {ok ? (hasRegion(rm, sel) ? 'contains x' : 'does not contain x') : '?'}.
                </p>
              </>
            )}
          </Zone>

          {lean && (
            <Zone kind="lean" label="In Lean" className="venn-card">
              <pre className="venn-code">{lean.statement}</pre>
              <p className="small muted">
                {!lean.elaborates
                  ? 'The game’s engine could not read this statement.'
                  : v?.holds
                    ? rel === 'eq'
                      ? `The engine reads this as a statement about sets. It holds for every A, B, C, since the shaded regions agree. Lean proves it with ext x, then a propositional argument on memberships.`
                      : 'The engine reads this as a statement about sets. It holds for every A, B, C. Lean proves it by intro x hx, then a propositional argument.'
                    : 'The engine reads this statement, but it is false in general: a set with an element in the marked region is a counterexample, so Lean can’t prove it.'}
              </p>
              {lean.proof && (
                <details>
                  <summary>Show a proof the engine accepts</summary>
                  <pre className="venn-code">{lean.proof}</pre>
                </details>
              )}
              {lean.noProof && v?.holds && <p className="small muted">The automatic prover found no constructive proof here (this one may need classical reasoning), so none is shown.</p>}
            </Zone>
          )}
        </div>
      </div>

      <TaughtIn links={[
        { href: href.level('sets-04'), title: 'Intersection is “and”' },
        { href: href.level('sets-10'), title: 'De Morgan for sets' },
        { href: href.level('sets-13'), title: 'Distributivity' },
      ]} />
    </div>
  );
}
