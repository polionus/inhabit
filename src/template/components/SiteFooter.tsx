import { useDisc } from '../context.tsx';
import { href } from '../router.ts';

export function SiteFooter() {
  const { brand } = useDisc();
  const links = brand.footerLinks ?? [];
  return (
    <footer className="site-footer">
      <p>
        {links.map((l) => (
          <span key={l.label}>
            <a
              href={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noopener noreferrer' : undefined}
            >
              {l.label}
            </a>
            <span aria-hidden="true"> · </span>
          </span>
        ))}
        <a href={href.about()}>About</a>
      </p>
      {brand.footerNote && <p className="muted small">{brand.footerNote}</p>}
    </footer>
  );
}
