/** Surface syntax trees produced by the parser. Every node carries its source range. */

export interface Range {
  from: number;
  to: number;
}

export type BinderKind = 'default' | 'implicit' | 'strict' | 'inst';

export interface BinderGroup extends Range {
  names: { name: string; from: number; to: number }[];
  type: Term | null;
  bi: BinderKind;
  /** `∀ x ∈ s, …` / `∃ x ∈ s, …`: binder predicate `∈ s` */
  pred?: { op: string; rhs: Term };
}

/** `fun` binders: either a binder group or a pattern like `⟨a, b⟩`. */
export type FunBinder = { k: 'group'; group: BinderGroup } | { k: 'pattern'; pat: Term };

export interface Arg {
  named?: string;
  value: Term;
}

export interface MatchAlt extends Range {
  pats: Term[];
  rhs: Term;
}

export type Term = Range &
  (
    | { k: 'ident'; name: string }
    | { k: 'num'; value: bigint }
    | { k: 'str'; value: string }
    | { k: 'sort'; sort: 'Prop' | 'Type' | 'Sort'; level: LevelSyntax | null }
    | { k: 'hole' }
    | { k: 'synthHole'; name: string | null }
    | { k: 'sorry' }
    | { k: 'app'; fn: Term; args: Arg[] }
    | { k: 'explicit'; term: Term }
    | { k: 'paren'; term: Term }
    | { k: 'ascription'; term: Term; type: Term }
    | { k: 'tuple'; elems: Term[] }
    | { k: 'anon'; elems: Term[] }
    | { k: 'fun'; binders: FunBinder[]; body: Term }
    | { k: 'funMatch'; alts: MatchAlt[] }
    | { k: 'forall'; binders: BinderGroup[]; body: Term }
    | { k: 'exists'; binders: BinderGroup[]; body: Term }
    | { k: 'arrow'; dom: Term; cod: Term }
    | { k: 'binop'; op: string; lhs: Term; rhs: Term; opFrom: number }
    | { k: 'unop'; op: string; arg: Term }
    | { k: 'proj'; term: Term; field: string; fieldFrom: number }
    | { k: 'by'; tactics: TacticSeq }
    | { k: 'have'; name: string | null; pat: Term | null; binders: BinderGroup[]; type: Term | null; value: Term; body: Term }
    | { k: 'suffices'; name: string | null; type: Term; value: Term; body: Term }
    | { k: 'show'; type: Term; value: Term | null }
    | { k: 'let'; name: string; binders: BinderGroup[]; type: Term | null; value: Term; body: Term }
    | { k: 'calc'; steps: CalcStep[] }
    | { k: 'setBuilder'; name: string; nameFrom: number; type: Term | null; body: Term }
    | { k: 'setLit'; elems: Term[] }
    | { k: 'cdot' }
    | { k: 'match'; discrs: Term[]; alts: MatchAlt[] }
    | { k: 'ite'; cond: Term; hname: string | null; then: Term; else: Term }
    | { k: 'dotIdent'; name: string }
    | { k: 'error' }
  );

export type LevelSyntax =
  | { k: 'num'; n: number }
  | { k: 'param'; name: string }
  | { k: 'succ'; l: LevelSyntax; n: number }
  | { k: 'max' | 'imax'; args: LevelSyntax[] }
  | { k: 'hole' };

export interface CalcStep extends Range {
  /** `_ = c` (lhs `_`) or a full relation */
  rel: Term;
  proof: Term;
}

/* ---------------- tactics ---------------- */

export interface TacticSeq extends Range {
  tactics: Tactic[];
  /** parse error encountered inside this block (the block is truncated there) */
  truncated?: boolean;
}

export interface RwRule extends Range {
  rev: boolean;
  term: Term;
}

export interface Location {
  /** hypothesis names; null entry = the goal `⊢` */
  hyps: { name: string; from: number; to: number }[];
  goal: boolean;
  wildcard: boolean;
}

/** rcases patterns */
export type RPat = Range &
  (
    | { k: 'one'; name: string } // name or `_`
    | { k: 'clear' } // `-`
    | { k: 'tuple'; elems: RPat[] }
    | { k: 'alts'; alts: RPat[] }
    | { k: 'typed'; pat: RPat; type: Term }
    | { k: 'paren'; pat: RPat }
  );

export interface InductionAlt extends Range {
  name: string;
  nameFrom: number;
  nameTo: number;
  vars: { name: string; from: number; to: number }[];
  tactics: TacticSeq;
}

