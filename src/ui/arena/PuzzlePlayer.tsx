/**
 * Plays one generated puzzle. Used by every Arena mode (daily, rated, rush, duels).
 * Mount it with `key={puzzle.id}`: its state is per puzzle. After `onDone` it stays on screen
 * showing the outcome (solved proof, option feedback), so the parent only adds its own strip.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { generator } from '../../arena/gen/index.ts';
import type { ProofPuzzle, Puzzle, QuickPuzzle } from '../../arena/types.ts';
import { HintLadder } from '../components/HintLadder.tsx';
import { Infoview } from '../components/Infoview.tsx';
import { Lean, Markdown } from '../components/Markdown.tsx';
import { SymbolBar } from '../components/SymbolBar.tsx';
import { Icon, sfx } from '../components/kit.tsx';
import { useGame } from '../game.ts';
import { useCheck } from '../hooks.tsx';
import { Editor, toEditorDiags, type EditorHandle } from '../lean/Editor.tsx';
import { useInfo } from '../level/ProofLevel.tsx';

export interface PuzzleOutcome {
  solved: boolean;
  ms: number;
  hintsUsed: number;
  revealed: boolean;
  skipped: boolean;
  attempts: number;
}

export interface PuzzlePlayerProps {
  puzzle: Puzzle;
  /** Called exactly once when the puzzle ends (solved, skipped, revealed, or a wrong quick answer). */
  onDone(o: PuzzleOutcome): void;
  /** Hints / reveal / skip buttons. Default: { hints: true, reveal: true, skip: true }. */
  allow?: { hints?: boolean; reveal?: boolean; skip?: boolean };
  /** Show the answer explanation after a quick item and wait for "Next" (default true); false = call onDone immediately (Rush, duels). */
  explain?: boolean;
  /** Compact chrome for timed modes. */
  compact?: boolean;
  /** Extra content for the header row (timers, opponent progress). */
  header?: ReactNode;
  /** Resume a puzzle that was left unfinished (optional extension used by Daily and Rated). */
  initial?: { hints?: number; ms?: number; body?: string };
  /** Reports resumable progress (hints used, elapsed ms, editor text). Optional extension. */
  onProgress?(p: { hints: number; ms: number; body: string }): void;
}

export function PuzzlePlayer(props: PuzzlePlayerProps) {
  const { puzzle, compact, header } = props;
  return (
    <div className={`pz ${compact ? 'compact' : ''} pz-${puzzle.kind}`}>
      {header && <div className="pz-header">{header}</div>}
      {puzzle.kind === 'proof' ? <ProofView {...props} puzzle={puzzle} /> : <QuickView {...props} puzzle={puzzle} />}
    </div>
  );
}

/** Shared bookkeeping: elapsed time, one-shot `done`. */
function useRun(initialMs: number) {
  const start = useRef(Date.now() - initialMs);
  const frozen = useRef<number | null>(null);
  const finished = useRef(false);
  return {
    elapsed: () => frozen.current ?? Date.now() - start.current,
    finish(): boolean {
      if (finished.current) return false;
      finished.current = true;
      frozen.current = Date.now() - start.current;
      return true;
    },
    get done() {
      return finished.current;
    },
  };
}

/* ───────────────────────── proof ───────────────────────── */

