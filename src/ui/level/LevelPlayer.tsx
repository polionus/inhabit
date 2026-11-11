import { useCallback, useMemo, useRef, useState } from 'react';
import type { Level } from '../../content/types.ts';
import type { LevelSession } from '../../game/env.ts';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { hintRevealsSolution } from '../lean/hints.ts';
import { HintLadder } from '../components/HintLadder.tsx';
import { Inventory } from '../components/Inventory.tsx';
import { Lean, Markdown } from '../components/Markdown.tsx';
import { Success } from '../components/Success.tsx';
import { ProofLevelView } from './ProofLevel.tsx';
import { ParsonsLevelView } from './ParsonsLevel.tsx';
import { ChoiceLevelView } from './ChoiceLevel.tsx';
import { PredictLevelView } from './PredictLevel.tsx';
import { FormalizeLevelView } from './FormalizeLevel.tsx';
import { hintsOf, type EditorApi, type Run, type RunCompletion } from './run.ts';

const KIND_LABEL: Record<Level['kind'], string> = {
  proof: 'Proof',
  parsons: 'Arrange',
  choice: 'Check',
  predict: 'Predict',
  formalize: 'Formalize',
};

export function englishOf(l: Level): string | null {
  if (l.kind === 'proof' || l.kind === 'parsons' || l.kind === 'formalize') return l.english;
  if (l.kind === 'choice') return l.question;
  return null;
}

function solutionText(l: Level): string | null {
  if (l.kind === 'proof') return l.solutions[0] ?? null;
  if (l.kind === 'parsons') return l.lines.join('\n');
  if (l.kind === 'formalize') return l.accept[0] ?? null;
  return null;
}

export interface LevelPlayerProps {
  levelId: string;
  mode: 'play' | 'review';
  /** Called when the learner leaves via the success card's primary action. */
  onNext?: () => void;
  nextLabel?: string;
  /** Review only: called once the item is decided. */
  onReviewDone?: (passed: boolean) => void;
  extraActions?: React.ReactNode;
}

