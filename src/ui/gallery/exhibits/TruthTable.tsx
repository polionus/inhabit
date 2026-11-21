/** Gallery exhibit 'truth-table': a formula's truth table, and whether Lean can prove it without classical logic. */
import { useMemo, useRef, useState } from 'react';
import type { ExhibitProps } from '../types.ts';
import { engine } from '../../data.ts';
import { Lean } from '../../components/Markdown.tsx';
import { href } from '../../router.ts';
import {
  MAX_ATOMS, PRESETS, classifyTable, leanProof, parseFormula, truthTable, verdict,
} from '../../../gallery/truth-table.ts';
import type { LeanProof } from '../../../gallery/truth-table.ts';
import { ExhibitIntro, TryThis, Zone, Verdict, TaughtIn } from '../kit.tsx';
import '../../styles/gallery-truth-table.css';

const SYMBOLS = ['¬', '∧', '∨', '→', '↔', '(', ')', 'True', 'False'];
const KIND_TEXT = { tautology: 'Tautology', contradiction: 'Contradiction', contingent: 'Neither a tautology nor a contradiction' } as const;

function checked(p: LeanProof | null): { proof: LeanProof; ok: boolean } | null {
  if (!p) return null;
  const r = engine.check(engine.baseEnv(), p.source, { allowedTactics: p.allowed });
  return { proof: p, ok: r.complete };
}