function ProofView({ puzzle, onDone, allow, compact, initial, onProgress }: PuzzlePlayerProps & { puzzle: ProofPuzzle }) {
  const canHint = allow?.hints !== false;
  const canReveal = allow?.reveal !== false;
  const canSkip = allow?.skip !== false;
  const fontSize = useGame((s) => s.save.settings.fontSize);
  const [body, setBody] = useState(initial?.body || puzzle.starter);
  const [cursor, setCursor] = useState(body.length);
  const [hints, setHints] = useState(Math.min(initial?.hints ?? 0, puzzle.hints.length));
  const [outcome, setOutcome] = useState<'solved' | 'revealed' | 'skipped' | null>(null);
  const editor = useRef<EditorHandle>(null);
  const run = useRun(initial?.ms ?? 0);
  const attempts = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const hintsRef = useRef(hints);
  hintsRef.current = hints;

  const { result: checked, pending } = useCheck(body, () => generator.check(puzzle, body));
  const result = checked?.result ?? null;
  const info = useInfo(result, checked?.bodyOffset ?? 0, body.length, cursor);
  const hintObjs = useMemo(() => puzzle.hints.map((text) => ({ text })), [puzzle.hints]);

  const end = (how: 'solved' | 'revealed' | 'skipped') => {
    if (!run.finish()) return;
    setOutcome(how);
    onDoneRef.current({
      solved: how === 'solved',
      ms: run.elapsed(),
      hintsUsed: hintsRef.current,
      revealed: how === 'revealed',
      skipped: how === 'skipped',
      attempts: attempts.current,
    });
  };

  const prevErr = useRef(false);
  useEffect(() => {
    if (!result || run.done) return;
    const hasErr = !result.ok;
    if (hasErr && !prevErr.current && body.trim() && body !== puzzle.starter) attempts.current += 1;
    prevErr.current = hasErr;
    if (checked?.complete && !pending && body.trim() !== '') {
      sfx.play('solve');
      end('solved');
    }
  }, [checked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report resumable progress (debounced) until the puzzle ends.
  useEffect(() => {
    if (!onProgress || outcome) return;
    const id = setTimeout(() => onProgress({ hints, ms: run.elapsed(), body }), 400);
    return () => clearTimeout(id);
  }, [body, hints, outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = outcome !== null;
  const solved = outcome === 'solved' || (!!checked?.complete && !pending);

  return (
    <div className="pz-body">
      <section className="pz-task" aria-label="Task">
        <div className="eyebrow">{puzzle.family === 'inhabit' ? 'Write the term' : 'Prove it'} · rated {puzzle.rating}</div>
        <Markdown className="english" text={puzzle.english} />
        {!compact && puzzle.themes.length > 0 && <div className="pz-themes">{puzzle.themes.map((t) => <span className="pill" key={t}>{t}</span>)}</div>}
        {!locked && canHint && hintObjs.length > 0 && (
          <HintLadder hints={hintObjs} revealed={hints} onReveal={() => { sfx.play('open'); setHints((h) => Math.min(hintObjs.length, h + 1)); }} lastGivesAway={false} />
        )}
        {!locked && (canReveal || canSkip) && (
          <div className="pz-actions">
            {canReveal && <button className="btn ghost small" onClick={() => end('revealed')} title="Ends the puzzle without credit"><Icon name="eye" size={16} /> Show solution</button>}
            {canSkip && <button className="btn ghost small" onClick={() => end('skipped')}>Skip</button>}
          </div>
        )}
        {!locked && (canReveal || canSkip) && <p className="muted small pz-cost">Hints make a solve count as half. Showing the solution or skipping counts as a miss.</p>}
      </section>
      <div className="pz-work">
        <div className="editor-panel">
          <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
          <div className="header-ro" aria-label="Statement (read-only)">
            <Lean code={(puzzle.setup ? puzzle.setup + '\n' : '') + puzzle.header} />
          </div>
          <Editor
            ref={editor}
            value={body}
            onChange={setBody}
            onCursor={setCursor}
            diagnostics={toEditorDiags(info.diags)}
            fontSize={fontSize}
            readOnly={locked}
            ariaLabel="Proof editor"
          />
        </div>
        <Infoview
          goals={info.goals}
          fallbackGoals={info.fallback}
          diagnostics={info.diags}
          complete={solved}
          pending={pending}
          friendlySorry
          onInsert={(n) => editor.current?.insert(n)}
          emptyHint={puzzle.mode === 'term' ? 'Write a term after the := sign. Errors and types show up here.' : undefined}
        />
        {outcome === 'revealed' && (
          <div className="pz-solution">
            <div className="label">A reference solution</div>
            <Lean code={puzzle.solution} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── quick ───────────────────────── */

function QuickView({ puzzle, onDone, allow, explain = true, compact, initial }: PuzzlePlayerProps & { puzzle: QuickPuzzle }) {
  const canSkip = allow?.skip !== false;
  const [picked, setPicked] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const run = useRun(initial?.ms ?? 0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const nextBtn = useRef<HTMLButtonElement>(null);
  const answered = picked !== null || skipped;
  const correctIdx = puzzle.options.findIndex((o) => o.correct);

  const report = (solved: boolean, wasSkip: boolean) => {
    if (!run.finish()) return;
    onDoneRef.current({ solved, ms: run.elapsed(), hintsUsed: 0, revealed: false, skipped: wasSkip, attempts: 1 });
  };

  const pick = (i: number) => {
    if (answered || run.done) return;
    const ok = !!puzzle.options[i]?.correct;
    setPicked(i);
    sfx.play(ok ? 'correct' : 'wrong');
    if (explain) {
      // Hold the report until "Next"; freeze the clock now.
      pendingRef.current = { solved: ok, wasSkip: false };
      setAwaiting(true);
      run.finish();
      frozenMs.current = run.elapsed();
    } else report(ok, false);
  };
  const pendingRef = useRef<{ solved: boolean; wasSkip: boolean } | null>(null);
  const frozenMs = useRef(0);
  const next = () => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setAwaiting(false);
    onDoneRef.current({ solved: p.solved, ms: frozenMs.current, hintsUsed: 0, revealed: false, skipped: p.wasSkip, attempts: 1 });
  };
  const skip = () => {
    if (answered) return;
    setSkipped(true);
    if (explain) {
      pendingRef.current = { solved: false, wasSkip: true };
      setAwaiting(true);
      run.finish();
      frozenMs.current = run.elapsed();
    } else report(false, true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!answered && /^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < puzzle.options.length) {
          e.preventDefault();
          pick(i);
        }
      } else if (answered && explain && e.key === 'Enter' && pendingRef.current) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (answered && explain) nextBtn.current?.focus();
  }, [answered, explain]);

  return (
    <div className="pz-quick">
      <div className="eyebrow">Quick question · rated {puzzle.rating}</div>
      <Markdown className="question" text={puzzle.prompt} />
      {puzzle.code && <div className="header-ro pz-code"><Lean code={puzzle.code} /></div>}
      <div className="options pz-options" role="group" aria-label="Options">
        {puzzle.options.map((o, i) => {
          const state = !answered ? '' : i === picked ? (o.correct ? 'right' : 'wrong') : o.correct ? 'right' : '';
          return (
            <div key={i} className="pz-opt">
              <button
                className={`option ${state}`}
                aria-keyshortcuts={String(i + 1)}
                aria-pressed={picked === i}
                disabled={answered && i !== picked && !o.correct}
                onClick={() => pick(i)}
              >
                <span className="optmark" aria-hidden="true">{answered ? (o.correct ? '✓' : i === picked ? '✗' : i + 1) : i + 1}</span>
                <Markdown text={o.text} className="inline-md" />
              </button>
              {answered && !compact && <p className={`pz-why ${o.correct ? 'right' : i === picked ? 'wrong' : ''}`}>{o.why}</p>}
            </div>
          );
        })}
      </div>
      {answered && (
        <div className={`feedback ${picked !== null && picked === correctIdx ? 'right' : 'wrong'}`} role="status">
          {skipped ? 'Skipped.' : picked === correctIdx ? 'Correct.' : 'Not quite.'}
        </div>
      )}
      {!answered && canSkip && (
        <div className="pz-actions">
          <button className="btn ghost small" onClick={skip}>Skip</button>
          <span className="muted small pz-keys">Press 1–{puzzle.options.length} to answer</span>
        </div>
      )}
      {awaiting && (
        <div className="pz-actions">
          <button ref={nextBtn} className="btn primary big" onClick={next}>Next <Icon name="arrow-right" size={18} /></button>
        </div>
      )}
    </div>
  );
}
