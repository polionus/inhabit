import { data } from '../data.ts';
import { Markdown } from '../components/Markdown.tsx';
import { openInRealLean } from '../lean/openInLean.ts';
import { EmptyState, Icon, ScreenHeader } from '../components/kit.tsx';

export function GraduateScreen() {
  const { graduate, phrasebook } = data;
  return (
    <div className="page narrow graduate-page">
      <ScreenHeader
        id="graduate"
        title="Graduate"
        icon="graduate"
        actions={<button className="btn primary" onClick={() => openInRealLean('example : 2 + 2 = 4 := rfl')}><Icon name="external" size={18} /> Open the real Lean editor</button>}
      />
      {graduate.length === 0 && <EmptyState icon="graduate" title="This page is still being written" />}
      {graduate.length > 1 && (
        <nav className="grad-toc" aria-label="Sections">
          <ol>{graduate.map((s) => <li key={s.id}><a href="#/graduate" onClick={(e) => { e.preventDefault(); document.getElementById(`grad-${s.id}`)?.scrollIntoView({ block: 'start' }); }}>{s.title}</a></li>)}</ol>
        </nav>
      )}
      {graduate.map((s, i) => (
        <section key={s.id} className="grad-section" id={`grad-${s.id}`} aria-labelledby={`grad-h-${s.id}`}>
          <h2 id={`grad-h-${s.id}`}><span className="grad-n tnum" aria-hidden="true">{i + 1}</span>{s.title}</h2>
          <Markdown text={s.body} className="prose" />
        </section>
      ))}
      {phrasebook.length > 0 && (
        <section>
          <h2 className="section-title"><Icon name="translate" size={20} /> Phrasebook</h2>
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
