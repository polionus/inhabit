/**
 * Recursive-descent / Pratt parser for the Lean 4 subset.
 *
 * Indentation follows Lean: tactic blocks are sequences of tactics at one column
 * (`withPosition` + `checkColGe`), and application arguments must be to the right of the
 * innermost saved position (`checkColGt`). On a parse error inside a tactic block the block is
 * truncated (like Lean), the error is reported, and parsing resumes at the next command.
 */
import type {
  Arg,
  BinderGroup,
  BinderKind,
  CalcStep,
  Command,
  CtorSyntax,
  DeclBody,
  DeclModifiers,
  FieldSyntax,
  FunBinder,
  InductionAlt,
  LevelSyntax,
  Location,
  MatchAlt,
  RPat,
  RwRule,
  Tactic,
  TacticSeq,
  Term,
} from './ast.ts';
import type { Token } from './lexer.ts';
import { COMMAND_KEYWORDS, lex } from './lexer.ts';

export interface ParseDiag {
  from: number;
  to: number;
  message: string;
  code: 'parse' | 'unknown-tactic';
  tactic?: string;
}

class ParseError extends Error {
  from: number;
  to: number;
  code: 'parse' | 'unknown-tactic';
  tactic?: string;
  constructor(message: string, from: number, to: number, code: 'parse' | 'unknown-tactic' = 'parse', tactic?: string) {
    super(message);
    this.from = from;
    this.to = to;
    this.code = code;
    this.tactic = tactic;
  }
}

export const MAX_PREC = 1024;
const ARG_PREC = 1023;
const LEAD_PREC = 1022;

interface InfixInfo {
  prec: number;
  /** precedence of the left operand */
  lhs: number;
  /** precedence of the right operand */
  rhs: number;
  /** canonical operator */
  op: string;
}

const infix = (op: string, prec: number, assoc: 'l' | 'r' | 'n'): InfixInfo => ({
  op,
  prec,
  lhs: assoc === 'l' ? prec : prec + 1,
  rhs: assoc === 'r' ? prec : prec + 1,
});

const INFIX: Record<string, InfixInfo> = {
  '→': infix('→', 25, 'r'),
  '->': infix('→', 25, 'r'),
  '↔': infix('↔', 20, 'n'),
  '<->': infix('↔', 20, 'n'),
  '∨': infix('∨', 30, 'r'),
  '\\/': infix('∨', 30, 'r'),
  '∧': infix('∧', 35, 'r'),
  '/\\': infix('∧', 35, 'r'),
  '×': infix('×', 35, 'r'),
  '=': infix('=', 50, 'n'),
  '≠': infix('≠', 50, 'n'),
  '!=': infix('≠', 50, 'n'),
  '≤': infix('≤', 50, 'n'),
  '<=': infix('≤', 50, 'n'),
  '≥': infix('≥', 50, 'n'),
  '>=': infix('≥', 50, 'n'),
  '<': infix('<', 50, 'n'),
  '>': infix('>', 50, 'n'),
  '∈': infix('∈', 50, 'n'),
  '∉': infix('∉', 50, 'n'),
  '⊆': infix('⊆', 50, 'n'),
  '⊂': infix('⊂', 50, 'n'),
  '∣': infix('∣', 50, 'n'),
  '+': infix('+', 65, 'l'),
  '-': infix('-', 65, 'l'),
  '++': infix('++', 65, 'l'),
  '∪': infix('∪', 65, 'l'),
  '*': infix('*', 70, 'l'),
  '/': infix('/', 70, 'l'),
  '%': infix('%', 70, 'l'),
  '∩': infix('∩', 70, 'l'),
  '\\': infix('\\', 70, 'n'),
  '^': infix('^', 75, 'r'),
  '▸': infix('▸', 75, 'r'),
  '∘': infix('∘', 90, 'r'),
  "''": infix("''", 90, 'l'),
  "⁻¹'": infix("⁻¹'", 80, 'l'),
  '<|': infix('<|', 10, 'r'),
  '$': infix('<|', 10, 'r'),
  '|>': infix('|>', 10, 'l'),
};

/** Tactics the parser knows, with their argument shape. */
const TACTIC_SHAPES: Record<string, string> = {
  intro: 'intro',
  intros: 'intro',
  rintro: 'rintro',
  exact: 'term',
  apply: 'term',
  refine: 'term',
  "refine'": 'term',
  show: 'term',
  change: 'termAt',
  exfalso: 'simple',
  constructor: 'simple',
  left: 'simple',
  right: 'simple',
  contradiction: 'simple',
  assumption: 'simple',
  rfl: 'simple',
  trivial: 'simple',
  sorry: 'simple',
  admit: 'simple',
  symm: 'simpleAt',
  done: 'simple',
  skip: 'simple',
  decide: 'simple',
  have: 'have',
  let: 'have',
  suffices: 'have',
  obtain: 'obtain',
  cases: 'cases',
  induction: 'cases',
  rcases: 'rcases',
  by_cases: 'byCases',
  by_contra: 'byContra',
  use: 'terms',
  exists: 'terms',
  specialize: 'specialize',
  rw: 'rw',
  rewrite: 'rw',
  rwa: 'rw',
  nth_rewrite: 'nthRw',
  nth_rw: 'nthRw',
  calc: 'calc',
  ext: 'names',
  funext: 'names',
  unfold: 'unfold',
  subst: 'names',
  revert: 'names',
  clear: 'names',
  injection: 'injection',
  rename_i: 'names',
  all_goals: 'comb',
  any_goals: 'comb',
  repeat: 'comb',
  try: 'comb',
  focus: 'comb',
  first: 'first',
  simp: 'simp',
  simp_all: 'simp',
  dsimp: 'simp',
  exact_mod_cast: 'term',
  apply_fun: 'term',
  contrapose: 'simple',
  push_neg: 'simpleAt',
  omega: 'simple',
  linarith: 'simple',
  norm_num: 'simp',
  ring: 'simple',
  aesop: 'simple',
  tauto: 'simple',
  positivity: 'simple',
  'exact?': 'simple',
  'apply?': 'simple',
  'simp?': 'simp',
  infer_instance: 'simple',
  native_decide: 'simple',
  generalize: 'term',
  conv: 'simple',
  split: 'simple',
  exists_intro: 'simple',
};

export const PARSER_TACTICS = Object.keys(TACTIC_SHAPES);

export interface ParseResult {
  commands: Command[];
  diagnostics: ParseDiag[];
}

export function parse(src: string): ParseResult {
  const p = new Parser(src);
  return p.parseFile();
}

/** Parse a single term (for `engine.elab`). */
export function parseTermOnly(src: string): { term: Term | null; diagnostics: ParseDiag[] } {
  const p = new Parser(src);
  return p.parseStandaloneTerm();
}

/** Parse binders like "(α : Type) (A B : Set α)". */
export function parseBindersOnly(src: string): { binders: BinderGroup[]; diagnostics: ParseDiag[] } {
  const p = new Parser(src);
  return p.parseStandaloneBinders();
}

class Parser {
  private toks: Token[];
  private i = 0;
  private diags: ParseDiag[] = [];
  /** column of the innermost saved position (`withPosition`) */
  private posCol = -1;
  /** set after a parse error: unwind and keep partial results */
  private aborted = false;
  /** `·` placeholders collected for the innermost parenthesis */
  private cdotStack: number[] = [];
  private src: string;

  constructor(src: string) {
    this.src = src;
    const { tokens, errors } = lex(src);
    this.toks = tokens;
    for (const e of errors) this.diags.push({ ...e, code: 'parse' });
  }

