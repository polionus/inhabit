import { useEffect, useMemo, useRef, useState } from 'react';
import type { Level } from '../../content/types.ts';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { bossIndex, canTestOut, levelPlayable, levelState, worldUnlocked } from '../../state/progress.ts';
import { starsFor } from '../../state/meta.ts';
import { Markdown } from '../components/Markdown.tsx';
import { Card, EmptyState, Icon, Pill, ProgressBar, Stars, type IconName } from '../components/kit.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { href } from '../router.ts';

export const KIND_LABEL: Record<Level['kind'], string> = { proof: 'Proof', parsons: 'Arrange', choice: 'Check', predict: 'Predict', formalize: 'Formalize' };
export const KIND_ICON: Record<Level['kind'], IconName> = { proof: 'turnstile', parsons: 'list', choice: 'check-circle', predict: 'eye', formalize: 'translate' };

const READ_MIN_MS = 8000;

/** Calls `onEnd` once the sentinel has been on screen after the reader has spent a little time here. */
export function useReadToEnd(onEnd: () => void, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onEnd);
  cb.current = onEnd;
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof IntersectionObserver === 'undefined') return;
    const start = Date.now();
    let timer = 0;
    let done = false;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.some((e) => e.isIntersecting);
      clearTimeout(timer);
      if (!vis || done) return;
      const wait = Math.max(0, READ_MIN_MS - (Date.now() - start));
      timer = window.setTimeout(() => {
        done = true;
        cb.current();
      }, wait);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [active]);
  return ref;
}

/** First paragraph(s) of a markdown text for a teaser: skips headings and code. */
function teaserOf(md: string): string {
  const paras = md.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !p.startsWith('#') && !p.startsWith('```') && !p.startsWith('|'));
  let out = '';
  for (const p of paras) {
    out += (out ? '\n\n' : '') + p;
    if (out.length > 260) break;
  }
  return out;
}

function Primer({ worldId, primer }: { worldId: string; primer: string }) {
  const read = useGame((s) => !!s.save.seen[`primer:${worldId}`]);
  const [open, setOpen] = useState(!read);
  const words = useMemo(() => primer.split(/\s+/).length, [primer]);
  const end = useReadToEnd(() => game().recordEvent({ type: 'primer-read', worldId }), open && !read);
  const teaser = useMemo(() => teaserOf(primer), [primer]);
  return (
    <section className={`chapter ${open ? 'open' : 'closed'}`} aria-labelledby="chapter-h">
      <div className="chapter-head">
        <span className="chapter-badge" aria-hidden="true"><Icon name="book" size={20} /></span>
        <div>
          <span className="eyebrow">The chapter</span>
          <h2 id="chapter-h">Before you play</h2>
        </div>
        <span className="chapter-meta">
          {read ? <Pill tone="ok" icon="check">Read</Pill> : <Pill icon="clock">{Math.max(1, Math.round(words / 200))} min read</Pill>}
        </span>
      </div>
      {open ? (
        <>
          <Markdown text={primer} className="prose chapter-body" />
          <div ref={end} className="reading-end" aria-hidden="true" />
          {read && (
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
              <Icon name="chevron-down" size={16} style={{ transform: 'rotate(180deg)' }} /> Collapse the chapter
            </button>
          )}
        </>
      ) : (
        <>
          <div className="chapter-teaser">
            <Markdown text={teaser} className="prose" />
          </div>
          <button type="button" className="btn outline" onClick={() => setOpen(true)} aria-expanded={false}>
            <Icon name="book" size={18} /> Read the chapter
          </button>
        </>
      )}
    </section>
  );
}

