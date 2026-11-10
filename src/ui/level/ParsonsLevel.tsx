import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParsonsLevel } from '../../content/types.ts';
import { data } from '../data.ts';
import { useCheck } from '../hooks.tsx';
import { Infoview } from '../components/Infoview.tsx';
import { LeanInline } from '../components/Markdown.tsx';
import { useInfo } from './ProofLevel.tsx';
import type { Run } from './run.ts';

interface Item {
  id: string;
  text: string;
}

function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function shuffleItems(items: Item[], seed: string): Item[] {
  const rnd = seeded(seed + Date.now().toString(36));
  let out = items.slice();
  for (let tries = 0; tries < 8; tries++) {
    out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (items.length < 2 || out.some((x, i) => x.id !== items[i].id)) break;
  }
  return out;
}

export function ParsonsLevelView({ run, level }: { run: Run; level: ParsonsLevel }) {
  const all = useMemo<Item[]>(
    () => [...level.lines, ...(level.distractors ?? [])].map((text, i) => ({ id: `p${i}`, text })),
    [level],
  );
  const [pool, setPool] = useState<Item[]>(() => shuffleItems(all, level.id));
  const [sol, setSol] = useState<Item[]>([]);
  const [sel, setSel] = useState(0);
  const [drag, setDrag] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const runRef = useRef(run);
  runRef.current = run;

  const body = sol.map((x) => x.text).join('\n');
  const { result: checked, pending } = useCheck(body, () => (sol.length ? data.checkBody(run.session, body) : null));
  const result = checked?.result ?? null;
  const bodyOffset = checked?.assembled.bodyOffset ?? 0;
  const lineStart = useMemo(() => {
    let o = 0;
    for (let i = 0; i < Math.min(sel, sol.length - 1); i++) o += sol[i].text.length + 1;
    return o + (sol[sel]?.text.length ?? 0) - (sol[sel]?.text.trimStart().length ?? 0);
  }, [sel, sol]);
  const info = useInfo(result, bodyOffset, body.length, lineStart);

  useEffect(() => {
    if (result?.complete && !pending) runRef.current.complete({ body });
    if (result && !result.ok) runRef.current.attempt();
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const take = (id: string): Item | undefined => {
    const a = pool.find((x) => x.id === id) ?? sol.find((x) => x.id === id);
    return a;
  };
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
    // when moving within the solution, account for the removal shift
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
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.altKey && e.key === 'ArrowUp') (e.preventDefault(), move(i, -1));
    else if (e.altKey && e.key === 'ArrowDown') (e.preventDefault(), move(i, 1));
    else if (e.key === 'Delete' || e.key === 'Backspace') (e.preventDefault(), place(sol[i].id, 'pool'));
  };

  return (
    <>
      <div className="editor-panel parsons">
        <div className="header-ro"><LeanInline code={level.header} /></div>
        <div className="parsons-cols">
          <div
            className="plist solution-list"
            aria-label="Your proof"
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) place(drag, 'end');
              setDrag(null);
            }}
          >
            <div className="label">Your proof</div>
            {sol.length === 0 && <p className="muted small drop-hint">Tap or drag lines here, in order.</p>}
            <ol>
              {sol.map((it, i) => (
                <li
                  key={it.id}
                  className={`pline ${sel === i ? 'sel' : ''} ${drag === it.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => (setDrag(it.id), e.dataTransfer.setData('text/plain', it.id))}
                  onDragEnd={() => setDrag(null)}
                  onDragOver={(e) => drag && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (drag) place(drag, i);
                    setDrag(null);
                  }}
                >
                  <button className="pline-main" onClick={() => setSel(i)} onKeyDown={(e) => onKey(e, i)} aria-label={`Line ${i + 1}: ${it.text.trim()}. Alt plus arrows moves it, Delete returns it to the pool.`}>
                    <span className="lnum">{i + 1}</span>
                    <pre><LeanInline code={it.text} /></pre>
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
            aria-label="Available lines"
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag) place(drag, 'pool');
              setDrag(null);
            }}
          >
            <div className="label">Lines <button className="linkish" onClick={reset}>reset</button></div>
            <ul>
              {pool.map((it) => (
                <li key={it.id} className={`pline ${drag === it.id ? 'dragging' : ''}`} draggable onDragStart={(e) => (setDrag(it.id), e.dataTransfer.setData('text/plain', it.id))} onDragEnd={() => setDrag(null)}>
                  <button className="pline-main" onClick={() => place(it.id, 'end')} aria-label={`Add line: ${it.text.trim()}`}>
                    <pre><LeanInline code={it.text} /></pre>
                  </button>
                </li>
              ))}
              {pool.length === 0 && <li className="muted small">All lines used.</li>}
            </ul>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">{live}</div>
      </div>
      <Infoview
        goals={sol.length ? info.goals : null}
        fallbackGoals={info.fallback}
        diagnostics={sol.length ? info.diags : []}
        complete={!!result?.complete && !pending}
        pending={pending}
        emptyHint="Place a line, then select it to see the goals at that point."
      />
    </>
  );
}