  /* ---------- token helpers ---------- */

  private get t(): Token {
    return this.toks[this.i];
  }

  private peek(k = 1): Token {
    return this.toks[Math.min(this.i + k, this.toks.length - 1)];
  }

  private next(): Token {
    const t = this.t;
    if (t.kind !== 'eof') this.i++;
    return t;
  }

  private atEof(): boolean {
    return this.t.kind === 'eof';
  }

  private prevEnd(): number {
    return this.i > 0 ? this.toks[this.i - 1].to : 0;
  }

  private isSym(s: string, t: Token = this.t): boolean {
    return t.kind === 'sym' && t.text === s;
  }

  private isKw(s: string, t: Token = this.t): boolean {
    return t.kind === 'kw' && t.text === s;
  }

  private isCommandStart(t: Token = this.t): boolean {
    if (t.kind === 'eof') return true;
    if (t.kind === 'doc') return true;
    return t.kind === 'kw' && COMMAND_KEYWORDS.has(t.text);
  }

  private fail(msg: string, t: Token = this.t): never {
    throw new ParseError(msg, t.from, Math.max(t.to, t.from + 1));
  }

  private unexpected(expected?: string): never {
    const t = this.t;
    const what = t.kind === 'eof' ? 'end of input' : `token '${t.text}'`;
    this.fail(expected ? `unexpected ${what}; expected ${expected}` : `unexpected ${what}`);
  }

  private expectSym(s: string): Token {
    if (this.isSym(s)) return this.next();
    if (s === '=>' && this.isSym('↦')) return this.next();
    if (s === '↦' && this.isSym('=>')) return this.next();
    this.unexpected(`'${s}'`);
  }

  private expectKw(s: string): Token {
    if (this.isKw(s)) return this.next();
    this.unexpected(`'${s}'`);
  }

  private ident(): Token {
    if (this.t.kind === 'ident') return this.next();
    this.unexpected('identifier');
  }

  private withPos<T>(col: number, f: () => T): T {
    const old = this.posCol;
    this.posCol = col;
    try {
      return f();
    } finally {
      this.posCol = old;
    }
  }

  private colGt(t: Token = this.t): boolean {
    return t.col > this.posCol;
  }

  private recordError(e: ParseError): void {
    if (!this.diags.some((d) => d.from === e.from && d.message === e.message)) {
      this.diags.push({ from: e.from, to: e.to, message: e.message, code: e.code, tactic: e.tactic });
    }
  }

  /* ---------- file / commands ---------- */

  parseFile(): ParseResult {
    const commands: Command[] = [];
    while (this.t.kind !== 'eof') {
      const start = this.i;
      this.aborted = false;
      try {
        const c = this.parseCommand();
        if (c) commands.push(c);
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        this.recordError(e);
        if (this.i === start) this.next();
      }
      if (this.aborted) {
        // skip to next command
        if (this.i === start) this.next();
        while (!this.isCommandStart()) this.next();
      } else if (!this.isCommandStart()) {
        const t = this.t;
        this.recordError(new ParseError(`unexpected token '${t.text}'; expected command`, t.from, t.to));
        while (!this.isCommandStart()) this.next();
      }
    }
    return { commands, diagnostics: this.diags };
  }

  parseStandaloneTerm(): { term: Term | null; diagnostics: ParseDiag[] } {
    try {
      const term = this.term();
      if (this.t.kind !== 'eof') this.unexpected();
      return { term, diagnostics: this.diags };
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      this.recordError(e);
      return { term: null, diagnostics: this.diags };
    }
  }

  parseStandaloneBinders(): { binders: BinderGroup[]; diagnostics: ParseDiag[] } {
    try {
      const binders = this.declBinders();
      if (this.t.kind !== 'eof') this.unexpected('binder');
      return { binders, diagnostics: this.diags };
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      this.recordError(e);
      return { binders: [], diagnostics: this.diags };
    }
  }

  private parseModifiers(): DeclModifiers {
    const mods: DeclModifiers = { attrs: [], isProtected: false, isPrivate: false, noncomputable: false };
    for (;;) {
      const t = this.t;
      if (t.kind === 'doc') {
        mods.doc = this.next().text;
      } else if (this.isKw('@[')) {
        this.next();
        let depth = 1;
        let text = '';
        while (this.t.kind !== 'eof' && depth > 0) {
          if (this.isSym('[')) depth++;
          if (this.isSym(']')) depth--;
          if (depth > 0) text += (text ? ' ' : '') + this.t.text;
          this.next();
        }
        mods.attrs.push(...text.split(',').map((s) => s.trim()));
      } else if (this.isKw('protected')) {
        this.next();
        mods.isProtected = true;
      } else if (this.isKw('private')) {
        this.next();
        mods.isPrivate = true;
      } else if (this.isKw('noncomputable')) {
        this.next();
        mods.noncomputable = true;
      } else break;
    }
    return mods;
  }

  private parseCommand(): Command | null {
    const start = this.t.from;
    const mods = this.parseModifiers();
    const t = this.t;
    if (t.kind !== 'kw') this.unexpected('command');
    switch (t.text) {
      case 'theorem':
      case 'lemma':
      case 'def':
      case 'example':
      case 'axiom':
      case 'abbrev':
      case 'instance':
      case 'opaque':
        return this.parseDecl(start, mods);
      case 'inductive':
        return this.parseInductive(start, mods);
      case 'structure':
      case 'class':
        return this.parseStructure(start, mods);
      case '#check':
      case '#eval':
      case '#reduce':
      case '#check_failure': {
        this.next();
        const term = this.withPos(-1, () => this.term());
        const k = t.text === '#check' ? 'check' : t.text === '#eval' ? 'eval' : t.text === '#reduce' ? 'reduce' : 'checkFailure';
        return { k, term, from: start, to: this.prevEnd() };
      }
      case '#print': {
        this.next();
        if (this.t.kind === 'str') {
          this.next();
          return { k: 'skip', from: start, to: this.prevEnd() };
        }
        const n = this.anyName();
        return { k: 'print', name: n.text, nameFrom: n.from, nameTo: n.to, from: start, to: this.prevEnd() };
      }
      case 'open': {
        this.next();
        const names: { name: string; from: number; to: number }[] = [];
        let hiding: string[] | undefined;
        while (this.t.kind === 'ident' && !this.isCommandStart()) {
          const n = this.next();
          names.push({ name: n.text, from: n.from, to: n.to });
          if (this.isKw('hiding') || (this.t.kind === 'ident' && this.t.text === 'hiding')) {
            this.next();
            hiding = [];
            while (this.t.kind === 'ident' && this.t.line === n.line) hiding.push(this.next().text);
          }
          if (this.isSym('(')) {
            // open Foo (bar baz)
            this.next();
            while (!this.isSym(')') && !this.atEof()) this.next();
            this.expectSym(')');
          }
        }
        if (names.length === 0) this.unexpected('identifier');
        let inCmd: Command | null = null;
        if (this.isKw('in')) {
          this.next();
          inCmd = this.parseCommand();
        }
        return { k: 'open', names, hiding, inCmd, from: start, to: this.prevEnd() };
      }
      case 'namespace': {
        this.next();
        const n = this.ident();
        return { k: 'namespace', name: n.text, from: start, to: n.to };
      }
      case 'section': {
        this.next();
        const n = this.t.kind === 'ident' && this.t.line === t.line ? this.next().text : null;
        return { k: 'section', name: n, from: start, to: this.prevEnd() };
      }
      case 'end': {
        this.next();
        const n = this.t.kind === 'ident' && this.t.line === t.line ? this.next().text : null;
        return { k: 'end', name: n, from: start, to: this.prevEnd() };
      }
      case 'variable': {
        this.next();
        const binders = this.declBinders();
        if (binders.length === 0) this.unexpected('binder');
        return { k: 'variable', binders, from: start, to: this.prevEnd() };
      }
      case 'universe': {
        this.next();
        const names: string[] = [];
        while (this.t.kind === 'ident' && this.t.line === t.line) names.push(this.next().text);
        return { k: 'universe', names, from: start, to: this.prevEnd() };
      }
      case 'set_option': {
        this.next();
        this.anyName();
        if (this.t.kind !== 'eof' && !this.isCommandStart()) this.next();
        if (this.isKw('in')) {
          this.next();
          return this.parseCommand();
        }
        return { k: 'skip', from: start, to: this.prevEnd() };
      }
      case 'attribute': {
        this.next();
        this.expectSym('[');
        const attrs: string[] = [];
        while (!this.isSym(']') && this.t.kind !== 'eof') attrs.push(this.next().text);
        this.expectSym(']');
        const names: string[] = [];
        while (this.t.kind === 'ident' && !this.isCommandStart()) names.push(this.next().text);
        return { k: 'attribute', attrs, names, from: start, to: this.prevEnd() };
      }
      case 'import': {
        this.next();
        while (this.t.kind === 'ident' && this.t.line === t.line) this.next();
        return { k: 'skip', from: start, to: this.prevEnd() };
      }
      case 'mutual':
      case 'macro':
      case 'syntax':
      case 'notation':
      case 'infix':
      case 'infixl':
      case 'infixr':
      case 'prefix':
      case 'postfix':
        this.fail(`'${t.text}' is not supported in this game`);
      // falls through
      default:
        this.unexpected('command');
    }
  }

