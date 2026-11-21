import { exhibits } from '../../gallery/registry.ts';
import { data } from '../data.ts';
import { guideMeta } from '../../content/guideMeta.ts';
import { useGame } from '../game.ts';
import { home } from '../../content/site.ts';
import { dayKey } from '../../state/game.ts';
import { href } from '../router.ts';
import { Markdown } from '../components/Markdown.tsx';
import { LiveDemo } from '../components/LiveDemo.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { StartLink, useStartTarget } from '../components/Start.tsx';
import { Card, Icon, Pill, ProgressBar, type IconName } from '../components/kit.tsx';
import { QuestList } from '../components/Quests.tsx';
import { WorldToken, worldStatus } from '../components/world.tsx';
import { usePlayer, useQuests } from '../usePlayer.ts';
import { useArenaSummary } from '../../arena/state/summary.ts';
import type { Blurb } from '../../content/types.ts';
import { useRecommendations, dismissRec } from '../useRecommend.ts';
import type { Rec, RecKind } from '../../state/recommend.ts';

const BLURB_ICONS: IconName[] = ['turnstile', 'sparkle', 'target', 'graduate'];

function Blurbs({ items }: { items: Blurb[] }) {
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

/** The ten worlds as a strip of emblem tokens. */
function Journey() {
  const save = useGame((s) => s.save);
  const returning = Object.keys(save.levels).length > 0;
  return (
    <ol className="journey">
      {data.worlds.map((w, i) => {
        const st = worldStatus(w, save);
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
  const start = useStartTarget();
  return (
    <div className="home-explain">
      <section className="band what" aria-labelledby="what-h">
        <h2 id="what-h">{home.whatIsLean.heading}</h2>
        <Markdown text={home.whatIsLean.body} className="measure prose" />
      </section>
      <section className="band" aria-labelledby="out-h">
        <h2 id="out-h">{home.outcomes.heading}</h2>
        <Blurbs items={home.outcomes.items} />
      </section>
      <section className="band" aria-labelledby="gal-h">
        <h2 id="gal-h">See the ideas move</h2>
        <p className="measure">Before you prove anything, play with the ideas. Replay a proof and watch its term grow, shade sets, draw functions, or play a quantifier against the computer.</p>
        <ul className="gallery-strip" role="list">
          {exhibits.map((e) => (
            <li key={e.id}><a href={href.gallery(e.id)}><span className="gallery-glyph" aria-hidden="true">{e.glyph}</span><span>{e.title}</span></a></li>
          ))}
        </ul>
      </section>
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

function DailyCard() {
  const a = useArenaSummary();
  return (
    <Card className="dash-daily" as="section" aria-labelledby="daily-h">
      <div className="card-head">
        <h2 id="daily-h"><Icon name="calendar" size={18} /> Daily Proof</h2>
        {a.dailyStreak > 0 && <Pill tone="flame" icon="flame">{a.dailyStreak}</Pill>}
      </div>
      {a.dailyDone ? (
        <>
          <p className="dash-big"><Icon name="check-circle" size={22} className="okc" /> Done for today</p>
          <p className="muted small">A new set appears tomorrow. Same three puzzles for everyone.</p>
          <a className="btn outline block" href={href.arena('daily')}>See your result</a>
        </>
      ) : (
        <>
          <p className="muted small">Three puzzles of rising difficulty, the same for everyone today. A clock counts up; nothing times out.</p>
          <a className="btn gold block" href={href.arena('daily')}><Icon name="play" size={16} /> Play today’s set</a>
        </>
      )}
    </Card>
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
  daily: { label: 'Daily Proof', icon: 'calendar', verb: 'Play today’s set' },
  chapter: { label: 'Read', icon: 'guide', verb: 'Read the chapter' },
  gallery: { label: 'Gallery', icon: 'sparkle', verb: 'Open the exhibit' },
  workshop: { label: 'Workshop', icon: 'workshop', verb: 'Open the Workshop' },
};

/** The top suggestion, why, and two different alternatives (src/state/recommend.ts). */
function NextForYou({ start, recs }: { start: ReturnType<typeof useStartTarget>; recs: Rec[] }) {
  const save = useGame((s) => s.save);
  const top = recs[0];
  if (!top) {
    return (
      <Card tone="primary" as="section" className="dash-continue" aria-labelledby="cont-h">
        <div className="dc-text">
          <span className="eyebrow">Next for you</span>
          <h2 id="cont-h">Prove something of your own</h2>
          <p className="muted">The Workshop takes a statement from English to a proved Lean theorem.</p>
          <a className="btn primary huge" href={start.href}><Icon name="workshop" size={20} /> Open the Workshop</a>
        </div>
      </Card>
    );
  }
  const m = REC_META[top.kind];
  const w = top.worldId ? data.worlds.find((x) => x.id === top.worldId) : undefined;
  const st = w ? worldStatus(w, save) : null;
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
          <a className="btn primary huge" href={top.href}><Icon name={m.icon} size={20} /> {m.verb}</a>
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
  const start = useStartTarget();
  const save = useGame((s) => s.save);
  const p = usePlayer();
  const quests = useQuests();
  const unread = guideMeta.find((a) => !save.seen[`guide:${a.id}`]);
  const studiedIds = data.worlds.flatMap((w) => w.levels).filter((l) => save.levels[l.id]?.status === 'studied').map((l) => l.id);
  const qDone = quests.filter((q) => q.done).length;
  const recs = useRecommendations(3);
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
          <Card as="a" href={href.level(studiedIds[0])} className="dash-studied" aria-label={`${studiedIds.length} ${studiedIds.length === 1 ? 'level' : 'levels'} to solve on your own. Start with ${data.findLevel(studiedIds[0])?.level.title ?? 'the first'}.`}>
            <div className="card-head"><h2><Icon name="book" size={18} /> {studiedIds.length} {studiedIds.length === 1 ? 'level' : 'levels'} to solve on your own</h2></div>
            <p className="muted small">You have seen how {studiedIds.length === 1 ? 'it goes' : 'they go'}. Solving {studiedIds.length === 1 ? 'it' : 'them'} yourself counts in full. Start with {data.findLevel(studiedIds[0])?.level.title}.</p>
          </Card>
        )}

        <DailyCard />

        {unread && (
          <Card as="a" href={href.guide(unread.id)} className="dash-guide" aria-label={`Guide: ${unread.title}. ${unread.summary}`}>
            <div className="card-head"><h2><Icon name="guide" size={18} /> From the Guide</h2><Pill icon="clock">{unread.minutes} min</Pill></div>
            <h3>{unread.title}</h3>
            <p className="muted small">{unread.summary}</p>
          </Card>
        )}
        <Card as="a" href={href.gallery(todaysExhibit.id)} className="dash-guide" aria-label={`Gallery: ${todaysExhibit.title}. ${todaysExhibit.tagline}`}>
          <div className="card-head"><h2><Icon name="sparkle" size={18} /> From the Gallery</h2></div>
          <h3>{todaysExhibit.title}</h3>
          <p className="muted small">{todaysExhibit.tagline}</p>
        </Card>
      </div>

      <details className="dash-about">
        <summary><Icon name="about" size={18} /> What Inhabit is, and how it teaches <Icon name="chevron-down" size={18} className="chev" /></summary>
        <Explainer />
      </details>
      <SiteFooter />
    </div>
  );
}

function FirstVisit() {
  const start = useStartTarget();
  const { hero, demo } = home;
  const cta = (cls = 'btn primary big') => <StartLink start={start} className={cls} startLabel={hero.startLabel} continueLabel={hero.continueLabel} />;
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
          <LiveDemo demo={demo} cta={cta('btn primary')} />
        </div>
      </section>
      <div className="home-body">
        <ul className="entry-cards" aria-label="Ways in">
          <li>
            <Card as="a" href={start.href} tone="primary" className="entry">
              <span className="entry-icon"><Icon name="map" size={22} /></span>
              <h2>Play from level one</h2>
              <p>Ten worlds of short levels, from your first proof to a theorem of your own.</p>
              <span className="entry-go">Start <Icon name="arrow-right" size={16} /></span>
            </Card>
          </li>
          <li>
            <Card as="a" href={href.guide()} className="entry">
              <span className="entry-icon"><Icon name="guide" size={22} /></span>
              <h2>Read the Guide</h2>
              <p>What Lean is, how proof checking works, and where it is used. Read first or alongside.</p>
              <span className="entry-go">Open the Guide <Icon name="arrow-right" size={16} /></span>
            </Card>
          </li>
          <li>
            <Card as="a" href={href.arena()} className="entry">
              <span className="entry-icon gold"><Icon name="arena" size={22} /></span>
              <h2>Try the Arena</h2>
              <p>A Daily Proof, rated puzzles and timed runs. Generated fresh, so it never runs out.</p>
              <span className="entry-go">Enter the Arena <Icon name="arrow-right" size={16} /></span>
            </Card>
          </li>
        </ul>
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

/** One exhibit a day on the dashboard, rotating by calendar day. */
const todaysExhibit = exhibits[Math.floor(Date.now() / 86_400_000) % exhibits.length];
