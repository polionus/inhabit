/**
 * `#/practice/<id>`: `id` is a level id (a set of generated problems on that level's tactic),
 * `<levelId>~s` (one smaller problem for a learner who is stuck), or the literal `translate`
 * (English-to-Lean statements).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { levelTitle, practiceFocus, practiceSet, smallerVersion } from '../../arena/practice.ts';
import type { ProofPuzzle } from '../../arena/types.ts';
import { nextAfter } from '../../state/progress.ts';
import { PuzzlePlayer, type PuzzleOutcome } from '../arena/PuzzlePlayer.tsx';
import { Reference } from '../arena/parts.tsx';
import { Card, EmptyState, ProgressBar, celebrate, sfx } from '../components/kit.tsx';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { href } from '../router.ts';
import { TranslateScreen } from './TranslateScreen.tsx';

export function PracticeScreen({ id }: { id: string }) {
  if (id === 'translate') return <TranslateScreen />;
  const small = id.endsWith('~s');
  const levelId = small ? id.slice(0, -2) : id;
  return <TacticPractice key={id} levelId={levelId} small={small} />;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="page narrow practice">
      <EmptyState icon="map" title="Nothing to practice here" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>
        {text}
      </EmptyState>
    </div>
  );
}

const solvedClean = (o: PuzzleOutcome) => o.solved && !o.skipped && !o.revealed;

function TacticPractice({ levelId, small }: { levelId: string; small: boolean }) {
  const [round, setRound] = useState(0);
  const [puzzles, setPuzzles] = useState<ProofPuzzle[] | null>(null);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<PuzzleOutcome[]>([]);
  const [current, setCurrent] = useState<PuzzleOutcome | null>(null);
  const [finished, setFinished] = useState(false);
  const recorded = useRef<number>(-1);
  const levels = useGame((s) => s.save.levels);
  const info = levelTitle(levelId);
  const focus = practiceFocus(levelId);

  useEffect(() => {
    setPuzzles(null);
    setIndex(0);
    setOutcomes([]);
    setCurrent(null);
    setFinished(false);
    const t = setTimeout(() => {
      try {
        setPuzzles(small ? [smallerVersion(levelId)].filter((p): p is ProofPuzzle => p !== null) : practiceSet(levelId, round));
      } catch {
        setPuzzles([]);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [levelId, small, round]);

  const onDone = useCallback((o: PuzzleOutcome) => {
    setCurrent(o);
    if (solvedClean(o)) celebrate(o.hintsUsed ? 'tick' : 'solve');
    else sfx.play('wrong');
  }, []);

  const advance = () => {
    if (!current || !puzzles) return;
    const all = [...outcomes, current];
    setOutcomes(all);
    setCurrent(null);
    if (index + 1 < puzzles.length) {
      setIndex(index + 1);
      return;
    }
    setFinished(true);
    if (!small && recorded.current !== round) {
      recorded.current = round;
      game().recordEvent({ type: 'practice', kind: 'tactic', levelId, solved: all.filter(solvedClean).length, total: puzzles.length });
    }
  };

  if (!info || !focus) return <Empty text="The generator cannot make problems for this level yet. The map has plenty to do." />;
  if (puzzles && puzzles.length === 0) return <Empty text="No generated problems fit what you have unlocked at this level. Back to the map." />;

  const found = data.findLevel(levelId);
  const next = found ? nextAfter(found.world, found.index, data.worlds, levels) : { kind: 'none' as const };
  const nextHref = next.kind === 'level' ? href.level(next.levelId!) : found ? href.world(found.world.id) : href.map();
  const nextLabel = next.kind === 'level' ? 'Next level' : 'Back to the region';

  const head = (
    <header className="practice-head">
      <div className="eyebrow">{small ? 'A smaller version' : 'Practice'}</div>
      <h1>
        {small ? 'Warm up on ' : 'Practice: '}
        {focus.tactics.length > 0 ? focus.tactics.map((t, i) => <span key={t}>{i > 0 && ', '}<code className="inline">{t}</code></span>) : focus.label}
        <span className="practice-from">, from {info.world} level {info.number}</span>
      </h1>
    </header>
  );

  if (!puzzles) {
    return (
      <div className="page narrow practice">
        {head}
        <p className="muted" role="status">Finding problems that fit what you have unlocked…</p>
      </div>
    );
  }

  if (finished) {
    if (small) {
      const ok = outcomes.some(solvedClean);
      return (
        <div className="page narrow practice">
          {head}
          <Card tone={ok ? 'ok' : 'default'} className="practice-end">
            <h2>{ok ? 'Nicely done' : 'That one is a stretch as well'}</h2>
            <p>{ok ? 'That is the same idea at a smaller size. Go back and try the level again.' : 'No problem. The level will still be there, and so will its solution when you want it.'}</p>
            <div className="practice-actions">
              <a className="btn primary" href={href.level(levelId)}>Back to the level</a>
              <a className="btn" href={href.practice(levelId)}>Try a set of three</a>
            </div>
          </Card>
        </div>
      );
    }
    const solved = outcomes.filter(solvedClean).length;
    const total = puzzles.length;
    const line = solved === total ? 'All of them, on your own terms.' : solved > 0 ? 'Good. Each one you solve by hand makes the idea easier to spot next time.' : 'Practice is for noticing, not for scoring. Another set will have fresh problems.';
    return (
      <div className="page narrow practice">
        {head}
        <Card tone={solved === total ? 'ok' : 'default'} className="practice-end">
          <h2 data-testid="practice-result">You solved {solved} of {total}</h2>
          <p>{line}</p>
          <div className="practice-actions">
            <button className="btn primary" onClick={() => setRound(round + 1)}>Another set</button>
            <a className="btn" href={href.level(levelId)}>Back to the level</a>
            <a className="btn" href={nextHref}>{nextLabel}</a>
          </div>
        </Card>
      </div>
    );
  }

  const puzzle = puzzles[index];
  const last = index + 1 === puzzles.length;
  return (
    <div className="page narrow practice">
      {head}
      {!small && (
        <div className="practice-progress">
          <span className="small tnum"><strong>{index + 1}</strong> of {puzzles.length}</span>
          <ProgressBar value={(index + (current ? 1 : 0)) / puzzles.length} size="xs" label={`Problem ${index + 1} of ${puzzles.length}`} />
        </div>
      )}
      <p className="muted small">
        Only the tactics you have unlocked are needed. Hints and the reference solution are always there; there is no timer.
      </p>
      <PuzzlePlayer key={puzzle.id} puzzle={puzzle} explain={false} onDone={onDone} />
      {current && (
        <section className={`strip ${solvedClean(current) ? 'good' : ''}`} role="status" aria-label="Result">
          <strong className="strip-title">{solvedClean(current) ? 'Solved' : current.skipped ? 'Skipped' : current.revealed ? 'Solution shown' : 'Not this time'}</strong>
          <Reference puzzle={puzzle} />
          <button className="btn primary" autoFocus onClick={advance}>
            {small ? 'Done' : last ? 'See how you did' : 'Next problem'}
          </button>
        </section>
      )}
    </div>
  );
}