  private anyName(): Token {
    if (this.t.kind === 'ident' || this.t.kind === 'kw') return this.next();
    this.unexpected('identifier');
  }

  private parseDecl(start: number, mods: DeclModifiers): Command {
    const kwTok = this.next();
    let kind = kwTok.text as 'theorem' | 'def' | 'example' | 'axiom' | 'abbrev' | 'instance' | 'opaque';
    if (kwTok.text === 'lemma') kind = 'theorem';
    let name: string | null = null;
    let nameFrom = kwTok.from;
    let nameTo = kwTok.to;
    if (kind !== 'example') {
      if (kind === 'instance' && this.t.kind !== 'ident') {
        name = null;
      } else {
        const n = this.ident();
        name = n.text;
        nameFrom = n.from;
        nameTo = n.to;
      }
    }
    const binders = this.declBinders();
    let type: Term | null = null;
    if (this.isSym(':')) {
      this.next();
      type = this.withPos(-1, () => this.term());
    }
    let body: DeclBody = { k: 'none' };
    if (this.isSym(':=')) {
      this.next();
      body = { k: 'term', term: this.withPos(-1, () => this.term()) };
      if (!this.aborted && this.isKw('where')) this.fail("'where' clauses are not supported in this game");
    } else if (this.isSym('|')) {
      body = { k: 'eqns', alts: this.matchAlts(-1) };
    } else if (kind !== 'axiom' && kind !== 'opaque' && !this.aborted) {
      this.unexpected("':='");
    }
    return { k: 'decl', kind, mods, name, nameFrom, nameTo, binders, type, body, from: start, to: this.prevEnd() };
  }

  private parseInductive(start: number, mods: DeclModifiers): Command {
    this.next();
    const n = this.ident();
    const binders = this.declBinders();
    let type: Term | null = null;
    if (this.isSym(':')) {
      this.next();
      type = this.term();
    }
    if (this.isKw('where')) this.next();
    const ctors: CtorSyntax[] = [];
    for (;;) {
      let doc: string | undefined;
      if (this.t.kind === 'doc') doc = this.next().text;
      if (!this.isSym('|')) break;
      const bar = this.next();
      const cn = this.ident();
      const cb = this.declBinders();
      let ct: Term | null = null;
      if (this.isSym(':')) {
        this.next();
        ct = this.term();
      }
      ctors.push({ name: cn.text, nameFrom: cn.from, binders: cb, type: ct, doc, from: bar.from, to: this.prevEnd() });
    }
    if (this.isKw('deriving')) {
      this.next();
      while (this.t.kind === 'ident' || this.isSym(',')) this.next();
    }
    return { k: 'inductive', mods, name: n.text, nameFrom: n.from, nameTo: n.to, binders, type, ctors, from: start, to: this.prevEnd() };
  }

  private parseStructure(start: number, mods: DeclModifiers): Command {
    this.next();
    const n = this.ident();
    const binders = this.declBinders();
    let stype: Term | null = null;
    if (this.isSym(':')) {
      this.next();
      stype = this.term();
    }
    const fields: FieldSyntax[] = [];
    let ctorName: string | null = null;
    if (this.isKw('where')) {
      this.next();
      if (this.t.kind === 'ident' && this.isSym('::', this.peek())) {
        ctorName = this.next().text;
        this.next();
      } else if (this.t.kind === 'ident' && this.isSym(':', this.peek()) && this.isSym(':', this.peek(2))) {
        ctorName = this.next().text;
        this.next();
        this.next();
      }
      while (this.t.kind === 'ident' || this.isSym('(') || this.t.kind === 'doc') {
        if (this.t.kind === 'doc') {
          this.next();
          continue;
        }
        if (this.isCommandStart()) break;
        const fs = this.t.from;
        if (this.isSym('(')) {
          const g = this.binderGroup();
          if (!g || !g.type) this.unexpected('field');
          fields.push({ names: g.names.map((x) => x.name), binders: [], type: g.type, from: fs, to: this.prevEnd() });
          continue;
        }
        const names: string[] = [];
        const fcol = this.t.col;
        while (this.t.kind === 'ident') names.push(this.next().text);
        const fb = this.declBinders();
        this.expectSym(':');
        const ty = this.withPos(fcol, () => this.term());
        fields.push({ names, binders: fb, type: ty, from: fs, to: this.prevEnd() });
      }
    }
    if (this.isKw('deriving')) {
      this.next();
      while (this.t.kind === 'ident' || this.isSym(',')) this.next();
    }
    return { k: 'structure', mods, name: n.text, nameFrom: n.from, nameTo: n.to, binders, type: stype, ctorName, fields, from: start, to: this.prevEnd() };
  }

  /* ---------- binders ---------- */

  /** Bracketed binders for declarations: `(x y : A) {z : B} ⦃w⦄ [inst]`; also bare idents. */
  private declBinders(): BinderGroup[] {
    const out: BinderGroup[] = [];
    for (;;) {
      if (this.isSym('(') || this.isSym('{') || this.isSym('⦃') || this.isSym('[')) {
        const g = this.binderGroup();
        if (!g) break;
        out.push(g);
      } else if (this.t.kind === 'ident' || this.isSym('_')) {
        // bare binder names in declarations (`def f x := …`) are rare; allow
        const tk = this.next();
        out.push({ names: [{ name: tk.text, from: tk.from, to: tk.to }], type: null, bi: 'default', from: tk.from, to: tk.to });
      } else break;
    }
    return out;
  }

