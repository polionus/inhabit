import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { celebrate } from '../components/celebrate.ts';
import type { Level } from '../../content/types.ts';
import type { LevelSession } from '../../game/env.ts';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { hintRevealsSolution } from '../lean/hints.ts';
import { HintLadder } from '../components/HintLadder.tsx';
import { Inventory } from '../components/Inventory.tsx';
import { Lean, Markdown } from '../components/Markdown.tsx';
import { Success, type Reward } from '../components/Success.tsx';
import { ShareButton } from '../arena/ShareButton.tsx';
import { Icon, Modal, Pill, Stars } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { KIND_ICON } from '../screens/WorldScreen.tsx';
import { starsFor } from '../../state/meta.ts';
import { worldComplete } from '../../state/progress.ts';
import { href } from '../router.ts';
import { LessonPanel } from './Lesson.tsx';
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
  const [outcome, setOutcome] = useState<(RunCompletion & { xp: number; studied: boolean; reward: Reward }) | null>(null);
  const [worldDone, setWorldDone] = useState(false);
  const lessonsOpen = useGame((s) => s.save.settings.lessonsOpen);
  const deckItem = useGame((s) => s.save.deck[levelId]);
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
      const world = session.ctx.world;
      const before = game().save;
      if (mode === 'play') {
        const r = game().completeLevel(levelId, { studied, clean, body: c.body, selfAssessed: c.selfAssessed });
        const after = game().save;
        const finishedWorld = r.firstPass && !!world && world.levels.length > 0 && !worldComplete(world, before.levels) && worldComplete(world, after.levels);
        const boss = !!level.boss;
        const reward: Reward = {
          stars: starsFor(after.levels[levelId], after.deck[levelId]),
          xpBefore: before.xp,
          xpAfter: after.xp,
          boss,
          celebration: studied ? null : finishedWorld ? null : boss ? 'boss' : 'solve',
          sound: studied ? 'tap' : boss || finishedWorld ? 'win' : 'solve',
        };
        setOutcome({ ...c, xp: r.xp, studied, reward });
        if (finishedWorld) setTimeout(() => setWorldDone(true), 700);
      } else {
        const reward: Reward = { stars: 0, xpBefore: before.xp, xpAfter: before.xp, boss: false, celebration: studied ? null : 'tick', sound: studied ? 'tap' : 'correct' };
        setOutcome({ ...c, xp: 0, studied, reward });
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

  const world = session.ctx.world;
  const save = useGame((s) => s.save);
  const wStatus = world ? worldStatus(world, save) : null;
  const passed = progress?.status === 'solved' || progress?.status === 'studied';
  const currentStars = starsFor(progress, deckItem);
  const lesson = useMemo(() => data.levelLesson(levelId), [levelId]);
  const sol = solutionText(level);
  const rating = progress?.rating;
  const hasEditor = level.kind === 'proof' || level.kind === 'parsons';

  return (
    <div className={`level kind-${level.kind}`}>
      <section className="task" aria-label="Task">
        {world && mode === 'play' && (
          <nav className="task-crumb" aria-label="Breadcrumb">
            <a href={href.world(world.id)}>
              <WorldToken world={world} size={28} state={wStatus?.state} progress={wStatus?.frac ?? 0} badge={false} />
              <span className="crumb-world">{world.title}</span>
            </a>
            <span className="crumb-pos">Level {session.ctx.index + 1} of {world.levels.length}</span>
          </nav>
        )}
        <div className="task-head">
          <div className="task-tags">
            <Pill tone="primary" icon={KIND_ICON[level.kind]}>{KIND_LABEL[level.kind]}</Pill>
            {level.boss && <Pill tone="gold" icon="crown-fill">Boss</Pill>}
            {level.optional && <Pill>Side quest</Pill>}
            {level.kind === 'proof' && level.mode === 'term' && <Pill>Term mode</Pill>}
          </div>
          <div className="task-title-row">
            <h1>{level.title}</h1>
            {mode === 'play' && !outcome && <Stars value={currentStars} size="md" />}
          </div>
        </div>
        {englishOf(level) && level.kind !== 'choice' && <Markdown className="english" text={englishOf(level)!} />}
        <Markdown text={level.intro} className="task-intro" />
        {level.kind === 'choice' && <Markdown className="english" text={level.question} />}
        <LessonPanel lesson={lesson} defaultOpen={mode === 'play' && !passed && lessonsOpen} remember={mode === 'play'} />
        <div className="toolbar">
          <button className="btn" onClick={() => setInventory(true)}><Icon name="bag" size={18} /> Inventory</button>
          {sol && !showSolution && !outcome && (
            <button className="btn ghost" onClick={reveal} title="Marks the level as studied"><Icon name="eye" size={18} /> Show solution</button>
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
            reward={outcome.reward}
            review={mode === 'review'}
            actions={
              <>
                <button className="btn primary big" onClick={props.onNext}>{props.nextLabel ?? 'Next'} <Icon name="arrow-right" size={18} /></button>
                {(level.kind === 'proof' || level.kind === 'parsons') && outcome.body && !outcome.studied && (
                  <ShareButton card={{ kind: 'level', ref: levelId, title: level.title, english: englishOf(level) ?? undefined, source: [level.setup, level.header + '\n' + outcome.body + (level.kind === 'proof' && level.after ? '\n' + level.after : '')].filter(Boolean).join('\n') }} />
                )}
                {props.extraActions}
              </>
            }
          />
        )}
        {!outcome && mode === 'review' && showSolution && (
          <div className="actions"><button className="btn primary" onClick={props.onNext}>{props.nextLabel ?? 'Continue'}</button></div>
        )}
        {progress?.status && progress.status !== 'unseen' && !outcome && mode === 'play' && (
          <p className="already"><Icon name="check-circle" size={16} /> You have already {progress.status === 'solved' ? 'solved' : 'studied'} this level{progress.testedOut ? ' (tested out)' : ''}.</p>
        )}
      </section>
      <div className="work">
        {level.kind === 'proof' && <ProofLevelView run={run} level={level} />}
        {level.kind === 'parsons' && <ParsonsLevelView run={run} level={level} />}
        {level.kind === 'choice' && <ChoiceLevelView run={run} level={level} />}
        {level.kind === 'predict' && <PredictLevelView run={run} level={level} />}
        {level.kind === 'formalize' && <FormalizeLevelView run={run} level={level} />}
      </div>
      {world && (
        <Modal open={worldDone} onClose={() => setWorldDone(false)} title="World complete" tone="gold" size="md" className="world-done">
          <WorldDone worldId={world.id} onNext={() => { setWorldDone(false); props.onNext?.(); }} />
        </Modal>
      )}
      {inventory && <Inventory ctx={session.ctx} onInsert={hasEditor && level.kind === 'proof' ? (t) => api.current.insert?.(t) : undefined} onClose={() => setInventory(false)} />}
    </div>
  );
}

/** Full celebration for finishing a world: emblem, stars, the world recap. */
function WorldDone({ worldId, onNext }: { worldId: string; onNext: () => void }) {
  const save = useGame((s) => s.save);
  const w = data.worlds.find((x) => x.id === worldId);
  useEffect(() => {
    const t = window.setTimeout(() => celebrate('world'), 60);
    return () => clearTimeout(t);
  }, []);
  if (!w) return null;
  const st = worldStatus(w, save);
  const recap = data.worldLessons(w.id)?.recap;
  return (
    <div className="wd">
      <div className="wd-hero">
        <WorldToken world={w} size={120} state="complete" />
        <h3>{w.title}</h3>
        <span className="wd-stars"><Icon name="star" size={18} className="goldc" /> <span className="tnum">{st.stars.earned} of {st.stars.total} stars</span></span>
      </div>
      {recap && <Markdown text={recap} className="prose compact wd-recap" />}
      <div className="actions">
        <a className="btn primary big" href={href.map()}><Icon name="map" size={18} /> Back to the map</a>
        <button type="button" className="btn ghost" onClick={onNext}>See the world page</button>
      </div>
    </div>
  );
}
