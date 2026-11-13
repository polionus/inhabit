import { dailyNumber, utcDateKey } from '../../arena/plan.ts';
import { RUSH_MODES, RUSH_TITLE, streakOn } from '../../arena/state/model.ts';
import { arenaStore, useArena } from '../../arena/state/store.ts';
import { Card, Icon, Pill, ScreenHeader } from '../components/kit.tsx';
import { useGame } from '../game.ts';
import { href } from '../router.ts';
import { hms, nextUtcMidnight, Sparkline, useNow } from './parts.tsx';

export function Hub() {
  const rating = useArena((s) => s.rating);
  const peak = useArena((s) => s.peak);
  const rated = useArena((s) => s.rated);
  const solved = useArena((s) => s.solved);
  const history = useArena((s) => s.history);
  const bests = useArena((s) => s.rush.bests);
  const name = useArena((s) => s.displayName);
  const now = useNow(1000);
  const today = utcDateKey(now);
  const todayRes = useArena((s) => s.daily[today]);
  const streak = useArena((s) => streakOn(s, today));
  const passed = useGame((s) => Object.values(s.save.levels).filter((l) => l.status === 'solved' || l.status === 'studied').length);
  const done = todayRes?.completed === true;
  const partial = !done && todayRes && todayRes.marks.length > 0;

  return (
    <div className="page arena">
      <ScreenHeader id="arena" title="Arena" icon="arena" />

      {passed < 10 && (
        <p className="notice" role="note">
          The Arena assumes the tactics from the first three worlds, and you have passed {passed} {passed === 1 ? 'level' : 'levels'} so far. You can play anyway; <a href={href.map()}>the map</a> is the better place to start.
        </p>
      )}

      <Card className="rating-card" tone="primary" aria-label="Your rating">
        <div className="rating-main">
          <div className="eyebrow">Arena rating</div>
          <div className="rating-num tnum" data-testid="rating">{rating}</div>
          <div className="rating-sub muted small">
            {rated > 0 ? <>Peak <strong className="tnum">{peak}</strong> · <strong className="tnum">{solved}</strong> solved of <strong className="tnum">{rated}</strong></> : 'Starts at 800. Play a rated puzzle to set it.'}
          </div>
        </div>
        <div className="rating-chart"><Sparkline points={history.map((h) => h.r)} /></div>
      </Card>

      <div className="mode-grid">
        <Card className="mode-card" as="section" aria-label="Daily Proof">
          <div className="mode-head"><span className="mode-icon"><Icon name="calendar" size={22} /></span><h2>Daily Proof</h2></div>
          <p className="muted">#{dailyNumber(today)} · the same three puzzles for everyone today.</p>
          <div className="mode-stats">
            {done ? <Pill tone="ok" icon="check-circle">Done</Pill> : partial ? <Pill tone="gold">{todayRes!.marks.length} of 3</Pill> : <Pill>Not started</Pill>}
            <Pill tone={streak ? 'flame' : 'neutral'} icon="flame" title="Consecutive days completed (UTC)">{streak} {streak === 1 ? 'day' : 'days'}</Pill>
            <span className="muted small tnum">{done ? 'next in' : 'ends in'} {hms(nextUtcMidnight(now) - now)}</span>
          </div>
          <a className="btn primary block" href="#/arena/daily">{done ? 'See result' : partial ? 'Continue' : 'Play today'}</a>
        </Card>

        <Card className="mode-card" as="section" aria-label="Rated puzzles">
          <div className="mode-head"><span className="mode-icon"><Icon name="target" size={22} /></span><h2>Rated puzzles</h2></div>
          <p className="muted">Endless puzzles near your rating. Solving raises it; a miss or a skip lowers it.</p>
          <div className="mode-stats"><Pill>{rated > 0 ? `${rating} rating` : 'unrated'}</Pill></div>
          <a className="btn primary block" href="#/arena/puzzles">Play</a>
        </Card>

        <Card className="mode-card" as="section" aria-label="Proof Rush">
          <div className="mode-head"><span className="mode-icon"><Icon name="bolt" size={22} /></span><h2>Proof Rush</h2></div>
          <p className="muted">Quick questions, one after another. 3 minutes, 5 minutes, or three strikes.</p>
          <div className="mode-stats">
            {RUSH_MODES.map((m) => <Pill key={m} tone={bests[m] ? 'gold' : 'neutral'} title={`Best in ${RUSH_TITLE[m]}`}>{RUSH_TITLE[m]} {bests[m]}</Pill>)}
          </div>
          <a className="btn primary block" href="#/arena/rush">Play</a>
        </Card>

        <Card className="mode-card" as="section" aria-label="Duel">
          <div className="mode-head"><span className="mode-icon"><Icon name="crown" size={22} /></span><h2>Duel</h2></div>
          <p className="muted">Race a bot, or a friend on the same puzzles.</p>
          <div className="mode-stats"><Pill>bots · live · challenge link</Pill></div>
          <a className="btn primary block" href="#/arena/duel">Duel</a>
        </Card>
      </div>

      <div className="hub-foot">
        <NameField name={name} />
        <p className="muted small honour">
          There is no server, so your rating and results are on the honour system: they live in this browser and are included when you export your save. Nothing here is a ranking of real players.
        </p>
      </div>
    </div>
  );
}

function NameField({ name }: { name: string }) {
  return (
    <label className="name-field">
      <span className="eyebrow">Display name</span>
      <input
        type="text"
        maxLength={20}
        value={name}
        placeholder="Shown to friends in duels"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => arenaStore.getState().setDisplayName(e.target.value)}
      />
    </label>
  );
}
