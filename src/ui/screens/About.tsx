import { about, home } from '../../content/site.ts';
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
  const start = useStartTarget();
  return (
    <div className="page about">
      <header className="about-head">
        <h1>{about.title}</h1>
        <div className="about-lede"><Markdown text={about.lede} /></div>
      </header>
      <nav className="toc" aria-label="On this page">
        <span className="label">On this page</span>
        <ol>
          {about.sections.map((s) => (
            <li key={s.id}><a href={`#/about`} onClick={(e) => { e.preventDefault(); jump(s.id); }}>{s.title}</a></li>
          ))}
          {about.faq.length > 0 && <li><a href="#/about" onClick={(e) => { e.preventDefault(); jump('faq'); }}>Questions</a></li>}
          <li><a href="#/about" onClick={(e) => { e.preventDefault(); jump('credits'); }}>Credits</a></li>
        </ol>
      </nav>
      <div className="about-body">
        {about.sections.map((s) => (
          <section key={s.id} className="about-sec" aria-labelledby={`about-${s.id}`}>
            <h2 id={`about-${s.id}`} tabIndex={-1}>{s.title}</h2>
            <Markdown text={s.body} />
          </section>
        ))}
        {about.faq.length > 0 && (
          <section className="about-sec" aria-labelledby="about-faq">
            <h2 id="about-faq" tabIndex={-1}>Questions</h2>
            <div className="faq">
              {about.faq.map((f, i) => (
                <details key={i}>
                  <summary>{f.q}</summary>
                  <Markdown text={f.a} />
                </details>
              ))}
            </div>
          </section>
        )}
        <section className="about-sec" aria-labelledby="about-credits">
          <h2 id="about-credits" tabIndex={-1}>Credits</h2>
          <Markdown text={about.credits} />
        </section>
        <section className="about-cta">
          <StartLink start={start} startLabel={home.closing.cta} continueLabel={home.hero.continueLabel} />
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}
