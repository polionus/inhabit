import { FirstTimeTip } from '../components/FirstTime.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProofLevel } from '../../content/types.ts';
import type { CheckResult } from '../../engine/types.ts';
import { data, engine } from '../data.ts';
import { dataForContext, hypItems } from '../lean/complete.ts';
import { Editor, placeholderRange, toEditorDiags, type EditorHandle } from '../lean/Editor.tsx';
import { mapDiagnostics } from '../lean/offsets.ts';
import { useCheck } from '../hooks.tsx';
import { Infoview } from '../components/Infoview.tsx';
import type { Goal } from '../../engine/types.ts';
import { Lean, Markdown } from '../components/Markdown.tsx';
import { missingTactics, mustUseNote } from './mustUse.ts';
import { SymbolBar } from '../components/SymbolBar.tsx';
import type { Run } from './run.ts';
import { WhatToProve } from './WhatToProve.tsx';

/** Derive infoview inputs from a check result and a cursor in body coordinates. */
export function useInfo(result: CheckResult | null, bodyOffset: number, bodyLen: number, cursor: number) {
  return useMemo(() => {
    const diags = result ? mapDiagnostics(result.diagnostics, bodyOffset, bodyLen) : [];
    let goals = null;
    if (result) {
      try {
        goals = engine.goalsAt(result, bodyOffset + cursor);
      } catch {
        goals = null;
      }
    }
    const fallback = diags.find((d) => d.code === 'unsolved-goals')?.data?.goals ?? null;
    // the state where the earliest error starts, so the first error can show its goal
    let errorGoals = null;
    const first = diags.filter((d) => d.severity === 'error' && d.inBody).sort((a, b) => a.bFrom - b.bFrom)[0];
    if (result && first && first.code !== 'parse') {
      try {
        errorGoals = engine.goalsAt(result, first.from);
      } catch {
        errorGoals = null;
      }
    }
    return { diags, goals, fallback, errorGoals };
  }, [result, bodyOffset, bodyLen, cursor]);
}

export function ProofLevelView({ run, level }: { run: Run; level: ProofLevel }) {
  const [body, setBody] = useState(run.initialBody);
  // Start with the cursor on the placeholder, so the goal view shows what is left to prove
  // before the learner has clicked anywhere.
  const [cursor, setCursor] = useState(() => placeholderRange(body)?.from ?? body.length);
  const editor = useRef<EditorHandle>(null);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    run.api.current = {
      insert: (t) => editor.current?.insert(t),
      setBody: (t) => setBody(t),
    };
  });

  const { result: checked, pending } = useCheck(body, () => data.checkBody(run.session, body));
  const result = checked?.result ?? null;
  const bodyOffset = checked?.assembled.bodyOffset ?? 0;
  const missing = useMemo(
    () => (result?.complete ? missingTactics(level.mustUse, result.decls.flatMap((d) => d.usedTactics)) : []),
    [result, level.mustUse],
  );
  const info = useInfo(result, bodyOffset, body.length, cursor);

  const completion = useMemo(() => dataForContext(run.session.ctx), [run.session.ctx]);
  const hyps = useMemo(() => hypItems(info.goals?.[0]?.hyps ?? []), [info.goals]);

  const prevErr = useRef(false);
  useEffect(() => {
    if (!result) return;
    const hasErr = !result.ok;
    if (hasErr && !prevErr.current && body.trim() && body !== level.starter) runRef.current.attempt();
    prevErr.current = hasErr;
    if (result.complete && !pending && body.trim() !== '' && missing.length === 0) {
      const decl = result.decls.find((d) => d.term && d.isTacticProof) ?? result.decls.find((d) => d.term);
      runRef.current.complete({ body, term: level.mode === 'tactic' ? decl?.term : undefined });
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // The state the stuck panel reads: at the cursor, else after the last good tactic, else what was left over.
  const live = useMemo(() => {
    let goals: Goal[] | null = null;
    let at: 'cursor' | 'last-step' | 'unsolved' | null = null;
    // after the last tactic, a `sorry` has closed the goal for now: read the state just before it
    const sorryStep = result && !result.complete && info.goals && info.goals.length === 0 ? [...result.steps].reverse().find((s) => s.tactic === 'sorry' && s.before.length > 0) : undefined;
    if (sorryStep) {
      goals = sorryStep.before;
      at = 'last-step';
    } else if (info.goals) {
      goals = info.goals;
      at = 'cursor';
    } else if (result) {
      const ok = result.steps.filter((s) => s.ok);
      const last = ok[ok.length - 1];
      if (last) {
        goals = last.after;
        at = 'last-step';
      } else if (info.fallback) {
        goals = info.fallback;
        at = 'unsolved';
      }
    }
    return { goals, at, edited: body !== level.starter };
  }, [info.goals, info.fallback, result, body, level.starter]);
  // Debounced: reporting on every keystroke would re-render the whole level screen in a cascade.
  useEffect(() => {
    const t = window.setTimeout(() => runRef.current.reportLive?.(live), 120);
    return () => window.clearTimeout(t);
  }, [live]);

  const onChange = (v: string) => {
    setBody(v);
    runRef.current.saveDraft(v);
  };

  return (
    <>
      <div className="editor-panel">
        <WhatToProve english={level.english}>
          <div className="header-ro" aria-label="Statement (read-only)">
            <Lean code={level.header} />
          </div>
        </WhatToProve>
        <SymbolBar levelId={level.id} onInsert={(s) => editor.current?.insert(s)} unlocked={run.session.ctx.codex} />
        {level.mode === 'tactic' && <FirstTimeTip tip="tactic" solved={run.solved} />}
        <Editor
          ref={editor}
          value={body}
          onChange={onChange}
          onCursor={setCursor}
          diagnostics={toEditorDiags(info.diags)}
          fontSize={run.fontSize}
          ariaLabel="Proof editor"
          selectPlaceholder
          completion={completion}
          hyps={hyps}
          cursor={placeholderRange(run.initialBody)?.from ?? 'end'}
        />
        {body !== level.starter && (
          <div className="start-over">
            <button type="button" className="linkish quiet" title="Back to the starting code. ⌘Z undoes it." onClick={() => editor.current?.replaceAll(level.starter)}>Start over</button>
          </div>
        )}
        {level.after && <><div className="after-caption">Lean also checks this:</div><div className="header-ro after"><Lean code={level.after} /></div></>}
      </div>
      <Infoview
        goals={info.goals}
        fallbackGoals={info.fallback}
        diagnostics={info.diags}
        complete={!!result?.complete && !pending && missing.length === 0}
        note={missing.length ? <Markdown text={mustUseNote(missing)} /> : undefined}
        pending={pending}
        friendlySorry
        onInsert={(n) => editor.current?.insert(n)}
        errorGoals={info.errorGoals}
        onReplace={(from, to, text) => {
          const next = body.slice(0, from) + text + body.slice(to);
          setBody(next);
          runRef.current.saveDraft(next);
        }}
        emptyHint={level.mode === 'term' ? 'Write a term after the := sign. Errors and types show up here.' : undefined}
        sorryLeft={!!result && result.decls.some((d) => d.usesSorry)}
      />
    </>
  );
}
