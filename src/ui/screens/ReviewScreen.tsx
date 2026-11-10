import { useState } from 'react';
import { data } from '../data.ts';
import { game, store, useGame } from '../game.ts';
import { dueLabel, pickSession, dueIds } from '../../state/leitner.ts';
import { LevelPlayer } from '../level/LevelPlayer.tsx';
import { href } from '../router.ts';

export function ReviewScreen() {
  const deck = useGame((s) => s.save.deck);
  const [session, setSession] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});

  const worldOf = (id: string) => data.findLevel(id)?.world.id;
  const now = Date.now();
  const dueCount = dueIds(deck, now).length;

  if (!session) {
    const upcoming = Object.entries(deck).filter(([, d]) => d.due > now).sort((a, b) => a[1].due - b[1].due).slice(0, 5);
    return (
      <div className="page narrow">
        <h1>Review</h1>
        <p className="lede">Solving things again, a little later, is what makes them stick. Sessions are short and mix regions.</p>
        {Object.keys(deck).length === 0 ? (
          <p className="notice">Nothing to review yet. Finished levels appear here once they are due.</p>
        ) : dueCount === 0 ? (
          <p className="notice">Nothing is due right now. Come back later; there is no rush.</p>
        ) : (
          <p>{dueCount} {dueCount === 1 ? 'item is' : 'items are'} due. A session takes up to 8.</p>
        )}
        <div className="actions">
          <button
            className="btn primary"
            disabled={dueCount === 0}
            onClick={() => {
              const s = pickSession(store.getState().save.deck, worldOf, Date.now(), 8);
              setSession(s);
              setI(0);
              setResults({});
            }}
          >
            Start a session
          </button>
        </div>
        {upcoming.length > 0 && (
          <>
            <h2>Coming up</h2>
            <ul className="plain">
              {upcoming.map(([id, d]) => (
                <li key={id}>{data.findLevel(id)?.level.title ?? id} <span className="muted">· box {d.box} · {dueLabel(d, now)}</span></li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  if (i >= session.length) {
    const passed = Object.values(results).filter(Boolean).length;
    return (
      <div className="page narrow">
        <h1>Session done</h1>
        <p className="lede">{passed} of {session.length} came back cleanly.</p>
        <ul className="plain">
          {session.map((id) => (
            <li key={id}>{results[id] ? '✓' : '·'} {data.findLevel(id)?.level.title ?? id} <span className="muted">{deck[id] ? `· box ${deck[id].box}, ${dueLabel(deck[id], Date.now())}` : ''}</span></li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn primary" onClick={() => setSession(null)}>Done</button>
          <a className="btn" href={href.map()}>Back to the map</a>
        </div>
      </div>
    );
  }

  const id = session[i];
  return (
    <>
      <div className="review-bar" role="status">Review {i + 1} of {session.length}
        <button className="btn ghost small" onClick={() => setSession(null)}>End session</button>
      </div>
      <LevelPlayer
        key={id}
        levelId={id}
        mode="review"
        onReviewDone={(passed) => {
          game().reviewResult(id, passed);
          setResults((r) => ({ ...r, [id]: passed }));
        }}
        onNext={() => setI(i + 1)}
        nextLabel={i + 1 < session.length ? 'Next item' : 'Finish'}
      />
    </>
  );
}
