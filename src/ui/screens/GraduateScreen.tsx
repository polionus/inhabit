import { data } from '../data.ts';
import { Markdown } from '../components/Markdown.tsx';
import { openInRealLean } from '../lean/openInLean.ts';

export function GraduateScreen() {
  const { graduate, phrasebook } = data;
  return (
    <div className="page narrow">
      <h1>Graduate</h1>
      <p className="lede">The game’s engine is a small, faithful slice of Lean. This is how to take what you know into the real thing, with Mathlib.</p>
      <div className="actions">
        <button className="btn primary" onClick={() => openInRealLean('example : 2 + 2 = 4 := rfl')}>Open the real Lean editor</button>
      </div>
      {graduate.length === 0 && <p className="notice">The guide is still being written.</p>}
      {graduate.map((s) => (
        <section key={s.id} className="grad-section">
          <h2>{s.title}</h2>
          <Markdown text={s.body} />
        </section>
      ))}
      {phrasebook.length > 0 && (
        <section>
          <h2>Phrasebook</h2>
          <p className="muted">From the names used in the game to what you will write in Mathlib.</p>
          <div className="table-wrap">
            <table className="phrasebook">
              <thead><tr><th scope="col">In the game</th><th scope="col">In Mathlib</th><th scope="col">Note</th></tr></thead>
              <tbody>
                {phrasebook.map((r, i) => (
                  <tr key={i}><td><code className="inline">{r.game}</code></td><td><code className="inline">{r.mathlib}</code></td><td>{r.note ?? ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