  private binderGroup(): BinderGroup | null {
    const open = this.t;
    const close = { '(': ')', '{': '}', '⦃': '⦄', '[': ']' }[open.text]!;
    const bi: BinderKind = open.text === '(' ? 'default' : open.text === '{' ? 'implicit' : open.text === '⦃' ? 'strict' : 'inst';
    // `(x y : A)` — but `(` may also start a term in some contexts; caller decides
    const save = this.i;
    this.next();
    const names: { name: string; from: number; to: number }[] = [];
    if (bi === 'inst') {
      // [inst : C] or [C]
      if (this.t.kind === 'ident' && this.isSym(':', this.peek())) {
        const n = this.next();
        names.push({ name: n.text, from: n.from, to: n.to });
        this.next();
      }
      const ty = this.term();
      this.expectSym(']');
      return { names: names.length ? names : [{ name: '', from: open.from, to: open.from }], type: ty, bi, from: open.from, to: this.prevEnd() };
    }
    while (this.t.kind === 'ident' || this.isSym('_')) {
      const n = this.next();
      names.push({ name: n.text, from: n.from, to: n.to });
    }
    if (names.length === 0) {
      this.i = save;
      return null;
    }
    let type: Term | null = null;
    if (this.isSym(':')) {
      this.next();
      type = this.withPos(-1, () => this.term());
    } else if (bi === 'default') {
      this.i = save;
      return null;
    }
    if (this.isSym(':=')) this.fail('default values for binders are not supported in this game');
    this.expectSym(close);
    return { names, type, bi, from: open.from, to: this.prevEnd() };
  }

  /** Binders after ∀ / ∃: `x y`, `x y : A`, `(x : A) {y : B}`, `x ∈ s`. */
  private quantBinders(): BinderGroup[] {
    const out: BinderGroup[] = [];
    if (this.t.kind === 'ident' || this.isSym('_')) {
      const names: { name: string; from: number; to: number }[] = [];
      const from = this.t.from;
      while (this.t.kind === 'ident' || this.isSym('_')) {
        const n = this.next();
        names.push({ name: n.text, from: n.from, to: n.to });
      }
      let type: Term | null = null;
      let pred: BinderGroup['pred'];
      if (this.isSym(':')) {
        this.next();
        type = this.term();
      } else if (['∈', '∉', '⊆', '<', '≤', '>', '≥', '≠', '∣'].some((s) => this.isSym(s))) {
        const op = this.next().text;
        pred = { op, rhs: this.term(51) };
      }
      out.push({ names, type, bi: 'default', pred, from, to: this.prevEnd() });
      return out;
    }
    while (this.isSym('(') || this.isSym('{') || this.isSym('⦃') || this.isSym('[')) {
      const g = this.binderGroup();
      if (!g) this.unexpected('binder');
      out.push(g);
    }
    if (out.length === 0) this.unexpected('binder');
    return out;
  }

  private funBinders(): FunBinder[] {
    const out: FunBinder[] = [];
    for (;;) {
      if (this.t.kind === 'ident' || this.isSym('_')) {
        const n = this.next();
        out.push({ k: 'group', group: { names: [{ name: n.text, from: n.from, to: n.to }], type: null, bi: 'default', from: n.from, to: n.to } });
      } else if (this.isSym('⟨')) {
        out.push({ k: 'pattern', pat: this.term(MAX_PREC) });
      } else if (this.isSym('(') || this.isSym('{') || this.isSym('⦃') || this.isSym('[')) {
        const g = this.binderGroup();
        if (g) out.push({ k: 'group', group: g });
        else if (this.isSym('(')) out.push({ k: 'pattern', pat: this.term(MAX_PREC) });
        else this.unexpected('binder');
      } else break;
    }
    // `fun x y : T => …`
    if (this.isSym(':') && out.length > 0 && out.every((b) => b.k === 'group' && b.group.type === null)) {
      this.next();
      const ty = this.term();
      for (const b of out) if (b.k === 'group') b.group.type = ty;
    }
    return out;
  }

  /* ---------- terms ---------- */

  term(minPrec = 0): Term {
    let lhs = this.leading(minPrec);
    for (;;) {
      if (this.aborted) return lhs;
      const t = this.t;
      // projections `.1`, `.foo`
      if (t.kind === 'field') {
        this.next();
        lhs = { k: 'proj', term: lhs, field: t.text, fieldFrom: t.from, from: lhs.from, to: t.to };
        continue;
      }
      if (this.isSym('ᶜ') && minPrec <= MAX_PREC) {
        this.next();
        lhs = { k: 'unop', op: 'ᶜ', arg: lhs, from: lhs.from, to: t.to };
        continue;
      }
      if (t.kind === 'sym' && INFIX[t.text]) {
        const info = INFIX[t.text];
        if (info.prec < minPrec) break;
        // a `-` or `*` at the start of a new line that is not indented is not a continuation
        this.next();
        const rhs = this.term(info.rhs);
        if (info.op === '→') lhs = { k: 'arrow', dom: lhs, cod: rhs, from: lhs.from, to: rhs.to };
        else lhs = { k: 'binop', op: info.op, lhs, rhs, opFrom: t.from, from: lhs.from, to: rhs.to };
        continue;
      }
      // application
      if (minPrec <= LEAD_PREC && this.canStartArg() && this.colGt()) {
        const args: Arg[] = [];
        while (!this.aborted && this.canStartArg() && this.colGt()) args.push(this.arg());
        lhs = { k: 'app', fn: lhs, args, from: lhs.from, to: this.prevEnd() };
        continue;
      }
      break;
    }
    return lhs;
  }

  private canStartArg(t: Token = this.t): boolean {
    switch (t.kind) {
      case 'ident':
      case 'num':
      case 'str':
        return true;
      case 'kw':
        return ['Type', 'Prop', 'Sort', 'fun', 'sorry'].includes(t.text);
      case 'sym':
        if (t.text === '.' && this.peek().kind === 'ident' && !this.peek().ws) return true;
        return ['(', '⟨', '_', '?_', '@', '{', '·', 'λ', '∅', '!', '¬', '?'].includes(t.text);
      default:
        return false;
    }
  }

  private arg(): Arg {
    // named argument `(x := e)`
    if (this.isSym('(') && this.peek().kind === 'ident' && this.isSym(':=', this.peek(2))) {
      this.next();
      const n = this.next().text;
      this.next();
      const value = this.withPos(-1, () => this.term());
      this.expectSym(')');
      return { named: n, value };
    }
    return { value: this.term(ARG_PREC) };
  }

  private leading(minPrec: number): Term {
    const t = this.t;
    const from = t.from;
    switch (t.kind) {
      case 'ident': {
        this.next();
        // explicit universes `f.{u}` are not supported; ignore
        return { k: 'ident', name: t.text, from, to: t.to };
      }
      case 'num':
        this.next();
        return { k: 'num', value: BigInt(t.text), from, to: t.to };
      case 'str':
        this.next();
        return { k: 'str', value: t.text, from, to: t.to };
      case 'kw':
        return this.leadingKw(minPrec);
      case 'sym':
        return this.leadingSym(minPrec);
      case 'eof':
        this.unexpected('term');
      // falls through
      default:
        this.unexpected('term');
    }
  }

