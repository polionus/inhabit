import { useMemo, useRef, useState } from 'react';
import type { FormalizeLevel } from '../../content/types.ts';
import type { Diagnostic } from '../../engine/types.ts';
import { engine } from '../data.ts';
import { Editor, type EditorHandle, toEditorDiags } from '../lean/Editor.tsx';
import { mapDiagnostics } from '../lean/offsets.ts';
import { useDebounced } from '../hooks.tsx';
import { DiagnosticItem } from '../components/Infoview.tsx';
import { Lean, LeanInline, Markdown } from '../components/Markdown.tsx';
import { SymbolBar } from '../components/SymbolBar.tsx';
import type { Run } from './run.ts';

type Verdict =
  | { kind: 'error'; diags: Diagnostic[] }
  | { kind: 'not-prop'; type: string }
  | { kind: 'mistake'; feedback: string }
  | { kind: 'unmatched' }
  | { kind: 'right' };

export function judgeStatement(
  env: Parameters<typeof engine.elab>[0],
  level: Pick<FormalizeLevel, 'accept' | 'mistakes' | 'binders'>,
  text: string,
): Verdict {
  const el = engine.elab(env, text, level.binders);
  if (!el.ok) return { kind: 'error', diags: el.diagnostics };
  if (el.type && el.type.trim() !== 'Prop') return { kind: 'not-prop', type: el.type };
  if (level.accept.some((a) => engine.defEq(env, text, a, level.binders))) return { kind: 'right' };
  const m = level.mistakes?.find((x) => engine.defEq(env, text, x.statement, level.binders));
  if (m) return { kind: 'mistake', feedback: m.feedback };
  return { kind: 'unmatched' };
}

export function FormalizeLevelView({ run, level }: { run: Run; level: FormalizeLevel }) {
  const [text, setText] = useState(run.mode === 'review' ? (level.starter ?? '') : (level.starter ?? ''));
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [resolved, setResolved] = useState(false);
  const editor = useRef<EditorHandle>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const env = useMemo(() => {
    const e = run.session.env;
    return level.setup ? engine.extend(e, level.setup).env : e;
  }, [run.session.env, level.setup]);

  const dText = useDebounced(text, 150);
  const live = useMemo(() => {
    if (!dText.trim()) return null;
    try {
      return engine.elab(env, dText, level.binders);
    } catch {
      return null;
    }
  }, [env, dText, level.binders]);

  const submit = () => {
    let v: Verdict;
    try {
      v = judgeStatement(env, level, text);
    } catch (e) {
      v = { kind: 'error', diags: [{ severity: 'error', code: 'other', message: String(e), from: 0, to: 0 }] };
    }
    setVerdict(v);
    if (v.kind === 'right') {
      setResolved(true);
      runRef.current.complete({ body: text });
    } else runRef.current.attempt();
  };

  const liveDiags = live && !live.ok ? mapDiagnostics(live.diagnostics, 0, text.length) : [];

  return (
    <>
      <div className="editor-panel formalize">
        <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
        {level.binders && (
          <div className="header-ro">
            <div className="label">In scope</div>
            <LeanInline code={level.binders} />
          </div>
        )}
        <Editor
          ref={editor}
          value={text}
          onChange={(v) => {
            setText(v);
            if (verdict && !resolved) setVerdict(null);
          }}
          diagnostics={toEditorDiags(liveDiags)}
          fontSize={run.fontSize}
          ariaLabel="Your Lean statement"
          placeholder="Write a Lean proposition…"
          className="small-editor"
        />
        <div className="actions">
          <button className="btn primary" disabled={!text.trim() || resolved} onClick={submit}>Check my statement</button>
        </div>
      </div>
      <section className="infoview" aria-label="Reading back">
        <div className="info-body">
          {live?.ok && (
            <div className="readback">
              <div className="label">Lean reads this as</div>
              <LeanInline code={live.pretty ?? text} />
              {live.type && <div className="muted small">of type <LeanInline code={live.type} /></div>}
            </div>
          )}
          {!live && <p className="muted">As you type, Lean’s reading of your statement shows up here.</p>}
          {live && !live.ok && (
            <ul className="diags">{liveDiags.map((d, i) => <DiagnosticItem key={i} d={d} />)}</ul>
          )}
          <div className="sr-only" role="status" aria-live="polite">{verdict?.kind ?? ''}</div>
          {verdict?.kind === 'right' && <div className="feedback right"><strong>Yes.</strong> That says the same thing as the model answer.</div>}
          {verdict?.kind === 'not-prop' && <div className="feedback wrong">That is a well-formed term, but its type is <LeanInline code={verdict.type} />, not <code className="inline">Prop</code>. A statement must be a proposition.</div>}
          {verdict?.kind === 'error' && <div className="feedback wrong">Lean could not read that as a proposition yet. See the message above.</div>}
          {verdict?.kind === 'mistake' && (
            <div className="feedback wrong">
              <strong>Not quite.</strong>
              <Markdown text={verdict.feedback} />
            </div>
          )}
          {verdict?.kind === 'unmatched' && !resolved && (
            <div className="feedback neutral">
              <p><strong>Well-typed, but I cannot confirm it means the same.</strong> I only compare against a few known answers, so yours might still be right. Compare it to the model answer:</p>
              <div className="side-by-side">
                <div><div className="label">Yours</div><Lean code={text} /></div>
                <div><div className="label">Model answer</div><Lean code={level.accept[0]} /></div>
              </div>
              <p className="small">Be honest with yourself: do they say the same thing?</p>
              <div className="actions">
                <button className="btn" onClick={() => { setResolved(true); runRef.current.complete({ body: text, selfAssessed: true }); }}>They mean the same</button>
                <button className="btn" onClick={() => { setResolved(true); runRef.current.complete({ body: level.accept[0], studied: true }); }}>I see the difference</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
