/**
 * `#/practice/translate`: an English sentence, the learner types the Lean statement, the engine
 * compares it with the reference by definitional equality. Sets of five, ratings rising.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../engine/index.ts';
import { checkTranslation, translateSet, type TranslateItem, type Verdict } from '../../arena/translate.ts';
import { Card, EmptyState, ProgressBar, celebrate, sfx } from '../components/kit.tsx';
import { DiagnosticItem } from '../components/Infoview.tsx';
import { Lean, LeanInline } from '../components/Markdown.tsx';
import { SymbolBar } from '../components/SymbolBar.tsx';
import { game, useGame } from '../game.ts';
import { useDebounced } from '../hooks.tsx';
import { Editor, toEditorDiags, type EditorHandle } from '../lean/Editor.tsx';
import { mapDiagnostics } from '../lean/offsets.ts';
import { href } from '../router.ts';

const SLIP: Record<string, string> = {
  converse: 'This looks like the converse: the two sides of the arrow are the wrong way round.',
  'and-for-implies': 'This looks like “and” where “implies” was meant. “Every x with p x has q x” is a statement about the x that have p x, not about all x.',
};

type Mark = 'right' | 'reviewed' | 'shown' | 'skipped';

export function TranslateScreen() {
  const [round, setRound] = useState(0);
  const [items, setItems] = useState<TranslateItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [finished, setFinished] = useState(false);
  const recorded = useRef(-1);

  useEffect(() => {
    setItems(null);
    setIndex(0);
    setMarks([]);
    setFinished(false);
    const t = setTimeout(() => {
      try {
        setItems(translateSet(round));
      } catch {
        setItems([]);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [round]);

  const finish = (m: Mark) => {
    if (!items) return;
    const all = [...marks, m];
    setMarks(all);
    if (index + 1 < items.length) setIndex(index + 1);
    else {
      setFinished(true);
      if (recorded.current !== round) {
        recorded.current = round;
        game().recordEvent({ type: 'practice', kind: 'translate', solved: all.filter((x) => x === 'right').length, total: items.length });
      }
    }
  };

  const head = (
    <header className="practice-head">
      <div className="eyebrow">Practice</div>
      <h1>Translate</h1>
      <p className="muted">Read the sentence, then write the Lean statement it says. You are stating, not proving.</p>
      <p className="muted small">
        The English here is a careful literal reading of the Lean, so word order matters: <code className="inline">P ∧ Q</code> and <code className="inline">Q ∧ P</code> are different statements.
        Equivalent ways of writing it are accepted too, such as <code className="inline">(P ∧ Q) → R</code> for <code className="inline">P → Q → R</code>.
      </p>
    </header>
  );

  if (items && items.length === 0) {
    return (
      <div className="page narrow practice">
        <EmptyState icon="map" title="No statements right now" action={<a className="btn primary" href={href.map()}>Back to the map</a>}>Something went wrong making this set.</EmptyState>
      </div>
    );
  }
  if (!items) return <div className="page narrow practice">{head}<p className="muted" role="status">Preparing sentences…</p></div>;

  if (finished) {
    const right = marks.filter((m) => m === 'right').length;
    return (
      <div className="page narrow practice">
        {head}
        <Card tone={right === items.length ? 'ok' : 'default'} className="practice-end">
          <h2 data-testid="practice-result">You wrote {right} of {items.length} correctly</h2>
          {marks.includes('reviewed') && <p className="muted small">Statements you judged equivalent without the checker confirming them are not counted as solved.</p>}
          <p>{right === items.length ? 'Reading a sentence as a statement is most of formalising.' : 'The ones you looked up are worth another read: compare the shape of the sentence with the shape of the statement.'}</p>
          <div className="practice-actions">
            <button className="btn primary" onClick={() => setRound(round + 1)}>Another set</button>
            <a className="btn" href={href.arena()}>Back to the Arena</a>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page narrow practice">
      {head}
      <div className="practice-progress">
        <span className="small tnum"><strong>{index + 1}</strong> of {items.length}</span>
        <ProgressBar value={index / items.length} size="xs" label={`Statement ${index + 1} of ${items.length}`} />
      </div>
      <Statement key={items[index].puzzle.id} item={items[index]} last={index + 1 === items.length} onFinish={finish} />
    </div>
  );
}

function Statement({ item, last, onFinish }: { item: TranslateItem; last: boolean; onFinish(m: Mark): void }) {
  const { task, puzzle } = item;
  const env = useMemo(() => engine.baseEnv(), []);
  const fontSize = useGame((s) => s.save.settings.fontSize);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [shown, setShown] = useState(false);
  const editor = useRef<EditorHandle>(null);
  const [resolved, setResolved] = useState<'same' | 'different' | null>(null);
  const accepted = verdict?.kind === 'right' || verdict?.kind === 'equivalent';
  const done = accepted || shown || resolved !== null;
  const unsure = verdict?.kind === 'different' && !verdict.slip && resolved === null && !shown;

  const dText = useDebounced(text, 150);
  const live = useMemo(() => {
    if (!dText.trim()) return null;
    try {
      return engine.elab(env, dText, task.binders || undefined);
    } catch {
      return null;
    }
  }, [env, dText, task.binders]);
  const liveDiags = live && !live.ok ? mapDiagnostics(live.diagnostics, 0, text.length) : [];

  const check = () => {
    let v: Verdict;
    try {
      v = checkTranslation(env, task, text);
    } catch (e) {
      v = { kind: 'error', message: String(e) };
    }
    setVerdict(v);
    if (v.kind === 'right' || v.kind === 'equivalent') {
      celebrate('tick');
      sfx.play('correct');
    } else sfx.play('wrong');
  };

  return (
    <div className="translate">
      <Card className="translate-english">
        <div className="eyebrow">Say this in Lean</div>
        <p className="translate-sentence" data-testid="english">{puzzle.english}</p>
        {task.binders && (
          <div className="translate-scope">
            <span className="label small muted">In scope</span>
            <LeanInline code={task.binders} />
          </div>
        )}
      </Card>

      <div className="editor-panel formalize">
        <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
        <Editor
          ref={editor}
          value={text}
          onChange={(v) => {
            setText(v);
            if (verdict && !accepted) setVerdict(null);
          }}
          diagnostics={toEditorDiags(liveDiags)}
          fontSize={fontSize}
          ariaLabel="Your Lean statement"
          placeholder="Write a Lean proposition…"
          className="small-editor"
        />
        <div className="actions">
          <button className="btn primary" disabled={!text.trim() || done} onClick={check}>Check</button>
          <button className="btn" disabled={done} onClick={() => setShown(true)}>Show a correct statement</button>
        </div>
      </div>

      <div className="translate-feedback" role="status" aria-live="polite">
        {live?.ok && !verdict && <p className="muted small">Lean reads this as <LeanInline code={live.pretty ?? text} /></p>}
        {live && !live.ok && !verdict && <ul className="diags">{liveDiags.map((d, i) => <DiagnosticItem key={i} d={d} />)}</ul>}
        {verdict?.kind === 'right' && <div className="feedback right"><strong>Yes.</strong> That says the same thing as the reference statement.</div>}
        {verdict?.kind === 'equivalent' && <div className="feedback right"><strong>Yes.</strong> {verdict.note}</div>}
        {verdict?.kind === 'error' && <div className="feedback wrong">Lean could not read that as a proposition yet. {verdict.message}</div>}
        {verdict?.kind === 'not-prop' && <div className="feedback wrong">That is a well-formed term, but its type is <LeanInline code={verdict.type} />, not <code className="inline">Prop</code>. A statement must be a proposition.</div>}
        {verdict?.kind === 'different' && (
          <div className="feedback wrong">
            <strong>Not quite.</strong> That is a different statement from the one in the sentence.
            {verdict.slip && <> {SLIP[verdict.slip]}</>}
            <span className="muted small"> Reread the sentence and try again, or look at a correct statement.</span>
          </div>
        )}
        {unsure && (
          <div className="feedback neutral">
            <p><strong>Well-typed, but I cannot confirm it means the same.</strong> I only compare against the statement and a set of known rewrites, so yours might still be right. Compare the two:</p>
            <div className="formalize-compare">
              <div><div className="label small muted">Yours</div><Lean code={text.trim()} /></div>
              <div><div className="label small muted">Reference</div><Lean code={task.reference} /></div>
            </div>
            <p className="small">Be honest with yourself: do they say the same thing?</p>
            <div className="practice-actions">
              <button className="btn" onClick={() => setResolved('same')}>Mine says the same thing</button>
              <button className="btn" onClick={() => setResolved('different')}>I see the difference</button>
            </div>
          </div>
        )}
        {resolved === 'same' && <div className="feedback"><strong>Noted.</strong> The checker could not confirm that yours is equivalent, so this one does not count as solved. If it is, you read the sentence well.</div>}
        {resolved === 'different' && (
          <div className="feedback">
            <strong>A correct statement</strong>
            <Lean code={task.reference} />
          </div>
        )}
        {shown && (
          <div className="feedback">
            <strong>A correct statement</strong>
            <Lean code={task.reference} />
          </div>
        )}
      </div>

      {done && (
        <div className="practice-actions">
          <button className="btn primary" autoFocus onClick={() => onFinish(accepted ? 'right' : resolved === 'same' ? 'reviewed' : 'shown')}>{last ? 'See how you did' : 'Next sentence'}</button>
        </div>
      )}
      {!done && (
        <div className="practice-actions">
          <button className="btn quiet" onClick={() => onFinish('skipped')}>Skip this one</button>
        </div>
      )}
    </div>
  );
}