  private leadingKw(minPrec: number): Term {
    const t = this.t;
    const from = t.from;
    switch (t.text) {
      case 'Prop':
        this.next();
        return { k: 'sort', sort: 'Prop', level: null, from, to: t.to };
      case 'Type':
      case 'Sort': {
        this.next();
        let level: LevelSyntax | null = null;
        if (minPrec <= LEAD_PREC && this.colGt() && (this.t.kind === 'num' || this.t.kind === 'ident' || this.isSym('(') || this.isSym('_')) && this.t.line === t.line) {
          level = this.level(true);
        } else if (this.isSym('*')) {
          this.next();
          level = { k: 'hole' };
        }
        return { k: 'sort', sort: t.text as 'Type' | 'Sort', level, from, to: this.prevEnd() };
      }
      case 'sorry':
        this.next();
        return { k: 'sorry', from, to: t.to };
      case 'fun':
        return this.funTerm();
      case 'forall': {
        this.next();
        const binders = this.quantBinders();
        this.expectSym(',');
        const body = this.term();
        return { k: 'forall', binders, body, from, to: body.to };
      }
      case 'exists': {
        this.next();
        const binders = this.quantBinders();
        this.expectSym(',');
        const body = this.term();
        return { k: 'exists', binders, body, from, to: body.to };
      }
      case 'by':
        return this.byTerm();
      case 'have':
        return this.haveTerm();
      case 'suffices': {
        this.next();
        let name: string | null = null;
        if (this.t.kind === 'ident' && this.isSym(':', this.peek())) name = this.next().text;
        this.expectSym(':');
        const type = this.term();
        let value: Term;
        if (this.isKw('from')) {
          this.next();
          value = this.term();
        } else value = this.byTerm();
        if (this.isSym(';')) this.next();
        const body = this.term();
        return { k: 'suffices', name, type, value, body, from, to: body.to };
      }
      case 'show': {
        this.next();
        const type = this.term();
        let value: Term | null = null;
        if (this.isKw('from')) {
          this.next();
          value = this.term();
        } else if (this.isKw('by')) {
          value = this.byTerm();
        }
        return { k: 'show', type, value, from, to: this.prevEnd() };
      }
      case 'let': {
        const col = t.col;
        this.next();
        const n = this.ident();
        const binders = this.declBinders();
        let type: Term | null = null;
        if (this.isSym(':')) {
          this.next();
          type = this.term();
        }
        this.expectSym(':=');
        const value = this.withPos(col, () => this.term());
        if (this.isSym(';')) this.next();
        else if (this.isKw('in')) this.next();
        const body = this.term();
        return { k: 'let', name: n.text, binders, type, value, body, from, to: body.to };
      }
      case 'calc':
        return this.calcTerm();
      case 'match':
        return this.matchTerm();
      case 'if': {
        this.next();
        let hname: string | null = null;
        if (this.t.kind === 'ident' && this.isSym(':', this.peek())) {
          hname = this.next().text;
          this.next();
        }
        const cond = this.term();
        this.expectKw('then');
        const th = this.term();
        this.expectKw('else');
        const el = this.term();
        return { k: 'ite', cond, hname, then: th, else: el, from, to: el.to };
      }
      default:
        this.unexpected('term');
    }
  }

  /** `(x : A) → B`, `{x : A} → B`, `⦃x⦄ → B`: dependent arrows (tried with backtracking). */
  private tryDepArrow(): Term | null {
    const save = this.i;
    const saveDiags = this.diags.length;
    const from = this.t.from;
    try {
      const groups: BinderGroup[] = [];
      while (this.isSym('(') || this.isSym('{') || this.isSym('⦃') || this.isSym('[')) {
        const g = this.binderGroup();
        if (!g || (!g.type && g.bi !== 'strict' && g.bi !== 'implicit')) {
          this.i = save;
          return null;
        }
        groups.push(g);
      }
      if (groups.length === 0 || !(this.isSym('→') || this.isSym('->'))) {
        this.i = save;
        this.diags.length = saveDiags;
        return null;
      }
      this.next();
      const body = this.term(25);
      return { k: 'forall', binders: groups, body, from, to: body.to };
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      this.i = save;
      this.diags.length = saveDiags;
      this.aborted = false;
      return null;
    }
  }

  private leadingSym(minPrec: number): Term {
    const t = this.t;
    const from = t.from;
    if ((t.text === '(' || t.text === '{' || t.text === '⦃' || t.text === '[') && t.kind === 'sym') {
      const dep = this.tryDepArrow();
      if (dep) return dep;
    }
    switch (t.text) {
      case '(': {
        this.next();
        if (this.isSym(')')) {
          this.next();
          return { k: 'ident', name: 'Unit.unit', from, to: this.prevEnd() };
        }
        this.cdotStack.push(0);
        let inner: Term;
        let ncdots = 0;
        try {
          inner = this.withPos(-1, () => {
            const e = this.term();
            if (this.isSym(':')) {
              this.next();
              const ty = this.term();
              return { k: 'ascription', term: e, type: ty, from, to: ty.to } as Term;
            }
            if (this.isSym(',')) {
              const elems = [e];
              while (this.isSym(',')) {
                this.next();
                elems.push(this.term());
              }
              return { k: 'tuple', elems, from, to: this.prevEnd() } as Term;
            }
            return e;
          });
        } finally {
          ncdots = this.cdotStack.pop()!;
        }
        this.expectSym(')');
        const to = this.prevEnd();
        let res: Term;
        if (inner.k === 'ascription') res = { ...inner, to };
        else if (inner.k === 'tuple') res = { ...inner, to };
        else res = { k: 'paren', term: inner, from, to };
        if (ncdots > 0) {
          // `(· + 1)` ↦ `fun x => x + 1`
          const binders: FunBinder[] = [];
          for (let j = 0; j < ncdots; j++) {
            binders.push({ k: 'group', group: { names: [{ name: `x✝${j}`, from, to: from }], type: null, bi: 'default', from, to: from } });
          }
          return { k: 'fun', binders, body: res, from, to };
        }
        return res;
      }
      case '⟨': {
        this.next();
        const elems: Term[] = [];
        this.withPos(-1, () => {
          if (!this.isSym('⟩')) {
            elems.push(this.term());
            while (this.isSym(',')) {
              this.next();
              elems.push(this.term());
            }
          }
        });
        this.expectSym('⟩');
        return { k: 'anon', elems, from, to: this.prevEnd() };
      }
      case '{': {
        this.next();
        // set builder `{x | p}` / `{x : T | p}` / literal `{a, b}`
        if (this.t.kind === 'ident' && (this.isSym('|', this.peek()) || this.isSym(':', this.peek()))) {
          const save = this.i;
          const n = this.next();
          let type: Term | null = null;
          let ok = true;
          if (this.isSym(':')) {
            this.next();
            try {
              type = this.withPos(-1, () => this.term());
            } catch (e) {
              if (!(e instanceof ParseError)) throw e;
              ok = false;
            }
          }
          if (ok && this.isSym('|')) {
            this.next();
            const body = this.withPos(-1, () => this.term());
            this.expectSym('}');
            return { k: 'setBuilder', name: n.text, nameFrom: n.from, type, body, from, to: this.prevEnd() };
          }
          this.i = save;
        }
        const elems: Term[] = [];
        this.withPos(-1, () => {
          if (!this.isSym('}')) {
            elems.push(this.term());
            while (this.isSym(',')) {
              this.next();
              elems.push(this.term());
            }
          }
        });
        this.expectSym('}');
        return { k: 'setLit', elems, from, to: this.prevEnd() };
      }
      case '_':
        this.next();
        return { k: 'hole', from, to: t.to };
      case '?_':
        this.next();
        return { k: 'synthHole', name: null, from, to: t.to };
      case '?': {
        this.next();
        const n = this.ident();
        return { k: 'synthHole', name: n.text, from, to: n.to };
      }
      case '@': {
        this.next();
        const inner = this.leading(MAX_PREC);
        return { k: 'explicit', term: inner, from, to: inner.to };
      }
      case '·': {
        this.next();
        if (this.cdotStack.length === 0) this.fail('invalid occurrence of `·` notation', t);
        const j = this.cdotStack[this.cdotStack.length - 1]++;
        return { k: 'ident', name: `x✝${j}`, from, to: t.to };
      }
      case 'λ':
        return this.funTerm();
      case '∀': {
        this.next();
        const binders = this.quantBinders();
        this.expectSym(',');
        const body = this.term();
        return { k: 'forall', binders, body, from, to: body.to };
      }
      case '∃': {
        this.next();
        const binders = this.quantBinders();
        this.expectSym(',');
        const body = this.term();
        return { k: 'exists', binders, body, from, to: body.to };
      }
      case '¬': {
        this.next();
        const arg = this.term(40);
        return { k: 'unop', op: '¬', arg, from, to: arg.to };
      }
      case '!': {
        this.next();
        const arg = this.term(MAX_PREC);
        return { k: 'unop', op: '!', arg, from, to: arg.to };
      }
      case '-': {
        this.next();
        const arg = this.term(75);
        return { k: 'unop', op: '-', arg, from, to: arg.to };
      }
      case '∅':
        this.next();
        return { k: 'ident', name: '∅', from, to: t.to };
      case '.': {
        if (this.peek().kind === 'ident' && !this.peek().ws) {
          this.next();
          const n = this.next();
          return { k: 'dotIdent', name: n.text, from, to: n.to };
        }
        this.unexpected('term');
      }
      // falls through
      default:
        this.unexpected('term');
    }
  }

