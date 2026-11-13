import { useEffect, useState } from 'react';
import { dailyNumber, dailySet, utcDateKey } from '../../arena/plan.ts';
import { dailyShareText, dailySolved, dailyTime, formatTime, markOf, streakOn, type DailyMark } from '../../arena/state/model.ts';
import { arenaStore, useArena } from '../../arena/state/store.ts';
import type { Puzzle } from '../../arena/types.ts';
import { Card, Icon, Pill, ScreenHeader, Stopwatch, celebrate, sfx } from '../components/kit.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { hms, nextUtcMidnight, Reference, useNow } from './parts.tsx';
import { PuzzlePlayer, type PuzzleOutcome } from './PuzzlePlayer.tsx';

const MARK_LABEL: Record<DailyMark['state'], string> = { clean: 'Solved', hinted: 'Solved with hints', failed: 'Not solved' };
const MARK_GLYPH: Record<DailyMark['state'], string> = { clean: '🟩', hinted: '🟨', failed: '⬛' };

export function DailyScreen() {
  const [dateKey] = useState(() => utcDateKey(Date.now()));
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const result = useArena((s) => s.daily[dateKey]);
  // A session that began with an unfinished set ends only when the player asks for the result.
  const [inSession, setInSession] = useState(() => !arenaStore.getState().daily[dateKey]?.completed);

  useEffect(() => {
    const id = setTimeout(() => {
      arenaStore.getState().startDaily(dateKey);
      setPuzzles(dailySet(dateKey));
    }, 0);
    return () => clearTimeout(id);
  }, [dateKey]);

  return (
    <div className="page arena daily">
      <ScreenHeader id="arena-daily" title="Daily Proof" icon="calendar" eyebrow={`#${dailyNumber(dateKey)} · ${dateKey}`} />
      {!puzzles || !result ? (
        <p className="muted" role="status">Preparing today's puzzles…</p>
      ) : inSession ? (
        <Playing dateKey={dateKey} puzzles={puzzles} onFinish={() => setInSession(false)} />
      ) : (
        <Results dateKey={dateKey} puzzles={puzzles} />
      )}
    </div>
  );
}

function Playing({ dateKey, puzzles, onFinish }: { dateKey: string; puzzles: Puzzle[]; onFinish(): void }) {
  const result = useArena((s) => s.daily[dateKey])!;
  const marks = result.marks;
  // Which puzzle is on screen is local state: the store moves ahead the moment a puzzle is recorded,
  // but the finished puzzle must stay visible (with its outcome) until the player moves on.
  const [viewIndex, setViewIndex] = useState(() => Math.min(2, marks.length));
  const [just, setJust] = useState<DailyMark | null>(null);
  const puzzle = puzzles[viewIndex];
  // Clock base: finished puzzles' time plus whatever the unfinished one had already used.
  const [{ since, initial }] = useState(() => {
    const r = arenaStore.getState().daily[dateKey];
    const prog = r.progress ?? undefined;
    return { since: Date.now() - (r.marks.reduce((a, m) => a + m.ms, 0) + (prog?.ms ?? 0)), initial: prog };
  });

  const onDone = (o: PuzzleOutcome) => {
    const mark = markOf(o);
    setJust(mark);
    arenaStore.getState().finishDaily(dateKey, viewIndex, o);
    if (mark.state !== 'failed') celebrate('solve');
    else sfx.play('wrong');
  };
  const last = viewIndex >= 2;
  const shown = marks.slice(0, just ? viewIndex + 1 : viewIndex);
  const frozen = just ? marks.reduce((a, m) => a + m.ms, 0) : undefined;
  const next = () => {
    if (last) onFinish();
    else {
      setJust(null);
      setViewIndex(viewIndex + 1);
    }
  };

  return (
    <>
      <div className="daily-bar" aria-label="Progress">
        <ol className="steps">
          {puzzles.map((p, i) => {
            const m = i < shown.length ? shown[i] : undefined;
            const state = m ? m.state : i === viewIndex ? 'now' : 'todo';
            return (
              <li key={p.id} className={`step ${state}`} aria-current={i === viewIndex ? 'step' : undefined}>
                <span className="step-n">{m ? MARK_GLYPH[m.state] : i + 1}</span>
                <span className="step-t small">{i === 0 ? 'Warm-up' : i === 1 ? 'Middle' : 'Final'}</span>
              </li>
            );
          })}
        </ol>
        <Stopwatch since={since} stopped={frozen} label="Daily clock" />
      </div>
      <PuzzlePlayer
        key={puzzle.id}
        puzzle={puzzle}
        explain={false}
        onDone={onDone}
        initial={viewIndex === marks.length ? initial : undefined}
        onProgress={(p) => arenaStore.getState().saveDailyProgress(dateKey, p)}
      />
      {just && (
        <div className={`strip ${just.state}`} role="status">
          <div className="strip-main">
            <strong>{MARK_LABEL[just.state]}</strong>
            <span className="muted tnum"> · {formatTime(just.ms)}</span>
            {just.state === 'hinted' && <span className="muted small"> · a hint was used</span>}
          </div>
          {just.state === 'failed' && <Reference puzzle={puzzle} />}
          <button className="btn primary big" autoFocus onClick={next}>
            {last ? 'See result' : 'Next puzzle'} <Icon name="arrow-right" size={18} />
          </button>
        </div>
      )}
    </>
  );
}

