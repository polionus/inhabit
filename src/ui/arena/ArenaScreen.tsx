import { game } from '../game.ts';
import { setArenaEventSink } from '../../arena/state/store.ts';
import { DailyScreen } from './DailyScreen.tsx';
import { Hub } from './Hub.tsx';
import { RatedScreen } from './RatedScreen.tsx';
import { RushScreen } from './RushScreen.tsx';
import { DuelRoutes } from './duel/DuelRoutes.tsx';
import { EmptyState } from '../components/kit.tsx';

// Arena results become XP, quests and badges in the main game store.
setArenaEventSink((e) => game().recordEvent(e));

/** `#/arena`, `#/arena/<sub>`, `#/arena/<sub>/<arg>`. */
export function ArenaScreen({ sub, arg }: { sub?: string; arg?: string }) {
  switch (sub) {
    case undefined:
    case '':
      return <Hub />;
    case 'daily':
      return <DailyScreen />;
    case 'puzzles':
      return <RatedScreen />;
    case 'rush':
      return <RushScreen />;
    case 'duel':
    case 'live':
    case 'challenge':
      return <DuelRoutes sub={sub} arg={arg} />;
    default:
      return (
        <div className="page narrow">
          <EmptyState glyph="?" title="Nothing here" action={<a className="btn primary" href="#/arena">Back to the Arena</a>}>That Arena page does not exist.</EmptyState>
        </div>
      );
  }
}