  private level(arg = false): LevelSyntax {
    const t = this.t;
    let l: LevelSyntax;
    if (t.kind === 'num') {
      this.next();
      l = { k: 'num', n: Number(t.text) };
    } else if (t.kind === 'ident' && (t.text === 'max' || t.text === 'imax') && !arg) {
      this.next();
      const args: LevelSyntax[] = [];
      while (this.t.kind === 'num' || this.t.kind === 'ident' || this.isSym('(')) args.push(this.level(true));
      l = { k: t.text as 'max' | 'imax', args };
    } else if (t.kind === 'ident') {
      this.next();
      l = { k: 'param', name: t.text };
    } else if (this.isSym('_')) {
      this.next();
      l = { k: 'hole' };
    } else if (this.isSym('(')) {
      this.next();
      l = this.level();
      this.expectSym(')');
    } else this.unexpected('universe level');
    if (!arg && this.isSym('+') && this.peek().kind === 'num') {
      this.next();
      const n = Number(this.next().text);
      l = { k: 'succ', l, n };
    }
    return l;
  }

  private funTerm(): Term {
    const from = this.next().from;
    if (this.isSym('|')) {
      const alts = this.matchAlts(this.posCol);
      return { k: 'funMatch', alts, from, to: this.prevEnd() };
    }
    const binders = this.funBinders();
    if (binders.length === 0) this.unexpected('binder');
    this.expectSym('=>');
    const body = this.term();
    return { k: 'fun', binders, body, from, to: body.to };
  }

  private haveTerm(): Term {
    const t = this.next();
    const col = t.col;
    let name: string | null = null;
    let pat: Term | null = null;
    if (this.t.kind === 'ident') name = this.next().text;
    else if (this.isSym('⟨')) pat = this.term(MAX_PREC);
    const binders = this.declBinders();
    let type: Term | null = null;
    if (this.isSym(':')) {
      this.next();
      type = this.term();
    }
    let value: Term;
    if (this.isSym(':=')) {
      this.next();
      value = this.withPos(col, () => this.term());
    } else if (this.isSym('|')) {
      const alts = this.matchAlts(col);
      value = { k: 'funMatch', alts, from: alts[0]?.from ?? this.t.from, to: this.prevEnd() };
    } else this.unexpected("':='");
    if (this.isSym(';')) this.next();
    else if (this.isKw('in')) this.next();
    const body = this.term();
    return { k: 'have', name, pat, binders, type, value, body, from: t.from, to: body.to };
  }

  private byTerm(): Term {
    const t = this.expectKw('by');
    const tactics = this.tacticSeq(t);
    return { k: 'by', tactics, from: t.from, to: Math.max(tactics.to, t.to) };
  }

  private calcSteps(): CalcStep[] {
    const steps: CalcStep[] = [];
    const first = this.t;
    const firstCol = first.col;
    const step = (): CalcStep => {
      const s = this.t;
      return this.withPos(s.col, () => {
        const rel = this.term();
        this.expectSym(':=');
        const proof = this.term();
        return { rel, proof, from: s.from, to: proof.to };
      });
    };
    steps.push(step());
    let stepsCol = -1;
    while (!this.aborted && this.t.bol && !this.isCommandStart() && this.canStartArg()) {
      const c = this.t.col;
      if (stepsCol < 0) {
        if (c <= this.posCol && !this.isSym('_')) break;
        stepsCol = c;
      } else if (c < stepsCol) break;
      if (c < Math.min(firstCol, stepsCol) && !this.isSym('_')) break;
      steps.push(step());
    }
    return steps;
  }

  private calcTerm(): Term {
    const t = this.next();
    const steps = this.calcSteps();
    return { k: 'calc', steps, from: t.from, to: this.prevEnd() };
  }

  private matchAlts(col: number): MatchAlt[] {
    const alts: MatchAlt[] = [];
    while (this.isSym('|') && !this.aborted) {
      const bar = this.next();
      const pats: Term[] = [];
      this.withPos(-1, () => {
        pats.push(this.term());
        while (this.isSym(',')) {
          this.next();
          pats.push(this.term());
        }
      });
      this.expectSym('=>');
      const rhs = this.withPos(col, () => this.term());
      alts.push({ pats, rhs, from: bar.from, to: rhs.to });
    }
    return alts;
  }

  private matchTerm(): Term {
    const t = this.next();
    const discrs: Term[] = [];
    this.withPos(-1, () => {
      discrs.push(this.term());
      while (this.isSym(',')) {
        this.next();
        discrs.push(this.term());
      }
    });
    this.expectKw('with');
    const alts = this.matchAlts(this.posCol);
    return { k: 'match', discrs, alts, from: t.from, to: this.prevEnd() };
  }

  /* ---------- tactics ---------- */

  /** A tactic sequence after `by` / `=>` / `·`: one column, `;` or newline separated. */
  private tacticSeq(owner: Token): TacticSeq {
    const first = this.t;
    const seq: TacticSeq = { tactics: [], from: first.from, to: owner.to };
    if (this.isCommandStart() || first.col <= this.posCol && first.bol) {
      // empty block: Lean reports a parse error
      this.recordError(new ParseError(`unexpected ${first.kind === 'eof' ? 'end of input' : `token '${first.text}'`}; expected '{' or tactic`, first.from, Math.max(first.to, first.from + 1)));
      this.aborted = true;
      seq.truncated = true;
      seq.from = owner.to;
      return seq;
    }
    const col = first.col;
    this.withPos(col, () => {
      for (;;) {
        if (this.aborted) {
          seq.truncated = true;
          break;
        }
        try {
          const tac = this.tacticWithCombinators();
          seq.tactics.push(tac);
          seq.to = tac.to;
        } catch (e) {
          if (!(e instanceof ParseError)) throw e;
          this.recordError(e);
          this.aborted = true;
          seq.truncated = true;
          break;
        }
        if (this.aborted) {
          seq.truncated = true;
          break;
        }
        if (this.isSym(';')) {
          this.next();
          if (this.t.bol && this.t.col < col) break;
          continue;
        }
        const t = this.t;
        if (t.kind === 'eof' || this.isCommandStart()) break;
        if (t.bol && t.col === col) continue;
        if (t.bol && t.col > col) {
          this.recordError(new ParseError(`unexpected token '${t.text}'; expected command`, t.from, t.to));
          this.aborted = true;
          seq.truncated = true;
          break;
        }
        break;
      }
    });
    return seq;
  }

