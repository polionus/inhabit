import { href } from '../router.ts';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <a href="https://github.com/polionus/inhabit" target="_blank" rel="noopener noreferrer">Open source (MIT)</a>
        <span aria-hidden="true"> · </span>
        <a href={href.about()}>About</a>
      </p>
      <p className="muted small">Independent project, not affiliated with the Lean developers.</p>
    </footer>
  );
}
