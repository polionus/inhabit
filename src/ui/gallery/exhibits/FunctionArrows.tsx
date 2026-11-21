/** Gallery exhibit 'function-arrows': draw a function between two small sets, see injective/surjective light up. */
import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ExhibitProps } from '../types.ts';
import { href } from '../../router.ts';
import {
  MAX_SIZE, MIN_SIZE, PRESETS, aName, analyze, bName, collision, image, indegrees, missed, preimage, resize, setArrow, showCod, showDom,
} from '../../../gallery/function-arrows.ts';
import type { Fn } from '../../../gallery/function-arrows.ts';
import { checkFn, definitionsAgree } from '../../../gallery/function-arrows-lean.ts';
import { ExhibitIntro, TryThis, Zone, Verdict, TaughtIn } from '../kit.tsx';
import '../../styles/gallery-function-arrows.css';

type Mode = 'draw' | 'image' | 'preimage';
const W = 420;
const H = 350;
const XA = 84;
const XB = 336;
const RAD = 18;
const GAP = 56;
const ys = (n: number, i: number) => H / 2 + (i - (n - 1) / 2) * GAP;

const MODES: { id: Mode; label: string; help: string }[] = [
  { id: 'draw', label: 'Draw arrows', help: 'Click a dot on the left, then a dot on the right to point its arrow there. With a left dot focused, the up and down arrow keys move its arrow.' },
  { id: 'image', label: 'Image of a subset', help: 'Click dots on the left to select a subset S. The dots its arrows reach, f(S), light up.' },
  { id: 'preimage', label: 'Preimage of a subset', help: 'Click dots on the right to select a subset T. The dots on the left that land in T, f⁻¹(T), light up.' },
];

