import { about, aboutGoalExample, aboutLevelParts, aboutSymbols, aboutSymbolsNote, home } from '../../content/site.ts';
import { data } from '../data.ts';
import { href } from '../router.ts';
import { Card, Icon } from '../components/kit.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { StartLink, useStartTarget } from '../components/Start.tsx';

function jump(id: string) {
  const el = document.getElementById(`about-${id}`);
  if (!el) return;
  const reduce =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-motion') === 'reduce';
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

function LevelFigure() {
  return (
    <>
      <ol className="about-steps">
        {aboutLevelParts.map((p, i) => (
          <li key={p.name}>
            <span className="about-step-n" aria-hidden="true">{i + 1}</span>
            <div><strong>{p.name}</strong><Markdown text={p.text} /></div>
          </li>
        ))}
      </ol>
      <figure className="about-goal">
        <div className="about-goal-box">
          <div className="about-goal-facts">
            {aboutGoalExample.facts.map((f) => <code key={f}>{f}</code>)}
          </div>
          <code className="about-goal-target">{aboutGoalExample.goal}</code>
        </div>
        <figcaption>
          <span><b>Above the line:</b> {aboutGoalExample.factsNote.toLowerCase()}.</span>
          <span><b>After the turnstile:</b> {aboutGoalExample.goalNote.toLowerCase()}.</span>
        </figcaption>
      </figure>
    </>
  );
}

function SymbolTable() {
  return (
    <>
      <div className="about-table-wrap">
        <table className="about-table">
          <caption className="sr-only">Abbreviations for common symbols</caption>
          <thead><tr><th scope="col">Type</th><th scope="col">You get</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            {aboutSymbols.map((r) => (
              <tr key={r.typed}><td><code>{r.typed}</code></td><td className="sym">{r.symbol}</td><td>{r.meaning}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Markdown text={aboutSymbolsNote} />
    </>
  );
}

export function AboutScreen() {
  const start = useStartTarget();
  const worlds = data.worlds.length;
  const levels = data.worlds.reduce((n, w) => n + w.levels.length, 0);
  const tiles = [
    { n: String(worlds), label: 'chapters, from types to a full formal proof' },
    { n: String(levels), label: 'levels in five kinds, from reading to writing' },
    { n: 'Lean', label: 'every reference solution is compiled by real Lean 4' },
    { n: 'Free', label: 'runs in your browser: no install, no account' },
  ];
  const nav = [
    ...about.sections.map((s) => ({ id: s.id, title: s.title })),
    ...(about.faq.length > 0 ? [{ id: 'faq', title: 'Questions' }] : []),
    { id: 'credits', title: 'Credits' },
  ];
  return (
    <div className="page wide about">
      <header className="about-hero">
        <h1>{about.title}</h1>
        <div className="about-lede"><Markdown text={about.lede} /></div>
        <div className="about-cta-row">
          <StartLink start={start} startLabel={home.closing.cta} continueLabel={home.hero.continueLabel} />
          <a className="btn outline" href={href.map()}><Icon name="map" size={16} /> See the roadmap</a>
        </div>
      </header>

      <ul className="about-glance" aria-label="At a glance">
        {tiles.map((t) => (
          <li key={t.n}><span className="ag-n tnum">{t.n}</span><span className="ag-l">{t.label}</span></li>
        ))}
      </ul>

      <div className="about-grid">
        <nav className="about-nav" aria-label="On this page">
          <span className="eyebrow">On this page</span>
          <ol>
            {nav.map((s) => (
              <li key={s.id}><a href="#/about" onClick={(e) => { e.preventDefault(); jump(s.id); }}>{s.title}</a></li>
            ))}
          </ol>
        </nav>
        <div className="about-body">
          {about.sections.map((s) => (
            <Card as="section" key={s.id} className="about-sec" aria-labelledby={`about-${s.id}`}>
              <h2 id={`about-${s.id}`} tabIndex={-1}>{s.title}</h2>
              {s.id === 'how-a-level-works' && <LevelFigure />}
              <Markdown text={s.body} />
              {s.id === 'typing-symbols' && <SymbolTable />}
            </Card>
          ))}
          {about.faq.length > 0 && (
            <Card as="section" className="about-sec" aria-labelledby="about-faq">
              <h2 id="about-faq" tabIndex={-1}>Questions</h2>
              <div className="faq">
                {about.faq.map((f, i) => (
                  <details key={i}>
                    <summary>{f.q}</summary>
                    <Markdown text={f.a} />
                  </details>
                ))}
              </div>
            </Card>
          )}
          <section className="about-sec about-credits" aria-labelledby="about-credits">
            <h2 id="about-credits" tabIndex={-1}>Credits</h2>
            <Markdown text={about.credits} />
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
