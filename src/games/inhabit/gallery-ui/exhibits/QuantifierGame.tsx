/** Gallery exhibit 'quantifier-game': ∀ and ∃ as a game on the numbers 0 to 5, with the computer playing the other side. */
import { useMemo, useState } from 'react';
import type { ExhibitProps } from '../types.ts';
import { engine } from '../../data.ts';
import { CodeBlock as Lean, CodeInline as LeanInline } from '../../../../template/components/Markdown.tsx';
import { href } from '../../routes.ts';
import {
  N, PRESETS, RELATIONS, SWAP_PROOF, advance, leanOf, matrixOf, narrate, outcome, ownerOf, relationText, solve, strategy, goodMoves,
} from '../../gallery/quantifier-game.ts';
import type { Binder, Matrix, Side } from '../../gallery/quantifier-game.ts';
import { ExhibitIntro, TryThis, Zone, Verdict, TaughtIn } from '../kit.tsx';
import '../gallery-quantifier-game.css';

const DOM = Array.from({ length: N }, (_, i) => i);
const BINDERS_ENV = '(R : Nat → Nat → Prop)';

const W = 300;
const H = 250;
const nodeY = (i: number) => 24 + (i * (H - 48)) / (N - 1);
const X_COL = 70;
const Y_COL = W - 70;

