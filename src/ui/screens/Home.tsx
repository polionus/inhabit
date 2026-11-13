import { data } from '../data.ts';
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

function Dashboard() {
  const start = useStartTarget();
  const save = useGame((s) => s.save);
  const p = usePlayer();
  const quests = useQuests();
  const cont = start.kind === 'continue' ? data.findLevel(start.href.replace('#/level/', '')) : undefined;
  const st = cont ? worldStatus(cont.world, save) : null;
  const unread = data.guide.find((a) => !save.seen[`guide:${a.id}`]);
  const qDone = quests.filter((q) => q.done).length;
  return (
    <div className="page wide dash">
      <header className="dash-head">
        <div>
          <span className="eyebrow">{p.streak.activeToday ? 'Good to see you' : 'Welcome back'}</span>
          <h1>{p.rank.title}, level {p.level.level}</h1>
        </div>
      </header>
      <div className="dash-grid">
        <Card tone="primary" as="section" className="dash-continue" aria-labelledby="cont-h">
          {cont && st ? (
            <>
              <WorldToken world={cont.world} size={104} state={st.state} progress={st.frac} />
              <div className="dc-text">
                <span className="eyebrow">Up next · {cont.world.title}</span>
                <h2 id="cont-h">{cont.level.title}</h2>
                <div className="dc-progress">
                  <ProgressBar value={st.frac} size="sm" label={`${cont.world.title}: ${st.done} of ${st.total} levels`} />
                  <span className="tnum">{st.done}/{st.total}</span>
                  <Pill tone="gold" icon="star">{st.stars.earned}/{st.stars.total}</Pill>
                </div>
                <a className="btn primary huge" href={start.href}><Icon name="play" size={20} /> Continue</a>
              </div>
            </>
          ) : (
            <div className="dc-text">
              <span className="eyebrow">Every world is done</span>
              <h2 id="cont-h">Prove something of your own</h2>
              <p className="muted">The Workshop takes a statement from English to a proved Lean theorem.</p>
              <a className="btn primary huge" href={start.href}><Icon name="workshop" size={20} /> Open the Workshop</a>
            </div>
          )}
        </Card>

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
          <p className="dash-big"><span className="tnum">{p.due}</span> <span className="streak-unit">due</span></p>
          <p className="muted small">{p.due ? 'Solving things again a little later is what makes them stick.' : 'Nothing due right now. Finished levels come back on a schedule.'}</p>
          <a className={`btn block ${p.due ? '' : 'outline'}`} href="#/review">{p.due ? 'Start a review session' : 'Open Review'}</a>
        </Card>

        <DailyCard />

        {unread && (
          <Card as="a" href={href.guide(unread.id)} className="dash-guide" aria-label={`Guide: ${unread.title}. ${unread.summary}`}>
            <div className="card-head"><h2><Icon name="guide" size={18} /> From the Guide</h2><Pill icon="clock">{unread.minutes} min</Pill></div>
            <h3>{unread.title}</h3>
            <p className="muted small">{unread.summary}</p>
          </Card>
        )}
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
