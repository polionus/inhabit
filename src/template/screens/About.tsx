import { useDisc } from '../context.tsx';
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

export function AboutScreen() {
  const disc = useDisc();
  const { about, home } = disc;
  const start = useStartTarget();
  const worlds = disc.worlds.length;
  const levels = disc.worlds.reduce((n, w) => n + w.levels.length, 0);
  const tiles = about.glanceTiles ?? [
    { n: String(worlds), label: worlds === 1 ? 'chapter of focused practice' : 'chapters of focused practice' },
    { n: String(levels), label: 'levels from concepts to mastery' },
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
          <li key={t.n + t.label}><span className="ag-n tnum">{t.n}</span><span className="ag-l">{t.label}</span></li>
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
          {about.sections.map((s) => {
            const ins = about.sectionInserts?.[s.id];
            const Before = ins?.before;
            const After = ins?.after;
            return (
              <Card as="section" key={s.id} className="about-sec" aria-labelledby={`about-${s.id}`}>
                <h2 id={`about-${s.id}`} tabIndex={-1}>{s.title}</h2>
                {Before && <Before />}
                <Markdown text={s.body} />
                {After && <After />}
              </Card>
            );
          })}
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
