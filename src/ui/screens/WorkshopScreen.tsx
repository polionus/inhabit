import { useMemo, useRef, useState } from 'react';
import type { TheoremIdea } from '../../content/types.ts';
import { data, engine } from '../data.ts';
import { game, useGame } from '../game.ts';
import { useCheck, useDebounced } from '../hooks.tsx';
import { Editor, toEditorDiags, type EditorHandle } from '../lean/Editor.tsx';
import { mapDiagnostics } from '../lean/offsets.ts';
import { openInRealLean } from '../lean/openInLean.ts';
import { DiagnosticItem, Infoview } from '../components/Infoview.tsx';
import { Lean, LeanInline } from '../components/Markdown.tsx';
import { SymbolBar } from '../components/SymbolBar.tsx';
import { useInfo } from '../level/ProofLevel.tsx';
import type { SavedTheorem, WorkshopDraft } from '../../state/game.ts';

const STEPS = ['Say it', 'Type it', 'Define it', 'State it', 'Prove it'];
const UNSUPPORTED = /ℝ|\bReal\b|ℚ|\bRat\b|ℂ|\bComplex\b|\bFinset\b|\bMatrix\b|\bPolynomial\b|\bMeasure|\bFilter\b|\bTopologicalSpace\b|\bDeriv/;

export const quantifierCounts = (text: string) => ({
  forall: (text.match(/\b(for (all|every|each|any)|every|each|all)\b/gi) ?? []).length,
  exists: (text.match(/\b(there (exists?|is|are)|some|at least one)\b/gi) ?? []).length,
  implies: (text.match(/\b(if\b|then\b|implies|whenever)/gi) ?? []).length,
});

export function theoremHeader(w: Pick<WorkshopDraft, 'name' | 'binders' | 'statement'>): string {
  const name = (w.name || 'my_theorem').trim().replace(/\s+/g, '_');
  return `theorem ${name}${w.binders.trim() ? ' ' + w.binders.trim() : ''} : ${w.statement.trim()} := by`;
}

export const fullSource = (w: Pick<WorkshopDraft, 'name' | 'binders' | 'statement' | 'defs' | 'proof'>): string =>
  [w.defs.trim(), theoremHeader(w) + '\n' + w.proof.replace(/\s+$/, '')].filter(Boolean).join('\n\n');

function GraduateNote() {
  return <p className="notice">That needs something the game’s Lean does not have (real numbers, finite sets, and so on). You can still do it in real Lean with Mathlib: see <a href="#/graduate">Graduate</a>.</p>;
}