function Results({ dateKey, puzzles }: { dateKey: string; puzzles: Puzzle[] }) {
  const result = useArena((s) => s.daily[dateKey])!;
  const streak = useArena((s) => streakOn(s, dateKey));
  const now = useNow(1000);
  const [copied, setCopied] = useState<'' | 'copied' | 'shared' | 'failed'>('');
  const number = dailyNumber(dateKey);
  const solved = dailySolved(result);
  const link = `${location.origin}${location.pathname}#/arena/daily`;
  const text = dailyShareText(result, number, link);

  useEffect(() => {
    if (solved === 3) celebrate('win');
    if (solved > 0) sfx.play('win');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        setCopied('shared');
        return;
      }
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <>
      <Card tone={solved === 3 ? 'gold' : 'primary'} className="daily-result" aria-label="Result">
        <div className="eyebrow">Daily Proof #{number}</div>
        <div className="daily-score tnum">{solved}/3</div>
        <div className="daily-marks" aria-hidden="true">{result.marks.map((m) => MARK_GLYPH[m.state]).join(' ')}</div>
        <div className="mode-stats">
          <Pill icon="clock">{formatTime(dailyTime(result))}</Pill>
          <Pill tone="flame" icon="flame">{streak} day {streak === 1 ? 'streak' : 'streak'}</Pill>
        </div>
        <div className="actions">
          <button className="btn gold big" onClick={share}><Icon name="external" size={18} /> Share result</button>
          <a className="btn outline big" href="#/arena">Back to the Arena</a>
        </div>
        <p className="muted small tnum" role="status" aria-live="polite">
          {copied === 'copied' ? 'Copied to the clipboard.' : copied === 'shared' ? 'Shared.' : copied === 'failed' ? 'Could not copy. Select the text below instead.' : `Come back in ${hms(nextUtcMidnight(now) - now)} for the next one.`}
        </p>
        <pre className="share-text" aria-label="Share text">{text}</pre>
      </Card>

      <h2 className="section-title">Study the proofs</h2>
      <div className="study">
        {puzzles.map((p, i) => {
          const m = result.marks[i];
          return (
            <Card key={p.id} as="article" className="study-item">
              <div className="study-head">
                <span>{MARK_GLYPH[m?.state ?? 'failed']}</span>
                <strong>{i + 1}. {m ? MARK_LABEL[m.state] : 'Not played'}</strong>
                <span className="muted small tnum">rated {p.rating}{m ? ` · ${formatTime(m.ms)}` : ''}</span>
              </div>
              {p.kind === 'proof' && <Markdown text={p.english} />}
              <Reference puzzle={p} />
            </Card>
          );
        })}
      </div>
    </>
  );
}
