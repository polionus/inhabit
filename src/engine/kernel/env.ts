/**
 * Global environment: an immutable map from names to constant declarations.
 * `add` returns a new environment; old ones stay valid (persistent, layered maps).
 */
import type { Expr } from './expr.ts';

export type Reducibility = 'reducible' | 'instance' | 'default' | 'irreducible';

export interface InductiveInfo {
  numParams: number;
  numIndices: number;
  ctors: string[];
  isRec: boolean;
  /** lives in Prop */
  isProp: boolean;
  /** recursor can eliminate into any Sort */
  largeElim: boolean;
  /** structure-like: one constructor, no indices; field names in order */
  fields?: string[];
}

export interface CtorInfo {
  induct: string;
  idx: number;
  numParams: number;
  numFields: number;
}

export interface RecRule {
  ctor: string;
  numFields: number;
  /** closed: λ params motive minors fields, … */
  rhs: Expr;
}

export interface RecInfo {
  induct: string;
  numParams: number;
  numIndices: number;
  numMinors: number;
  rules: RecRule[];
}

/** A pattern in an equation-compiled (structurally recursive) definition. */
export type Pat =
  | { k: 'var' }
  | { k: 'wild' }
  | { k: 'ctor'; name: string; numParams: number; args: Pat[] }
  | { k: 'lit'; value: bigint };

export interface MatchAlt {
  pats: Pat[];
  /** closed term: λ (pattern variables in order), rhs — may mention the defined constant */
  rhs: Expr;
  numVars: number;
}

/**
 * `f x₁ … xₙ` reduces by matching `xᵢ` (for i in `discrs`) against the patterns,
 * after the first `numFixed` arguments are passed through as fixed parameters.
 */
export interface MatchDef {
  numFixed: number;
  arity: number;
  alts: MatchAlt[];
}

export type ConstKind = 'def' | 'theorem' | 'axiom' | 'inductive' | 'ctor' | 'rec' | 'opaque';

export interface ConstDecl {
  name: string;
  kind: ConstKind;
  levelParams: string[];
  type: Expr;
  value?: Expr;
  reducibility?: Reducibility;
  /** definitional height for lazy delta reduction */
  height?: number;
  ind?: InductiveInfo;
  ctor?: CtorInfo;
  rec?: RecInfo;
  /** equation-compiled definitions (reduce by pattern matching) */
  matchDef?: MatchDef;
  doc?: string;
  /** user-facing declaration kind (theorem/def/example/structure/…) */
  userKind?: 'theorem' | 'def' | 'axiom' | 'inductive' | 'structure' | 'instance' | 'constructor' | 'recursor';
  /** `protected`: not accessible by its short name after `open` */
  isProtected?: boolean;
  /** declaration uses sorry */
  usesSorry?: boolean;
  /** pretty-printing: `@[app notation]` hints */
  pp?: string;
}

export class Environment {
  readonly __brand = 'Env' as const;
  private readonly local: Map<string, ConstDecl>;
  private readonly parent: Environment | null;
  private readonly depth: number;
  /** namespaces that exist (prefixes of declared names) */
  private readonly nsLocal: Set<string>;

  private constructor(parent: Environment | null, local: Map<string, ConstDecl>, ns: Set<string>, depth: number) {
    this.parent = parent;
    this.local = local;
    this.nsLocal = ns;
    this.depth = depth;
  }

  static empty(): Environment {
    return new Environment(null, new Map(), new Set(), 0);
  }

  get(name: string): ConstDecl | undefined {
    let e: Environment | null = this;
    while (e) {
      const d = e.local.get(name);
      if (d) return d;
      e = e.parent;
    }
    return undefined;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  isNamespace(ns: string): boolean {
    let e: Environment | null = this;
    while (e) {
      if (e.nsLocal.has(ns)) return true;
      e = e.parent;
    }
    return false;
  }

  /** Add declarations, returning a new environment. */
  add(...decls: ConstDecl[]): Environment {
    const m = new Map<string, ConstDecl>();
    const ns = new Set<string>();
    for (const d of decls) {
      m.set(d.name, d);
      const parts = d.name.split('.');
      for (let i = 1; i < parts.length; i++) ns.add(parts.slice(0, i).join('.'));
    }
    if (this.depth >= 24) {
      // flatten to keep lookups fast
      const all = new Map<string, ConstDecl>();
      const allNs = new Set<string>();
      this.forEach((d) => all.set(d.name, d));
      this.forEachNs((n) => allNs.add(n));
      for (const [k, v] of m) all.set(k, v);
      for (const n of ns) allNs.add(n);
      return new Environment(null, all, allNs, 0);
    }
    return new Environment(this, m, ns, this.depth + 1);
  }

  forEach(f: (d: ConstDecl) => void): void {
    const seen = new Set<string>();
    let e: Environment | null = this;
    while (e) {
      for (const [k, v] of e.local) {
        if (!seen.has(k)) {
          seen.add(k);
          f(v);
        }
      }
      e = e.parent;
    }
  }

  private forEachNs(f: (n: string) => void): void {
    let e: Environment | null = this;
    while (e) {
      for (const n of e.nsLocal) f(n);
      e = e.parent;
    }
  }

  names(): string[] {
    const out: string[] = [];
    this.forEach((d) => out.push(d.name));
    return out;
  }
}
