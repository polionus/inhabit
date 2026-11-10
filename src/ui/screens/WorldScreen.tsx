import { data } from '../data.ts';
import { useGame } from '../game.ts';
import { bossIndex, canTestOut, levelPlayable, levelState, worldComplete, worldIsEmpty, worldProgress, worldUnlocked } from '../../state/progress.ts';
import { Markdown } from '../components/Markdown.tsx';
import { href } from '../router.ts';

const KIND: Record<string, string> = { proof: 'Proof', parsons: 'Arrange', choice: 'Check', predict: 'Predict', formalize: 'Formalize' };

export function WorldScreen({ id }: { id: string }) {
  const levels = useGame((s) => s.save.levels);
  const w = data.worlds.find((x) => x.id === id);
  if (!w) return <div className="page narrow"><h1>Unknown world</h1><a href={href.map()}>Back to the map</a></div>;
  const unlocked = worldUnlocked(w, data.worlds, levels);
  const pr = worldProgress(w, levels);
  const boss = bossIndex(w);
  const test = canTestOut(w, data.worlds, levels);
  const reqNames = w.requires.map((r) => data.worlds.find((x) => x.id === r)?.title ?? r);
  return (
    <div className="page narrow">
      <p className="crumb"><a href={href.map()}>Map</a> / {w.title}</p>
      <h1>{w.title}</h1>
      <p className="lede">{w.tagline}</p>
      {w.bigIdea && <p className="bigidea"><span className="label">Big idea</span> {w.bigIdea}</p>}
      {w.intro && <Markdown text={w.intro} />}
      {!unlocked && <p className="notice">Finish {reqNames.join(' and ')} first to open this region{boss >= 0 ? ', or beat its boss from there to test out.' : '.'}</p>}
      {worldIsEmpty(w) ? (
        <p className="muted">No levels here yet.</p>
      ) : (
        <>
          <p className="muted">{pr.done} of {pr.total} required levels done{worldComplete(w, levels) ? ' ✓' : ''}.</p>
          {test && unlocked && <p className="notice">Confident? You can <a href={href.level(w.levels[boss].id)}>test out</a>: beat the boss and the rest of this world counts as passed.</p>}
          <ol className="levels">
            {w.levels.map((l, i) => {
              const st = levelState(w, i, data.worlds, levels);
              const p = levels[l.id];
              const playable = levelPlayable(w, i, data.worlds, levels);
              const label = p?.status === 'solved' ? (p.testedOut ? 'Tested out' : p.clean ? 'Solved cleanly' : 'Solved') : p?.status === 'studied' ? 'Studied' : st === 'locked' ? 'Locked' : 'Open';
              const inner = (
                <>
                  <span className="lv-num">{i + 1}</span>
                  <span className="lv-main">
                    <span className="lv-title">{l.title}</span>
                    <span className="lv-meta">{KIND[l.kind]}{l.boss ? ' · boss' : ''}{l.optional ? ' · side-quest' : ''}</span>
                  </span>
                  <span className={`lv-state ${st}`}>{st === 'locked' && playable ? 'Test out' : label}</span>
                </>
              );
              return (
                <li key={l.id} className={`lv ${st}`}>
                  {playable ? <a href={href.level(l.id)} className="lv-link">{inner}</a> : <div className="lv-link disabled" aria-disabled="true">{inner}</div>}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
