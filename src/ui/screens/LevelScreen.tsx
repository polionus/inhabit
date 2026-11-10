import { useEffect } from 'react';
import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { levelPlayable, nextAfter } from '../../state/progress.ts';
import { LevelPlayer } from '../level/LevelPlayer.tsx';
import { href, navigate } from '../router.ts';

export function LevelScreen({ id }: { id: string }) {
  const levels = useGame((s) => s.save.levels);
  const found = data.findLevel(id);
  useEffect(() => {
    if (found) game().visitLevel(id);
  }, [id, found]);
  if (!found) return <div className="page narrow"><h1>Unknown level</h1><a href={href.map()}>Back to the map</a></div>;
  const { world, index } = found;
  if (!levelPlayable(world, index, data.worlds, levels)) {
    return (
      <div className="page narrow">
        <h1>Not yet</h1>
        <p>Finish the levels before this one first.</p>
        <a className="btn" href={href.world(world.id)}>Back to {world.title}</a>
      </div>
    );
  }
  const next = nextAfter(world, index, data.worlds, levels);
  const go = () => {
    if (next.kind === 'level') navigate(href.level(next.levelId!));
    else navigate(href.world(world.id));
  };
  const label = next.kind === 'level' ? 'Next level' : next.kind === 'world-complete' ? 'World complete: back to the region' : 'Back to the region';
  return <LevelPlayer key={id} levelId={id} mode="play" onNext={go} nextLabel={label} />;
}
