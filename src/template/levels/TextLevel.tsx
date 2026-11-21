import { useEffect, useRef, useState } from 'react';
import type { BuiltInTextLevel, LevelRenderProps } from '../types.ts';
import { CodeBlock, Markdown } from '../components/Markdown.tsx';
import { KbdHint } from '../components/KbdHint.tsx';
import { Icon } from '../components/kit.tsx';
import { WhatToProve } from './WhatToProve.tsx';

export function judgeTextLevel(level: BuiltInTextLevel, raw: string): { ok: boolean; feedback?: string } {
  const norm = level.normalize ?? ((s: string) => s.trim());
  const val = norm(raw);
  if (!val) return { ok: false };
  const ok = level.validate ? level.validate(raw) : level.accept.some((a) => norm(a) === val);
  if (ok) return { ok: true };
  if (level.mistakes) {
    for (const m of level.mistakes) {
      if (typeof m.match === 'string' ? norm(m.match) === val : m.match.test(raw.trim())) {
        return { ok: false, feedback: m.feedback };
      }
    }
  }
  return { ok: false, feedback: level.wrongFeedback ?? 'Not quite—compare your answer with the prompt and try again.' };
}

export function TextLevelView(props: LevelRenderProps) {
  const level = props.level as BuiltInTextLevel;
  const [text, setText] = useState(props.initialBody || level.starter || '');
  const [verdict, setVerdict] = useState<{ ok: boolean; feedback?: string } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    props.api.current = {
      insert: (s) => setText((t) => t + s),
      setBody: (s) => setText(s),
    };
  });

  const submit = () => {
    const v = judgeTextLevel(level, text);
    setVerdict(v);
    if (v.ok) propsRef.current.complete({ body: text });
    else propsRef.current.attempt();
  };

  const onChange = (next: string) => {
    setText(next);
    propsRef.current.saveDraft(next);
    if (verdict && !verdict.ok) setVerdict(null);
  };

  return (
    <>
      <div className="editor-panel text-level">
        <WhatToProve english={level.prompt} label="Answer" />
        {level.code && <CodeBlock code={level.code} />}
        {level.multiline ? (
          <textarea
            rows={4}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (text.trim() && !props.solved) submit();
              }
            }}
            placeholder={level.placeholder ?? 'Type your answer…'}
            aria-label="Your answer"
            spellCheck={false}
            style={{ fontSize: `${props.fontSize}px` }}
          />
        ) : (
          <input
            type="text"
            className="wide"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (text.trim() && !props.solved) submit();
              }
            }}
            placeholder={level.placeholder ?? 'Type your answer…'}
            aria-label="Your answer"
            spellCheck={false}
            style={{ fontSize: `${props.fontSize}px` }}
          />
        )}
        <div className="actions">
          <button type="button" className="btn primary" disabled={!text.trim() || props.solved} onClick={submit}>
            Check answer <KbdHint />
          </button>
          {text !== (level.starter ?? '') && !props.solved && (
            <button type="button" className="btn ghost small" onClick={() => onChange(level.starter ?? '')}>
              Reset
            </button>
          )}
        </div>
      </div>
      <section className="infoview" aria-label="Result">
        <div className="info-head">
          <span className="eyebrow">Check</span>
          <span className={`pill info-status ${verdict?.ok ? 'pill-ok' : verdict && !verdict.ok ? 'pill-err' : ''}`}>
            {verdict?.ok ? 'Correct' : verdict ? 'Try again' : 'Ready'}
          </span>
        </div>
        <div className="info-body">
          {verdict?.ok ? (
            <div className="done-state"><span className="check" aria-hidden="true"><Icon name="check" size={16} strokeWidth={3.5} /></span> Correct answer.</div>
          ) : verdict?.feedback ? (
            <div className="feedback wrong" role="status"><Markdown text={verdict.feedback} /></div>
          ) : (
            <p className="muted">Type your answer and press Check (or Enter) to test it.</p>
          )}
        </div>
      </section>
    </>
  );
}
