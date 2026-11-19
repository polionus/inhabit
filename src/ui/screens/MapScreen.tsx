import { useMemo, useState } from 'react';
import type { World } from '../../content/types.ts';
import { chapterFor } from '../../content/chapters/index.ts';
import { LevelRows, readMinutes } from '../components/ChapterLevels.tsx';
import { worldMastery } from '../../state/meta.ts';
import { data } from '../data.ts';
import { useGame } from '../game.ts';
import { canTestOut, continueLevel, layoutWorlds, worldComplete } from '../../state/progress.ts';
import { href } from '../router.ts';
import { usePlayer } from '../usePlayer.ts';
import { useMedia } from '../hooks.tsx';
import { Card, Icon, Pill, ProgressBar, ProgressRing, ScreenHeader, Stars } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';

const ROW = 176;
const TOP = 70;

/** Snake path: single worlds swing left and right; parallel worlds sit side by side. */
function xFor(layer: number, slot: number, slots: number): number {
  if (slots === 1) return 50 + 21 * Math.sin((layer * Math.PI) / 2);
  if (slots === 2) return slot === 0 ? 27 : 73;
  return ((slot + 0.5) / slots) * 100;
}

const VIEW_KEY = 'inhabit.mapView';
type View = 'roadmap' | 'map';
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'map' ? 'map' : 'roadmap';
  } catch {
    return 'roadmap';
  }
}

const TRACKS: Record<string, string> = { nat: 'Track A: numbers', sets: 'Track B: sets and functions' };

/** Track label for worlds on a parallel branch: follow `requires` back to the world that forks. */
function trackOf(w: World, worlds: World[]): string | undefined {
  let cur: World | undefined = w;
  while (cur && cur.requires.length === 1) {
    const parent: string = cur.requires[0];
    if (worlds.filter((x) => x.requires.includes(parent)).length > 1) return TRACKS[cur.id];
    cur = worlds.find((x) => x.id === parent);
  }
  return undefined;
}

