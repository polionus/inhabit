/** The Guide: long-form reading. Index and article views. */
import { useEffect, useState } from 'react';
import { useDisc } from '../context.tsx';
import { game, useGame } from '../store.ts';
import type { TemplateGuideArticle, TemplateGuideMeta } from '../types.ts';
import { Markdown } from '../components/Markdown.tsx';
import { Card, EmptyState, Icon, Pill, ProgressBar, ScreenHeader } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { href } from '../router.ts';
import { useReadToEnd } from './WorldScreen.tsx';

function ArticleCard({ a, n, read, highlight }: { a: TemplateGuideMeta; n: number; read: boolean; highlight: boolean }) {
  return (
    <Card
      as="a"
      href={href.guide(a.id)}
      tone={highlight ? 'primary' : 'default'}
      className={`gcard ${read ? 'read' : ''}`}
      aria-label={`${a.title}. ${a.summary} ${a.minutes} minutes.${read ? ' Read.' : ''}`}
    >
      <span className="gcard-top">
        <span className="gcard-num tnum" aria-hidden="true">{n}</span>
        <Pill icon="clock">{a.minutes} min</Pill>
        {read ? <Pill tone="ok" icon="check">Read</Pill> : highlight ? <Pill tone="primary">Start here</Pill> : null}
      </span>
      <span className="gcard-title">{a.title}</span>
      <span className="gcard-sum">{a.summary}</span>
    </Card>
  );
}

function GuideIndex() {
  const disc = useDisc();
  const seen = useGame((s) => s.save.seen);
  const all = disc.guide?.meta ?? [];
  const sections = disc.guide?.sections ?? [];
  const isRead = (a: TemplateGuideMeta) => !!seen[`guide:${a.id}`];
  const readCount = all.filter(isRead).length;
  const firstUnread = all.find((a) => !isRead(a));

  return (
    <div className="page guide-page">
      <ScreenHeader
        id="guide"
        title="Guide"
        icon="guide"
        actions={all.length > 0 && (
          <div className="guide-progress">
            <span className="tnum"><strong>{readCount}</strong> of {all.length} read</span>
            <ProgressBar value={all.length ? readCount / all.length : 0} tone="ok" size="sm" label={`${readCount} of ${all.length} articles read`} />
          </div>
        )}
      />
      {all.length === 0 ? (
        <EmptyState icon="guide" title="The Guide is being written" action={<a className="btn primary" href={href.map()}>Play instead</a>}>
          Long-form articles and reference notes will appear here.
        </EmptyState>
      ) : (
        sections.map((sec) => {
          const items = all.filter((a) => a.section === sec.id);
          if (!items.length) return null;
          return (
            <section key={sec.id} className="guide-sec" aria-labelledby={`gs-${sec.id}`}>
              <h2 className="section-title" id={`gs-${sec.id}`}>{sec.title}<span className="count tnum">{items.filter(isRead).length}/{items.length}</span></h2>
              {sec.blurb && <p className="muted guide-blurb">{sec.blurb}</p>}
              <div className="gcards">
                {items.map((a) => <ArticleCard key={a.id} a={a} n={all.indexOf(a) + 1} read={isRead(a)} highlight={firstUnread?.id === a.id} />)}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ArticleView({ a, all }: { a: TemplateGuideArticle; all: TemplateGuideArticle[] }) {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  const read = !!save.seen[`guide:${a.id}`];
  const i = all.findIndex((x) => x.id === a.id);
  const prev = i > 0 ? all[i - 1] : undefined;
  const next = i >= 0 && i < all.length - 1 ? all[i + 1] : undefined;
  const section = disc.guide?.sections.find((s) => s.id === a.section);
  const end = useReadToEnd(() => game().recordEvent({ type: 'guide-read', articleId: a.id }), !read);
  const related = (a.worlds ?? []).map((id) => disc.worlds.find((w) => w.id === id)).filter((w): w is NonNullable<typeof w> => !!w);
  const readNext = (a.next ?? []).map((id) => all.find((x) => x.id === id)).filter((x): x is TemplateGuideArticle => !!x);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [a.id]);

  return (
    <div className="page article-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <a href={href.guide()}><Icon name="guide" size={15} /> Guide</a>
        <Icon name="chevron-right" size={14} />
        <span>{section?.title ?? a.section}</span>
      </nav>
      <article className="article" aria-labelledby="art-h">
        <header className="article-head">
          <h1 id="art-h">{a.title}</h1>
          <p className="lede">{a.summary}</p>
          <div className="article-meta">
            <Pill icon="clock">{a.minutes} min read</Pill>
            {read && <Pill tone="ok" icon="check">Read</Pill>}
            <span className="tnum muted small">Article {i + 1} of {all.length}</span>
          </div>
        </header>
        <Markdown text={a.body} className="prose article-body" />
        <div ref={end} className="reading-end" aria-hidden="true" />
      </article>

      {related.length > 0 && (
        <section className="article-related" aria-labelledby="rel-h">
          <h2 id="rel-h" className="eyebrow">Where you use this</h2>
          <ul className="rel-worlds">
            {related.map((w) => {
              const st = worldStatus(w, save, disc.worlds);
              return (
                <li key={w.id}>
                  <a className="rel-world" href={href.world(w.id)}>
                    <WorldToken world={w} size={40} state={st.state} progress={st.frac} badge={false} />
                    <span><strong>{w.title}</strong><span className="muted small">{w.tagline}</span></span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {readNext.length > 0 && (
        <section className="article-next" aria-labelledby="next-h">
          <h2 id="next-h" className="eyebrow">Read next</h2>
          <div className="gcards">
            {readNext.map((x) => <ArticleCard key={x.id} a={x} n={all.findIndex((y) => y.id === x.id) + 1} read={!!save.seen[`guide:${x.id}`]} highlight={false} />)}
          </div>
        </section>
      )}

      <nav className="article-nav" aria-label="Previous and next article">
        {prev ? (
          <a className="anav prev" href={href.guide(prev.id)}><span className="anav-dir"><Icon name="chevron-left" size={16} /> Previous</span><span className="anav-title">{prev.title}</span></a>
        ) : <span />}
        {next ? (
          <a className="anav next" href={href.guide(next.id)}><span className="anav-dir">Next <Icon name="chevron-right" size={16} /></span><span className="anav-title">{next.title}</span></a>
        ) : (
          <a className="anav next" href={href.guide()}><span className="anav-dir">Back to <Icon name="chevron-right" size={16} /></span><span className="anav-title">All articles</span></a>
        )}
      </nav>
    </div>
  );
}

export function GuideScreen({ id }: { id?: string }) {
  const disc = useDisc();
  const [articles, setArticles] = useState<TemplateGuideArticle[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (!id || !disc.guide) return;
    void disc.guide.loadArticles().then((list) => {
      if (alive) setArticles(list);
    });
    return () => { alive = false; };
  }, [id, disc.guide]);

  if (!id) return <GuideIndex />;
  if (!disc.guide) {
    return (
      <div className="page narrow">
        <EmptyState icon="guide" title="No guide available" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>
          This disc has no guide articles yet.
        </EmptyState>
      </div>
    );
  }
  if (!articles) {
    return <div className="page article-page" aria-busy="true" style={{ minHeight: '60vh' }} />;
  }
  const a = articles.find((x) => x.id === id);
  if (!a) {
    return (
      <div className="page narrow">
        <EmptyState icon="guide" title="No such article" action={<a className="btn primary" href={href.guide()}>All articles</a>}>
          It may have moved.
        </EmptyState>
      </div>
    );
  }
  return <ArticleView key={a.id} a={a} all={articles} />;
}
