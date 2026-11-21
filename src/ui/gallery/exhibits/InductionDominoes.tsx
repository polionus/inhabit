/** Gallery exhibit 'induction-dominoes': a base case and a step knock down every natural number. */
import { useMemo, useState } from 'react';
import type { Goal } from '../../../engine/types.ts';
import { DOMINO_COUNT, baseHolds, bodyOf, brokenLink, cascade, instance, presetById, presets } from '../../../gallery/induction-dominoes.ts';
import type { DominoPreset } from '../../../gallery/induction-dominoes.ts';
import { checkPreset } from '../../../gallery/induction-dominoes-lean.ts';
import { href } from '../../router.ts';
import type { ExhibitProps } from '../types.ts';
import { ExhibitIntro, TryThis, Zone, Verdict, TaughtIn } from '../kit.tsx';
import '../../styles/gallery-induction-dominoes.css';

const W = 30;
const H = 88;
const GAP = 58;
const X0 = 22;
const FLOOR = 112;

function GoalView({ goal }: { goal: Goal | null }) {
  if (!goal) return <pre className="dom-goal">(the engine returned no goal)</pre>;
  return (
    <pre className="dom-goal">
      {goal.hyps.map((h, i) => <span key={i}>{h.names.join(' ')} : {h.type}{'\n'}</span>)}
      {'⊢ '}{goal.target}
    </pre>
  );
}

