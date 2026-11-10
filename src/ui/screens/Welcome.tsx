import { data } from '../data.ts';
import { game, useGame } from '../game.ts';
import { continueLevel } from '../../state/progress.ts';
import { href, navigate } from '../router.ts';

export function Welcome() {
  const levels = useGame((s) => s.save.levels);
  const start = () => {
    game().welcome();
    const id = continueLevel(data.worlds, levels);
    navigate(id ? href.level(id) : href.map());
  };
  return (
    <div className="page narrow welcome">
      <p className="eyebrow">A game about proof</p>
      <h1>Inhabit</h1>
      <p className="lede">In Lean, a statement is a type, and a proof is something that lives in it. You will learn to build those proofs, one small goal at a time, until you can state and prove a theorem of your own.</p>
      <p>Each level shows a goal. You shape the proof until Lean says there is nothing left to prove.</p>
      <div className="actions">
        <button className="btn primary big" onClick={start}>Start level one</button>
        <button className="btn ghost" onClick={() => { game().welcome(); navigate(href.map()); }}>Show me the map first</button>
      </div>
    </div>
  );
}