export function LevelPlayer(props: LevelPlayerProps) {
  const { levelId, mode } = props;
  const strict = useGame((s) => s.save.settings.strictInventory);
  const fontSize = useGame((s) => s.save.settings.fontSize);
  const progress = useGame((s) => s.save.levels[levelId]);
  const draft = useGame((s) => s.save.drafts[levelId]);

  const session: LevelSession = useMemo(() => data.levelSession(levelId, strict), [levelId, strict]);
  const level = session.ctx.level;
  const hints = hintsOf(level);

  const [revealed, setRevealed] = useState(0);
  const [usedSolution, setUsedSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [inventory, setInventory] = useState(false);
  const [outcome, setOutcome] = useState<(RunCompletion & { xp: number; studied: boolean }) | null>(null);
  const api = useRef<EditorApi>({});
  const done = useRef(false);
  const finalGivesAway = useMemo(() => hints.length > 0 && hintRevealsSolution(hints[hints.length - 1].text, level), [hints, level]);
  const finalRevealed = finalGivesAway && revealed >= hints.length && hints.length > 1;
  const attemptsInit = useRef(false);

  const initialBody = useMemo(() => {
    if (level.kind === 'proof') {
      if (mode === 'review') return level.starter;
      return draft ?? (progress?.status === 'solved' || progress?.status === 'studied' ? (progress.best ?? level.starter) : level.starter);
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, mode]);

  const revealHint = () => {
    const n = Math.min(hints.length, revealed + 1);
    setRevealed(n);
    if (mode === 'play') game().recordHints(levelId, n);
  };

  const reveal = () => {
    setShowSolution(true);
    if (!usedSolution) {
      setUsedSolution(true);
      if (mode === 'play') {
        game().completeLevel(levelId, { studied: true, clean: false });
      } else if (!done.current) {
        done.current = true;
        props.onReviewDone?.(false);
      }
    }
  };

  const complete = useCallback(
    (c: RunCompletion = {}) => {
      if (done.current) return;
      done.current = true;
      const studied = !!c.studied || usedSolution || finalRevealed;
      const clean = !studied && revealed === 0;
      if (mode === 'play') {
        const r = game().completeLevel(levelId, { studied, clean, body: c.body, selfAssessed: c.selfAssessed });
        setOutcome({ ...c, xp: r.xp, studied });
      } else {
        setOutcome({ ...c, xp: 0, studied });
        props.onReviewDone?.(!studied);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelId, mode, usedSolution, finalRevealed, revealed],
  );

  const run: Run = {
    level,
    mode,
    session,
    fontSize,
    solved: !!outcome,
    initialBody,
    attempt: () => {
      if (mode === 'play') game().recordAttempt(levelId);
    },
    complete,
    saveDraft: (t) => mode === 'play' && game().setDraft(levelId, t),
    api,
  };
  void attemptsInit;

  const sol = solutionText(level);
  const rating = progress?.rating;
  const hasEditor = level.kind === 'proof' || level.kind === 'parsons';

  return (
    <div className={`level kind-${level.kind}`}>
      <section className="task" aria-label="Task">
        <div className="task-head">
          <span className="tag">{KIND_LABEL[level.kind]}{level.boss ? ' · boss' : ''}{level.optional ? ' · side-quest' : ''}</span>
          <h1>{level.title}</h1>
        </div>
        {englishOf(level) && level.kind !== 'choice' && <Markdown className="english" text={englishOf(level)!} />}
        <Markdown text={level.intro} />
        {level.kind === 'choice' && <Markdown className="english" text={level.question} />}
        <div className="toolbar">
          <button className="btn" onClick={() => setInventory(true)}>Inventory</button>
          {sol && !showSolution && !outcome && (
            <button className="btn ghost" onClick={reveal} title="Marks the level as studied">Show solution</button>
          )}
        </div>
        {hints.length > 0 && <HintLadder hints={hints} revealed={revealed} onReveal={revealHint} lastGivesAway={finalGivesAway} />}
        {showSolution && sol && (
          <div className="solution">
            <div className="label">A solution</div>
            <Lean code={sol} />
            {hasEditor && level.kind === 'proof' && (
              <button className="btn small" onClick={() => api.current.setBody?.(sol)}>Put it in the editor</button>
            )}
            <p className="muted small">{mode === 'review' ? 'Noted. This one will come back sooner.' : 'This level is now marked studied. Solve it again later to earn “solved”.'}</p>
          </div>
        )}
        {outcome && (
          <Success
            outro={level.outro}
            term={outcome.term}
            termOpen={level.kind === 'proof' && level.showTerm}
            studied={outcome.studied}
            xp={outcome.xp}
            rating={mode === 'play' ? rating : undefined}
            onRate={mode === 'play' ? (r) => game().rateLevel(levelId, r) : undefined}
            note={level.kind === 'formalize' && outcome.selfAssessed ? 'You judged this one yourself.' : undefined}
            actions={
              <>
                <button className="btn primary" onClick={props.onNext}>{props.nextLabel ?? 'Next'}</button>
                {props.extraActions}
              </>
            }
          />
        )}
        {!outcome && mode === 'review' && showSolution && (
          <div className="actions"><button className="btn primary" onClick={props.onNext}>{props.nextLabel ?? 'Continue'}</button></div>
        )}
        {progress?.status && progress.status !== 'unseen' && !outcome && mode === 'play' && (
          <p className="muted small">You have already {progress.status === 'solved' ? 'solved' : 'studied'} this level{progress.testedOut ? ' (tested out)' : ''}.</p>
        )}
      </section>
      <div className="work">
        {level.kind === 'proof' && <ProofLevelView run={run} level={level} />}
        {level.kind === 'parsons' && <ParsonsLevelView run={run} level={level} />}
        {level.kind === 'choice' && <ChoiceLevelView run={run} level={level} />}
        {level.kind === 'predict' && <PredictLevelView run={run} level={level} />}
        {level.kind === 'formalize' && <FormalizeLevelView run={run} level={level} />}
      </div>
      {inventory && <Inventory ctx={session.ctx} onInsert={hasEditor && level.kind === 'proof' ? (t) => api.current.insert?.(t) : undefined} onClose={() => setInventory(false)} />}
    </div>
  );
}
