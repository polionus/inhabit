import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, StateEffect, StateField, Compartment, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  hoverTooltip,
  keymap,
  placeholder as cmPlaceholder,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { abbreviations } from '../../content/abbreviations.ts';
import { completionsFor, findPending, onType, resolve } from './abbrev.ts';
import { leanLanguage } from './highlight.ts';
import type { BodyDiagnostic } from './offsets.ts';

export interface EditorHandle {
  insert(text: string): void;
  focus(): void;
  getCursor(): number;
}

export interface EditorDiag {
  from: number;
  to: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export const toEditorDiags = (ds: BodyDiagnostic[]): EditorDiag[] =>
  ds.filter((d) => d.inBody).map((d) => ({ from: d.bFrom, to: d.bTo, severity: d.severity, message: d.message }));

const setDiags = StateEffect.define<EditorDiag[]>();
const setMarkLine = StateEffect.define<number | null>();

const diagField = StateField.define<{ diags: EditorDiag[]; deco: DecorationSet }>({
  create: () => ({ diags: [], deco: Decoration.none }),
  update(v, tr) {
    let { diags, deco } = v;
    for (const e of tr.effects) {
      if (e.is(setDiags)) {
        diags = e.value;
        deco = Decoration.none;
        const len = tr.state.doc.length;
        const ranges = diags
          .map((d) => {
            let from = Math.min(d.from, len);
            let to = Math.min(d.to, len);
            if (to <= from) {
              if (from < len) to = from + 1;
              else if (from > 0) from = from - 1;
            }
            return { d, from, to };
          })
          .filter((r) => r.to > r.from)
          .sort((a, b) => a.from - b.from);
        deco = Decoration.set(ranges.map((r) => Decoration.mark({ class: `cm-sq cm-sq-${r.d.severity}` }).range(r.from, r.to)), true);
      }
    }
    if (tr.docChanged) deco = deco.map(tr.changes);
    return { diags, deco };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

const markLineField = StateField.define<{ line: number | null; deco: DecorationSet }>({
  create: () => ({ line: null, deco: Decoration.none }),
  update(v, tr) {
    let line = v.line;
    for (const e of tr.effects) if (e.is(setMarkLine)) line = e.value;
    if (line === v.line && !tr.docChanged) return v;
    if (line === null || line < 1 || line > tr.state.doc.lines) return { line, deco: Decoration.none };
    const l = tr.state.doc.line(line);
    return { line, deco: Decoration.set([Decoration.line({ class: 'cm-marked-line' }).range(l.from)]) };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

/** Underline the abbreviation being typed. */
const pendingPlugin = ViewPlugin.fromClass(
  class {
    deco: DecorationSet = Decoration.none;
    update(u: ViewUpdate) {
      if (!u.docChanged && !u.selectionSet) return;
      const sel = u.state.selection.main;
      this.deco = Decoration.none;
      if (!sel.empty) return;
      const line = u.state.doc.lineAt(sel.head);
      const p = findPending(line.text.slice(0, sel.head - line.from));
      if (p) this.deco = Decoration.set([Decoration.mark({ class: 'cm-abbrev-pending' }).range(line.from + p.start, sel.head)]);
    }
  },
  { decorations: (v) => v.deco },
);

const diagTooltip = hoverTooltip((view, pos) => {
  const { diags } = view.state.field(diagField);
  const hit = diags.find((d) => pos >= d.from && pos <= Math.max(d.to, d.from + 1));
  if (!hit) return null;
  return {
    pos: hit.from,
    end: Math.max(hit.to, hit.from + 1),
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = `cm-diag-tip cm-diag-tip-${hit.severity}`;
      dom.textContent = hit.message;
      return { dom };
    },
  };
});

function abbrevCompletion(ctx: CompletionContext) {
  const m = ctx.matchBefore(/\\[^\s\\]*/);
  if (!m) return null;
  const q = m.text.slice(1);
  const opts = completionsFor(q, abbreviations);
  if (!opts.length) return null;
  return {
    from: m.from,
    filter: false,
    options: opts.map((o) => ({
      label: '\\' + o.key,
      detail: o.symbol,
      apply: (view: EditorView, _c: unknown, from: number, to: number) => {
        const r = resolve(o.key, abbreviations);
        const text = r ? r.text : o.symbol;
        view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + (r ? r.cursor : text.length) } });
      },
    })),
  };
}

const highlight = HighlightStyle.define([
  { tag: t.keyword, class: 'hl-kw' },
  { tag: t.operatorKeyword, class: 'hl-tac' },
  { tag: t.invalid, class: 'hl-sorry' },
  { tag: t.typeName, class: 'hl-ty' },
  { tag: t.comment, class: 'hl-com' },
  { tag: t.string, class: 'hl-str' },
  { tag: t.number, class: 'hl-num' },
  { tag: t.operator, class: 'hl-op' },
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--ink)', height: '100%' },
  '.cm-content': { fontFamily: 'var(--mono)', caretColor: 'var(--accent)', padding: '6px 0' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-gutters': { display: 'none' },
  '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
  '.cm-activeLine': { backgroundColor: 'var(--active-line)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--selection) !important' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' },
  '.cm-tooltip-autocomplete ul': { fontFamily: 'var(--mono)' },
});

interface Props {
  value: string;
  onChange?: (v: string) => void;
  onCursor?: (offset: number) => void;
  diagnostics?: EditorDiag[];
  readOnly?: boolean;
  fontSize?: number;
  markLine?: number | null;
  placeholder?: string;
  ariaLabel: string;
  /** Initial cursor position: 'end' (default) or an offset. */
  cursor?: 'end' | number;
  className?: string;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef(props);
  cb.current = props;
  const fontComp = useRef(new Compartment());
  const roComp = useRef(new Compartment());

  useImperativeHandle(ref, () => ({
    insert(text) {
      const v = view.current;
      if (!v) return;
      const sel = v.state.selection.main;
      v.dispatch({ changes: { from: sel.from, to: sel.to, insert: text }, selection: { anchor: sel.from + text.length }, scrollIntoView: true });
      v.focus();
    },
    focus: () => view.current?.focus(),
    getCursor: () => view.current?.state.selection.main.head ?? 0,
  }));

  useEffect(() => {
    if (!host.current) return;
    const abbrevInput = EditorView.inputHandler.of((v, from, to, text) => {
      if (text.length !== 1 && text !== '\n') return false;
      if (from !== to) return false;
      const r = onType(v.state.doc.toString(), from, text === '\n' ? '' : text, abbreviations);
      if (!r) return false;
      v.dispatch({ changes: { from: r.from, to: r.to, insert: r.insert }, selection: { anchor: r.cursor }, userEvent: 'input.type' });
      return true;
    });
    const tabKey = (v: EditorView) => {
      const sel = v.state.selection.main;
      if (cb.current.readOnly) return false;
      const r = sel.empty ? onType(v.state.doc.toString(), sel.head, '', abbreviations) : null;
      if (r) {
        v.dispatch({ changes: { from: r.from, to: r.to, insert: r.insert }, selection: { anchor: r.cursor } });
        return true;
      }
      v.dispatch({ changes: { from: sel.from, to: sel.to, insert: '  ' }, selection: { anchor: sel.from + 2 } });
      return true;
    };
    const exts: Extension[] = [
      history(),
      drawSelection(),
      highlightActiveLine(),
      leanLanguage,
      syntaxHighlighting(highlight),
      indentUnit.of('  '),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      theme,
      diagField,
      markLineField,
      pendingPlugin,
      diagTooltip,
      abbrevInput,
      autocompletion({ override: [abbrevCompletion], activateOnTyping: true, icons: false }),
      keymap.of([{ key: 'Tab', run: tabKey, shift: () => true }, ...defaultKeymap, ...historyKeymap]),
      EditorView.contentAttributes.of({ 'aria-label': cb.current.ariaLabel, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
      fontComp.current.of(EditorView.theme({ '&': { fontSize: `${cb.current.fontSize ?? 15}px` } })),
      roComp.current.of([EditorState.readOnly.of(!!cb.current.readOnly), EditorView.editable.of(true)]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) cb.current.onChange?.(u.state.doc.toString());
        if (u.docChanged || u.selectionSet) cb.current.onCursor?.(u.state.selection.main.head);
      }),
    ];
    if (cb.current.placeholder) exts.push(cmPlaceholder(cb.current.placeholder));
    const doc = cb.current.value;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc,
        extensions: exts,
        selection: { anchor: cb.current.cursor === undefined || cb.current.cursor === 'end' ? doc.length : Math.min(cb.current.cursor, doc.length) },
      }),
    });
    view.current = v;
    cb.current.onCursor?.(v.state.selection.main.head);
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  // external value changes (e.g. insert solution, reset)
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur !== props.value) v.dispatch({ changes: { from: 0, to: cur.length, insert: props.value }, selection: { anchor: props.value.length } });
  }, [props.value]);

  useEffect(() => {
    view.current?.dispatch({ effects: setDiags.of(props.diagnostics ?? []) });
  }, [props.diagnostics]);
  useEffect(() => {
    view.current?.dispatch({ effects: setMarkLine.of(props.markLine ?? null) });
  }, [props.markLine, props.value]);
  useEffect(() => {
    view.current?.dispatch({
      effects: [
        fontComp.current.reconfigure(EditorView.theme({ '&': { fontSize: `${props.fontSize ?? 15}px` } })),
        roComp.current.reconfigure([EditorState.readOnly.of(!!props.readOnly), EditorView.editable.of(true)]),
      ],
    });
  }, [props.fontSize, props.readOnly]);

  return <div ref={host} className={`editor ${props.className ?? ''}`} />;
});
