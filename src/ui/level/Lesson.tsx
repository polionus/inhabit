import { useId, useState } from 'react';
import type { LevelLesson } from '../../content/types.ts';
import { game } from '../game.ts';
import { Markdown } from '../components/Markdown.tsx';
import { Icon } from '../components/kit.tsx';

/**
 * The level's lesson: a reading section under the intro. Collapsible; toggling remembers the
 * choice in `settings.lessonsOpen`. Renders nothing when there is no lesson.
 */
export function LessonPanel({ lesson, defaultOpen, remember = true }: { lesson: LevelLesson | undefined; defaultOpen: boolean; remember?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (!lesson) return null;
  const words = (lesson.body + ' ' + (lesson.pitfall ?? '') + ' ' + (lesson.realLean ?? '')).split(/\s+/).length;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (remember) game().setSettings({ lessonsOpen: next });
  };
  return (
    <section className={`lesson ${open ? 'open' : ''}`} aria-labelledby={`${id}-h`}>
      <button type="button" className="lesson-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={toggle}>
        <span className="lesson-badge" aria-hidden="true"><Icon name="book" size={18} /></span>
        <span id={`${id}-h`}>Lesson</span>
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
          {lesson.realLean && (
            <aside className="callout callout-real" aria-label="In real Lean">
              <div className="callout-head"><Icon name="graduate" size={15} /> In real Lean</div>
              <Markdown text={lesson.realLean} />
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
