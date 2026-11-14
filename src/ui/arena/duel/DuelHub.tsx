/** `#/arena/duel`: three ways to play, the bot ladder, and recent duels. */
import { useState } from 'react';
import { DUEL_FORMATS, type DuelFormat } from '../../../arena/plan.ts';
import { BOTS, unlockedBots } from '../../../arena/state/duelBots.ts';
import { Card, EmptyState, Icon, Pill, ScreenHeader } from '../../components/kit.tsx';
import { navigate } from '../../router.ts';
import { NameField } from './Challenge.tsx';
import { Avatar, FormatPicker, nav, useDuelData } from './common.tsx';

const ago = (at: number): string => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60_000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function DuelHub() {
  const [format, setFormat] = useState<DuelFormat>(nav.format);
  const d = useDuelData();
  const open = unlockedBots(d.bots);
  const pick = (f: DuelFormat) => { nav.format = f; setFormat(f); };
  const play = (botId: string) => { nav.bot = { botId, format }; navigate('#/arena/duel/bot'); };

  return (
    <div className="page arena dl-hub">
      <ScreenHeader id="arena-duel" title="Duel" icon="arena" />

      <Card as="section" aria-label="Format and name">
        <h2>Pick a format</h2>
        <FormatPicker value={format} onChange={pick} />
        <NameField />
      </Card>

      <div className="mode-grid dl-modes">
        <Card as="section" aria-label="Friend, live" className="mode-card">
          <div className="mode-head"><span className="mode-icon"><Icon name="arena" size={22} /></span><h2>Friend, live</h2></div>
          <p className="muted">Race a friend on the same puzzles, right now. The two browsers connect directly; you will be told exactly what that means before anything connects.</p>
          <a className="btn primary block" href="#/arena/duel/host" onClick={() => { nav.format = format; }}>Create a room</a>
        </Card>
        <Card as="section" aria-label="Challenge link" className="mode-card">
          <div className="mode-head"><span className="mode-icon"><Icon name="external" size={22} /></span><h2>Challenge link</h2></div>
          <p className="muted">Play the set yourself, then send a link. Your friend plays it whenever they like and sees both results. Works even when a live connection will not.</p>
          <a className="btn primary block" href="#/arena/duel/make" onClick={() => { nav.format = format; }}>Make a challenge</a>
        </Card>
      </div>

      <section aria-label="Bots" className="dl-ladder">
        <h2>Against a bot</h2>
        <p className="muted small">Bots are programs, not people: each is a model of a player of a given rating, with randomness fixed by the duel&apos;s seed. Beat one to unlock the next.</p>
        <ul className="dl-bots">
          {BOTS.map((b, i) => {
            const rec = d.bots[b.id] ?? { w: 0, l: 0, d: 0 };
            const locked = !open.has(b.id);
            return (
              <li key={b.id} className={`dl-bot ${locked ? 'locked' : ''}`}>
                <Avatar bot={b} size={48} />
                <div className="dl-bot-main">
                  <div className="dl-bot-name"><strong>{b.name}</strong> <span className="dl-bot-badge">bot</span> <Pill tone="neutral">{b.rating}</Pill></div>
                  <p className="muted small">{b.blurb}</p>
                  <p className="small tnum">{rec.w + rec.l + rec.d === 0 ? 'Not played yet' : `${rec.w} won, ${rec.l} lost${rec.d ? `, ${rec.d} drawn` : ''}`}</p>
                </div>
                {locked ? (
                  <span className="dl-lock muted small"><Icon name="lock" size={16} /> Beat {BOTS[i - 1].name} to unlock</span>
                ) : (
                  <button className={`btn ${rec.w === 0 ? 'primary' : ''}`} onClick={() => play(b.id)} aria-label={`Play ${b.name}, a bot rated ${b.rating}, ${DUEL_FORMATS[format].title}`}>Play</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Recent duels">
        <h2>Recent duels</h2>
        {d.history.length === 0 ? (
          <EmptyState glyph="⚔" title="No duels yet">Your finished duels appear here.</EmptyState>
        ) : (
          <ul className="dl-history">
            {d.history.slice(0, 10).map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <Pill tone={h.result === 'win' ? 'ok' : h.result === 'loss' ? 'err' : 'neutral'}>{h.result === 'win' ? 'Won' : h.result === 'loss' ? 'Lost' : 'Drew'}</Pill>
                <span className="tnum">{h.me} : {h.them}</span>
                <span>vs {h.name || 'someone'}{h.opponent === 'bot' ? ' (bot)' : h.opponent === 'challenge' ? ' (challenge)' : ''}{h.left ? ', who left' : ''}</span>
                <span className="muted small">{DUEL_FORMATS[h.format].title} · {ago(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
        {d.friend.w + d.friend.l + d.friend.d > 0 && <p className="muted small">Against friends: {d.friend.w} won, {d.friend.l} lost, {d.friend.d} drawn. Friend duels are unrated.</p>}
      </section>
    </div>
  );
}
