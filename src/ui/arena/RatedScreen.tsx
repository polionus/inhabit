import { useCallback, useEffect, useState } from 'react';
import { RATED_FAMILIES, ratedPuzzle, type RatedCurrent, type RatedResult } from '../../arena/state/model.ts';
import { arenaStore, useArena } from '../../arena/state/store.ts';
import type { Puzzle, PuzzleFamily } from '../../arena/types.ts';
import { Pill, ScreenHeader, celebrate, sfx } from '../components/kit.tsx';
import { CountUp, Reference } from './parts.tsx';
import { PuzzlePlayer, type PuzzleOutcome } from './PuzzlePlayer.tsx';

const FAMILY_LABEL: Record<PuzzleFamily, string> = { prop: 'Logic', inhabit: 'Terms', quant: 'Quantifiers', set: 'Sets', quick: 'Quick' };

interface Stage {
  cur: RatedCurrent;
  puzzle: Puzzle;
  outcome: PuzzleOutcome | null;
  result: RatedResult | null;
}

function load(): Stage {
  const cur = arenaStore.getState().ensureRated();
  return { cur, puzzle: ratedPuzzle(arenaStore.getState(), cur), outcome: null, result: null };
}

export function RatedScreen() {
  const [stage, setStage] = useState<Stage | null>(null);
  const filter = useArena((s) => s.filter);
  const rating = useArena((s) => s.rating);
  const rated = useArena((s) => s.rated);

  useEffect(() => {
    const id = setTimeout(() => setStage(load()), 0);
    return () => clearTimeout(id);
  }, []);

  const onDone = useCallback((puzzle: Puzzle, o: PuzzleOutcome) => {
    const result = arenaStore.getState().finishRated(puzzle, o);
    const ok = o.solved && !o.skipped && !o.revealed;
    if (ok) celebrate(o.hintsUsed ? 'tick' : 'solve');
    else sfx.play('wrong');
    setStage((s) => (s ? { ...s, outcome: o, result } : s));
  }, []);

  const next = useCallback(() => setStage(load()), []);

  // Enter moves on once a result is showing.
  useEffect(() => {
    if (!stage?.result) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable || t.tagName === 'A' || (t.tagName === 'BUTTON' && !t.classList.contains('next-btn')))) return;
      e.preventDefault();
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage?.result, next]);

  const toggle = (f: PuzzleFamily) => {
    const has = filter.includes(f);
    const nextF = has ? filter.filter((x) => x !== f) : [...filter, f];
    if (nextF.length) arenaStore.getState().setFilter(RATED_FAMILIES.filter((x) => nextF.includes(x)));
  };

  return (
    <div className="page arena rated">
      <ScreenHeader id="arena-puzzles" title="Rated puzzles" icon="target" actions={<Pill tone="primary" title="Your Arena rating">{rating}{rated === 0 ? ' (unrated)' : ''}</Pill>} />
      <div className="chips" role="group" aria-label="Puzzle types for the next puzzle">
        {RATED_FAMILIES.map((f) => (
          <button key={f} className={`chip ${filter.includes(f) ? 'on' : ''}`} aria-pressed={filter.includes(f)} onClick={() => toggle(f)}>
            {FAMILY_LABEL[f]}
          </button>
        ))}
        <span className="muted small chips-note">Applies from the next puzzle.</span>
      </div>

      {!stage ? (
        <p className="muted" role="status">Finding a puzzle near your rating…</p>
      ) : (
        <>
          <PuzzlePlayer
            key={stage.puzzle.id}
            puzzle={stage.puzzle}
            explain={false}
            onDone={(o) => onDone(stage.puzzle, o)}
            initial={stage.cur.progress.ms || stage.cur.progress.hints || stage.cur.progress.body ? stage.cur.progress : undefined}
            onProgress={(p) => arenaStore.getState().saveRatedProgress(p)}
          />
          {stage.result && stage.outcome && <ResultStrip stage={stage} onNext={next} />}
        </>
      )}
    </div>
  );
}

function ResultStrip({ stage, onNext }: { stage: Stage; onNext(): void }) {
  const { result, outcome, puzzle } = stage;
  if (!result || !outcome) return null;
  const ok = outcome.solved && !outcome.skipped && !outcome.revealed;
  const headline = ok ? (outcome.hintsUsed ? 'Solved with hints' : 'Solved') : outcome.skipped ? 'Skipped' : outcome.revealed ? 'Solution shown' : 'Missed';
  const sign = result.delta > 0 ? '+' : result.delta < 0 ? '−' : '±';
  return (
    <section className={`strip rated-strip ${ok ? 'good' : 'bad'}`} role="status" aria-label="Result">
      <div className="strip-row">
        <div>
          <strong className="strip-title">{headline}</strong>
          <div className="muted small">Puzzle rated <span className="tnum">{puzzle.rating}</span>{puzzle.themes.length ? ` · ${puzzle.themes.join(', ')}` : ''}</div>
          {ok && outcome.hintsUsed > 0 && <div className="muted small">Hints make a solve count as a draw.</div>}
        </div>
        <div className={`delta ${result.delta > 0 ? 'up' : result.delta < 0 ? 'down' : 'flat'}`} aria-label={`Rating change ${sign}${Math.abs(result.delta)}, now ${result.after}`}>
          <span className="delta-chg tnum">{sign}{Math.abs(result.delta)}</span>
          <span className="delta-now"><CountUp from={result.before} to={result.after} /></span>
        </div>
      </div>
      <Reference puzzle={puzzle} />
      <button className="btn primary big next-btn" autoFocus onClick={onNext}>Next puzzle <span className="kbd">Enter</span></button>
    </section>
  );
}
