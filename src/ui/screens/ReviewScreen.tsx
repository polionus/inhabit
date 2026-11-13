import { useState } from 'react';
import { data } from '../data.ts';
import { game, store, useGame } from '../game.ts';
import { dueLabel, pickSession, pickPractice, dueIds } from '../../state/leitner.ts';
import { LevelPlayer } from '../level/LevelPlayer.tsx';
import { href } from '../router.ts';
import { Card, EmptyState, Icon, Pill, ProgressBar, ScreenHeader, StatTile, celebrate, sfx } from '../components/kit.tsx';
import { useEffect } from 'react';
import type { DeckItem } from '../../state/leitner.ts';

export function ReviewScreen() {
  const deck = useGame((s) => s.save.deck);
  const levels = useGame((s) => s.save.levels);
  const [session, setSession] = useState<string[] | null>(null);
  const [practice, setPractice] = useState(false);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const worldOf = (id: string) => data.findLevel(id)?.world.id;
  const now = Date.now();
  const dueCount = dueIds(deck, now).length;

  const completedIds = Object.entries(levels).filter(([id, p]) => (p.status === 'solved' || p.status === 'studied') && data.findLevel(id)).map(([id]) => id);

  if (!session) {
    const upcoming = Object.entries(deck).filter(([, d]) => d.due > now).sort((a, b) => a[1].due - b[1].due).slice(0, 5);
    const deckSize = Object.keys(deck).length;
    const reviewsPassed = store.getState().save.reviewsPassed;
    const startSession = () => {
      const s = pickSession(store.getState().save.deck, worldOf, Date.now(), 8);
      setPractice(false);
      setSession(s);
      setI(0);
      setResults({});
    };
    const startPractice = () => {
      setPractice(true);
      setSession(pickPractice(completedIds, worldOf, 5));
      setI(0);
      setResults({});
    };
    return (
      <div className="page review-page">
        <ScreenHeader id="review" title="Review" icon="review" />
        <div className="review-stats">
          <StatTile icon="review" tone="primary" value={dueCount} label="due now" />
          <StatTile icon="codex" value={deckSize} label="in your deck" />
          <StatTile icon="check" tone="ok" value={reviewsPassed} label="reviews passed" />
        </div>
        {deckSize === 0 ? (
          <EmptyState icon="review" title="Nothing to review yet" action={<a className="btn primary" href={href.map()}>Play a level</a>}>
            Finished levels join your review deck and come back here when they are due.
          </EmptyState>
        ) : (
          <Card tone={dueCount ? 'primary' : 'default'} className="review-start">
            <div>
              <h2>{dueCount ? `${dueCount} ${dueCount === 1 ? 'item is' : 'items are'} due` : 'Nothing is due right now'}</h2>
              <p className="muted">{dueCount ? 'A session takes up to 8, mixed across worlds.' : 'Come back later; there is no rush. You can practise anyway.'}</p>
            </div>
            <div className="actions">
              <button className={`btn big ${dueCount ? 'primary' : ''}`} disabled={dueCount === 0} onClick={startSession}><Icon name="play" size={18} /> Start a session</button>
              {completedIds.length > 0 && <button className="btn outline big" onClick={startPractice}>Practise anyway</button>}
            </div>
            {completedIds.length > 0 && <p className="muted small practice-note">Practising picks up to 5 finished levels at random. It does not change your review schedule.</p>}
          </Card>
        )}
        {upcoming.length > 0 && (
          <>
            <h2 className="section-title"><Icon name="calendar" size={20} /> Coming up</h2>
            <ul className="upcoming">
              {upcoming.map(([id, d]) => {
                const f = data.findLevel(id);
                return (
                  <li key={id}>
                    <span className="up-title">{f?.level.title ?? id}<span className="muted small">{f?.world.title}</span></span>
                    <Pill>Box {d.box}</Pill>
                    <span className="up-when tnum">{dueLabel(d, now)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    );
  }

  if (i >= session.length) {
    return <SessionDone session={session} results={results} practice={practice} deck={deck} onDone={() => setSession(null)} />;
  }

  const id = session[i];
  return (
    <>
      <div className="review-bar" role="status">
        <span>{practice ? 'Practice' : 'Review'} <span className="tnum">{i + 1} of {session.length}</span></span>
        <ProgressBar className="rb-progress" value={i / session.length} size="sm" label="Session progress" />
        <button className="btn ghost small" onClick={() => setSession(null)}>End session</button>
      </div>
      <LevelPlayer
        key={id}
        levelId={id}
        mode="review"
        onReviewDone={(passed) => {
          // Practice never promotes boxes; a miss may still reset an item already in the deck.
          if (!practice || (!passed && store.getState().save.deck[id])) game().reviewResult(id, passed);
          setResults((r) => ({ ...r, [id]: passed }));
        }}
        onNext={() => setI(i + 1)}
        nextLabel={i + 1 < session.length ? 'Next item' : 'Finish'}
      />
    </>
  );
}

function SessionDone({ session, results, practice, deck, onDone }: { session: string[]; results: Record<string, boolean>; practice: boolean; deck: Record<string, DeckItem>; onDone: () => void }) {
  const passed = Object.values(results).filter(Boolean).length;
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (passed > 0) {
        sfx.play(passed === session.length ? 'win' : 'correct');
        if (passed === session.length) celebrate('boss');
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="page narrow">
      <Card tone={passed === session.length ? 'ok' : 'default'} className="session-done">
        <span className="eyebrow">{practice ? 'Practice done' : 'Session done'}</span>
        <h1><span className="tnum">{passed}</span> of <span className="tnum">{session.length}</span> came back cleanly</h1>
        <ProgressBar value={session.length ? passed / session.length : 0} tone="ok" size="md" label={`${passed} of ${session.length} passed`} />
        {practice && <p className="muted practice-note">Practice only: your review schedule was not changed by the ones you got right.</p>}
        <ul className="session-list">
          {session.map((id) => (
            <li key={id} className={results[id] ? 'ok' : ''}>
              <span className="sl-mark" aria-hidden="true"><Icon name={results[id] ? 'check' : 'review'} size={16} strokeWidth={3} /></span>
              <span className="sl-title">{data.findLevel(id)?.level.title ?? id}<span className="sr-only">{results[id] ? ', passed' : ', comes back sooner'}</span></span>
              {!practice && deck[id] && <span className="muted small tnum">box {deck[id].box} · {dueLabel(deck[id], Date.now())}</span>}
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn primary big" onClick={onDone}>Done</button>
          <a className="btn outline big" href={href.map()}>Back to the map</a>
        </div>
      </Card>
    </div>
  );
}