export type Tactic = Range & { name: string; nameTo: number } & (
    | { k: 'simple' } // rfl, constructor, left, right, exfalso, assumption, contradiction, trivial, sorry, symm, …
    | { k: 'intro'; names: { name: string; from: number; to: number; pat?: Term }[] }
    | { k: 'term'; term: Term } // exact, apply, refine, use(single), exists, show, change …
    | { k: 'terms'; terms: Term[] } // use a, b ; exists a, b
    | { k: 'have'; hname: string | null; pat: RPat | null; binders: BinderGroup[]; type: Term | null; value: Term | null; isLet?: boolean }
    | { k: 'change'; term: Term; loc: Location | null }
    | { k: 'cases'; target: Term; targetName: string | null; alts: InductionAlt[] | null; generalizing: string[] }
    | { k: 'rcases'; targets: Term[]; pat: RPat | null }
    | { k: 'obtain'; pat: RPat | null; type: Term | null; value: Term | null }
    | { k: 'rintro'; pats: RPat[] }
    | { k: 'rw'; rules: RwRule[]; loc: Location | null; rulesFrom: number; rulesTo: number }
    | { k: 'byCases'; hname: string | null; prop: Term }
    | { k: 'byContra'; hname: string | null }
    | { k: 'names'; names: { name: string; from: number; to: number }[]; loc: Location | null } // clear, revert, subst, ext, funext, unfold, specialize?, rename_i, injection
    | { k: 'specialize'; term: Term }
    | { k: 'focus'; tactics: TacticSeq } // · tacs
    | { k: 'paren'; tactics: TacticSeq } // ( tacs )
    | { k: 'case'; tag: string; vars: { name: string; from: number; to: number }[]; tactics: TacticSeq }
    | { k: 'combinator'; tactics: TacticSeq } // all_goals, any_goals, repeat, try, focus
    | { k: 'first'; alts: TacticSeq[] }
    | { k: 'seqAll'; first: Tactic; then: Tactic } // t <;> t'
    | { k: 'calc'; steps: CalcStep[] }
    | { k: 'unfold'; names: { name: string; from: number; to: number }[]; loc: Location | null }
    | { k: 'simp'; only: boolean; rules: RwRule[]; loc: Location | null }
    | { k: 'exactAbsurd'; term: Term }
    | { k: 'nthRw'; n: number; rules: RwRule[]; loc: Location | null }
  );

/* ---------------- commands ---------------- */

export interface DeclModifiers {
  doc?: string;
  attrs: string[];
  isProtected: boolean;
  isPrivate: boolean;
  noncomputable: boolean;
}

export type DeclBody =
  | { k: 'term'; term: Term }
  | { k: 'eqns'; alts: MatchAlt[] }
  | { k: 'none' };

export interface CtorSyntax extends Range {
  name: string;
  nameFrom: number;
  binders: BinderGroup[];
  type: Term | null;
  doc?: string;
}

export interface FieldSyntax extends Range {
  names: string[];
  binders: BinderGroup[];
  type: Term;
}

export type Command = Range &
  (
    | {
        k: 'decl';
        kind: 'theorem' | 'def' | 'example' | 'axiom' | 'abbrev' | 'instance' | 'opaque';
        mods: DeclModifiers;
        name: string | null;
        nameFrom: number;
        nameTo: number;
        binders: BinderGroup[];
        type: Term | null;
        body: DeclBody;
      }
    | { k: 'inductive'; mods: DeclModifiers; name: string; nameFrom: number; nameTo: number; binders: BinderGroup[]; type: Term | null; ctors: CtorSyntax[] }
    | { k: 'structure'; mods: DeclModifiers; name: string; nameFrom: number; nameTo: number; binders: BinderGroup[]; type: Term | null; ctorName: string | null; fields: FieldSyntax[] }
    | { k: 'check' | 'eval' | 'reduce' | 'checkFailure'; term: Term }
    | { k: 'print'; name: string; nameFrom: number; nameTo: number }
    | { k: 'open'; names: { name: string; from: number; to: number }[]; hiding?: string[]; inCmd: Command | null }
    | { k: 'namespace'; name: string }
    | { k: 'section'; name: string | null }
    | { k: 'end'; name: string | null }
    | { k: 'variable'; binders: BinderGroup[] }
    | { k: 'universe'; names: string[] }
    | { k: 'skip' }
    | { k: 'attribute'; attrs: string[]; names: string[] }
  );
