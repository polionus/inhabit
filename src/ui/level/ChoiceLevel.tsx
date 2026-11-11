import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChoiceLevel, PredictLevel } from '../../content/types.ts';
import type { CheckResult, Goal } from '../../engine/types.ts';
import { engine } from '../data.ts';
import { Editor, toEditorDiags } from '../lean/Editor.tsx';
import { lineOffset, mapDiagnostics } from '../lean/offsets.ts';
import { CommandOutputs, Infoview, Goals } from '../components/Infoview.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { useInfo } from './ProofLevel.tsx';
import type { Run } from './run.ts';
import { useShuffledOrder } from './shuffle.ts';

/** Check a read-only snippet once (with the level's setup prefix). */
export function useSnippet(run: Run, code: string | undefined, setup: string | undefined) {
  return useMemo(() => {
    if (!code) return null;
    const prefix = setup ? setup + '\n' : '';
    let result: CheckResult | null = null;
    try {
      result = engine.check(run.session.env, prefix + code);
    } catch {
      result = null;
    }
    return { result, offset: prefix.length };
  }, [run.session, code, setup]);
}

export function OptionList({
  options,
  order,
  picked,
  selected,
  locked,
  onPick,
}: {
  options: { text: string }[];
  /** Display order: positions -> original option indices. */
  order: number[];
  picked: Record<number, boolean>;
  selected?: number | null;
  locked: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className="options" role="group" aria-label="Options">
      {order.map((i, pos) => {
        const o = options[i];
        const state = picked[i] === undefined ? '' : picked[i] ? 'right' : 'wrong';
        return (
          <button
            key={i}
            data-option-index={i}
            className={`option ${state} ${selected === i ? 'selected' : ''}`}
            aria-pressed={selected === i || picked[i] !== undefined}
            disabled={locked && picked[i] === undefined}
            onClick={() => onPick(i)}
          >
            <span className="optmark" aria-hidden="true">{state === 'right' ? '✓' : state === 'wrong' ? '✗' : String.fromCharCode(65 + pos)}</span>
            <Markdown text={o.text} className="inline-md" />
          </button>
        );
      })}
    </div>
  );
}

export function ChoiceLevelView({ run, level }: { run: Run; level: ChoiceLevel }) {
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [last, setLast] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;
  const snippet = useSnippet(run, level.code, level.setup);
  const info = useInfo(snippet?.result ?? null, snippet?.offset ?? 0, level.code?.length ?? 0, cursor);
  const done = Object.values(picked).some(Boolean);
  const order = useShuffledOrder(level.id, level.options.length);

  const pick = (i: number) => {
    if (done) return;
    const ok = !!level.options[i].correct;
    setPicked((p) => ({ ...p, [i]: ok }));
    setLast(i);
    if (ok) runRef.current.complete();
    else runRef.current.attempt();
  };
  useEffect(() => setCursor(0), [level.id]);
  const code = level.code ?? '';
  const lineAt = (off: number) => {
    let n = 0;
    for (let k = 0; k < Math.min(off, code.length); k++) if (code[k] === '\n') n++;
    return n;
  };
  const curLine = lineAt(cursor);
  const outputs = info.diags.filter((d) => d.code === 'command-output' && d.inBody && lineAt(d.bFrom) <= curLine && curLine <= lineAt(Math.max(d.bFrom, d.bTo - 1)));

  return (
    <>
      <div className="editor-panel choice">
        {level.code && (
          <Editor value={level.code} readOnly fontSize={run.fontSize} onCursor={setCursor} diagnostics={toEditorDiags(mapDiagnostics(snippet?.result?.diagnostics ?? [], snippet?.offset ?? 0, level.code.length))} ariaLabel="Code (read-only). Move the cursor to inspect goals." cursor={0} />
        )}
        <OptionList options={level.options} order={order} picked={picked} locked={done} onPick={pick} />
        {last !== null && (
          <div className={`feedback ${picked[last] ? 'right' : 'wrong'}`} role="status">
            <Markdown text={level.options[last].feedback} />
          </div>
        )}
      </div>
      {level.code ? (
        <Infoview goals={info.goals} diagnostics={info.diags.filter((d) => d.severity === 'error')} outputs={outputs} complete={false} emptyHint="Move the cursor through the code to see what Lean says." />
      ) : (
        <section className="infoview muted-panel"><p className="muted">Pick the option you think is right. Wrong picks tell you why.</p></section>
      )}
    </>
  );
}

export function PredictLevelView({ run, level }: { run: Run; level: PredictLevel }) {
  const snippet = useSnippet(run, level.code, level.setup);
  const result = snippet?.result ?? null;
  const base = snippet?.offset ?? 0;
  const lo = lineOffset(level.code, level.line);
  const before: Goal[] | null = useMemo(() => {
    if (!result) return null;
    try {
      return engine.goalsAt(result, base + lo.indent);
    } catch {
      return null;
    }
  }, [result, base, lo.indent]);
  const after: Goal[] | null = useMemo(() => {
    if (!result) return null;
    const at = base + lo.indent;
    const step = result.steps.find((s) => s.from >= base + lo.start && s.from <= base + lo.end && s.from >= at - 0) ?? result.steps.find((s) => s.from <= at && s.to >= at);
    if (step) return step.after;
    try {
      const next = lineOffset(level.code, level.line + 1);
      return engine.goalsAt(result, base + (next.start >= level.code.length ? level.code.length : next.indent));
    } catch {
      return null;
    }
  }, [result, base, lo, level.code, level.line]);

  const [sel, setSel] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [last, setLast] = useState<number | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const done = Object.values(picked).some(Boolean);
  const order = useShuffledOrder(level.id, level.options.length);

  const commit = () => {
    if (sel === null) return;
    const ok = !!level.options[sel].correct;
    setPicked((p) => ({ ...p, [sel]: ok }));
    setLast(sel);
    setRevealed(true);
    setSel(null);
    if (ok) runRef.current.complete();
    else runRef.current.attempt();
  };

  return (
    <>
      <div className="editor-panel predict">
        <Editor value={level.code} readOnly markLine={level.line} fontSize={run.fontSize} cursor={lo.indent} ariaLabel="Code (read-only). The marked line is the one to predict." />
        <p className="question">{level.question ?? 'What will the goal be after this line runs?'}</p>
        <OptionList options={level.options} order={order} picked={picked} selected={sel} locked={done} onPick={(i) => !done && setSel(i)} />
        {!done && (
          <div className="actions">
            <button className="btn primary" disabled={sel === null} onClick={commit}>{revealed ? 'Try another prediction' : 'Lock in my prediction'}</button>
          </div>
        )}
        {last !== null && (
          <div className={`feedback ${picked[last] ? 'right' : 'wrong'}`} role="status">
            <Markdown text={level.options[last].feedback} />
          </div>
        )}
      </div>
      <section className="infoview" aria-label="Goal states">
        <div className="info-body">
          {before ? <Goals goals={before} label="Before the marked line" /> : <p className="muted">No goal state available here.</p>}
          {revealed && (after && after.length ? <Goals goals={after} label="After the marked line (what Lean actually does)" /> : <p className="done-state quiet"><span className="check" aria-hidden="true">✓</span> After this line there are no goals left.</p>)}
          {!revealed && <p className="muted small">Commit to a prediction to reveal what really happens.</p>}
        </div>
      </section>
    </>
  );
}
