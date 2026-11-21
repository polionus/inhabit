import { useEffect, useMemo, useRef, useState } from 'react';
import { game, useGame } from '../../../template/store.ts';
import { useCheck } from '../../../template/hooks.tsx';
import { Icon, ScreenHeader } from '../../../template/components/kit.tsx';
import { getLeanRuntime } from '../context.ts';
import { dataForEverything, hypItems } from '../editor/complete.ts';
import { Editor, toEditorDiags, type EditorHandle } from '../editor/Editor.tsx';
import { mapDiagnostics } from '../editor/offsets.ts';
import { OpenInLean } from '../components/OpenInLean.tsx';
import { CommandOutputs, Infoview } from '../components/Infoview.tsx';
import { SymbolBar } from '../components/SymbolBar.tsx';
import { useInfo } from '../levels/ProofLevel.tsx';

export function SandboxScreen() {
  const { engine, fullEnv, ShareButton } = getLeanRuntime();
  const saved = useGame((s) => s.save.sandbox);
  const fontSize = useGame((s) => s.save.settings.fontSize);
  const [text, setText] = useState(saved);
  const [cursor, setCursor] = useState(text.length);
  const editor = useRef<EditorHandle>(null);
  const env = useMemo(() => fullEnv(), [fullEnv]);
  const { result, pending } = useCheck(text, () => engine.check(env, text));
  const info = useInfo(result, 0, text.length, cursor);
  useEffect(() => {
    const id = setTimeout(() => game().setSandbox(text), 400);
    return () => clearTimeout(id);
  }, [text]);
  const completion = useMemo(() => dataForEverything(), []);
  const hyps = useMemo(() => hypItems(info.goals?.[0]?.hyps ?? []), [info.goals]);
  const outputs = (result?.diagnostics ?? []).filter((d) => d.code === 'command-output');
  const diags = info.diags.filter((d) => d.code !== 'command-output');
  return (
    <div className="page wide sandbox">
      <ScreenHeader
        id="sandbox"
        title="Sandbox"
        icon="sandbox"
        actions={
          <>
            <OpenInLean source={text} className="btn outline" />
            {ShareButton && <ShareButton card={{ kind: 'sandbox', title: 'From the Sandbox', source: text }} className="btn outline" />}
            <button className="btn ghost" onClick={() => setText('')}><Icon name="close" size={16} /> Clear</button>
          </>
        }
      />
      <div className="sandbox-grid">
        <div className="editor-panel">
          <SymbolBar onInsert={(s) => editor.current?.insert(s)} />
          <div className="sandbox-editor">
            <Editor
              ref={editor}
              value={text}
              onChange={setText}
              onCursor={setCursor}
              diagnostics={toEditorDiags(mapDiagnostics(result?.diagnostics ?? [], 0, text.length))}
              fontSize={fontSize}
              ariaLabel="Sandbox editor"
              completion={completion}
              hyps={hyps}
              cursor={0}
            />
          </div>
        </div>
        <div className="sandbox-side">
          <CommandOutputs outputs={outputs} label="Output" />
          <Infoview
            goals={info.goals}
            fallbackGoals={info.fallback}
            diagnostics={diags}
            complete={false}
            pending={pending}
            onInsert={(n) => editor.current?.insert(n)}
            emptyHint="Put the cursor inside a proof to see its goals."
          />
        </div>
      </div>
      <p className="muted small">Names that exist only in the game may need adjusting in real Lean (it opens with Mathlib).</p>
    </div>
  );
}
