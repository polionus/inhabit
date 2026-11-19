import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KbdHint } from '../components/KbdHint.tsx';
import { celebrate } from '../components/celebrate.ts';
import type { Level } from '../../content/types.ts';
import type { LevelSession } from '../../game/env.ts';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { hintRevealsSolution } from '../lean/hints.ts';
import { Inventory } from '../components/Inventory.tsx';
import { Lean, Markdown } from '../components/Markdown.tsx';
import { Success, type Reward } from '../components/Success.tsx';
import { ShareButton } from '../arena/ShareButton.tsx';
import { Icon, Modal, Pill, Stars } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { starsFor } from '../../state/meta.ts';
import { worldComplete } from '../../state/progress.ts';
import { chapterFor } from '../../content/chapters/index.ts';
import { href } from '../router.ts';
import { LessonPanel } from './Lesson.tsx';
import { ProofLevelView } from './ProofLevel.tsx';
import { StuckHelp } from './StuckHelp.tsx';
import { ParsonsLevelView } from './ParsonsLevel.tsx';
import { ChoiceLevelView } from './ChoiceLevel.tsx';
import { PredictLevelView } from './PredictLevel.tsx';
import { FormalizeLevelView } from './FormalizeLevel.tsx';
import { lessonDefaultOpen } from './lessonDefault.ts';
import { PracticeOffer } from '../practice/PracticeOffer.tsx';
import { useMedia } from '../hooks.tsx';
import { hintsOf, type EditorApi, type LiveState, type Run, type RunCompletion } from './run.ts';

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
  // A rung that states the solution is not part of the ladder: the solution button covers it.
  const hints = useMemo(() => hintsOf(level).filter((h) => !hintRevealsSolution(h.text, level)), [level]);

  const [revealed, setRevealed] = useState(0);
  const [toolUsed, setToolUsed] = useState(false);
  const [failedChecks, setFailedChecks] = useState(0);
  const [live, setLive] = useState<LiveState | null>(null);
  const [usedSolution, setUsedSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [inventory, setInventory] = useState(false);
  const [outcome, setOutcome] = useState<(RunCompletion & { xp: number; studied: boolean; reward: Reward }) | null>(null);
  const [worldDone, setWorldDone] = useState(false);
  // Ctrl/Cmd+Enter goes on once the level is solved. Active only then, so it never competes with the editor.
  const advanceRef = useRef<(() => void) | undefined>(undefined);
  advanceRef.current = outcome || (mode === 'review' && showSolution) ? props.onNext : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (!advanceRef.current || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      e.stopPropagation();
      advanceRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const lessonSettings = useGame((s) => s.save.settings);
  const narrow = useMedia('(max-width: 900px)');
  const deckItem = useGame((s) => s.save.deck[levelId]);
  const api = useRef<EditorApi>({});
  const done = useRef(false);
  const helpUsed = revealed + (toolUsed ? 1 : 0);

  const initialBody = useMemo(() => {
    if (level.kind === 'proof') {
      // Review tests recall: start blank, unless the starter is the task itself (code to fix, or a commented workflow).
      if (mode === 'review') return keepStarterInReview(level.starter) ? level.starter : '  sorry';
      return draft ?? (progress?.status === 'solved' || progress?.status === 'studied' ? (progress.best ?? level.starter) : level.starter);
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, mode]);

  const revealHint = () => {
    const n = Math.min(hints.length, revealed + 1);
    setRevealed(n);
    if (mode === 'play') game().recordHints(levelId, n + (toolUsed ? 1 : 0));
  };

  /** "Which tool?" counts as one hint. */
  const useTool = () => {
    if (toolUsed) return;
    setToolUsed(true);
    if (mode === 'play') game().recordHints(levelId, revealed + 1);
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
      const studied = !!c.studied || usedSolution;
      const clean = !studied && helpUsed === 0;
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
    [levelId, mode, usedSolution, helpUsed],
  );

  const run: Run = {
    level,
    mode,
    session,
    fontSize,
    solved: !!outcome,
    initialBody,
    attempt: () => {
      setFailedChecks((n) => n + 1);
      if (mode === 'play') game().recordAttempt(levelId);
    },
    reportLive: setLive,
    complete,
    saveDraft: (t) => mode === 'play' && game().setDraft(levelId, t),
    api,
  };

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
        <nav className="task-crumb" aria-label="Breadcrumb">
          {world && mode === 'play' && (
            <>
              <a href={href.world(world.id)}>
                <WorldToken world={world} size={28} state={wStatus?.state} progress={wStatus?.frac ?? 0} badge={false} />
                <span className="crumb-world">{world.title}</span>
              </a>
              <span className="crumb-sep" aria-hidden="true">·</span>
              <span className="crumb-pos">Level {session.ctx.index + 1} of {world.levels.length}</span>
              <span className="crumb-sep" aria-hidden="true">·</span>
            </>
          )}
          <span className="crumb-kind">{KIND_LABEL[level.kind]}</span>
        </nav>
        <div className="task-head">
          {(level.boss || level.optional || (level.kind === 'proof' && level.mode === 'term')) && (
            <div className="task-tags">
              {level.boss && <Pill tone="gold" icon="crown-fill">Boss</Pill>}
              {level.optional && <Pill>Side quest</Pill>}
              {level.kind === 'proof' && level.mode === 'term' && <Pill>Term mode</Pill>}
            </div>
          )}
          <div className="task-title-row">
            <h1>{level.title}</h1>
            {mode === 'play' && !outcome && <Stars value={currentStars} size="md" />}
          </div>
        </div>
        <Markdown text={level.intro} className="task-intro" />
        <StuckHelp
          level={level}
          levelId={levelId}
          ctx={session.ctx}
          strict={strict}
          hints={hints}
          live={live}
          revealed={revealed}
          onRevealHint={revealHint}
          toolUsed={toolUsed}
          onUseTool={useTool}
          failedChecks={failedChecks}
          canShowSolution={!!sol && !showSolution}
          onShowSolution={reveal}
          finished={!!outcome}
          leading={<button className="btn small" onClick={() => setInventory(true)}><Icon name="bag" size={16} /> Inventory</button>}
        />
        <LessonPanel lesson={lesson} defaultOpen={lessonDefaultOpen({ ctx: session.ctx, mode, passed, settings: lessonSettings, narrow })} remember={mode === 'play'} nudge={failedChecks >= 2 && !outcome && !passed} />
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
            levelId={levelId}
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
                <button className="btn primary big" onClick={props.onNext}>{props.nextLabel ?? 'Next'} <Icon name="arrow-right" size={18} /><KbdHint /></button>
                {(level.kind === 'proof' || level.kind === 'parsons') && outcome.body && !outcome.studied && (
                  <ShareButton card={{ kind: 'level', ref: levelId, title: level.title, english: englishOf(level) ?? undefined, source: [level.setup, level.header + '\n' + outcome.body + (level.kind === 'proof' && level.after ? '\n' + level.after : '')].filter(Boolean).join('\n') }} />
                )}
                {mode === 'play' && <PracticeOffer levelId={levelId} when={outcome.studied ? 'studied' : 'after'} />}
                {props.extraActions}
              </>
            }
          />
        )}
        {!outcome && mode === 'review' && showSolution && (
          <div className="actions"><button className="btn primary" onClick={props.onNext}>{props.nextLabel ?? 'Continue'} <KbdHint /></button></div>
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
  // Worlds this one leads to, once all their other prerequisites are also finished.
  const nextWorlds = data.worlds.filter(
    (x) => x.requires.includes(w.id) && x.requires.every((r) => { const rw = data.worlds.find((y) => y.id === r); return !!rw && worldComplete(rw, save.levels); }),
  );
  const recap = data.worldLessons(w.id)?.recap;
  return (
    <div className="wd">
      <div className="wd-hero">
        <WorldToken world={w} size={120} state="complete" />
        <h3>{w.title}</h3>
        <span className="wd-stars"><Icon name="star" size={18} className="goldc" /> <span className="tnum">{st.stars.earned} of {st.stars.total} stars</span></span>
      </div>
      {recap && <Markdown text={recap} className="prose compact wd-recap" />}
      {nextWorlds.length > 0 ? (
        <>
          {nextWorlds.map((n) => (
            <div key={n.id} className="wd-next">
              <a className="btn primary big" href={href.world(n.id)}>{nextWorlds.length > 1 ? 'Next track' : 'Next chapter'}: {n.title} <Icon name="arrow-right" size={18} /></a>
              {chapterFor(n.id) && <a className="linkish" href={href.chapter(n.id)}>Read the chapter explainer</a>}
            </div>
          ))}
          <div className="actions">
            <a className="linkish" href={href.map()}>Back to the map</a>
            <button type="button" className="linkish" onClick={onNext}>See the world page</button>
          </div>
        </>
      ) : (
        <div className="actions">
          <a className="btn primary big" href={href.map()}><Icon name="map" size={18} /> Back to the map</a>
          <button type="button" className="btn ghost" onClick={onNext}>See the world page</button>
        </div>
      )}
    </div>
  );
}

/** A starter with no `sorry` is code to fix; one that opens with a comment is a written workflow. Both are the task. */
export function keepStarterInReview(starter: string): boolean {
  return !starter.includes('sorry') || starter.trimStart().startsWith('--');
}
