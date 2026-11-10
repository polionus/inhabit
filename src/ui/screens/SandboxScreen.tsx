import { useEffect, useMemo, useRef, useState } from 'react';
import { data, engine } from '../data.ts';
import { game, useGame } from '../game.ts';
import { useCheck } from '../hooks.tsx';
import { Editor, toEditorDiags, type EditorHandle } from '../lean/Editor.tsx';
import { mapDiagnostics } from '../lean/offsets.ts';
import { openInRealLean } from '../lean/openInLean.ts';
import { Infoview } from '../components/Infoview.tsx';
import { SymbolBar } from '../components/SymbolBar.tsx';
import { useInfo } from '../level/ProofLevel.tsx';

export function SandboxScreen() {
  const saved = useGame((s) => s.save.sandbox);
  const fontSize = useGame((s) => s.save.settings.fontSize);
  const [text, setText] = useState(saved);
  const [cursor, setCursor] = useState(text.length);
  const editor = useRef<EditorHandle>(null);
  const env = useMemo(() => data.fullEnv(), []);
  const { result, pending } = useCheck(text, () => engine.check(env, text));
  const info = useInfo(result, 0, text.length, cursor);
  useEffect(() => {
    const id = setTimeout(() => game().setSandbox(text), 400);
    return () => clearTimeout(id);
  }, [text]);
  const outputs = (result?.diagnostics ?? []).filter((d) => d.code === 'command-output');
  const diags = info.diags.filter((d) => d.code !== 'command-output');
  return (
    <div className="page wide sandbox">
      <div className="page-head">
        <div>
          <h1>Sandbox</h1>
          <p className="muted">Everything is unlocked. Try <code className="inline">#check</code>, <code className="inline">#eval</code>, any tactic.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => openInRealLean(text)}>Open in real Lean</button>
          <button className="btn ghost" onClick={() => setText('')}>Clear</button>
        </div>
      </div>
      <div className="sandbox-grid">
        <div className="editor-panel">
          <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
          <Editor ref={editor} value={text} onChange={setText} onCursor={setCursor} diagnostics={toEditorDiags(mapDiagnostics(result?.diagnostics ?? [], 0, text.length))} fontSize={fontSize} ariaLabel="Sandbox editor" cursor={0} />
        </div>
        <div className="sandbox-side">
          {outputs.length > 0 && (
            <section className="outputs" aria-label="Command output">
              <div className="label">Output</div>
              {outputs.map((o, i) => <pre key={i} className="raw out">{o.message}</pre>)}
            </section>
          )}
          <Infoview goals={info.goals} fallbackGoals={info.fallback} diagnostics={diags} complete={false} pending={pending} onInsert={(n) => editor.current?.insert(n)} emptyHint="Put the cursor inside a proof to see its goals." />
        </div>
      </div>
      <p className="muted small">Names that exist only in the game may need adjusting in real Lean (it opens with Mathlib).</p>
    </div>
  );
}
