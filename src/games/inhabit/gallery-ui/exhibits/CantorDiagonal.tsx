/** Gallery exhibit 'cantor-diagonal': a finite illustration of Cantor's theorem. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_N, MIN_N, clash, diagonalSet, inRange, randomRel, relPresets, resize, showSet, toggle } from '../../gallery/cantor-diagonal.ts';
import type { Rel } from '../../gallery/cantor-diagonal.ts';
import { cantorReport } from '../../gallery/cantor-diagonal-lean.ts';
import { href } from '../../routes.ts';
import type { ExhibitProps } from '../types.ts';
import { ExhibitIntro, TryThis, Zone, Verdict, TaughtIn } from '../kit.tsx';
import '../gallery-cantor-diagonal.css';

const yn = (b: boolean) => (b ? 'yes' : 'no');

export default function CantorDiagonal(_props: ExhibitProps) {
  const [n, setN] = useState(4);
  const [f, setF] = useState<Rel>(() => relPresets[3].make(4));
  const [built, setBuilt] = useState(4);
  const [a, setA] = useState(0);
  const [preset, setPreset] = useState<string | null>(relPresets[3].id);
  const timer = useRef<number | undefined>(undefined);
  const report = useMemo(() => cantorReport(), []);
  const d = diagonalSet(f);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const replay = () => {
    window.clearInterval(timer.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setBuilt(n); return; }
    setBuilt(0);
    let k = 0;
    timer.current = window.setInterval(() => {
      k += 1;
      setBuilt(k);
      if (k >= n) window.clearInterval(timer.current);
    }, 450);
  };

  const changeN = (m: number) => {
    if (m < MIN_N || m > MAX_N) return;
    window.clearInterval(timer.current);
    setPreset(null); setN(m); setF((g) => resize(g, m)); setBuilt(m); setA((x) => Math.min(x, m - 1));
  };
  const load = (make: (n: number) => Rel, id: string | null) => { setF(make(n)); setBuilt(n); setPreset(id); };
  const aa = Math.min(a, n - 1);
  const c = clash(f, aa);
  const missed = !inRange(f, d);

  return (
    <div className="can">
      <ExhibitIntro lead="Click cells to change f, then watch the bottom row D flip the diagonal.">
        <p>
          Row <code>x</code> is the subset <code>f x</code> of {'{0, …, ' + (n - 1) + '}'}. The outlined diagonal cells ask whether <code>x ∈ f x</code>. The bottom row flips them: <code>D = {'{x | x ∉ f x}'}</code>. However you set <code>f</code>, no row can be equal to <code>D</code>.
        </p>
      </ExhibitIntro>
      <TryThis
        presets={relPresets.map((p) => ({ label: p.label, active: preset === p.id, onPick: () => load(p.make, p.id) }))}
        extra={<button type="button" className="xk-chip" onClick={() => load((m) => randomRel(m), null)}>Random f</button>}
      />

      <Zone kind="play" className="can-play" aside={
        <span className="can-size">
          Size
          <button type="button" className="btn btn-sm" aria-label="Fewer elements" disabled={n <= MIN_N} onClick={() => changeN(n - 1)}>−</button>
          <strong aria-live="polite">{n}</strong>
          <button type="button" className="btn btn-sm" aria-label="More elements" disabled={n >= MAX_N} onClick={() => changeN(n + 1)}>+</button>
        </span>
      }>
      <div className="can-scroll">
        <div className="can-grid" style={{ gridTemplateColumns: `4.2rem repeat(${n}, minmax(2.4rem, 3.4rem))` }} role="group" aria-label={`The function f as a grid: row x lists the elements of f x`}>
          <span className="can-corner" />
          {Array.from({ length: n }, (_, y) => <span key={y} className="can-col">{y}</span>)}
          {f.map((row, x) => (
            <Row key={x} x={x}>
              {row.map((v, y) => (
                <button
                  key={y} type="button"
                  className={'can-cell' + (v ? ' on' : '') + (x === y ? ' diag' : '')}
                  aria-pressed={v}
                  aria-label={`${y} in f ${x}: ${yn(v)}${x === y ? ' (diagonal)' : ''}`}
                  onClick={() => { setF((g) => toggle(g, x, y)); setPreset(null); }}
                >{v ? '✓' : ''}</button>
              ))}
            </Row>
          ))}
          <span className="can-sep" style={{ gridColumn: `1 / span ${n + 1}` }} />
          <span className="can-rowlabel can-d">D</span>
          {d.map((v, y) => (
            <span
              key={`${y}-${v}-${y < built}`}
              className={'can-cell can-dcell' + (y < built ? (v ? ' on flip' : ' flip') : ' hidden')}
              aria-label={y < built ? `${y} in D: ${yn(v)}` : `${y} in D: not built yet`}
            >{y < built ? (v ? '✓' : '') : '?'}</span>
          ))}
        </div>
      </div>
      <div className="can-bar">
        <button type="button" className="btn btn-sm" onClick={replay}>Build D cell by cell</button>
      </div>
      <Verdict tone={missed ? 'ok' : 'no'}>
        D = {built >= n ? showSet(d) : '(still building)'}. {missed ? 'D is not in the range of f: f is not onto.' : 'Something is wrong: D is a row of f.'}
      </Verdict>
      </Zone>

      <Zone kind="explain" label="D is not any row">
        <ul className="can-checks">
          {f.slice(0, built).map((row, x) => (
            <li key={x}>
              <code>f {x} = {showSet(row)}</code> and <code>D = {showSet(d)}</code> differ at position {x}: <code>{x} ∈ f {x}</code> is {yn(row[x])}, <code>{x} ∈ D</code> is {yn(d[x])}. ✓
            </li>
          ))}
        </ul>
        <p className="can-small"><strong>So f misses D.</strong> {n} rows can't produce all {2 ** n} subsets anyway, but the diagonal shows the miss for <em>every</em> f, and the same argument works when α is infinite.</p>
      </Zone>

      <Zone kind="explain" label="The key step">
        <p className="can-small">Suppose <code>D = f a</code> for some <code>a</code>. Pick one:</p>
        <div className="can-pick">
          {Array.from({ length: n }, (_, i) => (
            <button key={i} type="button" className={'btn btn-sm' + (i === aa ? ' on' : '')} aria-pressed={i === aa} onClick={() => setA(i)}>a = {i}</button>
          ))}
        </div>
        <p className="can-small">
          If <code>D = f {aa}</code>, then <code>{aa} ∈ D ↔ {aa} ∈ f {aa}</code>. But <code>{aa} ∈ D</code> means <code>{aa} ∉ f {aa}</code>. Here <code>{aa} ∈ f {aa}</code> is <strong>{yn(c.inFa)}</strong> and <code>{aa} ∈ D</code> is <strong>{yn(c.inD)}</strong>, so the two sides of the ↔ never agree. That's <code>P ↔ ¬P</code> for <code>P := a ∈ f a</code>, which <code>iff_not_self</code> rules out.
        </p>
      </Zone>

      <Zone kind="lean" label="In Lean">
        <p className="can-small">The statement, as the engine reads it: <code>{report.pretty}</code>. The lemma it leans on: <code>iff_not_self : {report.iffNotSelf}</code>.</p>
        <pre className="can-code">{report.header}{'\n'}{report.proof}</pre>
        <p className="can-small">{report.complete ? <span className="can-ok">The engine checks this proof, with no sorry.</span> : <span className="can-bad">The engine did not accept this proof.</span>} It's the game's own solution to the boss level.</p>
      </Zone>

      <TaughtIn links={[
        { href: href.level('fun-13'), title: 'Nothing is its own opposite' },
        { href: href.level('fun-14'), title: 'The diagonal set' },
        { href: href.level('fun-15'), title: "Cantor's theorem" },
        { href: href.chapter('fun'), title: 'The functions chapter' },
      ]} />
    </div>
  );
}

function Row({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <>
      <span className="can-rowlabel">f {x}</span>
      {children}
    </>
  );
}
