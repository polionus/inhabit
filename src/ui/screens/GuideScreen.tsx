/** Stub: replaced by the design agent. Renders `src/content/guide.ts`. */
import { guide, getArticle } from '../../content/guide.ts';
import { Markdown } from '../components/Markdown.tsx';
import { href } from '../router.ts';

export function GuideScreen({ id }: { id?: string }) {
  const a = id ? getArticle(id) : undefined;
  if (a) return <div className="page narrow"><p className="crumb"><a href={href.guide()}>Guide</a> / {a.title}</p><h1>{a.title}</h1><Markdown text={a.body} /></div>;
  return (
    <div className="page narrow">
      <h1>Guide</h1>
      <ul>{guide.map((x) => <li key={x.id}><a href={href.guide(x.id)}>{x.title}</a> <span className="muted">{x.summary}</span></li>)}</ul>
    </div>
  );
}
