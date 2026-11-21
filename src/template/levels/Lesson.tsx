import { useId, useState } from 'react';
import type { TemplateLesson } from '../types.ts';
import { FirstSteps } from './FirstSteps.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { Icon } from '../components/kit.tsx';

/** First sentence of a lesson, as plain text for the collapsed bar. */
export function lessonTeaser(body: string): string {
  const para = body.split(/\n\s*\n/).find((p) => p.trim() && !/^\s*(```|#|\||- |\d+\. )/.test(p)) ?? '';
  const plain = para.replace(/\s+/g, ' ').replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
  const m = /^.*?[.!?:](?=\s|$)/.exec(plain);
  return m ? m[0] : plain;
}

export function LessonPanel({
  lesson,
  defaultOpen,
  nudge = false,
}: {
  lesson: TemplateLesson | undefined;
  defaultOpen: boolean;
  remember?: boolean;
  nudge?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (!lesson) return <FirstSteps />;
  const extra = lesson.extraCallout;
  const words = (lesson.body + ' ' + (lesson.pitfall ?? '') + ' ' + (extra?.body ?? '')).split(/\s+/).length;
  const toggle = () => setOpen(!open);
  const teaser = lessonTeaser(lesson.body);
  const pulse = nudge && !open;
  return (
    <>
      <FirstSteps />
      <section className={`lesson ${open ? 'open' : ''} ${pulse ? 'nudge' : ''}`} aria-labelledby={`${id}-h`}>
        <button type="button" className="lesson-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={toggle}>
          <span className="lesson-badge" aria-hidden="true"><Icon name="book" size={18} /></span>
          <span id={`${id}-h`} className="lesson-label">{pulse ? 'Stuck? The lesson covers this' : 'Lesson'}</span>
          {!open && teaser && <span className="lesson-teaser">{teaser}</span>}
          <span className="lesson-meta">{Math.max(1, Math.round(words / 200))} min read</span>
          <Icon name="chevron-down" size={18} className="chev" />
        </button>
        {open && (
          <div className="lesson-body" id={`${id}-body`}>
            <Markdown text={lesson.body} className="prose compact" />
            {lesson.pitfall && (
              <aside className="callout callout-pitfall" aria-label="Watch out">
                <div className="callout-head"><Icon name="warn" size={15} /> Watch out</div>
                <Markdown text={lesson.pitfall} />
              </aside>
            )}
            {extra && (
              <aside className="callout callout-real" aria-label={extra.label}>
                <div className="callout-head"><Icon name={extra.icon ?? 'graduate'} size={15} /> {extra.label}</div>
                <Markdown text={extra.body} />
              </aside>
            )}
          </div>
        )}
      </section>
    </>
  );
}
