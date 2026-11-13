/** `#/arena/duel/bot`: a duel against one rung of the bot ladder. Always labelled as a bot. */
import { useMemo, useState } from 'react';
import { duelSet } from '../../../arena/plan.ts';
import { BOTS, botById, botTimeline, unlockedBots } from '../../../arena/state/duelBots.ts';
import { migrateDuel } from '../../../arena/state/duelStore.ts';
import { arenaStore } from '../../../arena/state/store.ts';
import { EmptyState } from '../../components/kit.tsx';
import { game } from '../../game.ts';
import { navigate } from '../../router.ts';
import { DuelPlay, type DuelEnd } from './DuelPlay.tsx';
import { nav, randomSeed, saveDuel, useMyName } from './common.tsx';

export function BotDuel() {
  const cfg = nav.bot;
  if (!cfg || !botById(cfg.botId)) {
    return (
      <div className="page narrow">
        <EmptyState glyph="⚔" title="Pick an opponent first" action={<a className="btn primary" href="#/arena/duel">Choose a bot</a>}>The duel hub is where you choose a bot and a format.</EmptyState>
      </div>
    );
  }
  return <BotRounds botId={cfg.botId} format={cfg.format} />;
}

function BotRounds({ botId: first, format }: { botId: string; format: 'blitz' | 'standard' | 'proofs' }) {
  const me = useMyName();
  const [botId, setBotId] = useState(first);
  const [round, setRound] = useState(() => ({ n: 0, seed: randomSeed(), startAt: Date.now() + 3500 }));
  const bot = botById(botId)!;
  const puzzles = useMemo(() => duelSet(round.seed, format), [round.seed, format]);
  const timeline = useMemo(() => botTimeline(bot, round.seed, puzzles.map((p) => ({ rating: p.rating, par: p.par, kind: p.kind }))), [bot, round.seed, puzzles]);

  const onEnd = (e: DuelEnd) => {
    const w = e.view.winner;
    saveDuel({ at: Date.now(), opponent: 'bot', name: bot.name, format, seed: round.seed, me: e.view.scores.me, them: e.view.scores.them, result: w === 'me' ? 'win' : w === 'them' ? 'loss' : 'draw' }, bot.id);
    game().recordEvent({ type: 'arena-duel', won: w === 'me', opponent: 'bot' });
  };
  const next = (id: string, keepSeed = false) => { setBotId(id); setRound((r) => ({ n: r.n + 1, seed: keepSeed ? r.seed : randomSeed(), startAt: Date.now() + 3500 })); };

  return (
    <DuelPlay
      key={`${botId}:${round.n}`}
      seed={round.seed}
      format={format}
      puzzles={puzzles}
      mode="bot"
      meName={me}
      opponent={{ name: bot.name, bot }}
      startAt={round.startAt}
      botTimeline={timeline}
      onEnd={onEnd}
      endActions={(e) => {
        const idx = BOTS.findIndex((b) => b.id === botId);
        const nextBot = BOTS[idx + 1];
        const unlocked = unlockedBots(migrateDuel(arenaStore.getState().duel).bots);
        return (
          <>
            <button className="btn primary big" onClick={() => next(botId)}>Rematch (new puzzles)</button>
            {e.view.winner === 'me' && nextBot && unlocked.has(nextBot.id) && <button className="btn gold" onClick={() => next(nextBot.id)}>Face {nextBot.name} ({nextBot.rating})</button>}
            <button className="btn ghost" onClick={() => navigate('#/arena/duel')}>Back to the hub</button>
          </>
        );
      }}
    />
  );
}