function Roadmap({ currentId }: { currentId?: string }) {
  const save = useGame((s) => s.save);
  const worlds = data.worlds;
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  return (
    <ol className="roadmap">
      {worlds.map((w, i) => {
        const st = worldStatus(w, save);
        const m = worldMastery(w, save);
        const ch = chapterFor(w.id);
        const track = trackOf(w, worlds);
        const forkAfter = worlds.filter((x) => x.requires.includes(w.id)).length > 1;
        const locked = st.state === 'locked';
        const current = currentId === w.id;
        const open = openIds[w.id] ?? current;
        const started = st.done > 0;
        const label = st.state === 'locked' ? 'Locked' : st.state === 'complete' ? 'Done' : st.state === 'empty' ? 'Coming soon' : started ? 'In progress' : 'Open';
        const cid = `rm-c-${w.id}`;
        return (
          <li key={w.id} className={`rm-item ${st.state} ${current ? 'current' : ''} ${track ? 'branch' : ''}`}>
            <Card as="article" className="rm-card" aria-labelledby={`rm-h-${w.id}`}>
              <div className="rm-top">
                <WorldToken world={w} size={64} state={st.state} progress={st.frac} />
                <div className="rm-head">
                  <span className="rm-kicker">
                    <span className="eyebrow">Chapter {i + 1}</span>
                    {track && <span className="rm-track">{track}</span>}
                    {current && <span className="rm-here">You are here</span>}
                  </span>
                  <h2 id={`rm-h-${w.id}`}>{w.title}</h2>
                  <p className="rm-tag">{w.tagline}</p>
                </div>
                <span className={`rm-state ${st.state}`}>
                  {st.state === 'locked' && <Icon name="lock" size={13} />}
                  {st.state === 'complete' && <Icon name="check" size={13} />}
                  {label}
                </span>
              </div>
              {w.bigIdea && <p className="rm-idea">{w.bigIdea}</p>}
              {st.total > 0 && (
                <div className="rm-prog">
                  <ProgressBar value={m.total ? m.unaided / m.total : 0} tone="ok" size="sm" label={`${m.unaided} of ${m.total} solved on your own`} />
                  <span className="tnum">{m.unaided} of {m.total} solved on your own</span>
                  <span className="tnum muted">{st.done}/{st.total} passed</span>
                </div>
              )}
              <div className="rm-actions">
                {ch ? (
                  <a className="btn outline" href={href.chapter(w.id)}><Icon name="book" size={16} /> Read the explainer <span className="muted tnum">{readMinutes(ch.body)} min</span></a>
                ) : (
                  <span className="rm-soon"><Icon name="book" size={16} /> Explainer coming soon</span>
                )}
                {st.state !== 'empty' && (
                  locked ? (
                    <button type="button" className="btn primary" disabled><Icon name="lock" size={16} /> Play (locked)</button>
                  ) : (
                    <a className="btn primary" href={href.world(w.id)}><Icon name="play" size={16} /> {started ? 'Continue' : 'Play'}</a>
                  )
                )}
                {w.levels.length > 0 && (
                  <button type="button" className="btn ghost rm-toggle" aria-expanded={open} aria-controls={cid} onClick={() => setOpenIds({ ...openIds, [w.id]: !open })}>
                    Contents ({w.levels.length}) <Icon name="chevron-down" size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
                  </button>
                )}
              </div>
              {open && w.levels.length > 0 && (
                <div id={cid} className="rm-contents">
                  <LevelRows world={w} save={save} locked={locked} />
                </div>
              )}
            </Card>
            {forkAfter && <p className="rm-fork" role="note">The path splits here into two tracks, A and B. Both lead to the Formalization Forge.</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function MapScreen() {
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const save = useGame((s) => s.save);
  const levels = save.levels;
  const worlds = data.worlds;
  const p = usePlayer();
  const small = useMedia('(max-width: 520px)');
  const layout = useMemo(() => layoutWorlds(worlds), [worlds]);
  const rows = Math.max(1, ...layout.map((l) => l.layer + 1));
  const pos = new Map(layout.map((l) => [l.id, { x: xFor(l.layer, l.slot, l.slots), y: TOP + l.layer * ROW }]));
  const cont = continueLevel(worlds, levels);
  const contWorld = cont ? data.findLevel(cont)?.world : undefined;
  const H = TOP + (rows - 1) * ROW + 120;
  const statuses = new Map(worlds.map((w) => [w.id, worldStatus(w, save)]));
  const complete = worlds.filter((w) => statuses.get(w.id)?.state === 'complete').length;

  return (
    <div className="page wide map-page">
      <ScreenHeader id="map" title={view === 'roadmap' ? 'The roadmap' : 'The map'} icon="map" />
      <div className="seg rm-seg" role="group" aria-label="View">
        {(['roadmap', 'map'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v === 'roadmap' ? 'Roadmap' : 'Map'}</button>
        ))}
      </div>
      <div className={`map-layout ${view === 'roadmap' ? 'is-roadmap' : ''}`}>
        {view === 'roadmap' ? <Roadmap currentId={contWorld?.id} /> : <div className="board" style={{ height: H }}>
          <svg className="board-roads" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
            {worlds.flatMap((w) =>
              w.requires.map((r) => {
                const a = pos.get(r);
                const b = pos.get(w.id);
                if (!a || !b) return null;
                const m = (b.y - a.y) / 2;
                const d = `M ${a.x} ${a.y} C ${a.x} ${a.y + m}, ${b.x} ${b.y - m}, ${b.x} ${b.y}`;
                const rw = worlds.find((x) => x.id === r);
                const done = !!rw && rw.levels.length > 0 && worldComplete(rw, levels);
                return (
                  <g key={r + '>' + w.id}>
                    <path className="road-bed" d={d} vectorEffect="non-scaling-stroke" />
                    <path className={done ? 'road-done' : 'road-todo'} d={d} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              }),
            )}
          </svg>
          <ol className="board-nodes">
            {worlds.map((w, i) => {
              const at = pos.get(w.id)!;
              const st = statuses.get(w.id)!;
              const current = contWorld?.id === w.id;
              const test = st.state === 'open' && canTestOut(w, worlds, levels) && st.done === 0;
              const stateText = st.state === 'locked' ? 'Locked' : st.state === 'complete' ? 'Complete' : st.state === 'empty' ? 'No levels yet' : `${st.done} of ${st.total} levels done`;
              return (
                <li key={w.id} className={`bnode ${st.state} ${current ? 'current' : ''}`} style={{ left: `${at.x}%`, top: at.y }}>
                  <a href={href.world(w.id)} className="bnode-link" aria-label={`World ${i + 1}: ${w.title}. ${w.tagline}. ${stateText}. ${st.stars.earned} of ${st.stars.total} stars.${current ? ' You are here.' : ''}`}>
                    {current && <span className="bnode-here" aria-hidden="true">Next</span>}
                    <WorldToken world={w} size={small ? 76 : 92} state={st.state} progress={st.frac} />
                    <span className="bnode-title">{w.title}</span>
                    <span className="bnode-meta" aria-hidden="true">
                      {st.state === 'locked' ? (
                        <span className="bnode-locked"><Icon name="lock" size={13} /> Locked</span>
                      ) : st.state === 'empty' ? (
                        <span>Coming soon</span>
                      ) : (
                        <>
                          <Icon name="star" size={13} className="goldc" />
                          <span className="tnum">{st.stars.earned}/{st.stars.total}</span>
                        </>
                      )}
                      {test && <span className="bnode-test">test out</span>}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>}

        <aside className="map-side" aria-label="Your progress">
          <Card className="map-summary">
            <div className="ms-ring">
              <ProgressRing value={p.starsMax ? p.stars / p.starsMax : 0} size={112} stroke={10} tone="gold" label={`${p.stars} of ${p.starsMax} stars`}>
                <span className="ms-ring-in">
                  <Icon name="star" size={20} className="goldc" />
                  <span className="ms-stars tnum">{p.stars}</span>
                  <span className="ms-of tnum">of {p.starsMax}</span>
                </span>
              </ProgressRing>
              <div className="ms-facts">
                <div><span className="ms-num tnum">{complete}</span><span className="ms-lab">of {worlds.length} worlds complete</span></div>
                <div><span className="ms-num tnum">{Object.values(levels).filter((l) => l.status === 'solved' || l.status === 'studied').length}</span><span className="ms-lab">levels passed</span></div>
              </div>
            </div>
            {cont ? (
              <a className="btn primary big block" href={href.level(cont)}>
                <Icon name="play" size={18} /> Continue
                {contWorld && <span className="btn-sub">{contWorld.title}</span>}
              </a>
            ) : (
              <a className="btn primary big block" href="#/workshop"><Icon name="workshop" size={18} /> Open the Workshop</a>
            )}
            {p.due > 0 && (
              <a className="btn outline block" href="#/review"><Icon name="review" size={18} /> Review <Pill tone="primary">{p.due} ready</Pill></a>
            )}
          </Card>
          <Card tone="flat" className="map-legend">
            <h2 className="eyebrow">How stars work</h2>
            <ul>
              <li><Stars value={0} size="sm" /> <span>Studied: solve it yourself for a star</span></li>
              <li><Stars value={1} size="sm" /> <span>Solved</span></li>
              <li><Stars value={2} size="sm" /> <span>Solved with no hints</span></li>
              <li><Stars value={3} size="sm" /> <span>Then solved again in Review</span></li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