  private tacticWithCombinators(): Tactic {
    let tac = this.tactic();
    while (this.isSym('<;>') && !this.aborted) {
      this.next();
      const rhs = this.tactic();
      tac = { k: 'seqAll', name: '<;>', nameTo: tac.to, first: tac, then: rhs, from: tac.from, to: rhs.to };
    }
    return tac;
  }

  private names(sameLine = true): { name: string; from: number; to: number }[] {
    const out: { name: string; from: number; to: number }[] = [];
    while ((this.t.kind === 'ident' || this.isSym('_')) && this.colGt() && (!sameLine || !this.t.bol)) {
      const n = this.next();
      out.push({ name: n.text, from: n.from, to: n.to });
    }
    return out;
  }

  private location(): Location | null {
    if (!this.isKw('at')) return null;
    this.next();
    const loc: Location = { hyps: [], goal: false, wildcard: false };
    for (;;) {
      if (this.isSym('*')) {
        this.next();
        loc.wildcard = true;
      } else if (this.isSym('⊢') || this.isSym('|-')) {
        this.next();
        loc.goal = true;
      } else if (this.t.kind === 'ident' && !this.t.bol) {
        const n = this.next();
        loc.hyps.push({ name: n.text, from: n.from, to: n.to });
      } else break;
    }
    if (!loc.wildcard && !loc.goal && loc.hyps.length === 0) this.unexpected('location');
    return loc;
  }

  private rwRules(): { rules: RwRule[]; from: number; to: number } {
    const open = this.expectSym('[');
    const rules: RwRule[] = [];
    this.withPos(-1, () => {
      if (!this.isSym(']')) {
        for (;;) {
          const s = this.t.from;
          let rev = false;
          if (this.isSym('←') || this.isSym('<-')) {
            this.next();
            rev = true;
          }
          const term = this.term();
          rules.push({ rev, term, from: s, to: term.to });
          if (this.isSym(',')) {
            this.next();
            continue;
          }
          break;
        }
      }
    });
    const close = this.expectSym(']');
    return { rules, from: open.from, to: close.to };
  }

  private inductionAlts(): InductionAlt[] {
    const alts: InductionAlt[] = [];
    while (this.isSym('|') && !this.aborted) {
      const bar = this.next();
      let nameTok: Token;
      if (this.isSym('_')) nameTok = this.next();
      else nameTok = this.ident();
      const vars = [];
      while (this.t.kind === 'ident' || this.isSym('_')) {
        const v = this.next();
        vars.push({ name: v.text, from: v.from, to: v.to });
      }
      const arrow = this.expectSym('=>');
      const tactics = this.tacticSeq(arrow);
      alts.push({
        name: nameTok.text,
        nameFrom: nameTok.from,
        nameTo: nameTok.to,
        vars,
        tactics,
        from: bar.from,
        to: Math.max(tactics.to, arrow.to),
      });
    }
    return alts;
  }

  private rpatAtom(): RPat {
    const t = this.t;
    if (t.kind === 'ident' || this.isSym('_')) {
      this.next();
      return { k: 'one', name: t.text, from: t.from, to: t.to };
    }
    if (this.isSym('-')) {
      this.next();
      return { k: 'clear', from: t.from, to: t.to };
    }
    if (this.isSym('⟨')) {
      this.next();
      const elems: RPat[] = [];
      if (!this.isSym('⟩')) {
        elems.push(this.rpat());
        while (this.isSym(',')) {
          this.next();
          elems.push(this.rpat());
        }
      }
      this.expectSym('⟩');
      return { k: 'tuple', elems, from: t.from, to: this.prevEnd() };
    }
    if (this.isSym('(')) {
      this.next();
      const p = this.rpat();
      if (this.isSym(':')) {
        this.next();
        const ty = this.withPos(-1, () => this.term());
        this.expectSym(')');
        return { k: 'typed', pat: p, type: ty, from: t.from, to: this.prevEnd() };
      }
      this.expectSym(')');
      return { k: 'paren', pat: p, from: t.from, to: this.prevEnd() };
    }
    this.unexpected('rcases pattern');
  }

  private rpat(): RPat {
    const first = this.rpatAtom();
    if (!this.isSym('|')) return first;
    const alts = [first];
    while (this.isSym('|')) {
      this.next();
      alts.push(this.rpatAtom());
    }
    return { k: 'alts', alts, from: first.from, to: this.prevEnd() };
  }

  private termsComma(): Term[] {
    const terms = [this.term()];
    while (this.isSym(',')) {
      this.next();
      terms.push(this.term());
    }
    return terms;
  }

