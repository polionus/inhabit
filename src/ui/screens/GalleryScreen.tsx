/** The Gallery: a grid of interactive exhibits, and one exhibit at a time at `#/gallery/<id>`. */
import { lazy, Suspense, useMemo } from 'react';
import { exhibits, exhibitById, type ExhibitId } from '../../gallery/registry.ts';
import { exhibitLoaders } from '../gallery/loaders.ts';
import { data } from '../data.ts';
import { EmptyState, Icon, ScreenHeader } from '../components/kit.tsx';
import { href } from '../router.ts';

export function GalleryScreen({ id }: { id?: string }) {
  if (id) return <ExhibitPage id={id} />;
  return (
    <div className="page gallery-page">
      <ScreenHeader id="gallery" title="Gallery" icon="sparkle" />
      <ul className="gallery-grid" role="list">
        {exhibits.map((e) => (
          <li key={e.id}>
            <a className="gallery-card" href={href.gallery(e.id)}>
              <span className="gallery-glyph" aria-hidden="true">{e.glyph}</span>
              <span className="gallery-card-title">{e.title}</span>
              <span className="gallery-card-tag">{e.tagline}</span>
              <span className="gallery-card-worlds">{e.worlds.map(worldTitle).join(' · ')}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const worldTitle = (w: string): string => data.worlds.find((x) => x.id === w)?.title ?? w;

function ExhibitPage({ id }: { id: string }) {
  const meta = exhibitById(id);
  const Exhibit = useMemo(() => (meta ? lazy(exhibitLoaders[meta.id as ExhibitId]) : null), [meta]);
  if (!meta || !Exhibit) {
    return (
      <div className="page">
        <EmptyState icon="sparkle" title="No such exhibit" action={<a className="btn" href={href.gallery()}>Back to the Gallery</a>}>
          That exhibit does not exist.
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
        <div className="exhibit-nav">
          {prev ? <a href={href.gallery(prev.id)}>← {prev.title}</a> : <span />}
          {next ? <a href={href.gallery(next.id)}>{next.title} →</a> : <span />}
        </div>
      </footer>
    </div>
  );
}
