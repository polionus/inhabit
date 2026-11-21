import { useDisc } from '../context.tsx';
import { useGame } from '../store.ts';
import { dayKey } from '../state/game.ts';
import { href } from '../router.ts';
import { Markdown } from '../components/Markdown.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { StartLink, useStartTarget } from '../components/Start.tsx';
import { Card, Icon, Pill, ProgressBar, type IconName } from '../components/kit.tsx';
import { QuestList } from '../components/Quests.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { usePlayer, useQuests } from '../usePlayer.ts';
import { useRecommendations, dismissRec } from '../useRecommend.ts';
import type { Rec, RecKind } from '../state/recommend.ts';
import type { TemplateBlurb } from '../types.ts';

const BLURB_ICONS: IconName[] = ['turnstile', 'sparkle', 'target', 'graduate'];

function Blurbs({ items }: { items: TemplateBlurb[] }) {
  return (
    <ul className="blurbs">
      {items.map((b, i) => (
        <li key={i} className="blurb">
          <span className="blurb-icon" aria-hidden="true"><Icon name={BLURB_ICONS[i % BLURB_ICONS.length]} size={20} /></span>
          <h3>{b.title}</h3>
          <Markdown text={b.body} />
        </li>
      ))}
    </ul>
  );
}

/** The worlds as a strip of emblem tokens. */
function Journey() {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  const returning = Object.keys(save.levels).length > 0;
  return (
    <ol className="journey">
      {disc.worlds.map((w, i) => {
        const st = worldStatus(w, save, disc.worlds);
        return (
          <li key={w.id}>
            <a className="jnode" href={href.world(w.id)} aria-label={`${i + 1}. ${w.title}. ${w.tagline}.${returning && st.state !== 'empty' ? ` ${st.done} of ${st.total} done.` : ''}`}>
              <WorldToken world={w} size={64} state={returning ? st.state : 'open'} progress={returning ? st.frac : 0} badge={returning} />
              <span className="jnode-title">{w.title}</span>
              <span className="jnode-tag">{w.tagline}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function Explainer() {
  const disc = useDisc();
  const { home } = disc;
  const exhibits = disc.gallery?.exhibits ?? [];
  const start = useStartTarget();
  return (
    <div className="home-explain">
      <section className="band what" aria-labelledby="what-h">
        <h2 id="what-h">{home.whatIs.heading}</h2>
        <Markdown text={home.whatIs.body} className="measure prose" />
      </section>
      <section className="band" aria-labelledby="out-h">
        <h2 id="out-h">{home.outcomes.heading}</h2>
        <Blurbs items={home.outcomes.items} />
      </section>
      {exhibits.length > 0 && home.galleryStrip && (
        <section className="band" aria-labelledby="gal-h">
          <h2 id="gal-h">{home.galleryStrip.heading}</h2>
          <p className="measure">{home.galleryStrip.intro}</p>
          <ul className="gallery-strip" role="list">
            {exhibits.map((e) => (
              <li key={e.id}><a href={href.gallery(e.id)}><span className="gallery-glyph" aria-hidden="true">{e.glyph}</span><span>{e.title}</span></a></li>
            ))}
          </ul>
        </section>
      )}
      <section className="band" aria-labelledby="jr-h">
        <h2 id="jr-h">{home.journey.heading}</h2>
        <Markdown text={home.journey.intro} className="measure" />
        <Journey />
        <p><a className="btn outline" href={href.map()}><Icon name="map" size={18} /> See the full map</a></p>
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
        <Card tone="primary" className="closing-card">
          <h2 id="close-h">{home.closing.heading}</h2>
          <Markdown text={home.closing.body} className="measure" />
          <div className="actions">
            <StartLink start={start} startLabel={home.closing.cta} continueLabel={home.hero.continueLabel} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function StreakCard() {
  const p = usePlayer();
  const days = useGame((s) => s.save.activeDays);
  const set = new Set(days);
  const now = Date.now();
  const week = Array.from({ length: 7 }, (_, i) => {
    const t = now - (6 - i) * 86_400_000;
    const k = dayKey(t);
    return { k, on: set.has(k), label: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), today: i === 6 };
  });
  return (
    <Card className="dash-streak" as="section" aria-labelledby="streak-h">
      <div className="card-head"><h2 id="streak-h"><Icon name="flame" size={18} className="flamec" /> Streak</h2></div>
      <p className="streak-num"><span className="tnum">{p.streak.current}</span> <span className="streak-unit">{p.streak.current === 1 ? 'day' : 'days'}</span></p>
      <ol className="week" aria-label="The last seven days">
        {week.map((d) => (
          <li key={d.k} className={`${d.on ? 'on' : ''} ${d.today ? 'today' : ''}`} aria-label={`${d.k}: ${d.on ? 'active' : 'not active'}`}>
            <span className="wk-dot" aria-hidden="true">{d.on ? <Icon name="flame" size={14} /> : null}</span>
            <span className="wk-lab" aria-hidden="true">{d.label}</span>
          </li>
        ))}
      </ol>
      <p className="muted small">Best: {p.streak.best} {p.streak.best === 1 ? 'day' : 'days'}. One rest day a week is forgiven.</p>
    </Card>
  );
}

const REC_META: Record<RecKind, { label: string; icon: IconName; verb: string }> = {
  continue: { label: 'Up next', icon: 'play', verb: 'Continue' },
  review: { label: 'Review', icon: 'review', verb: 'Start the review' },
  redo: { label: 'Solve it yourself', icon: 'book', verb: 'Try it again' },
  practice: { label: 'Practice', icon: 'target', verb: 'Practice' },
  boss: { label: 'Test out', icon: 'crown', verb: 'Face the boss' },
  daily: { label: 'Daily', icon: 'calendar', verb: 'Play today’s set' },
  chapter: { label: 'Read', icon: 'guide', verb: 'Read the chapter' },
  gallery: { label: 'Gallery', icon: 'sparkle', verb: 'Open the exhibit' },
  workshop: { label: 'Complete', icon: 'trophy', verb: 'Continue' },
};

/** The top suggestion, why, and two different alternatives. */
function NextForYou({ start, recs }: { start: ReturnType<typeof useStartTarget>; recs: Rec[] }) {
  const disc = useDisc();
  const save = useGame((s) => s.save);
  const top = recs[0];
  if (!top) {
    const afterAll = disc.progression?.afterAllWorlds;
    return (
      <Card tone="primary" as="section" className="dash-continue" aria-labelledby="cont-h">
        <div className="dc-text">
          <span className="eyebrow">Next for you</span>
          <h2 id="cont-h">{afterAll?.title ?? 'All chapters complete'}</h2>
          <p className="muted">{afterAll?.reason ?? 'Revisit any world on the map or sharpen skills in Review.'}</p>
          <a className="btn primary huge" href={afterAll?.href ?? start.href}>
            <Icon name={afterAll?.icon ?? 'map'} size={20} /> {afterAll?.cta ?? 'Open the map'}
          </a>
        </div>
      </Card>
    );
  }
  const m = REC_META[top.kind];
  const afterAll = disc.progression?.afterAllWorlds;
  const verb = top.kind === 'workshop' && afterAll ? afterAll.cta : m.verb;
  const icon = top.kind === 'workshop' && afterAll ? afterAll.icon : m.icon;
  const w = top.worldId ? disc.worlds.find((x) => x.id === top.worldId) : undefined;
  const st = w ? worldStatus(w, save, disc.worlds) : null;
  return (
    <Card tone="primary" as="section" className="dash-continue dash-next" aria-labelledby="cont-h">
      {w && st && <WorldToken world={w} size={104} state={st.state} progress={st.frac} />}
      <div className="dc-text">
        <span className="eyebrow">Next for you · {m.label}</span>
        <h2 id="cont-h">{top.title}</h2>
        <p className="dc-why">{top.reason}</p>
        {w && st && (top.kind === 'continue' || top.kind === 'boss') && (
          <div className="dc-progress">
            <ProgressBar value={st.frac} size="sm" label={`${w.title}: ${st.done} of ${st.total} levels`} />
            <span className="tnum">{st.done}/{st.total}</span>
            <Pill tone="gold" icon="star">{st.stars.earned}/{st.stars.total}</Pill>
          </div>
        )}
        <div className="dc-actions">
          <a className="btn primary huge" href={top.href}><Icon name={icon} size={20} /> {verb}</a>
          <span className="muted small tnum">About {top.minutes} min</span>
          <button type="button" className="btn ghost small" onClick={() => dismissRec(top)} aria-label={`Not now: hide “${top.title}” until tomorrow`}>Not now</button>
        </div>
        {recs.length > 1 && (
          <div className="dc-alts">
            <span className="eyebrow">Or</span>
            <ul>
              {recs.slice(1).map((r) => (
                <li key={r.key}>
                  <a href={r.href}>
                    <Icon name={REC_META[r.kind].icon} size={16} />
                    <span><strong>{r.title}</strong><span className="muted small">{r.reason}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function Dashboard() {
  const disc = useDisc();
  const start = useStartTarget();
  const save = useGame((s) => s.save);
  const p = usePlayer();
  const quests = useQuests();
  const unread = (disc.guide?.meta ?? []).find((a) => !save.seen[`guide:${a.id}`]);
  const exhibits = disc.gallery?.exhibits ?? [];
  const todaysExhibit = exhibits.length > 0 ? exhibits[Math.floor(Date.now() / 86_400_000) % exhibits.length] : null;
  const studiedIds = disc.worlds.flatMap((w) => w.levels).filter((l) => save.levels[l.id]?.status === 'studied').map((l) => l.id);
  const qDone = quests.filter((q) => q.done).length;
  const recs = useRecommendations(3);
  const ExtraCards = disc.hooks?.dashboardCards ?? [];

  return (
    <div className="page wide dash">
      <header className="dash-head">
        <div>
          <span className="eyebrow">{p.streak.activeToday ? 'Good to see you' : 'Welcome back'}</span>
          <h1>{p.rank.title}, level {p.level.level}</h1>
        </div>
      </header>
      <div className="dash-grid">
        <NextForYou start={start} recs={recs} />

        <Card as="section" className="dash-quests" aria-labelledby="q-h">
          <div className="card-head">
            <h2 id="q-h"><Icon name="quest" size={18} className="goldc" /> Today’s quests</h2>
            <Pill tone={qDone === quests.length && quests.length ? 'ok' : 'neutral'}>{qDone}/{quests.length}</Pill>
          </div>
          <QuestList quests={quests} />
          <p className="muted small dash-note">New quests every day. Unfinished ones simply expire.</p>
        </Card>

        <StreakCard />

        <Card as="section" className="dash-review" aria-labelledby="rv-h">
          <div className="card-head"><h2 id="rv-h"><Icon name="review" size={18} /> Review</h2></div>
          <p className="dash-big"><span className="tnum">{p.ready}</span> <span className="streak-unit">ready today</span></p>
          <p className="muted small">{p.ready ? 'A short session. Solving things again a little later is what makes them stick.' : 'Nothing is ready right now. Finished levels come back on a schedule.'}</p>
          <a className={`btn block ${p.ready ? '' : 'outline'}`} href="#/review">{p.ready ? 'Start today’s session' : 'Open Review'}</a>
        </Card>

        {studiedIds.length > 0 && !recs.some((r) => r.kind === 'redo') && (
          <Card as="a" href={href.level(studiedIds[0])} className="dash-studied" aria-label={`${studiedIds.length} ${studiedIds.length === 1 ? 'level' : 'levels'} to solve on your own. Start with ${disc.findLevel(studiedIds[0])?.level.title ?? 'the first'}.`}>
            <div className="card-head"><h2><Icon name="book" size={18} /> {studiedIds.length} {studiedIds.length === 1 ? 'level' : 'levels'} to solve on your own</h2></div>
            <p className="muted small">You have seen how {studiedIds.length === 1 ? 'it goes' : 'they go'}. Solving {studiedIds.length === 1 ? 'it' : 'them'} yourself counts in full. Start with {disc.findLevel(studiedIds[0])?.level.title}.</p>
          </Card>
        )}

        {ExtraCards.map((CardComp, idx) => <CardComp key={idx} />)}

        {unread && (
          <Card as="a" href={href.guide(unread.id)} className="dash-guide" aria-label={`Guide: ${unread.title}. ${unread.summary}`}>
            <div className="card-head"><h2><Icon name="guide" size={18} /> From the Guide</h2><Pill icon="clock">{unread.minutes} min</Pill></div>
            <h3>{unread.title}</h3>
            <p className="muted small">{unread.summary}</p>
          </Card>
        )}

        {todaysExhibit && (
          <Card as="a" href={href.gallery(todaysExhibit.id)} className="dash-guide" aria-label={`Gallery: ${todaysExhibit.title}. ${todaysExhibit.tagline}`}>
            <div className="card-head"><h2><Icon name="sparkle" size={18} /> From the Gallery</h2></div>
            <h3>{todaysExhibit.title}</h3>
            <p className="muted small">{todaysExhibit.tagline}</p>
          </Card>
        )}
      </div>

      <details className="dash-about">
        <summary><Icon name="about" size={18} /> {disc.home.aboutSummary ?? `What ${disc.brand.name} is, and how it teaches`} <Icon name="chevron-down" size={18} className="chev" /></summary>
        <Explainer />
      </details>
      <SiteFooter />
    </div>
  );
}

function FirstVisit() {
  const disc = useDisc();
  const start = useStartTarget();
  const { home } = disc;
  const { hero } = home;
  const HeroWidget = disc.heroWidget;
  const cta = (cls = 'btn primary big') => (
    <StartLink start={start} className={cls} startLabel={hero.startLabel} continueLabel={hero.continueLabel} />
  );

  const defaultEntries = [
    {
      title: 'Play from level one',
      body: `${disc.worlds.length} ${disc.worlds.length === 1 ? 'world' : 'worlds'} of short levels, building one idea at a time.`,
      cta: 'Start',
      href: start.href,
      icon: 'map' as IconName,
      tone: 'primary' as const,
    },
    ...((disc.guide?.meta.length ?? 0) > 0
      ? [{
          title: 'Read the Guide',
          body: 'Background articles and worked ideas you can read first or alongside.',
          cta: 'Open the Guide',
          href: href.guide(),
          icon: 'guide' as IconName,
          tone: 'default' as const,
        }]
      : []),
    ...((disc.gallery?.exhibits.length ?? 0) > 0
      ? [{
          title: 'Explore the Gallery',
          body: 'Interactive visual exhibits you can play with right away.',
          cta: 'Open the Gallery',
          href: href.gallery(),
          icon: 'sparkle' as IconName,
          tone: 'gold' as const,
        }]
      : []),
  ];
  const entries = home.entryCards ?? defaultEntries;

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-h">
        <div className="hero-inner">
          <div className="hero-text">
            <span className="eyebrow accent">{hero.eyebrow}</span>
            <h1 id="hero-h">{hero.headline}</h1>
            <div className="hero-lede"><Markdown text={hero.lede} /></div>
            <div className="hero-actions">
              {cta('btn primary huge')}
              <a className="btn outline big" href={href.about()}>{hero.aboutLabel}</a>
            </div>
            <ul className="reassure">
              {hero.reassurances.map((r, i) => <li key={i}><Icon name="check" size={16} strokeWidth={3} /> {r}</li>)}
            </ul>
          </div>
          {HeroWidget && <HeroWidget cta={cta('btn primary')} />}
        </div>
      </section>
      <div className="home-body">
        {entries.length > 0 && (
          <ul className="entry-cards" aria-label="Ways in">
            {entries.map((e) => (
              <li key={e.title}>
                <Card as="a" href={e.href} tone={e.tone === 'primary' ? 'primary' : 'default'} className="entry">
                  <span className={`entry-icon ${e.tone === 'gold' ? 'gold' : ''}`}><Icon name={e.icon} size={22} /></span>
                  <h2>{e.title}</h2>
                  <p>{e.body}</p>
                  <span className="entry-go">{e.cta} <Icon name="arrow-right" size={16} /></span>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Explainer />
        <SiteFooter />
      </div>
    </div>
  );
}

export function HomeScreen() {
  const start = useStartTarget();
  return start.returning ? <Dashboard /> : <FirstVisit />;
}