export function WorldScreen({ id }: { id: string }) {
  const save = useGame((s) => s.save);
  const levels = save.levels;
  const w = data.worlds.find((x) => x.id === id);
  if (!w) {
    return (
      <div className="page narrow">
        <EmptyState glyph="?" title="Unknown world" action={<a className="btn primary" href={href.map()}>Back to the map</a>} />
      </div>
    );
  }
  const st = worldStatus(w, save);
  const unlocked = worldUnlocked(w, data.worlds, levels);
  const boss = bossIndex(w);
  const test = canTestOut(w, data.worlds, levels) && unlocked && st.state !== 'complete';
  const reqNames = w.requires.map((r) => data.worlds.find((x) => x.id === r)?.title ?? r);
  const prose = data.worldLessons(w.id);
  const nextIdx = w.levels.findIndex((_, i) => levelState(w, i, data.worlds, levels) === 'open');
  const next = nextIdx >= 0 ? w.levels[nextIdx] : null;
  const worldIndex = data.worlds.indexOf(w);
  const nextWorld = st.state === 'complete' ? data.worlds.find((x) => x.requires.includes(w.id) && worldUnlocked(x, data.worlds, levels) && worldStatus(x, save).state !== 'complete') : undefined;

  return (
    <div className="page world-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <a href={href.map()}><Icon name="map" size={15} /> Map</a>
        <Icon name="chevron-right" size={14} />
        <span>World {worldIndex + 1}</span>
      </nav>
      <header className="world-hero">
        <WorldToken world={w} size={128} state={st.state} progress={st.frac} />
        <div className="wh-text">
          <h1>{w.title}</h1>
          <p className="lede">{w.tagline}</p>
          {w.bigIdea && (
            <p className="bigidea"><span className="eyebrow">Big idea</span>{w.bigIdea}</p>
          )}
          {st.state !== 'empty' && (
            <div className="wh-stats">
              <div className="wh-progress">
                <ProgressBar value={st.frac} tone={st.state === 'complete' ? 'gold' : 'primary'} size="md" label={`${st.done} of ${st.total} levels done`} />
                <span className="tnum">{st.done}/{st.total} levels</span>
              </div>
              <Pill tone="gold" icon="star">{st.stars.earned}/{st.stars.total}</Pill>
              {st.state === 'complete' && <Pill tone="ok" icon="check">Complete</Pill>}
            </div>
          )}
          <div className="actions">
            {next && unlocked && (
              <a className="btn primary big" href={href.level(next.id)}>
                <Icon name="play" size={18} /> {st.done === 0 ? 'Start' : 'Continue'}
                <span className="btn-sub">{next.title}</span>
              </a>
            )}
            {nextWorld && (
              <a className="btn primary big" href={href.world(nextWorld.id)}>
                Next world <span className="btn-sub">{nextWorld.title}</span> <Icon name="arrow-right" size={18} />
              </a>
            )}
            {prose?.primer && st.state !== 'empty' && <a className="btn ghost" href="#levels" onClick={(e) => { e.preventDefault(); document.getElementById('levels')?.scrollIntoView({ block: 'start' }); }}>Jump to the levels</a>}
          </div>
        </div>
      </header>

      {w.intro && <Markdown text={w.intro} className="world-intro" />}

      {!unlocked && (
        <p className="notice">
          <Icon name="lock" size={16} /> Finish {reqNames.join(' and ')} first to open this world{boss >= 0 ? ', or beat its boss once you get here to test out.' : '.'}
        </p>
      )}

      {st.state === 'complete' && prose?.recap && (
        <Card tone="gold" as="section" className="recap" aria-labelledby="recap-h">
          <div className="recap-head">
            <Icon name="trophy" size={22} />
            <h2 id="recap-h">World complete</h2>
            <Stars value={Math.round((st.stars.earned / Math.max(1, st.stars.total)) * 3)} size="md" label={`${st.stars.earned} of ${st.stars.total} stars`} />
          </div>
          <Markdown text={prose.recap} className="prose compact" />
        </Card>
      )}

      {prose?.primer && <Primer worldId={w.id} primer={prose.primer} />}

      {test && (
        <Card tone="primary" className="testout">
          <Icon name="crown" size={22} />
          <div>
            <strong>Already know this?</strong> Beat the boss and the rest of this world counts as passed.
          </div>
          <a className="btn" href={href.level(w.levels[boss].id)}>Test out</a>
        </Card>
      )}

      <section aria-labelledby="levels-h" id="levels" className="levels-sec">
        <h2 className="section-title" id="levels-h"><Icon name="list" size={20} /> Levels <span className="count tnum">{st.done}/{st.total}</span></h2>
        {w.levels.length === 0 ? (
          <EmptyState icon="sparkle" title="No levels yet">This world is still being built.</EmptyState>
        ) : (
          <ol className="ltiles">
            {w.levels.map((l, i) => {
              const ls = levelState(w, i, data.worlds, levels);
              const p = levels[l.id];
              const playable = levelPlayable(w, i, data.worlds, levels);
              const stars = starsFor(p, save.deck[l.id]);
              const isNext = next?.id === l.id;
              const label = p?.status === 'solved' ? (p.testedOut ? 'Tested out' : 'Solved') : p?.status === 'studied' ? 'Studied' : ls === 'locked' ? (playable ? 'Test out' : 'Locked') : isNext ? 'Play' : 'Open';
              const inner = (
                <>
                  <span className="lt-top">
                    <span className="lt-num tnum">{i + 1}</span>
                    <span className="lt-kind"><Icon name={KIND_ICON[l.kind]} size={15} /> {KIND_LABEL[l.kind]}</span>
                    {l.boss && <span className="lt-boss"><Icon name="crown-fill" size={15} /> Boss</span>}
                    {l.optional && <span className="lt-side">Side quest</span>}
                  </span>
                  <span className="lt-title">{l.title}</span>
                  <span className="lt-foot">
                    {ls === 'locked' && !playable ? <Icon name="lock" size={16} /> : <Stars value={stars} size="sm" />}
                    <span className={`lt-state ${ls}`}>{isNext && <Icon name="play" size={12} />} {label}</span>
                  </span>
                </>
              );
              const cls = `ltile ${ls} ${l.boss ? 'boss' : ''} ${isNext ? 'next' : ''} ${l.optional ? 'optional' : ''}`;
              return (
                <li key={l.id} className="ltile-li">
                  {playable ? (
                    <a href={href.level(l.id)} className={cls} aria-label={`Level ${i + 1}: ${l.title}. ${KIND_LABEL[l.kind]}${l.boss ? ', boss' : ''}${l.optional ? ', side quest' : ''}. ${label}. ${stars} of 3 stars.`}>{inner}</a>
                  ) : (
                    <div className={cls} aria-disabled="true" aria-label={`Level ${i + 1}: ${l.title}. Locked.`}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
