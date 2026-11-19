/** Chapter explainer: a blog-style article for one world at `#/chapter/<worldId>`. */
import { useEffect, useMemo, useRef } from 'react';
import { chapterFor } from '../../content/chapters/full.ts';
import { data } from '../data.ts';
import { lazyData, getArticle } from '../lazyData.ts';
import { useGame } from '../game.ts';
import { worldUnlocked } from '../../state/progress.ts';
import { Markdown } from '../components/Markdown.tsx';
import { LevelRows, readMinutes } from '../components/ChapterLevels.tsx';
import { EmptyState, Icon, Pill } from '../components/kit.tsx';
import { worldStatus } from '../components/world.tsx';
import { href } from '../router.ts';

const slug = (t: string, i: number) => `sec-${i + 1}-${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

export function ChapterScreen({ id }: { id: string }) {
  const save = useGame((s) => s.save);
  const worlds = data.worlds;
  const idx = worlds.findIndex((w) => w.id === id);
  const w = worlds[idx];
  const ch = chapterFor(id);
  const body = useRef<HTMLDivElement>(null);
  const heads = useMemo(
    () => (ch ? [...ch.body.matchAll(/^##\s+(.+)$/gm)].map((m, i) => ({ text: m[1].replace(/[`*_]/g, ''), id: slug(m[1], i) })) : []),
    [ch],
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);
  useEffect(() => {
    const hs = body.current?.querySelectorAll('h2');
    hs?.forEach((h, i) => {
      if (heads[i]) h.id = heads[i].id;
    });
  }, [heads]);

  if (!w) {
    return (
      <div className="page narrow">
        <EmptyState glyph="?" title="No such chapter" action={<a className="btn primary" href={href.map()}>Back to the roadmap</a>}>It may have moved.</EmptyState>
      </div>
    );
  }
  const st = worldStatus(w, save);
  const locked = !worldUnlocked(w, worlds, save.levels);
  const prev = idx > 0 ? worlds[idx - 1] : undefined;
  const next = idx < worlds.length - 1 ? worlds[idx + 1] : undefined;
  const guide = (ch?.guide ?? []).map((g) => getArticle(g)).filter((a): a is NonNullable<typeof a> => !!a);
  const started = st.done > 0;
  const play = st.state === 'empty' ? null : locked ? (
    <button type="button" className="btn primary big" disabled><Icon name="lock" size={18} /> Play this world (locked)</button>
  ) : (
    <a className="btn primary big" href={href.world(w.id)}><Icon name="play" size={18} /> {started ? 'Continue the world' : 'Play this world'}</a>
  );

  return (
    <div className={`page chapter-page ${heads.length > 1 ? 'with-toc' : ''}`}>
      <nav className="crumb" aria-label="Breadcrumb">
        <a href={href.map()}><Icon name="map" size={15} /> Roadmap</a>
        <Icon name="chevron-right" size={14} />
        <span>Chapter {idx + 1}</span>
      </nav>

      <div className={`ch-layout ${heads.length > 1 ? 'has-toc' : ''}`}>
        {heads.length > 1 && (
          <nav className="ch-toc" aria-label="In this article">
            <span className="eyebrow">In this article</span>
            <ol>
              {heads.map((h) => (
                <li key={h.id}>
                  <a href={href.chapter(id)} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ block: 'start' }); }}>{h.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <article className="ch-article" aria-labelledby="ch-h">
          <header className="ch-head">
            <p className="ch-kicker">Chapter {idx + 1} · {w.title}</p>
            <h1 id="ch-h">{ch ? ch.title : w.title}</h1>
            {ch ? <p className="ch-dek">{ch.dek}</p> : <p className="ch-dek">{w.tagline}</p>}
            {ch && (
              <div className="ch-meta">
                <Pill icon="clock">{readMinutes(ch.body)} min read</Pill>
                <a className="ch-world" href={href.world(w.id)}>Go to the world</a>
              </div>
            )}
          </header>
          {ch ? (
            <div ref={body}>
              <Markdown text={ch.body} className="prose article-body ch-body" />
            </div>
          ) : (
            <p className="notice"><Icon name="book" size={16} /> The explainer for this chapter is coming soon. The chapter contents are below, and the world has its own short primer.</p>
          )}
          <div className="ch-play">{play}</div>
        </article>
      </div>

      <section className="ch-levels" aria-labelledby="ch-lv-h">
        <h2 id="ch-lv-h" className="section-title"><Icon name="list" size={20} /> In this chapter <span className="count tnum">{st.done}/{st.total}</span></h2>
        <LevelRows world={w} save={save} locked={locked} />
      </section>

      {guide.length > 0 && (
        <section className="ch-readnext" aria-labelledby="ch-rn-h">
          <h2 id="ch-rn-h" className="section-title"><Icon name="guide" size={20} /> Read next</h2>
          <ul>
            {guide.map((a) => (
              <li key={a.id}>
                <a className="ch-rn" href={href.guide(a.id)}><strong>{a.title}</strong><span className="muted">{a.summary}</span></a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="article-nav" aria-label="Previous and next chapter">
        {prev ? (
          <a className="anav prev" href={href.chapter(prev.id)}><span className="anav-dir"><Icon name="chevron-left" size={16} /> Chapter {idx}</span><span className="anav-title">{chapterFor(prev.id)?.title ?? prev.title}</span></a>
        ) : <span />}
        {next ? (
          <a className="anav next" href={href.chapter(next.id)}><span className="anav-dir">Chapter {idx + 2} <Icon name="chevron-right" size={16} /></span><span className="anav-title">{chapterFor(next.id)?.title ?? next.title}</span></a>
        ) : (
          <a className="anav next" href={href.map()}><span className="anav-dir">Back to <Icon name="chevron-right" size={16} /></span><span className="anav-title">The roadmap</span></a>
        )}
      </nav>
    </div>
  );
}
