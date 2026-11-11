import { useMemo } from 'react';
import { data } from '../data.ts';
import { useGame } from '../game.ts';
import { home } from '../../content/site.ts';
import { layoutWorlds, worldComplete, worldIsEmpty, worldProgress } from '../../state/progress.ts';
import { href } from '../router.ts';
import { Markdown } from '../components/Markdown.tsx';
import { LiveDemo } from '../components/LiveDemo.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { StartLink, useStartTarget } from '../components/Start.tsx';
import type { Blurb } from '../../content/types.ts';

function Blurbs({ items, className }: { items: Blurb[]; className?: string }) {
  return (
    <ul className={`blurbs ${className ?? ''}`}>
      {items.map((b, i) => (
        <li key={i} className="blurb">
          <h3>{b.title}</h3>
          <Markdown text={b.body} />
        </li>
      ))}
    </ul>
  );
}

const ROW = 88;
const NODE_H = 72;

/** The ten worlds as a left-to-right path; branching comes from `World.requires`. */
function Journey() {
  const levels = useGame((s) => s.save.levels);
  const returning = Object.keys(levels).length > 0;
  const worlds = data.worlds;
  const layout = useMemo(() => layoutWorlds(worlds), [worlds]);
  const cols = Math.max(1, ...layout.map((l) => l.layer + 1));
  const maxSlots = Math.max(1, ...layout.map((l) => l.slots));
  const H = maxSlots * ROW;
  const wPct = (100 / cols) * 0.9;
  const pos = new Map(
    layout.map((l) => [l.id, { x: ((l.layer + 0.5) / cols) * 100, y: ((l.slot + 0.5) / l.slots) * H }]),
  );
  return (
    <div className="journey-scroll">
      <div className="journey" style={{ height: H, minWidth: Math.max(640, cols * 132) }}>
        <svg className="journey-edges" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {worlds.flatMap((w) =>
            w.requires.map((r) => {
              const a = pos.get(r);
              const b = pos.get(w.id);
              if (!a || !b) return null;
              const x1 = a.x + wPct / 2;
              const x2 = b.x - wPct / 2;
              const m = (x2 - x1) / 2;
              const done = returning && worldComplete(worlds.find((x) => x.id === r)!, levels);
              return (
                <path key={r + '>' + w.id} className={done ? 'edge done' : 'edge'} vectorEffect="non-scaling-stroke"
                  d={`M ${x1} ${a.y} C ${x1 + m} ${a.y}, ${x2 - m} ${b.y}, ${x2} ${b.y}`} />
              );
            }),
          )}
        </svg>
        {worlds.map((w, idx) => {
          const p = pos.get(w.id)!;
          const pr = worldProgress(w, levels);
          const empty = worldIsEmpty(w);
          const complete = !empty && worldComplete(w, levels);
          return (
            <a
              key={w.id}
              href={href.world(w.id)}
              className={`jnode${complete ? ' complete' : ''}`}
              title={w.tagline}
              style={{ left: `${p.x}%`, top: p.y - NODE_H / 2, width: `${wPct}%`, height: NODE_H }}
              aria-label={`${idx + 1}. ${w.title}. ${w.tagline} ${w.levels.length} levels.${returning && !empty ? ` ${pr.done} of ${pr.total} done.` : ''}`}
            >
              <span className="jnode-title">{w.title}</span>
              <span className="jnode-foot">
                {returning && !empty ? (
                  <>
                    <span className="bar" aria-hidden="true"><span style={{ width: `${pr.total ? (pr.done / pr.total) * 100 : 0}%` }} /></span>
                    <span>{complete ? 'Done' : `${pr.done}/${pr.total}`}</span>
                  </>
                ) : (
                  <span>{w.levels.length} {w.levels.length === 1 ? 'level' : 'levels'}</span>
                )}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function HomeScreen() {
  const start = useStartTarget();
  const { hero, demo } = home;
  const cta = (label?: { s: string; c: string }, cls = 'btn primary big') => (
    <StartLink start={start} className={cls} startLabel={label?.s} continueLabel={label?.c} />
  );
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-h">
        <div className="hero-inner">
          <div className="hero-text">
            <p className="eyebrow accent">{hero.eyebrow}</p>
            <h1 id="hero-h">{hero.headline}</h1>
            <div className="hero-lede"><Markdown text={hero.lede} /></div>
            <div className="hero-actions">
              {cta({ s: hero.startLabel, c: hero.continueLabel })}
              {start.returning ? (
                <a className="btn ghost big" href={href.map()}>Open the map</a>
              ) : (
                <a className="btn ghost big" href={href.about()}>{hero.aboutLabel}</a>
              )}
              {start.returning && <a className="hero-about" href={href.about()}>{hero.aboutLabel}</a>}
            </div>
            <ul className="reassure">
              {hero.reassurances.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <LiveDemo demo={demo} cta={cta({ s: hero.startLabel, c: hero.continueLabel }, 'btn primary')} />
        </div>
      </section>

      <div className="home-body">
        <section className="band what" aria-labelledby="what-h">
          <h2 id="what-h">{home.whatIsLean.heading}</h2>
          <Markdown text={home.whatIsLean.body} className="measure" />
        </section>

        <section className="band" aria-labelledby="out-h">
          <h2 id="out-h">{home.outcomes.heading}</h2>
          <Blurbs items={home.outcomes.items} />
        </section>

        <section className="band" aria-labelledby="jr-h">
          <h2 id="jr-h">{home.journey.heading}</h2>
          <Markdown text={home.journey.intro} className="measure" />
          <Journey />
          <p className="journey-link"><a href={href.map()}>See the full map</a></p>
        </section>

        <section className="band" aria-labelledby="method-h">
          <h2 id="method-h">{home.method.heading}</h2>
          <Blurbs items={home.method.items} />
        </section>

        <section className="band" aria-labelledby="aud-h">
          <h2 id="aud-h">{home.audience.heading}</h2>
          <Markdown text={home.audience.body} className="measure" />
        </section>

        <section className="band closing" aria-labelledby="close-h">
          <h2 id="close-h">{home.closing.heading}</h2>
          <Markdown text={home.closing.body} className="measure" />
          <div className="actions">{cta({ s: home.closing.cta, c: hero.continueLabel })}</div>
        </section>
        <SiteFooter />
      </div>
    </div>
  );
}