export default function TruthTable(_props: ExhibitProps) {
  const [src, setSrc] = useState(PRESETS[0].formula);
  const [steps, setSteps] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseFormula(src), [src]);
  const note = PRESETS.find((p) => p.formula === src.trim())?.note;

  const analysis = useMemo(() => {
    if (!parsed.ok) return null;
    const table = truthTable(parsed.f, parsed.atoms);
    const cls = classifyTable(table);
    const v = verdict(parsed.f);
    const constructive = v === 'constructive' ? checked(leanProof(parsed.f, parsed.atoms, false)) : null;
    const classical = v === 'classical' ? checked(leanProof(parsed.f, parsed.atoms, true)) : null;
    const counter = table.rows.find((r) => !r.result);
    return { table, cls, v, constructive, classical, counter };
  }, [parsed]);

  const insert = (s: string) => {
    const el = input.current;
    const a = el?.selectionStart ?? src.length;
    const b = el?.selectionEnd ?? src.length;
    const pad = s.length > 1 ? ' ' : '';
    const text = src.slice(0, a) + pad + s + pad + src.slice(b);
    setSrc(text);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = a + pad.length * 2 + s.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const summary = analysis
    ? `${KIND_TEXT[analysis.cls.kind]}. True in ${analysis.cls.trueRows} of ${analysis.cls.total} rows. ${
        analysis.v === 'constructive' ? 'Provable without classical logic.' : analysis.v === 'classical' ? 'Needs classical logic.' : 'Not provable.'
      }`
    : '';

  const t = analysis?.table;
  const cols = t ? (steps ? t.columns : t.columns.slice(-1)) : [];

  return (
    <div className="tt">
      <ExhibitIntro lead="Pick a formula below, or type your own, and read off its truth table.">
        <p>
          Type a formula in P, Q, R (up to {MAX_ATOMS} letters) and see every row of its truth table. Then ask the harder question: a formula can be
          true in every row and still need an extra axiom to prove in Lean. Try the first and third presets side by side.
        </p>
      </ExhibitIntro>

      <TryThis presets={PRESETS.map((p) => ({ label: p.formula, active: src.trim() === p.formula, onPick: () => setSrc(p.formula) }))} />

      <div className="tt-layout">
      <Zone kind="play" className="tt-playzone">
      <div className="tt-input">
        <label htmlFor="tt-formula" className="tt-label">Formula</label>
        <input
          id="tt-formula"
          ref={input}
          className="tt-field"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={!parsed.ok}
          aria-describedby="tt-msg"
        />
        <div className="tt-syms" role="toolbar" aria-label="Symbols">
          {SYMBOLS.map((s) => (
            <button key={s} className="sym" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)} aria-label={`Insert ${s}`}>
              {s}
            </button>
          ))}
          <span className="small muted">or type -&gt; &lt;-&gt; /\ \/ ~</span>
        </div>
        <p id="tt-msg" className={`small ${parsed.ok ? 'muted' : 'tt-error'}`} role={parsed.ok ? undefined : 'alert'}>
          {parsed.ok ? note ?? 'Reading it as ' + analysis!.table.columns[analysis!.table.columns.length - 1].text + '.' : parsed.error}
        </p>
      </div>
      {analysis && t && (
          <div className="tt-tablewrap">
            <div className="tt-tools">
              <label className="small"><input type="checkbox" checked={steps} onChange={(e) => setSteps(e.target.checked)} /> Show every subformula</label>
            </div>
            <div className="tt-scroll">
              <table className="tt-table">
                <thead>
                  <tr>
                    {t.atoms.map((a) => <th key={a} scope="col" className="tt-atom">{a}</th>)}
                    {cols.map((c, i) => <th key={i} scope="col" className={i === cols.length - 1 ? 'tt-result' : ''}>{c.text}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={i} className={r.result ? '' : 'false-row'}>
                      {t.atoms.map((a) => <td key={a} className="tt-atom">{r.values[a] ? 'T' : 'F'}</td>)}
                      {(steps ? r.cells : r.cells.slice(-1)).map((v, j, arr) => (
                        <td key={j} className={`${v ? 'T' : 'F'}${j === arr.length - 1 ? ' tt-result' : ''}`}>{v ? 'T' : 'F'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}
      </Zone>

      {analysis && t && (
        <div className="tt-side">
          <Verdict tone={analysis.v === 'constructive' ? 'ok' : analysis.v === 'classical' ? 'info' : 'no'}>{summary}</Verdict>
          <Zone kind="lean" label="Can Lean prove it?" className="tt-verdict">
            <div className="tt-badges">
              <span className={`tt-badge ${analysis.cls.kind}`}>{KIND_TEXT[analysis.cls.kind]}</span>
              <span className={`tt-badge ${analysis.cls.satisfiable ? 'yes' : 'no'}`}>{analysis.cls.satisfiable ? 'Satisfiable' : 'Unsatisfiable'}</span>
              <span className="tt-count">true in {analysis.cls.trueRows} of {analysis.cls.total} rows</span>
            </div>
            <h3>Without classical logic?</h3>
            {analysis.v === 'invalid' && (
              <p>
                No, and no proof exists at all: it is false in some row
                {analysis.counter && t.atoms.length > 0 ? ` (${t.atoms.map((a) => `${a} = ${analysis.counter!.values[a] ? 'true' : 'false'}`).join(', ')})` : ''}.
                Lean only proves what is true in every row.
              </p>
            )}
            {analysis.v === 'constructive' && (
              <>
                <p>
                  <strong>Yes.</strong> The arena prover (G4ip, a decision procedure for constructive propositional logic) finds a proof.
                  {analysis.constructive?.ok
                    ? ' Lean checked it using only constructive tactics (no by_cases, no by_contra).'
                    : ' (The proof printer gave up, so there is no script to show.)'}
                </p>
                {analysis.constructive?.ok && <Lean code={analysis.constructive.proof.source} />}
              </>
            )}
            {analysis.v === 'classical' && (
              <>
                <p>
                  <strong>No.</strong> It is true in every row, but G4ip shows there is no constructive proof: you cannot build it from the connectives
                  alone. It needs classical logic (excluded middle), which in Lean means a step like <code>by_cases</code> or <code>by_contra</code>.
                  {analysis.classical?.ok ? ' With those allowed, Lean accepts this proof:' : ''}
                </p>
                {analysis.classical?.ok ? <Lean code={analysis.classical.proof.source} /> : <p className="muted">I could not produce a script for it, but it needs classical logic (excluded middle).</p>}
              </>
            )}
          </Zone>
        </div>
      )}
      </div>

      <TaughtIn links={[
        { href: href.level('logic-08'), title: 'From falsehood, anything' },
        { href: href.level('logic-12'), title: 'Either it is, or it is not' },
        { href: href.level('logic-13'), title: 'Proof by contradiction' },
      ]} />
    </div>
  );
}
