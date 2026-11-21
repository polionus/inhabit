import { useEffect, useMemo, useRef, useState } from 'react';
import type { BuiltInOrderLevel, LevelRenderProps } from '../types.ts';
import { CodeInline } from '../components/Markdown.tsx';
import { Icon } from '../components/kit.tsx';
import { WhatToProve } from './WhatToProve.tsx';
import { shuffleItems } from './shuffle.ts';

interface Item {
  id: string;
  text: string;
}

export function OrderLevelView(props: LevelRenderProps) {
  const level = props.level as BuiltInOrderLevel;
  const all = useMemo<Item[]>(
    () => [...level.lines, ...(level.distractors ?? [])].map((text, i) => ({ id: `p${i}`, text })),
    [level],
  );
  const [pool, setPool] = useState<Item[]>(() => shuffleItems(all, level.id));
  const [sol, setSol] = useState<Item[]>([]);
  const [sel, setSel] = useState(0);
  const [drag, setDrag] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const propsRef = useRef(props);
  propsRef.current = props;
  const lastErrRef = useRef('');

  const placed = useMemo(() => sol.map((x) => x.text), [sol]);
  const validation = useMemo(() => {
    if (placed.length === 0) return { ok: false, feedback: undefined };
    if (level.validate) return level.validate(placed);
    const exact =
      placed.length === level.lines.length &&
      placed.every((line, i) => line === level.lines[i]);
    if (exact) return { ok: true, feedback: undefined };
    if (placed.length >= level.lines.length) {
      return { ok: false, feedback: 'Not quite in the right order yet—or a distractor slipped in.' };
    }
    return { ok: false, feedback: undefined };
  }, [placed, level]);

  useEffect(() => {
    if (validation.ok) {
      propsRef.current.complete({ body: placed.join('\n') });
    } else if (validation.feedback) {
      const key = placed.join('\n');
      if (lastErrRef.current !== key) {
        lastErrRef.current = key;
        propsRef.current.attempt();
      }
    }
  }, [validation, placed]);

  const take = (id: string): Item | undefined =>
    pool.find((x) => x.id === id) ?? sol.find((x) => x.id === id);

  const place = (id: string, index: number | 'end' | 'pool') => {
    const item = take(id);
    if (!item) return;
    const p = pool.filter((x) => x.id !== id);
    const s = sol.filter((x) => x.id !== id);
    if (index === 'pool') {
      setPool([...p, item]);
      setSol(s);
      setLive(`Moved back to the pool: ${item.text.trim()}`);
      return;
    }
    let at = index === 'end' ? s.length : index;
    const old = sol.findIndex((x) => x.id === id);
    if (old >= 0 && index !== 'end' && old < index) at = index - 1;
    at = Math.max(0, Math.min(at, s.length));
    s.splice(at, 0, item);
    setPool(p);
    setSol(s);
    setSel(at);
    setLive(`Line placed at position ${at + 1} of ${s.length}`);
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sol.length) return;
    const s = sol.slice();
    [s[i], s[j]] = [s[j], s[i]];
    setSol(s);
    setSel(j);
    setLive(`Moved to position ${j + 1} of ${s.length}`);
  };

  const reset = () => {
    setPool(shuffleItems(all, level.id));
    setSol([]);
    setSel(0);
    lastErrRef.current = '';
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      move(i, -1);
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      move(i, 1);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      place(sol[i].id, 'pool');
    }
  };

  return (
    <>
      <div className="editor-panel parsons">
        <WhatToProve english={level.prompt} label="Arrange" />
        <div className="parsons-cols">
          <div
            className="plist solution-list"
            aria-label="Your sequence"
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) place(drag, 'end');
              setDrag(null);
            }}
          >
            <div className="label">Your sequence</div>
            {sol.length === 0 && <p className="muted small drop-hint">Tap or drag items here, in order.</p>}
            <ol>
              {sol.map((it, i) => (
                <li
                  key={it.id}
                  className={`pline ${sel === i ? 'sel' : ''} ${drag === it.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDrag(it.id);
                    e.dataTransfer.setData('text/plain', it.id);
                  }}
                  onDragEnd={() => setDrag(null)}
                  onDragOver={(e) => drag && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (drag) place(drag, i);
                    setDrag(null);
                  }}
                >
                  <button
                    className="pline-main"
                    onClick={() => setSel(i)}
                    onKeyDown={(e) => onKey(e, i)}
                    aria-label={`Item ${i + 1}: ${it.text.trim()}. Alt plus arrows moves it, Delete returns it to the pool.`}
                  >
                    <span className="lnum">{i + 1}</span>
                    <pre><CodeInline code={it.text} lang={level.codeLang} /></pre>
                  </button>
                  <span className="pline-tools">
                    <button className="btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button className="btn small" onClick={() => move(i, 1)} disabled={i === sol.length - 1} aria-label="Move down">↓</button>
                    <button className="btn small" onClick={() => place(it.id, 'pool')} aria-label="Remove">✕</button>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div
            className="plist pool-list"
            aria-label="Available items"
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) place(drag, 'pool');
              setDrag(null);
            }}
          >
            <div className="label">Items <button className="linkish" onClick={reset}>reset</button></div>
            <ul>
              {pool.map((it) => (
                <li
                  key={it.id}
                  className={`pline ${drag === it.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDrag(it.id);
                    e.dataTransfer.setData('text/plain', it.id);
                  }}
                  onDragEnd={() => setDrag(null)}
                >
                  <button className="pline-main" onClick={() => place(it.id, 'end')} aria-label={`Add item: ${it.text.trim()}`}>
                    <pre><CodeInline code={it.text} lang={level.codeLang} /></pre>
                  </button>
                </li>
              ))}
              {pool.length === 0 && <li className="muted small">All items placed.</li>}
            </ul>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">{live}</div>
      </div>
      <section className="infoview" aria-label="Status">
        <div className="info-head">
          <span className="eyebrow">Order</span>
          <span className={`pill info-status ${validation.ok ? 'pill-ok' : validation.feedback ? 'pill-err' : ''}`}>
            {validation.ok ? 'Complete' : validation.feedback ? 'Check order' : `${placed.length} of ${level.lines.length}`}
          </span>
        </div>
        <div className="info-body">
          {validation.ok ? (
            <div className="done-state"><span className="check" aria-hidden="true"><Icon name="check" size={16} strokeWidth={3.5} /></span> Sequence is in the right order.</div>
          ) : validation.feedback ? (
            <div className="feedback wrong">{validation.feedback}</div>
          ) : (
            <p className="muted">Build the sequence on the left. Tap items to add or reorder them.</p>
          )}
        </div>
      </section>
    </>
  );
}
