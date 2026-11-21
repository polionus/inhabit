/** The Gallery: exhibits grouped by topic at `#/gallery`, and one exhibit at a time at `#/gallery/<id>`. */
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useDisc } from '../context.tsx';
import { game, useGame } from '../store.ts';
import type { TemplateExhibitMeta } from '../types.ts';
import { continueLevel } from '../state/progress.ts';
import { EmptyState, Icon, ScreenHeader } from '../components/kit.tsx';
import { href } from '../router.ts';

/** The world the player is working in (for the "For where you are" flag). */
function useCurrentWorld(): string | undefined {
  const disc = useDisc();
  const levels = useGame((s) => s.save.levels);
  return useMemo(() => {
    const id = continueLevel(disc.worlds, levels);
    return id ? disc.findLevel(id)?.world.id : undefined;
  }, [disc, levels]);
}

export function GalleryScreen({ id }: { id?: string }) {
  const disc = useDisc();
  const seen = useGame((s) => s.save.seen);
  const here = useCurrentWorld();
  if (id) return <ExhibitPage id={id} />;

  const exhibits = disc.gallery?.exhibits ?? [];
  const groups = disc.gallery?.groups ?? [];
  if (exhibits.length === 0) {
    return (
      <div className="page gallery-page">
        <ScreenHeader id="gallery" title="Gallery" icon="sparkle" />
        <EmptyState icon="sparkle" title="No exhibits yet" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>
          Interactive demonstrations for this game will appear here.
        </EmptyState>
      </div>
    );
  }

  const explored = exhibits.filter((e) => seen[`gallery:${e.id}`]).length;
  return (
    <div className="page gallery-page">
      <ScreenHeader id="gallery" title="Gallery" icon="sparkle" />
      <div className="gal-progress" aria-label={`${explored} of ${exhibits.length} exhibits explored`}>
        <span className="gal-dots" aria-hidden="true">{exhibits.map((e) => <i key={e.id} className={seen[`gallery:${e.id}`] ? 'on' : ''} />)}</span>
        <span className="tnum">{explored} of {exhibits.length} explored</span>
      </div>
      {groups.map((g) => {
        const list = exhibits.filter((e) => e.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} className="gal-group" aria-labelledby={`gal-${g.id}`}>
            <div className="gal-group-head">
              <h2 id={`gal-${g.id}`}>{g.title}</h2>
              <p>{g.blurb}</p>
            </div>
            <ul className="gallery-grid v2" role="list">
              {list.map((e) => (
                <li key={e.id}><ExhibitCard e={e} seen={!!seen[`gallery:${e.id}`]} here={!!here && e.worlds.includes(here)} /></li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ExhibitCard({ e, seen, here }: { e: TemplateExhibitMeta; seen: boolean; here: boolean }) {
  const disc = useDisc();
  const worldTitle = (w: string): string => disc.worlds.find((x) => x.id === w)?.title ?? w;
  const thumb = disc.gallery?.renderThumb?.(e.id);
  return (
    <a className="gallery-card v2" href={href.gallery(e.id)}>
      <span className="gal-thumb">
        {thumb ?? <span className="gal-thumb-fallback" aria-hidden="true">{e.glyph}</span>}
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

function ExhibitPage({ id }: { id: string }) {
  const disc = useDisc();
  const gallery = disc.gallery;
  const exhibits = gallery?.exhibits ?? [];
  const meta = exhibits.find((e) => e.id === id);
  const Exhibit = useMemo(() => (meta && gallery ? lazy(() => gallery.loadExhibit(meta.id)) : null), [meta, gallery]);

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
  const worldTitle = (w: string): string => disc.worlds.find((x) => x.id === w)?.title ?? w;
  const worldHref = (w: string): string => (disc.chapters?.meta.some((c) => c.worldId === w) ? href.chapter(w) : href.world(w));
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
            {gallery?.verifiedLabel && <span><Icon name="check-circle" size={14} /> {gallery.verifiedLabel}</span>}
            <span>Exhibit {i + 1} of {exhibits.length}</span>
          </p>
        </div>
      </header>
      <Suspense fallback={<div className="exhibit-loading" aria-busy="true" />}>
        <Exhibit />
      </Suspense>
      <footer className="exhibit-foot">
        {meta.worlds.length > 0 && (
          <p className="muted small">
            Comes up in{' '}
            {meta.worlds.map((w, k) => (
              <span key={w}>
                {k > 0 && ', '}
                <a href={worldHref(w)}>{worldTitle(w)}</a>
              </span>
            ))}
            .
          </p>
        )}
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