export default function FunctionArrows(_props: ExhibitProps) {
  const [fn, setFn] = useState<Fn>(PRESETS[0].fn);
  const [mode, setMode] = useState<Mode>('draw');
  const [active, setActive] = useState<number | null>(0);
  const [selA, setSelA] = useState<Set<number>>(new Set([0, 1]));
  const [selB, setSelB] = useState<Set<number>>(new Set());
  const [note, setNote] = useState(PRESETS[0].note);
  const [preset, setPreset] = useState<string | null>(PRESETS[0].id);

  const an = useMemo(() => analyze(fn), [fn]);
  const lean = useMemo(() => checkFn(fn), [fn]);
  const defs = useMemo(() => definitionsAgree(), []);
  const inDeg = indegrees(fn);
  const col = collision(fn);
  const miss = missed(fn);
  const img = useMemo(() => image(fn, selA), [fn, selA]);
  const pre = useMemo(() => preimage(fn, selB), [fn, selB]);

  const toggle = (s: Set<number>, i: number) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  };
  const clickA = (i: number) => {
    if (mode === 'image') setSelA(toggle(selA, i));
    else if (mode === 'draw') setActive(i);
  };
  const clickB = (j: number) => {
    if (mode === 'draw') {
      if (active !== null) { setFn(setArrow(fn, active, j)); setPreset(null); }
      else setNote('Pick a dot on the left first, then the dot it should point to.');
    } else if (mode === 'preimage') setSelB(toggle(selB, j));
  };
  const keyA = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      clickA(i);
    } else if (mode === 'draw' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const d = e.key === 'ArrowUp' ? -1 : 1;
      setActive(i);
      setFn(setArrow(fn, i, (fn.map[i] + d + fn.nB) % fn.nB));
      setPreset(null);
    }
  };
  const keyB = (e: KeyboardEvent, j: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      clickB(j);
    }
  };

  const size = (nA: number, nB: number) => {
    const g = resize(fn, nA, nB);
    setFn(g);
    setPreset(null);
    setSelA(new Set([...selA].filter((i) => i < g.nA)));
    setSelB(new Set([...selB].filter((j) => j < g.nB)));
    setActive((a) => (a !== null && a < g.nA ? a : 0));
    setNote('');
  };

  const load = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setFn(p.fn);
    setPreset(id);
    setMode(p.mode);
    setActive(0);
    setSelA(new Set(p.mode === 'image' ? (p.select ?? []) : [0, 1].filter((i) => i < p.fn.nA)));
    setSelB(new Set(p.mode === 'preimage' ? (p.select ?? []) : []));
    setNote(p.note);
  };

  const arrowClass = (i: number): string => {
    const j = fn.map[i];
    let c = 'fa-arrow';
    if (mode === 'image' && selA.has(i)) c += ' hot';
    else if (mode === 'preimage' && selB.has(j)) c += ' hot';
    else if (mode === 'draw' && active === i) c += ' hot';
    else if (inDeg[j] > 1 && mode === 'draw') c += ' clash';
    return c;
  };
  const hotA = (i: number) => (mode === 'image' ? selA.has(i) : mode === 'preimage' ? pre.has(i) : active === i);
  const hotB = (j: number) => (mode === 'image' ? img.has(j) : mode === 'preimage' ? selB.has(j) : false);
  const subsetA = (i: number) => mode === 'image' && selA.has(i);
  const subsetB = (j: number) => mode === 'preimage' && selB.has(j);

  const summary = an.bijective ? 'Bijective: every target is hit exactly once.'
    : `${an.injective ? 'Injective' : an.surjective ? 'Surjective' : 'Neither injective nor surjective'}${an.injective || an.surjective ? `, but not ${an.injective ? 'surjective' : 'injective'}` : ''}.`;
  const imageText = mode === 'image' ? `f(${showDom(selA)}) = ${showCod(img)}` : mode === 'preimage' ? `f⁻¹(${showCod(selB)}) = ${showDom(pre)}` : '';

  return (
    <div className="fa">
      <ExhibitIntro lead="Click a dot on the left, then a dot on the right, to redirect its arrow.">
        <p>
          A function sends every dot on the left to exactly one dot on the right. Draw one, and the badges show whether it is
          injective (no two arrows share a target) or surjective (every target is hit). When one fails, you get the exact
          instance of the definition that breaks.
        </p>
      </ExhibitIntro>
      <TryThis presets={PRESETS.map((p) => ({ label: p.label, active: preset === p.id, onPick: () => load(p.id) }))} />

      <div className="fa-main">
        <Zone kind="play" className="fa-stage">
          <div className="fa-controls">
            <div className="fa-modes" role="group" aria-label="Mode">
              {MODES.map((m) => (
                <button key={m.id} type="button" className={'btn btn-sm' + (mode === m.id ? ' on' : '')} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
              ))}
            </div>
            <div className="fa-sizes">
              <Stepper label="Domain size" value={fn.nA} onChange={(n) => size(n, fn.nB)} />
              <Stepper label="Codomain size" value={fn.nB} onChange={(n) => size(fn.nA, n)} />
            </div>
          </div>
          <p className="fa-help small muted">{MODES.find((m) => m.id === mode)!.help}</p>
          <svg className="fa-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Function diagram: domain on the left, codomain on the right">
            <defs>
              {['', 'hot', 'clash'].map((k) => (
                <marker key={k} id={`fa-head-${k || 'n'}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0L10 5L0 10z" className={'fa-head ' + k} />
                </marker>
              ))}
            </defs>
            <text x={XA} y="20" textAnchor="middle" className="fa-col">domain</text>
            <text x={XB} y="20" textAnchor="middle" className="fa-col">codomain</text>
            {fn.map.map((j, i) => {
              const c = arrowClass(i);
              return (
                <line
                  key={i}
                  className={c}
                  x1={XA + RAD}
                  y1={ys(fn.nA, i)}
                  x2={XB - RAD - 3}
                  y2={ys(fn.nB, j)}
                  markerEnd={`url(#fa-head-${c.includes('hot') ? 'hot' : c.includes('clash') ? 'clash' : 'n'})`}
                />
              );
            })}
            {Array.from({ length: fn.nA }, (_, i) => (
              <g
                key={'a' + i}
                className={'fa-dot' + (hotA(i) ? ' hot' : '') + (subsetA(i) ? ' pick' : '')}
                role="button"
                tabIndex={0}
                aria-pressed={mode === 'image' ? selA.has(i) : mode === 'draw' ? active === i : undefined}
                aria-label={`${aName(i)}, goes to ${bName(fn.map[i])}${mode === 'preimage' && pre.has(i) ? ', in the preimage' : ''}`}
                onClick={() => clickA(i)}
                onKeyDown={(e) => keyA(e, i)}
              >
                <circle cx={XA} cy={ys(fn.nA, i)} r={RAD} />
                <text x={XA} y={ys(fn.nA, i) + 5} textAnchor="middle">{aName(i)}</text>
              </g>
            ))}
            {Array.from({ length: fn.nB }, (_, j) => (
              <g
                key={'b' + j}
                className={'fa-dot' + (hotB(j) ? ' hot' : '') + (subsetB(j) ? ' pick' : '') + (mode === 'draw' && inDeg[j] === 0 ? ' unhit' : '') + (mode === 'draw' && inDeg[j] > 1 ? ' clash' : '')}
                role="button"
                tabIndex={0}
                aria-pressed={mode === 'preimage' ? selB.has(j) : undefined}
                aria-label={`${bName(j)}, hit by ${inDeg[j]} arrow${inDeg[j] === 1 ? '' : 's'}${mode === 'image' && img.has(j) ? ', in the image' : ''}`}
                onClick={() => clickB(j)}
                onKeyDown={(e) => keyB(e, j)}
              >
                <circle cx={XB} cy={ys(fn.nB, j)} r={RAD} />
                <text x={XB} y={ys(fn.nB, j) + 5} textAnchor="middle">{bName(j)}</text>
              </g>
            ))}
          </svg>
          <p className="fa-caption" aria-live="polite">{imageText || note || ' '}</p>
        </Zone>

        <div className="fa-side">
          <Verdict tone={an.bijective ? 'ok' : 'info'}>{summary}</Verdict>
          <Badge title="Injective" on={an.injective} reason={an.injReason} />
          <Badge title="Surjective" on={an.surjective} reason={an.surjReason} />
          <Badge title="Bijective" on={an.bijective} reason={an.bijective ? 'injective and surjective' : !an.injective && !an.surjective ? 'neither property holds' : `not ${an.injective ? 'surjective' : 'injective'}`} />
          {an.pigeon && <p className="fa-pigeon small">{an.pigeon}</p>}

          <Zone kind="lean" label="Function.Injective f" className="fa-card">
            {defs.injective && <p className="small">is <code>∀ a b, f a = f b → a = b</code>.</p>}
            {col ? (
              <p className="small">
                Fails: take <code>a := {aName(col.i)}</code>, <code>b := {aName(col.k)}</code>. Then <code>f a = f b</code> is true (both are {bName(col.j)}) but <code>a = b</code> is false.
              </p>
            ) : (
              <p className="small">Holds: whenever <code>f a = f b</code>, no two dots share a target, so <code>f a = f b</code> can only happen when <code>a</code> and <code>b</code> are the same dot.</p>
            )}
            <Checked c={lean.injective} declsOk={lean.declsOk} />
          </Zone>
          <Zone kind="lean" label="Function.Surjective f" className="fa-card">
            {defs.surjective && <p className="small">is <code>∀ b, ∃ a, f a = b</code>.</p>}
            {miss !== null ? (
              <p className="small">
                Fails: take <code>b := {bName(miss)}</code>. No <code>a</code> works: {fn.map.map((j, i) => `f ${aName(i)} = ${bName(j)}`).join(', ')}.
              </p>
            ) : (
              <p className="small">Holds: for every <code>b</code> there is a witness <code>a</code>: {Array.from({ length: fn.nB }, (_, j) => `${bName(j)} = f ${aName(fn.map.indexOf(j))}`).join(', ')}.</p>
            )}
            <Checked c={lean.surjective} declsOk={lean.declsOk} />
          </Zone>
          <Zone kind="lean" label="The function as Lean code" className="fa-card">
            <details>
              <summary className="small">Show the code</summary>
              <pre className="fa-code">{lean.decls}</pre>
            </details>
          </Zone>
        </div>
      </div>

      <TaughtIn links={[
        { href: href.level('fun-02'), title: 'Injective, unwrapped' },
        { href: href.level('fun-05'), title: 'Surjective composes' },
        { href: href.level('fun-09'), title: 'Image and preimage' },
        { href: href.level('fun-08b'), title: 'Which set is which?' },
      ]} />
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <span className="fa-step" role="group" aria-label={label}>
      <span className="small muted">{label}</span>
      <button type="button" className="btn btn-sm" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= MIN_SIZE} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" className="btn btn-sm" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= MAX_SIZE} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

function Badge({ title, on, reason }: { title: string; on: boolean; reason: string }) {
  return (
    <div className={'fa-badge ' + (on ? 'yes' : 'no')}>
      <span className="fa-badge-t">{on ? '✓' : '✗'} {title}</span>
      <span className="fa-badge-r">{on ? '' : 'not: '}{reason}</span>
    </div>
  );
}

function Checked({ c, declsOk }: { c: { label: string; ok: boolean; source: string }; declsOk: boolean }) {
  if (!declsOk || !c.ok) return null;
  return (
    <details>
      <summary className="fa-ok small">Lean checked: f is {c.label}</summary>
      <pre className="fa-code">{c.source}</pre>
    </details>
  );
}
