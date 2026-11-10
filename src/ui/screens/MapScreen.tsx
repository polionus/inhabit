import { useMemo } from 'react';
import { data } from '../data.ts';
import { useGame } from '../game.ts';
import { continueLevel, layoutWorlds, worldComplete, worldIsEmpty, worldProgress, worldUnlocked, canTestOut } from '../../state/progress.ts';
import { dueIds } from '../../state/leitner.ts';
import { href } from '../router.ts';

const ROW = 150;
const NODE_H = 108;

export function MapScreen() {
  const levels = useGame((s) => s.save.levels);
  const deck = useGame((s) => s.save.deck);
  const worlds = data.worlds;
  const layout = useMemo(() => layoutWorlds(worlds), [worlds]);
  const rows = Math.max(1, ...layout.map((l) => l.layer + 1));
  const pos = new Map(layout.map((l) => [l.id, { x: ((l.slot + 0.5) / l.slots) * 100, y: l.layer * ROW + 8 }]));
  const cont = continueLevel(worlds, levels);
  const due = dueIds(deck, Date.now()).length;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>The map</h1>
          <p className="muted">Each region teaches one idea. Open ones are ready; the rest unlock when their neighbours upstream are done.</p>
        </div>
        <div className="actions">
          {cont && <a className="btn primary" href={href.level(cont)}>Continue</a>}
          {due > 0 && <a className="btn" href="#/review">Review ({due})</a>}
        </div>
      </div>
      <div className="map" style={{ height: rows * ROW }}>
        <svg className="map-edges" viewBox={`0 0 100 ${rows * ROW}`} preserveAspectRatio="none" aria-hidden="true">
          {worlds.flatMap((w) =>
            w.requires.map((r) => {
              const a = pos.get(r);
              const b = pos.get(w.id);
              if (!a || !b) return null;
              const y1 = a.y + NODE_H;
              const y2 = b.y;
              const m = (y2 - y1) / 2;
              const done = worldComplete(data.worlds.find((x) => x.id === r)!, levels);
              return <path key={r + '>' + w.id} className={done ? 'edge done' : 'edge'} d={`M ${a.x} ${y1} C ${a.x} ${y1 + m}, ${b.x} ${y2 - m}, ${b.x} ${y2}`} vectorEffect="non-scaling-stroke" />;
            }),
          )}
        </svg>
        {worlds.map((w) => {
          const p = pos.get(w.id)!;
          const empty = worldIsEmpty(w);
          const unlocked = worldUnlocked(w, worlds, levels);
          const complete = !empty && worldComplete(w, levels);
          const pr = worldProgress(w, levels);
          const state = empty ? 'empty' : complete ? 'complete' : unlocked ? 'open' : 'locked';
          const test = canTestOut(w, worlds, levels) && !complete;
          return (
            <a
              key={w.id}
              href={href.world(w.id)}
              className={`node ${state}`}
              style={{ left: `${p.x}%`, top: p.y, height: NODE_H }}
              aria-label={`${w.title}. ${state === 'locked' ? 'Locked.' : state === 'complete' ? 'Complete.' : empty ? 'No levels yet.' : `${pr.done} of ${pr.total} done.`}`}
            >
              <span className="node-title">{w.title}</span>
              <span className="node-tag">{w.tagline}</span>
              <span className="node-foot">
                {empty ? <span>No levels yet</span> : (
                  <>
                    <span className="bar" aria-hidden="true"><span style={{ width: `${pr.total ? (pr.done / pr.total) * 100 : 0}%` }} /></span>
                    <span>{state === 'locked' ? 'Locked' : complete ? 'Complete ✓' : `${pr.done}/${pr.total}`}</span>
                  </>
                )}
                {test && !empty && <span className="chip tiny">test out</span>}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