function Wizard() {
  const w = useGame((s) => s.save.workshop);
  const fontSize = useGame((s) => s.save.settings.fontSize);
  const set = (p: Partial<WorkshopDraft>) => game().setWorkshop(p);
  const baseEnv = useMemo(() => data.fullEnv(), []);
  const editor = useRef<EditorHandle>(null);
  const [saved, setSaved] = useState(false);

  const dBinders = useDebounced(w.binders, 200);
  const dDefs = useDebounced(w.defs, 200);
  const dStmt = useDebounced(w.statement, 200);

  const binderRes = useMemo(() => (dBinders.trim() ? engine.elab(baseEnv, 'True', dBinders) : null), [baseEnv, dBinders]);
  const defsRes = useMemo(() => (dDefs.trim() ? engine.extend(baseEnv, dDefs) : null), [baseEnv, dDefs]);
  const env2 = defsRes && defsRes.result.ok ? defsRes.env : baseEnv;
  const stmtRes = useMemo(() => (dStmt.trim() ? engine.elab(env2, dStmt, dBinders) : null), [env2, dStmt, dBinders]);
  const stmtIsProp = !!stmtRes?.ok && (stmtRes.type ?? 'Prop').trim() === 'Prop';

  const header = theoremHeader(w);
  const proofSource = header + '\n' + w.proof;
  const { result: proofRes, pending } = useCheck(proofSource + '|' + (defsRes ? 1 : 0), () => engine.check(env2, proofSource));
  const [cursor, setCursor] = useState(w.proof.length);
  const info = useInfo(proofRes, header.length + 1, w.proof.length, cursor);
  const unsupported = UNSUPPORTED.test(w.binders + w.defs + w.statement + w.english);

  const q = quantifierCounts(w.english);
  const canNext = [w.english.trim().length > 3, !w.binders.trim() || !!binderRes?.ok, !w.defs.trim() || !!defsRes?.result.ok, stmtIsProp, true][w.step - 1];
  const complete = !!proofRes?.complete && !pending && stmtIsProp;

  const save = () => {
    game().saveTheorem({ name: (w.name || 'my_theorem').trim().replace(/\s+/g, '_'), english: w.english, binders: w.binders, defs: w.defs, statement: w.statement, proof: w.proof, complete });
    setSaved(true);
  };

  return (
    <div className="wizard">
      <ol className="steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={w.step === i + 1 ? 'cur' : w.step > i + 1 ? 'past' : ''}>
            <button onClick={() => set({ step: i + 1 })} aria-current={w.step === i + 1 ? 'step' : undefined}><span className="n">{i + 1}</span> {s}</button>
          </li>
        ))}
      </ol>

      {w.step === 1 && (
        <section>
          <h2>1. Say it</h2>
          <p className="muted">Write the statement in careful English. Mark every “for all”, “there exists” and “if … then”.</p>
          <textarea rows={4} value={w.english} onChange={(e) => set({ english: e.target.value })} aria-label="Statement in English" placeholder="For every natural number n, if n is even then n + 1 is odd." />
          <p className="small muted">Found: ∀ × {q.forall} · ∃ × {q.exists} · if/then × {q.implies}. Does that match what you mean?</p>
        </section>
      )}
      {w.step === 2 && (
        <section>
          <h2>2. Type it</h2>
          <p className="muted">What are the objects? Give each a type: <code className="inline">(n : Nat)</code>, <code className="inline">(A : Set α)</code>, <code className="inline">(f : α → β)</code>. Hypotheses can go here too.</p>
          <input className="wide" value={w.binders} onChange={(e) => set({ binders: e.target.value })} aria-label="Binders" placeholder="(n : Nat) (A B : Set Nat)" spellCheck={false} />
          {binderRes?.ok && <p className="ok-line">✓ Lean accepts these types.</p>}
          {binderRes && !binderRes.ok && <ul className="diags">{binderRes.diagnostics.map((d, i) => <DiagnosticItem key={i} d={d} />)}</ul>}
          {unsupported && <GraduateNote />}
        </section>
      )}
      {w.step === 3 && (
        <section>
          <h2>3. Define it</h2>
          <p className="muted">Is there a notion Lean does not already know? Make it a <code className="inline">def</code>, usually a predicate. Skip this if you need none.</p>
          <textarea rows={4} value={w.defs} onChange={(e) => set({ defs: e.target.value })} aria-label="Definitions" placeholder="def IsSquare (n : Nat) : Prop := ∃ k, n = k * k" spellCheck={false} />
          {defsRes?.result.ok && <p className="ok-line">✓ Definitions accepted.</p>}
          {defsRes && !defsRes.result.ok && <ul className="diags">{defsRes.result.diagnostics.map((d, i) => <DiagnosticItem key={i} d={d} />)}</ul>}
          {unsupported && <GraduateNote />}
        </section>
      )}
      {w.step === 4 && (
        <section>
          <h2>4. State it</h2>
          <p className="muted">The hypotheses are already arguments; write the conclusion as a proposition.</p>
          <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
          <Editor ref={editor} value={w.statement} onChange={(v) => set({ statement: v })} fontSize={fontSize} ariaLabel="Statement in Lean" placeholder="∀ n : Nat, Even n → Odd (n + 1)" className="small-editor" cursor={w.statement.length} diagnostics={toEditorDiags(mapDiagnostics(stmtRes && !stmtRes.ok ? stmtRes.diagnostics : [], 0, w.statement.length))} />
          {stmtRes?.ok && !stmtIsProp && <p className="feedback wrong">That has type <LeanInline code={stmtRes.type ?? '?'} />, not <code className="inline">Prop</code>.</p>}
          {stmtRes && !stmtRes.ok && <ul className="diags">{stmtRes.diagnostics.map((d, i) => <DiagnosticItem key={i} d={d} />)}</ul>}
          {stmtIsProp && (
            <div className="readback">
              <div className="label">Lean reads this back as</div>
              <Lean code={`theorem ${w.name || 'my_theorem'} ${w.binders} :\n  ${stmtRes?.pretty ?? w.statement}`} />
              <div className="label">Compare with your English</div>
              <blockquote>{w.english || '(nothing written in step 1)'}</blockquote>
              <ul className="checklist">
                {['The quantifiers are in the order I said.', 'Every hypothesis I need appears.', 'Each variable has the right type.', 'It still makes sense for edge cases (0, the empty set).'].map((t, i) => (
                  <li key={i}><label><input type="checkbox" checked={w.checks[i]} onChange={(e) => set({ checks: w.checks.map((c, j) => (j === i ? e.target.checked : c)) })} /> {t}</label></li>
                ))}
              </ul>
            </div>
          )}
          {unsupported && <GraduateNote />}
        </section>
      )}
      {w.step === 5 && (
        <section>
          <h2>5. Prove it</h2>
          <p className="tip"><strong>Skeleton first.</strong> Write the plan as <code className="inline">have … := by sorry</code> steps, check it holds together, then fill each <code className="inline">sorry</code>. Read every error.</p>
          <label className="inline-field">Name <input value={w.name} onChange={(e) => set({ name: e.target.value })} placeholder="my_theorem" spellCheck={false} /></label>
          <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
          <div className="header-ro"><Lean code={header} /></div>
          <Editor ref={editor} value={w.proof} onChange={(v) => set({ proof: v })} onCursor={setCursor} fontSize={fontSize} ariaLabel="Proof editor" diagnostics={toEditorDiags(info.diags)} className="proof-editor" />
          <Infoview goals={info.goals} fallbackGoals={info.fallback} diagnostics={info.diags} complete={complete} pending={pending} onInsert={(n) => editor.current?.insert(n)} />
          <div className="actions">
            <button className="btn primary" onClick={save}>{complete ? 'Save to My theorems' : 'Save work in progress'}</button>
            <button className="btn" onClick={() => openInRealLean(fullSource(w))}>Open in real Lean</button>
            <button className="btn ghost" onClick={() => { game().resetWorkshop(); setSaved(false); }}>Start a new one</button>
          </div>
          {saved && <p role="status" className="ok-line">Saved. See it under My theorems.</p>}
        </section>
      )}

      <div className="wiz-nav">
        <button className="btn" disabled={w.step === 1} onClick={() => set({ step: w.step - 1 })}>Back</button>
        {w.step < 5 && <button className="btn primary" disabled={!canNext} onClick={() => set({ step: w.step + 1 })}>{w.step === 3 && !w.defs.trim() ? 'Skip' : 'Next'}</button>}
      </div>
    </div>
  );
}