export default function QuantifierGame(_props: ExhibitProps) {
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [binders, setBinders] = useState<Binder[]>(PRESETS[0].binders);
  const [M, setM] = useState<Matrix>(() => matrixOf(PRESETS[0].relation));
  const [relName, setRelName] = useState<string>(RELATIONS[PRESETS[0].relation].name);
  const [side, setSide] = useState<Side>('true');
  const [hints, setHints] = useState(false);
  const [picks, setPicks] = useState<number[]>(() => advance(PRESETS[0].binders, matrixOf(PRESETS[0].relation), 'true', []));

  const restart = (bs: Binder[], m: Matrix, s: Side) => setPicks(advance(bs, m, s, []));

  const loadPreset = (id: string) => {
    const p = PRESETS.find((q) => q.id === id)!;
    const m = matrixOf(p.relation);
    setPresetId(id);
    setBinders(p.binders);
    setM(m);
    setRelName(RELATIONS[p.relation].name);
    restart(p.binders, m, side);
  };
  const chooseSide = (s: Side) => {
    setSide(s);
    restart(binders, M, s);
  };
  const toggle = (x: number, y: number) => {
    const m = M.map((row, i) => row.map((v, j) => (i === x && j === y ? !v : v)));
    setM(m);
    setPresetId('');
    setRelName('your own relation');
    restart(binders, m, side);
  };
  const play = (v: number) => {
    if (picks.length >= binders.length) return;
    setPicks(advance(binders, M, side, [...picks, v]));
  };

  const done = picks.length === binders.length;
  const next = done ? null : binders[picks.length];
  const preset = PRESETS.find((p) => p.id === presetId);
  const truth = useMemo(() => solve(binders, M), [binders, M]);
  const out = done ? outcome(binders, M, side, picks) : null;
  const log = narrate(binders, picks, side);
  const winning = !done && hints ? goodMoves(binders, M, picks) : [];
  const strat = useMemo(() => (done ? strategy(binders, M) : null), [done, binders, M]);

  // the statement as the engine pretty-prints it (checked, not hand-written)
  const lean = leanOf(binders);
  const elab = useMemo(() => engine.elab(engine.baseEnv(), lean, BINDERS_ENV), [lean]);
  const swapCheck = useMemo(() => engine.check(engine.baseEnv(), SWAP_PROOF), []);
  const isSwapPair = presetId === 'forall-exists' || presetId === 'exists-forall';

  // values picked so far, as variables
  const val: Record<string, number | undefined> = {};
  binders.forEach((b, i) => (val[b.v] = picks[i]));

  const summary = done
    ? `Round over. ${relationText(binders, picks)} ${out!.holds ? 'holds' : 'does not hold'}. You ${out!.playerWon ? 'won' : 'lost'}.`
    : `Your move: choose ${next!.v}, a number from 0 to ${N - 1}.`;

  return (
    <div className="qg">
      <ExhibitIntro lead="Pick a side, then click the numbers that make your claim come true.">
        <p>
          A statement with ∀ and ∃ is a game. Claim it is true and you choose the numbers for every ∃; claim it is false and you
          choose them for every ∀. The computer plays the other quantifiers as well as it can. Try the swapped pair of presets, then click the
          grid to change the relation.
        </p>
      </ExhibitIntro>

      <TryThis presets={PRESETS.map((p) => ({ label: p.label, active: p.id === presetId, onPick: () => loadPreset(p.id) }))} />

      <Zone kind="lean" label="The statement" className="qg-stmt">
        <div className="qg-lean" data-testid="qg-lean">
          {elab.ok ? <LeanInline code={elab.pretty ?? lean} /> : <LeanInline code={lean} />}
          <span className="qg-checked">{elab.ok ? 'Lean accepts this statement, with R : ℕ → ℕ → Prop' : 'Lean could not read this'}</span>
        </div>
        <p className="muted small">
          Here R x y means <strong>{relName}</strong> on the numbers 0 to {N - 1}.{preset ? ' ' + preset.blurb : ''}
        </p>
      </Zone>

      <Zone kind="play" className="qg-playzone">
      <div className="qg-sides" role="radiogroup" aria-label="Your side">
        <button role="radio" aria-checked={side === 'true'} className={`btn small${side === 'true' ? ' primary' : ''}`} onClick={() => chooseSide('true')}>
          I claim it is true
        </button>
        <button role="radio" aria-checked={side === 'false'} className={`btn small${side === 'false' ? ' primary' : ''}`} onClick={() => chooseSide('false')}>
          I claim it is false
        </button>
        <label className="qg-hint">
          <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} /> Show winning moves
        </label>
      </div>

      <div className="qg-board">
        <svg className="qg-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`The relation R as arrows from x to y. ${DOM.map((x) => `x = ${x} relates to ${DOM.filter((y) => M[x][y]).join(', ') || 'nothing'}`).join('; ')}.`}>
          <text className="qg-axis" x={X_COL} y={11} textAnchor="middle">x</text>
          <text className="qg-axis" x={Y_COL} y={11} textAnchor="middle">y</text>
          {DOM.flatMap((x) =>
            DOM.filter((y) => M[x][y]).map((y) => {
              const final = done && val.x === x && val.y === y;
              return (
                <line
                  key={`${x}-${y}`}
                  className={`qg-edge${val.x === x && val.y === y ? ' on' : ''}${final ? (out!.holds ? ' win' : ' lose') : ''}`}
                  x1={X_COL + 14}
                  y1={nodeY(x)}
                  x2={Y_COL - 14}
                  y2={nodeY(y)}
                />
              );
            }),
          )}
          {DOM.map((i) => (
            <g key={'x' + i}>
              <circle className={`qg-node${val.x === i ? ' picked' : ''}`} cx={X_COL} cy={nodeY(i)} r={14} />
              <text className="qg-num" x={X_COL} y={nodeY(i) + 5} textAnchor="middle">{i}</text>
            </g>
          ))}
          {DOM.map((i) => (
            <g key={'y' + i}>
              <circle className={`qg-node${val.y === i ? ' picked' : ''}`} cx={Y_COL} cy={nodeY(i)} r={14} />
              <text className="qg-num" x={Y_COL} y={nodeY(i) + 5} textAnchor="middle">{i}</text>
            </g>
          ))}
          {done && val.x !== undefined && val.y !== undefined && !M[val.x][val.y] && (
            <line className="qg-edge lose dashed" x1={X_COL + 14} y1={nodeY(val.x)} x2={Y_COL - 14} y2={nodeY(val.y)} />
          )}
        </svg>

        <div className="qg-matrix-wrap">
          <table className="qg-matrix">
            <caption>Edit R: click a cell to toggle R x y (row x, column y)</caption>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">x \ y</span></th>
                {DOM.map((y) => <th key={y} scope="col">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {DOM.map((x) => (
                <tr key={x}>
                  <th scope="row">{x}</th>
                  {DOM.map((y) => (
                    <td key={y}>
                      <button
                        className={`qg-cell${M[x][y] ? ' on' : ''}${val.x === x && val.y === y ? ' picked' : ''}`}
                        aria-pressed={M[x][y]}
                        aria-label={`R ${x} ${y}: ${M[x][y] ? 'holds' : 'does not hold'}`}
                        onClick={() => toggle(x, y)}
                      >
                        {M[x][y] ? '✓' : ''}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="qg-play">
        {done ? <Verdict tone={out!.playerWon ? 'ok' : 'no'}>{summary}</Verdict> : <p className="qg-turn" aria-live="polite">{summary}</p>}
        {!done && (
          <div className="qg-tiles" role="group" aria-label={`Choose ${next!.v}`}>
            <span className="qg-label">
              {next!.q} {next!.v} =
            </span>
            {DOM.map((v) => (
              <button key={v} className={`qg-tile${winning.includes(v) ? ' good' : ''}`} onClick={() => play(v)} aria-label={`${next!.v} = ${v}${winning.includes(v) ? ', a winning move' : ''}`}>
                {v}
              </button>
            ))}
          </div>
        )}
        <ol className="qg-log">
          {log.map((l, i) => (
            <li key={i} className={l.who}>{l.text}</li>
          ))}
          {done && (
            <li className={`qg-final ${out!.holds ? 'ok' : 'bad'}`}>
              {relationText(binders, picks)} {out!.holds ? 'holds' : 'does not hold'}, so the {out!.holds ? 'true' : 'false'} claim wins.{' '}
              <strong>{out!.playerWon ? 'You win.' : 'The computer wins.'}</strong>
            </li>
          )}
        </ol>
        {done && (
          <button className="btn small" onClick={() => restart(binders, M, side)}>Play again</button>
        )}
      </div>
      </Zone>

      {done && strat && (
        <Zone kind="explain" label="Why" className="qg-result">
          <p>
            Brute force over all {N * N} pairs: the statement is <strong>{truth ? 'true' : 'false'}</strong>. So the {truth ? '∃' : '∀'} player has a winning strategy,
            {(truth ? 'true' : 'false') === side ? ' and that was you.' : ' and that was the computer.'}
          </p>
          {strat.tables.map((t) => (
            <table className="qg-strat" key={t.binder.v}>
              <caption>Winning strategy: what to pick for {t.binder.q} {t.binder.v}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.rows[0]?.given ? 'When' : 'Pick'}</th>
                  <th scope="col">{t.binder.v} =</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.given || 'at the start'}</td>
                    <td>{r.move}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </Zone>
      )}

      {isSwapPair && (
        <Zone kind="lean" label="Order matters" className="qg-swap">
          <p className="small">
            With the same relation, <LeanInline code="∀ x, ∃ y, R x y" /> is {solve(PRESETS[2].binders, M) ? 'true' : 'false'} and{' '}
            <LeanInline code="∃ y, ∀ x, R x y" /> is {solve(PRESETS[3].binders, M) ? 'true' : 'false'}. Lean proves one direction for any R
            {swapCheck.complete ? ' (the engine checked this proof):' : '.'}
          </p>
          {swapCheck.complete && <Lean code={SWAP_PROOF} />}
        </Zone>
      )}

      <TaughtIn links={[
        { href: href.level('quant-09'), title: 'Order matters' },
        { href: href.level('quant-11'), title: 'Say it: everyone has a friend' },
        { href: href.level('quant-08'), title: 'Not-exists is for-all-not' },
      ]} />
    </div>
  );
}
