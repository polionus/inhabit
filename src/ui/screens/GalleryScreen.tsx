/** The Gallery: exhibits grouped by topic at `#/gallery`, and one exhibit at a time at `#/gallery/<id>`. */
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { game, useGame } from '../game.ts';
import { exhibits, exhibitById, exhibitGroups, type ExhibitId, type ExhibitMeta } from '../../gallery/registry.ts';
import { continueLevel } from '../../state/progress.ts';
import { exhibitLoaders } from '../gallery/loaders.ts';
import { thumbs } from '../gallery/thumbs.tsx';
import { data } from '../data.ts';
import { EmptyState, Icon, ScreenHeader } from '../components/kit.tsx';
import { href } from '../router.ts';

/** The world the player is working in (for the "For where you are" flag). */
function useCurrentWorld(): string | undefined {
  const levels = useGame((s) => s.save.levels);
  return useMemo(() => {
    const id = continueLevel(data.worlds, levels);
    return id ? data.findLevel(id)?.world.id : undefined;
  }, [levels]);
}

export function GalleryScreen({ id }: { id?: string }) {
  const seen = useGame((s) => s.save.seen);
  const here = useCurrentWorld();
  if (id) return <ExhibitPage id={id} />;
  const explored = exhibits.filter((e) => seen[`gallery:${e.id}`]).length;
  return (
    <div className="page gallery-page">
      <ScreenHeader id="gallery" title="Gallery" icon="sparkle" />
      <div className="gal-progress" aria-label={`${explored} of ${exhibits.length} exhibits explored`}>
        <span className="gal-dots" aria-hidden="true">{exhibits.map((e) => <i key={e.id} className={seen[`gallery:${e.id}`] ? 'on' : ''} />)}</span>
        <span className="tnum">{explored} of {exhibits.length} explored</span>
      </div>
      {exhibitGroups.map((g) => (
        <section key={g.id} className="gal-group" aria-labelledby={`gal-${g.id}`}>
          <div className="gal-group-head">
            <h2 id={`gal-${g.id}`}>{g.title}</h2>
            <p>{g.blurb}</p>
          </div>
          <ul className="gallery-grid v2" role="list">
            {exhibits.filter((e) => e.group === g.id).map((e) => (
              <li key={e.id}><ExhibitCard e={e} seen={!!seen[`gallery:${e.id}`]} here={!!here && e.worlds.includes(here)} /></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ExhibitCard({ e, seen, here }: { e: ExhibitMeta; seen: boolean; here: boolean }) {
  const Thumb = thumbs[e.id];
  return (
    <a className="gallery-card v2" href={href.gallery(e.id)}>
      <span className="gal-thumb">
        <Thumb />
        {here ? <span className="gal-flag here">For where you are</span> : !seen && <span className="gal-flag new">New</span>}
      </span>
      <span className="gal-body">
        <span className="gallery-card-title">{e.title}</span>
        <span className="gallery-card-tag">{e.tagline}</span>
        <span className="gal-meta">
          <span><Icon name="clock" size={13} /> {e.minutes} min</span>
          <span>{e.worlds.map(worldTitle).join(' · ')}</span>
          {seen && <span className="gal-flag seen"><Icon name="check" size={12} /> Explored</span>}
        </span>
      </span>
    </a>
  );
}

const worldTitle = (w: string): string => data.worlds.find((x) => x.id === w)?.title ?? w;

function ExhibitPage({ id }: { id: string }) {
  const meta = exhibitById(id);
  const Exhibit = useMemo(() => (meta ? lazy(exhibitLoaders[meta.id as ExhibitId]) : null), [meta]);
  useEffect(() => {
    if (meta) game().markSeen(`gallery:${meta.id}`);
    window.scrollTo(0, 0);
  }, [meta]);
  if (!meta || !Exhibit) {
    return (
      <div className="page">
        <EmptyState icon="sparkle" title="No such exhibit" action={<a className="btn" href={href.gallery()}>Back to the Gallery</a>}>
          That exhibit doesn't exist.
        </EmptyState>
      </div>
    );
  }
  const i = exhibits.findIndex((e) => e.id === meta.id);
  const prev = exhibits[i - 1];
  const next = exhibits[i + 1];
  return (
    <div className="page exhibit-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href.gallery()}><Icon name="sparkle" size={14} /> Gallery</a>
      </nav>
      <header className="exhibit-head">
        <span className="gallery-glyph" aria-hidden="true">{meta.glyph}</span>
        <div>
          <h1>{meta.title}</h1>
          <p className="lede">{meta.tagline}</p>
          <p className="exhibit-meta">
            <span><Icon name="clock" size={14} /> About {meta.minutes} min</span>
            <span><Icon name="check-circle" size={14} /> Lean here is engine-checked</span>
            <span>Exhibit {i + 1} of {exhibits.length}</span>
          </p>
        </div>
      </header>
      <Suspense fallback={<div className="exhibit-loading" aria-busy="true" />}>
        <Exhibit />
      </Suspense>
      <footer className="exhibit-foot">
        <p className="muted small">
          Comes up in{' '}
          {meta.worlds.map((w, k) => (
            <span key={w}>
              {k > 0 && ', '}
              <a href={href.chapter(w)}>{worldTitle(w)}</a>
            </span>
          ))}
          .
        </p>
        <nav className="exhibit-nav v2" aria-label="Other exhibits">
          {prev ? (
            <a className="prev" href={href.gallery(prev.id)}><span className="gallery-glyph" aria-hidden="true">{prev.glyph}</span><span><small>Previous</small><strong>{prev.title}</strong></span></a>
          ) : <span />}
          {next ? (
            <a className="next" href={href.gallery(next.id)}><span><small>Next</small><strong>{next.title}</strong></span><span className="gallery-glyph" aria-hidden="true">{next.glyph}</span></a>
          ) : (
            <a className="next" href={href.gallery()}><span><small>Back to</small><strong>All exhibits</strong></span><span className="gallery-glyph" aria-hidden="true">✦</span></a>
          )}
        </nav>
      </footer>
    </div>
  );
}