function Gallery() {
  const list = useGame((s) => s.save.theorems);
  if (!list.length) return <p className="notice">Nothing here yet. Prove something in the Build tab and save it.</p>;
  const edit = (t: SavedTheorem) => {
    game().setWorkshop({ step: 5, english: t.english, binders: t.binders, defs: t.defs, statement: t.statement, proof: t.proof, name: t.name });
    window.location.hash = '#/workshop';
  };
  return (
    <ul className="gallery">
      {list.map((t) => (
        <li key={t.id} className="theorem">
          <h3>{t.name} <span className={`chip tiny ${t.complete ? 'on' : ''}`}>{t.complete ? 'proved' : 'in progress'}</span></h3>
          {t.english && <p>{t.english}</p>}
          <Lean code={fullSource(t)} />
          <div className="actions">
            <button className="btn" onClick={() => openInRealLean(fullSource(t))}>Open in real Lean</button>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(fullSource(t))}>Copy</button>
            <button className="btn" onClick={() => edit(t)}>Edit</button>
            <button className="btn ghost" onClick={() => game().deleteTheorem(t.id)}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Ideas({ onUse }: { onUse: (i: TheoremIdea) => void }) {
  const ideas = data.ideas;
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  if (!ideas.length) return <p className="notice">No ideas yet.</p>;
  const show = (k: string) => setShown((s) => ({ ...s, [k]: true }));
  return (
    <ul className="ideas">
      {ideas.map((i) => (
        <li key={i.id}>
          <button className="idea-head" aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)}>
            <strong>{i.title}</strong> <span className="muted small">{i.area} · {'●'.repeat(i.difficulty)}{'○'.repeat(3 - i.difficulty)}</span>
          </button>
          {open === i.id && (
            <div className="idea-body">
              <p>{i.english}</p>
              {(['statement', 'strategy', 'proof'] as const).map((k) => (
                <div key={k}>
                  {shown[i.id + k] ? (k === 'strategy' ? <p><span className="label">Strategy</span> {i.strategy}</p> : <><div className="label">{k === 'proof' ? 'Reference proof' : 'One way to state it'}</div><Lean code={k === 'statement' ? (i.definitions ? i.definitions + '\n\n' : '') + i.statement : i.proof} /></>) : (
                    <button className="btn small" onClick={() => show(i.id + k)}>Show {k === 'proof' ? 'a proof (try first!)' : k}</button>
                  )}
                </div>
              ))}
              <div className="actions"><button className="btn primary" onClick={() => onUse(i)}>Use this as my starting point</button></div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function WorkshopScreen() {
  const [tab, setTab] = useState<'build' | 'ideas' | 'mine'>('build');
  const n = useGame((s) => s.save.theorems.length);
  return (
    <div className="page narrow workshop">
      <h1>Workshop</h1>
      <p className="lede">Take a statement of your own from English to a proved Lean theorem.</p>
      <div className="tabs" role="tablist">
        {([['build', 'Build'], ['ideas', 'Ideas'], ['mine', `My theorems (${n})`]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'build' && <Wizard />}
      {tab === 'ideas' && <Ideas onUse={(i) => { game().setWorkshop({ step: 1, english: i.english, binders: '', defs: '', statement: '', proof: '  sorry', name: '', checks: [false, false, false, false] }); setTab('build'); }} />}
      {tab === 'mine' && <Gallery />}
    </div>
  );
}
