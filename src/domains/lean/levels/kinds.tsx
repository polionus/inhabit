import { lazy, Suspense, useMemo } from 'react';
import { CodeBlock as Lean } from '../../../template/components/Markdown.tsx';
import type { LevelKindDef, LevelRenderProps } from '../../../template/types.ts';
import { getLeanRuntime } from '../context.ts';
import type { LeanChoiceLevel, FormalizeLevel, LeanLevel, ParsonsLevel, PredictLevel, ProofLevel } from '../types.ts';
import type { LiveState, Run } from './run.ts';

// The views (and CodeMirror behind ProofLevel) load with the first level, not with the app shell.
const ProofLevelView = lazy(() => import('./ProofLevel.tsx').then((m) => ({ default: m.ProofLevelView })));
const ParsonsLevelView = lazy(() => import('./ParsonsLevel.tsx').then((m) => ({ default: m.ParsonsLevelView })));
const ChoiceLevelView = lazy(() => import('./ChoiceLevel.tsx').then((m) => ({ default: m.ChoiceLevelView })));
const PredictLevelView = lazy(() => import('./ChoiceLevel.tsx').then((m) => ({ default: m.PredictLevelView })));
const FormalizeLevelView = lazy(() => import('./FormalizeLevel.tsx').then((m) => ({ default: m.FormalizeLevelView })));
const loading = <div className="level-loading" aria-busy="true" />;

function useLeanRun(props: LevelRenderProps): Run {
  const { sessionFor } = getLeanRuntime();
  const session = useMemo(
    () => sessionFor(props.level.id, props.strictInventory),
    [sessionFor, props.level.id, props.strictInventory],
  );
  return useMemo(
    () => ({
      level: props.level as LeanLevel,
      mode: props.mode,
      session,
      fontSize: props.fontSize,
      solved: props.solved,
      initialBody: props.initialBody,
      attempt: props.attempt,
      complete: props.complete,
      saveDraft: props.saveDraft,
      reportLive: (live: LiveState) => props.reportLive(live),
      api: props.api,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.level, props.mode, session, props.fontSize, props.solved, props.initialBody, props.attempt, props.complete, props.saveDraft, props.reportLive, props.api],
  );
}

function ProofKind(props: LevelRenderProps) {
  const run = useLeanRun(props);
  return <Suspense fallback={loading}><ProofLevelView run={run} level={props.level as ProofLevel} /></Suspense>;
}

function ParsonsKind(props: LevelRenderProps) {
  const run = useLeanRun(props);
  return <Suspense fallback={loading}><ParsonsLevelView run={run} level={props.level as ParsonsLevel} /></Suspense>;
}

function ChoiceKind(props: LevelRenderProps) {
  const run = useLeanRun(props);
  return <Suspense fallback={loading}><ChoiceLevelView run={run} level={props.level as LeanChoiceLevel} /></Suspense>;
}

function PredictKind(props: LevelRenderProps) {
  const run = useLeanRun(props);
  return <Suspense fallback={loading}><PredictLevelView run={run} level={props.level as PredictLevel} /></Suspense>;
}

function FormalizeKind(props: LevelRenderProps) {
  const run = useLeanRun(props);
  return <Suspense fallback={loading}><FormalizeLevelView run={run} level={props.level as FormalizeLevel} /></Suspense>;
}

export function createLeanLevelKinds(): Record<string, LevelKindDef> {
  return {
    proof: {
      label: 'Proof',
      icon: 'bolt',
      baseXp: 20,
      initialBody: (l, mode, draft, progress) => {
        const pl = l as ProofLevel;
        if (mode === 'review') return pl.starter;
        return draft ?? (progress?.status === 'solved' ? (progress.best ?? pl.starter) : pl.starter);
      },
      solutionText: (l) => (l as ProofLevel).solutions[0] ?? null,
      renderSolution: (solution, _l, api) => (
        <>
          <Lean code={solution} />
          {api.current.setBody && (
            <button
              className="btn small"
              onClick={() => {
                api.current.setBody?.(solution);
              }}
            >
              Copy into editor
            </button>
          )}
        </>
      ),
      render: ProofKind,
    },
    parsons: {
      label: 'Arrange',
      icon: 'list',
      baseXp: 10,
      solutionText: (l) => (l as ParsonsLevel).lines.join('\n'),
      renderSolution: (solution) => <Lean code={solution} />,
      render: ParsonsKind,
    },
    choice: {
      label: 'Choice',
      icon: 'check-circle',
      baseXp: 8,
      solutionText: (l) => (l as LeanChoiceLevel).options.find((o) => o.correct)?.text ?? null,
      render: ChoiceKind,
    },
    predict: {
      label: 'Predict',
      icon: 'eye',
      baseXp: 8,
      solutionText: (l) => (l as PredictLevel).options.find((o) => o.correct)?.text ?? null,
      render: PredictKind,
    },
    formalize: {
      label: 'Formalise',
      icon: 'translate',
      baseXp: 25,
      solutionText: (l) => (l as FormalizeLevel).accept[0] ?? null,
      renderSolution: (solution) => <Lean code={solution} />,
      render: FormalizeKind,
    },
  };
}
