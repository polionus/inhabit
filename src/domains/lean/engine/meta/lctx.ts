/**
 * Local contexts: the ordered list of hypotheses `x : A` (optionally `x : A := v`) a goal or
 * metavariable can see. Immutable; `push` returns a new context.
 */
import type { BinderInfo, Expr } from '../kernel/expr.ts';

export interface LocalDecl {
  readonly id: number;
  readonly userName: string;
  readonly type: Expr;
  readonly value?: Expr;
  readonly bi: BinderInfo;
  /** shown as `name✝` and not accessible by name */
  readonly inaccessible?: boolean;
  /** hidden from goal display (e.g. auxiliary recursion hypotheses) */
  readonly hidden?: boolean;
}

export class LocalContext {
  readonly decls: readonly LocalDecl[];
  private readonly ids: ReadonlySet<number>;

  constructor(decls: readonly LocalDecl[] = []) {
    this.decls = decls;
    this.ids = new Set(decls.map((d) => d.id));
  }

  static readonly empty = new LocalContext();

  push(d: LocalDecl): LocalContext {
    return new LocalContext([...this.decls, d]);
  }

  has(id: number): boolean {
    return this.ids.has(id);
  }

  get(id: number): LocalDecl | undefined {
    if (!this.ids.has(id)) return undefined;
    return this.decls.find((d) => d.id === id);
  }

  /** Most recent accessible declaration with this user name. */
  findByName(name: string): LocalDecl | undefined {
    for (let i = this.decls.length - 1; i >= 0; i--) {
      const d = this.decls[i];
      if (d.userName === name && !d.inaccessible) return d;
    }
    return undefined;
  }

  remove(ids: ReadonlySet<number>): LocalContext {
    return new LocalContext(this.decls.filter((d) => !ids.has(d.id)));
  }

  replace(d: LocalDecl): LocalContext {
    return new LocalContext(this.decls.map((x) => (x.id === d.id ? d : x)));
  }

  /** Insert `d` right after the declaration with id `after` (or at the end). */
  insertAfter(after: number | null, ds: LocalDecl[]): LocalContext {
    if (after === null) return new LocalContext([...ds, ...this.decls]);
    const i = this.decls.findIndex((x) => x.id === after);
    if (i < 0) return new LocalContext([...this.decls, ...ds]);
    return new LocalContext([...this.decls.slice(0, i + 1), ...ds, ...this.decls.slice(i + 1)]);
  }

  indexOf(id: number): number {
    return this.decls.findIndex((d) => d.id === id);
  }

  get size(): number {
    return this.decls.length;
  }
}
