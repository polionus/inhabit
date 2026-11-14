/** Routes for duels: `#/arena/duel[/bot|host|make]`, `#/arena/live/<roomId>`, `#/arena/challenge/<code>`. */
import { EmptyState } from '../../components/kit.tsx';
import { BotDuel } from './BotDuel.tsx';
import { ChallengeScreen, MakeChallenge } from './Challenge.tsx';
import { DuelHub } from './DuelHub.tsx';
import { HostScreen, JoinScreen } from './LiveDuel.tsx';

export function DuelRoutes({ sub, arg }: { sub: string; arg?: string }) {
  if (sub === 'live') return <JoinScreen key={arg} roomId={arg} />;
  if (sub === 'challenge') return <ChallengeScreen key={arg} code={arg} />;
  switch (arg) {
    case undefined:
    case '':
      return <DuelHub />;
    case 'bot':
      return <BotDuel />;
    case 'host':
      return <HostScreen />;
    case 'make':
      return <MakeChallenge />;
    default:
      return <div className="page narrow"><EmptyState glyph="?" title="Nothing here" action={<a className="btn primary" href="#/arena/duel">Back to duels</a>}>That duel page does not exist.</EmptyState></div>;
  }
}
