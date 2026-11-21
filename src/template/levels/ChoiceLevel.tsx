import { useRef, useState } from 'react';
import type { BuiltInChoiceLevel, LevelRenderProps } from '../types.ts';
import { CodeBlock, Markdown } from '../components/Markdown.tsx';
import { WhatToProve } from './WhatToProve.tsx';
import { useShuffledOrder } from './shuffle.ts';

export function OptionList({
  options,
  order,
  picked,
  selected,
  locked,
  onPick,
}: {
  options: { text: string }[];
  /** Display order: positions -> original option indices. */
  order: number[];
  picked: Record<number, boolean>;
  selected?: number | null;
  locked: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className="options" role="group" aria-label="Options">
      {order.map((i, pos) => {
        const o = options[i];
        const state = picked[i] === undefined ? '' : picked[i] ? 'right' : 'wrong';
        return (
          <button
            key={i}
            data-option-index={i}
            className={`option ${state} ${selected === i ? 'selected' : ''}`}
            aria-pressed={selected === i || picked[i] !== undefined}
            disabled={locked && picked[i] === undefined}
            onClick={() => onPick(i)}
          >
            <span className="optmark" aria-hidden="true">{state === 'right' ? '✓' : state === 'wrong' ? '✗' : String.fromCharCode(65 + pos)}</span>
            <Markdown text={o.text} className="inline-md" />
          </button>
        );
      })}
    </div>
  );
}

export function ChoiceLevelView(props: LevelRenderProps) {
  const level = props.level as BuiltInChoiceLevel;
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [last, setLast] = useState<number | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const done = Object.values(picked).some(Boolean);
  const order = useShuffledOrder(level.id, level.options.length);

  const pick = (i: number) => {
    if (done) return;
    const ok = !!level.options[i].correct;
    setPicked((p) => ({ ...p, [i]: ok }));
    setLast(i);
    if (ok) propsRef.current.complete();
    else propsRef.current.attempt();
  };

  return (
    <>
      <div className="editor-panel choice">
        <WhatToProve english={level.question} label="Question" />
        {level.code && <CodeBlock code={level.code} lang={level.codeLang} />}
        <OptionList options={level.options} order={order} picked={picked} locked={done} onPick={pick} />
        {last !== null && (
          <div className={`feedback ${picked[last] ? 'right' : 'wrong'}`} role="status">
            <Markdown text={level.options[last].feedback} />
          </div>
        )}
      </div>
      <section className="infoview muted-panel" aria-label="Guidance">
        <div className="info-head">
          <span className="eyebrow">Check</span>
          <span className={`pill info-status ${done ? 'pill-ok' : ''}`}>{done ? 'Solved' : 'Choose one'}</span>
        </div>
        <div className="info-body">
          <p className="muted">Pick the option you think is right. Wrong picks explain the idea behind them.</p>
        </div>
      </section>
    </>
  );
}