export default function InductionDominoes(_props: ExhibitProps) {
  const [pid, setPid] = useState(presets[0].id);
  const [showBase, setShowBase] = useState(false);
  const [showStep, setShowStep] = useState(false);
  const [pushed, setPushed] = useState(0);
  const p = presetById(pid);
  const checked = useMemo(() => checkPreset(p), [p]);
  const run = useMemo(() => cascade(p), [p]);
  const broken = brokenLink(p);
  const fates = pushed > 0 ? run.fates : run.fates.map(() => 'standing' as const);

  const load = (q: DominoPreset) => { setPid(q.id); setShowBase(false); setShowStep(false); setPushed(0); };
  const ready = showBase && showStep;
  const push = () => setPushed((n) => n + 1);
  const proveBase = () => { setShowBase(true); setPushed(0); };
  const proveStep = () => { setShowStep(true); setPushed(0); };

  const status = pushed > 0 ? run.summary
    : ready ? 'Both cases are open. Push domino 0.'
    : 'Prove the base case and the step, then push domino 0.';

  const baseHyps = checked.goals.base;
  return (
    <div className="dom">
      <ExhibitIntro lead="Pick a statement, prove the base case and the step, then push domino 0.">
        <p>
          Induction proves a statement <code>P n</code> for every natural number with two finite proofs. The base case knocks over domino 0. The step shows that any domino that falls knocks over the next one. In the step, <code>ih</code> is the domino you lean on. Pick a statement and see which proof breaks, if any.
        </p>
      </ExhibitIntro>
      <TryThis presets={presets.map((q) => ({ label: q.label, active: q.id === pid, onPick: () => load(q) }))} />
      <p className="dom-note"><strong>P n :</strong> <code>{p.stmt}</code>. {p.note}</p>

      <Zone kind="play">
      <div className="dom-scroll" role="group" aria-label="Row of dominoes P 0 to P 9">
        <svg className="dom-svg" viewBox={`0 0 ${X0 * 2 + GAP * (DOMINO_COUNT - 1) + W + 40} 160`} role="img" aria-label={status}>
          <line className="dom-floor" x1="6" y1={FLOOR} x2={X0 * 2 + GAP * (DOMINO_COUNT - 1) + W + 34} y2={FLOOR} />
          {fates.map((f, i) => {
            const x = X0 + i * GAP;
            const fell = f === 'falls';
            return (
              <g key={`${pid}-${i}-${pushed}`}>
                <rect
                  className={`dom-tile ${f}`}
                  x={x} y={FLOOR - H} width={W} height={H} rx="4"
                  style={{
                    transformOrigin: `${x + W}px ${FLOOR}px`,
                    transform: fell ? 'rotate(76deg)' : undefined,
                    transitionDelay: fell ? `${i * 0.16}s` : undefined,
                    animationDelay: f === 'wobbles' ? '0s' : undefined,
                  }}
                />
                {f === 'blocked' && <text className="dom-x" x={x - GAP / 2 + W / 2 + 6} y={FLOOR - H / 2 + 8} textAnchor="middle">✗</text>}
                <text className={`dom-label ${pushed > 0 ? (p.pred(i) ? 'yes' : 'no') : ''}`} x={x + W / 2} y={FLOOR + 22} textAnchor="middle">P {i}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="dom-controls">
        <button type="button" className={'btn btn-sm' + (showBase ? ' on' : '')} onClick={proveBase}>Prove the base case</button>
        <button type="button" className={'btn btn-sm' + (showStep ? ' on' : '')} onClick={proveStep}>Prove the step</button>
        <button type="button" className="btn btn-sm dom-push" disabled={!ready} onClick={push}>{pushed > 0 ? 'Push again' : 'Push domino 0'}</button>
      </div>
      <Verdict tone={pushed > 0 ? (run.fates.every((f) => f === 'falls') ? 'ok' : 'no') : 'info'}>{status}</Verdict>
      </Zone>

      <div className="dom-cases">
        {showBase && (
          <Zone kind="lean" label="Base case: P 0">
            <p className="dom-small">The goal the engine shows for <code>zero</code>:</p>
            <GoalView goal={baseHyps} />
            {p.base ? (
              <>
                <p className="dom-small">Proof {checked.baseOk ? <span className="dom-ok">checked by the engine</span> : <span className="dom-bad">did not check</span>}:</p>
                <pre className="dom-code">{`| zero => ${p.base[0]}`}</pre>
              </>
            ) : (
              <p className="dom-bad-text">
                No proof exists. At 0 the statement reads <code>{instance(p, 0)}</code>, so domino 0 can't fall. It wobbles.
              </p>
            )}
          </Zone>
        )}
        {showStep && (
          <Zone kind="lean" label="Step: P k → P (k+1)">
            <p className="dom-small">The goal for <code>succ</code>, with <code>ih</code> as the domino you lean on:</p>
            <GoalView goal={checked.goals.step} />
            {p.step ? (
              <>
                <p className="dom-small">Proof {checked.stepOk ? <span className="dom-ok">checked by the engine</span> : <span className="dom-bad">did not check</span>}:</p>
                <pre className="dom-code">{p.step.length === 1 ? `| succ k ih => ${p.step[0]}` : `| succ k ih =>\n  ${p.step.join('\n  ')}`}</pre>
              </>
            ) : (
              <p className="dom-bad-text">
                The engine can't close this goal, and it shouldn't be able to. Take <code>k = {broken}</code>: <code>ih</code> holds ({instance(p, broken ?? 0)}) but the goal does not ({instance(p, (broken ?? 0) + 1)}).
              </p>
            )}
          </Zone>
        )}
      </div>

      {ready && p.base && p.step && (
        <Zone kind="lean" label="Together" aside={checked.complete ? <span className="dom-ok">engine: complete</span> : undefined}>
          <pre className="dom-code">{`theorem P_all (n : Nat) : ${p.stmt} := by\n${bodyOf(p.stmt, p.base, p.step)}`}</pre>
        </Zone>
      )}
      {ready && !baseHolds(p) && p.step && (
        <p className="dom-small">A provable step isn't enough. Without the base case, the proof of <code>{p.stmt}</code> never starts.</p>
      )}

      <TaughtIn links={[
        { href: href.level('nat-05'), title: 'Induction: two goals' },
        { href: href.level('nat-06'), title: 'zero_add' },
        { href: href.level('nat-12'), title: 'zero_mul' },
        { href: href.chapter('nat'), title: 'The natural numbers chapter' },
      ]} />
    </div>
  );
}
