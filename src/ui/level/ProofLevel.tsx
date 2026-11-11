import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProofLevel } from '../../content/types.ts';
import type { CheckResult } from '../../engine/types.ts';
import { data, engine } from '../data.ts';
import { Editor, toEditorDiags, type EditorHandle } from '../lean/Editor.tsx';
import { mapDiagnostics } from '../lean/offsets.ts';
import { useCheck } from '../hooks.tsx';
import { Infoview } from '../components/Infoview.tsx';
import { Lean } from '../components/Markdown.tsx';
import { SymbolBar } from '../components/SymbolBar.tsx';
import type { Run } from './run.ts';

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
    return { diags, goals, fallback };
  }, [result, bodyOffset, bodyLen, cursor]);
}

export function ProofLevelView({ run, level }: { run: Run; level: ProofLevel }) {
  const [body, setBody] = useState(run.initialBody);
  const [cursor, setCursor] = useState(body.length);
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
  const info = useInfo(result, bodyOffset, body.length, cursor);

  const prevErr = useRef(false);
  useEffect(() => {
    if (!result) return;
    const hasErr = !result.ok;
    if (hasErr && !prevErr.current && body.trim() && body !== level.starter) runRef.current.attempt();
    prevErr.current = hasErr;
    if (result.complete && !pending && body.trim() !== '') {
      const decl = result.decls.find((d) => d.term && d.isTacticProof) ?? result.decls.find((d) => d.term);
      runRef.current.complete({ body, term: level.mode === 'tactic' ? decl?.term : undefined });
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (v: string) => {
    setBody(v);
    runRef.current.saveDraft(v);
  };

  return (
    <>
      <div className="editor-panel">
        <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
        <div className="header-ro" aria-label="Statement (read-only)">
          <Lean code={level.header} />
        </div>
        <Editor
          ref={editor}
          value={body}
          onChange={onChange}
          onCursor={setCursor}
          diagnostics={toEditorDiags(info.diags)}
          fontSize={run.fontSize}
          ariaLabel="Proof editor"
        />
        {level.after && <div className="header-ro after"><Lean code={level.after} /></div>}
      </div>
      <Infoview
        goals={info.goals}
        fallbackGoals={info.fallback}
        diagnostics={info.diags}
        complete={!!result?.complete && !pending}
        pending={pending}
        friendlySorry
        onInsert={(n) => editor.current?.insert(n)}
        emptyHint={level.mode === 'term' ? 'Write a term after the := sign. Errors and types show up here.' : undefined}
      />
    </>
  );
}