  private tactic(): Tactic {
    const t = this.t;
    const from = t.from;
    // structural tactics
    if (this.isSym('·') || (this.isSym('.') && t.bol)) {
      const dot = this.next();
      const tactics = this.tacticSeq(dot);
      return { k: 'focus', name: '·', nameTo: dot.to, tactics, from, to: Math.max(tactics.to, dot.to) };
    }
    if (this.isSym('(')) {
      const open = this.next();
      const tactics = this.withPos(-1, () => this.tacticSeqInline(open));
      this.expectSym(')');
      return { k: 'paren', name: '(', nameTo: open.to, tactics, from, to: this.prevEnd() };
    }
    if (t.kind === 'kw') {
      switch (t.text) {
        case 'have':
        case 'let':
        case 'suffices':
        case 'show':
        case 'calc':
        case 'exists':
        case 'sorry':
          break;
        default:
          this.fail(`unexpected token '${t.text}'; expected tactic`);
      }
    } else if (t.kind !== 'ident') {
      this.fail(`unexpected token '${t.text}'; expected tactic`);
    }
    const name = t.text;
    if (name === 'case' || name === 'next') {
      this.next();
      let tag = '';
      if (name === 'case') {
        const tg = this.isSym('_') ? this.next() : this.ident();
        tag = tg.text;
      }
      const vars = [];
      while (this.t.kind === 'ident' || this.isSym('_')) {
        const v = this.next();
        vars.push({ name: v.text, from: v.from, to: v.to });
      }
      const arrow = this.expectSym('=>');
      const tactics = this.tacticSeq(arrow);
      return { k: 'case', name, nameTo: t.to, tag, vars, tactics, from, to: Math.max(tactics.to, arrow.to) };
    }
    const shape = TACTIC_SHAPES[name];
    if (!shape) {
      throw new ParseError(`unknown tactic '${name}'`, t.from, t.to, 'unknown-tactic', name);
    }
    this.next();
    const nameTo = t.to;
    const end = () => this.prevEnd();
    switch (shape) {
      case 'simple':
        return { k: 'simple', name, nameTo, from, to: end() };
      case 'simpleAt': {
        const loc = this.location();
        return { k: 'names', name, nameTo, names: [], loc, from, to: end() };
      }
      case 'intro': {
        const names: { name: string; from: number; to: number; pat?: Term }[] = [];
        while (this.colGt() && !this.t.bol && (this.t.kind === 'ident' || this.isSym('_') || this.isSym('⟨') || this.isSym('('))) {
          if (this.isSym('⟨') || this.isSym('(')) {
            const pat = this.term(MAX_PREC);
            names.push({ name: '', from: pat.from, to: pat.to, pat });
          } else {
            const n = this.next();
            names.push({ name: n.text, from: n.from, to: n.to });
          }
        }
        return { k: 'intro', name, nameTo, names, from, to: end() };
      }
      case 'rintro': {
        const pats: RPat[] = [];
        while (this.colGt() && !this.t.bol && (this.t.kind === 'ident' || this.isSym('_') || this.isSym('⟨') || this.isSym('(') || this.isSym('-'))) {
          pats.push(this.rpatAtom());
        }
        if (this.isSym(':')) {
          this.next();
          this.term();
        }
        if (pats.length === 0) this.unexpected('rintro pattern');
        return { k: 'rintro', name, nameTo, pats, from, to: end() };
      }
      case 'term': {
        const term = this.term();
        return { k: 'term', name, nameTo, term, from, to: end() };
      }
      case 'termAt': {
        const term = this.term();
        const loc = this.location();
        return { k: 'change', name, nameTo, term, loc, from, to: end() };
      }
      case 'terms': {
        const terms = this.termsComma();
        return { k: 'terms', name, nameTo, terms, from, to: end() };
      }
      case 'specialize': {
        const term = this.term();
        return { k: 'specialize', name, nameTo, term, from, to: end() };
      }
      case 'have': {
        if (name === 'show') {
          const term = this.term();
          return { k: 'term', name, nameTo, term, from, to: end() };
        }
        let hname: string | null = null;
        let pat: RPat | null = null;
        if (this.t.kind === 'ident') hname = this.next().text;
        else if (this.isSym('⟨')) pat = this.rpatAtom();
        else if (this.isSym('_')) {
          this.next();
          hname = '_';
        }
        const binders = this.declBinders();
        let type: Term | null = null;
        if (this.isSym(':')) {
          this.next();
          type = this.term();
        }
        let value: Term | null = null;
        if (this.isSym(':=')) {
          this.next();
          value = this.term();
        } else if (this.isSym('|')) {
          const alts = this.matchAlts(this.posCol);
          value = { k: 'funMatch', alts, from: alts[0]?.from ?? this.t.from, to: this.prevEnd() };
        } else if (name === 'suffices' && this.isKw('from')) {
          this.next();
          value = this.term();
        } else if (name === 'suffices' && this.isKw('by')) {
          value = this.byTerm();
        }
        if (!value && !type) this.unexpected("':='");
        return { k: 'have', name, nameTo, hname, pat, binders, type, value, isLet: name === 'let', from, to: end() };
      }
      case 'obtain': {
        let pat: RPat | null = null;
        if (!this.isSym(':') && !this.isSym(':=')) pat = this.rpat();
        let type: Term | null = null;
        if (this.isSym(':')) {
          this.next();
          type = this.term();
        }
        let value: Term | null = null;
        if (this.isSym(':=')) {
          this.next();
          value = this.term();
        }
        return { k: 'obtain', name, nameTo, pat, type, value, from, to: end() };
      }
      case 'cases': {
        let targetName: string | null = null;
        if (this.t.kind === 'ident' && this.isSym(':', this.peek())) {
          targetName = this.next().text;
          this.next();
        }
        const target = this.term();
        const generalizing: string[] = [];
        if (this.isKw('generalizing')) {
          this.next();
          for (const n of this.names()) generalizing.push(n.name);
        }
        let alts: InductionAlt[] | null = null;
        if (this.isKw('with')) {
          this.next();
          alts = this.inductionAlts();
          if (alts.length === 0 && !this.aborted) this.unexpected("'|'");
        }
        return { k: 'cases', name, nameTo, target, targetName, alts, generalizing, from, to: end() };
      }
      case 'rcases': {
        const targets = this.termsComma();
        let pat: RPat | null = null;
        if (this.isKw('with')) {
          this.next();
          pat = this.rpat();
        }
        return { k: 'rcases', name, nameTo, targets, pat, from, to: end() };
      }
      case 'byCases': {
        let hname: string | null = null;
        if (this.t.kind === 'ident' && this.isSym(':', this.peek())) {
          hname = this.next().text;
          this.next();
        }
        const prop = this.term();
        return { k: 'byCases', name, nameTo, hname, prop, from, to: end() };
      }
      case 'byContra': {
        let hname: string | null = null;
        if ((this.t.kind === 'ident' || this.isSym('_')) && !this.t.bol && this.colGt()) hname = this.next().text;
        return { k: 'byContra', name, nameTo, hname, from, to: end() };
      }
      case 'rw': {
        const r = this.rwRules();
        const loc = this.location();
        return { k: 'rw', name, nameTo, rules: r.rules, loc, rulesFrom: r.from, rulesTo: r.to, from, to: end() };
      }
      case 'nthRw': {
        const nt = this.t;
        if (nt.kind !== 'num') this.unexpected('number');
        this.next();
        const r = this.rwRules();
        const loc = this.location();
        return { k: 'nthRw', name, nameTo, n: Number(nt.text), rules: r.rules, loc, from, to: end() };
      }
      case 'calc': {
        const steps = this.calcSteps();
        return { k: 'calc', name, nameTo, steps, from, to: end() };
      }
      case 'names': {
        const names = this.names();
        const loc = this.location();
        return { k: 'names', name, nameTo, names, loc, from, to: end() };
      }
      case 'injection': {
        const names = this.names();
        if (this.isKw('with')) {
          this.next();
          names.push(...this.names());
        }
        return { k: 'names', name, nameTo, names, loc: null, from, to: end() };
      }
      case 'unfold': {
        const names = this.names();
        const loc = this.location();
        return { k: 'unfold', name, nameTo, names, loc, from, to: end() };
      }
      case 'comb': {
        const tactics = this.tacticSeq(t);
        return { k: 'combinator', name, nameTo, tactics, from, to: Math.max(tactics.to, nameTo) };
      }
      case 'first': {
        const alts: TacticSeq[] = [];
        while (this.isSym('|')) {
          const bar = this.next();
          alts.push(this.tacticSeq(bar));
        }
        if (alts.length === 0) this.unexpected("'|'");
        return { k: 'first', name, nameTo, alts, from, to: end() };
      }
      case 'simp': {
        let only = false;
        if (this.t.kind === 'ident' && this.t.text === 'only') {
          this.next();
          only = true;
        }
        let rules: RwRule[] = [];
        if (this.isSym('[')) rules = this.rwRules().rules;
        const loc = this.location();
        return { k: 'simp', name, nameTo, only, rules, loc, from, to: end() };
      }
      default:
        throw new ParseError(`unknown tactic '${name}'`, t.from, t.to, 'unknown-tactic', name);
    }
  }

  /** `(tac; tac)` — tactics separated by `;` or newlines, inside parentheses. */
  private tacticSeqInline(open: Token): TacticSeq {
    const seq: TacticSeq = { tactics: [], from: this.t.from, to: open.to };
    while (!this.isSym(')') && this.t.kind !== 'eof' && !this.aborted) {
      const tac = this.tacticWithCombinators();
      seq.tactics.push(tac);
      seq.to = tac.to;
      if (this.isSym(';')) this.next();
      else if (!this.t.bol) break;
    }
    return seq;
  }
}

export function sourceSlice(src: string, r: { from: number; to: number }): string {
  return src.slice(r.from, r.to);
}

export type { ParseError };
