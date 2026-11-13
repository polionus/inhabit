/**
 * Quick items: multiple choice, answerable in seconds. Every correct answer is computed — by
 * running the engine (goal states, which tactic works, types, which term checks) or by the prover
 * and truth tables (provability) — never asserted by hand.
 */
import type { QuickKind, QuickOption, Rng } from '../types.ts';
import type { Goal } from '../../engine/types.ts';
import { engine } from '../../engine/index.ts';
import { atom, atomNames, classify, countermodel, imp, not, and, or, parse, show, substAtoms } from './logic.ts';
import type { F } from './logic.ts';
import { buildProp, propAttempt, PROP_SCHEMAS, uncurry, searchTarget, CLASSICAL_TACTICS, PROP_TACTICS } from './prop.ts';
import { typeAttempt, typeLang } from './inhabit.ts';
import { flatTerm } from './emit.ts';
import type { Pf } from './search.ts';

export interface QuickItem {
  quick: QuickKind;
  rating: number;
  prompt: string;
  code?: string;
  options: QuickOption[];
  themes: string[];
  /** Lean snippets for real-Lean verification: must compile (`ok`) / must fail (`bad`). */
  verify: { ok: string[]; bad: string[] };
}

const env = () => engine.baseEnv();
const tick = (s: string) => '`' + s + '`';

/* ------------------------------------------------------------------ goal states */

const hasInaccessible = (g: Goal) => g.hyps.some((h) => h.names.some((n) => n.includes('✝'))) || g.target.includes('✝');

/** A theorem whose statement is the goal `g`. */
export function stateTheorem(g: Goal): string {
  const binders = g.hyps.map((h) => `(${h.names.join(' ')} : ${h.type})`).join(' ');
  return `theorem t ${binders} : ${g.target} := by`;
}

/** Infoview rendering. */
export function stateCode(g: Goal): string {
  return [...g.hyps.map((h) => `${h.names.join(' ')} : ${h.type}`), `⊢ ${g.target}`].join('\n');
}

/** One-line rendering of the proof hypotheses and target. */
function goalLine(g: Goal): string {
  const hs = g.hyps.filter((h) => h.isProof).map((h) => `${h.names.join(' ')} : ${h.type}`);
  return (hs.length ? hs.join(', ') + ' ' : '') + '⊢ ' + g.target;
}
function goalsText(gs: Goal[]): string {
  if (gs.length === 0) return 'No goals: the proof is complete';
  if (gs.length === 1) return tick(goalLine(gs[0]));
  return `${gs.length} goals: ` + gs.map((g) => tick(goalLine(g))).join(' and ');
}

interface Run {
  ok: boolean;
  after: Goal[];
  message: string;
}
/** Run one tactic on a goal state. */
function runTac(g: Goal, tac: string): Run {
  const src = stateTheorem(g) + '\n  ' + tac;
  const r = engine.check(env(), src, {});
  const errs = r.diagnostics.filter((d) => d.severity === 'error' && d.code !== 'unsolved-goals');
  const step = r.steps[0];
  if (errs.length || !step || !step.ok) return { ok: false, after: [], message: errs[0]?.message ?? 'failed' };
  return { ok: true, after: step.after, message: '' };
}

/** Pick a step of a generated proof whose state is clean. */
function proofSteps(rng: Rng, target: number): { tac: string; kind: string; before: Goal }[] {
  const b = searchTarget(rng, Math.max(450, Math.min(1100, target - 100)), (r) => propAttempt(r, Math.max(450, target - 100), 'tactic', 'prop'), 20, 200);
  if (!b) return [];
  const src = b.header + '\n' + b.solution;
  const r = engine.check(env(), src, { allowedTactics: [...PROP_TACTICS, ...CLASSICAL_TACTICS] });
  if (!r.complete) return [];
  const out: { tac: string; kind: string; before: Goal }[] = [];
  for (const s of r.steps) {
    const text = src.slice(s.from, s.to).trim().replace(/^·\s*/, '');
    if (!s.before[0] || hasInaccessible(s.before[0]) || text.includes('\n') || text.endsWith('with')) continue;
    out.push({ tac: text, kind: s.tactic, before: s.before[0] });
  }
  return out;
}

const KIND_WHY: Record<string, string> = {
  intro: '`intro` moves the assumption into the context; the goal becomes what was to the right of the arrow.',
  constructor: '`constructor` splits the goal into one goal per part.',
  left: '`left` commits to proving the left side of the disjunction.',
  right: '`right` commits to proving the right side of the disjunction.',
  obtain: '`obtain ⟨a, b⟩ := h` replaces `h` by its two parts.',
  apply: '`apply h` matches the conclusion of `h` with the goal and leaves its premises to prove.',
  exfalso: '`exfalso` replaces any goal by `False`.',
  exact: '`exact` closes the goal with a term of exactly its type.',
  rcases: '`rcases` takes the hypothesis apart into its pieces.',
  cases: '`cases` splits a hypothesis into its cases.',
  by_contra: '`by_contra h` assumes the negation of the goal and asks for `False`.',
  by_cases: '`by_cases` splits into a case where the proposition holds and one where it does not.',
};

function alternatives(g: Goal): string[] {
  const proofHyps = g.hyps.filter((h) => h.isProof).flatMap((h) => h.names);
  return [
    'intro h',
    'constructor',
    'left',
    'right',
    'exfalso',
    ...proofHyps.map((n) => `apply ${n}`),
    ...proofHyps.map((n) => `exact ${n}`),
    ...proofHyps.map((n) => `obtain ⟨a, b⟩ := ${n}`),
  ];
}

function stateRating(g: Goal, kind: string, base: number): number {
  const hyps = g.hyps.filter((h) => h.isProof).length;
  const len = g.target.length + g.hyps.reduce((a, h) => a + h.type.length, 0);
  const kb: Record<string, number> = { intro: 0, left: 40, right: 40, constructor: 60, exfalso: 120, obtain: 120, exact: 80, apply: 200 };
  return Math.round(base + (kb[kind] ?? 100) + 45 * Math.max(0, hyps - 1) + 4 * Math.max(0, len - 8));
}

function goalAfter(rng: Rng, target: number): QuickItem | null {
  const steps = proofSteps(rng.fork('proof'), target).filter((s) =>
    ['intro', 'constructor', 'left', 'right', 'obtain', 'apply', 'exfalso'].includes(s.kind),
  );
  if (!steps.length) return null;
  const s = rng.pick(steps);
  const run = runTac(s.before, s.tac);
  if (!run.ok) return null;
  const correct = goalsText(run.after);
  const opts: QuickOption[] = [{ text: correct, correct: true, why: `${KIND_WHY[s.kind] ?? 'This is the state the engine computes.'}` }];
  const seen = new Set([correct]);
  const distract: QuickOption[] = [];
  for (const alt of rng.shuffle(alternatives(s.before).filter((a) => !a.startsWith('obtain')))) {
    if (alt === s.tac || (alt.split(' ')[0] === s.tac.split(' ')[0] && s.kind !== 'apply')) continue;
    const r2 = runTac(s.before, alt);
    if (!r2.ok) continue;
    const t = goalsText(r2.after);
    if (seen.has(t)) continue;
    seen.add(t);
    distract.push({ text: t, correct: false, why: `That is what ${tick(alt)} would leave, not ${tick(s.tac)}.` });
  }
  const unchanged = goalsText([s.before]);
  if (!seen.has(unchanged)) {
    seen.add(unchanged);
    distract.unshift({ text: unchanged, correct: false, why: `That is the state before the tactic: ${tick(s.tac)} does change it.` });
  }
  if (distract.length === 0) return null;
  const n = Math.min(distract.length, 1 + rng.int(3));
  const options = rng.shuffle([...opts, ...distract.slice(0, Math.max(1, n))]);
  return {
    quick: 'goal-after',
    rating: stateRating(s.before, s.kind, 380),
    prompt: `What is the proof state after ${tick(s.tac)}?`,
    code: stateCode(s.before),
    options,
    themes: ['goal state', s.kind],
    verify: { ok: [`${stateTheorem(s.before)}\n  ${s.tac}\n  all_goals sorry`], bad: [] },
  };
}

function whyFail(alt: string, g: Goal): string {
  const [t, n] = alt.split(' ');
  switch (t) {
    case 'intro':
      return '`intro` needs a goal of the form `A → B`, `¬A` or `∀ x, …`.';
    case 'constructor':
      return '`constructor` needs a goal built from one constructor, such as `A ∧ B` or `A ↔ B`.';
    case 'left':
    case 'right':
      return `${tick(t)} needs a disjunction as the goal.`;
    case 'exact': {
      const h = g.hyps.find((x) => x.names.includes(n));
      return h ? `${tick(n)} has type ${tick(h.type)}, which is not the goal.` : `${tick(n)} does not have the goal's type.`;
    }
    case 'apply':
      return `The conclusion of ${tick(n)} does not match the goal ${tick(g.target)}.`;
    case 'obtain':
      return `${tick(alt.split(':= ')[1])} is not a conjunction (or ∃), so there is nothing to take apart.`;
    default:
      return 'The engine rejects it here.';
  }
}

function nextTactic(rng: Rng, target: number): QuickItem | null {
  const steps = proofSteps(rng.fork('proof'), target).filter((s) => s.kind !== 'exfalso');
  if (!steps.length) return null;
  const s = rng.pick(steps);
  if (!runTac(s.before, s.tac).ok) return null;
  const opts: QuickOption[] = [{ text: tick(s.tac), correct: true, why: `${tick(s.tac)} works here. ${KIND_WHY[s.kind] ?? ''}`.trim() }];
  const seen = new Set([s.tac]);
  const bad: string[] = [];
  for (const alt of rng.shuffle(alternatives(s.before).filter((a) => a !== 'exfalso'))) {
    if (seen.has(alt) || opts.length >= 4) continue;
    seen.add(alt);
    if (runTac(s.before, alt).ok) continue;
    opts.push({ text: tick(alt), correct: false, why: whyFail(alt, s.before) });
    bad.push(`${stateTheorem(s.before)}\n  ${alt}\n  all_goals sorry`);
  }
  if (opts.length < 3) return null;
  return {
    quick: 'next-tactic',
    rating: stateRating(s.before, s.kind, 430),
    prompt: 'Exactly one of these tactics works on this goal. Which one?',
    code: stateCode(s.before),
    options: rng.shuffle(opts),
    themes: ['tactics', s.kind],
    verify: { ok: [`${stateTheorem(s.before)}\n  ${s.tac}\n  all_goals sorry`], bad },
  };
}

/* ------------------------------------------------------------------ provable */

const SCHEMA_F = PROP_SCHEMAS.map(([s]) => parse(s));

/** A plausible-looking statement: a schema, or a schema with a typical mistake. */
function provableCand(rng: Rng): F {
  const f = rng.pick(SCHEMA_F);
  const names = atomNames(f);
  const perm = rng.shuffle(['P', 'Q', 'R', 'S'].slice(0, Math.max(2, names.length)));
  let g = substAtoms(f, Object.fromEntries(names.map((n, i) => [n, atom(perm[i])])));
  const mut = rng.int(5);
  const { hyps, goal } = uncurry(g);
  if (mut === 1 && hyps.length === 1) g = imp(goal, hyps[0]); // converse
  if (mut === 2) g = swapAndOr(g, rng);
  if (mut === 3 && hyps.length >= 1) g = imp(hyps[0], goal.t === 'not' ? goal.a : not(goal)); // flip conclusion
  if (mut === 4 && hyps.length >= 2) g = imp(hyps[1], goal); // drop a premise
  return g;
}
function swapAndOr(f: F, rng: Rng): F {
  let done = false;
  const go = (g: F): F => {
    if (done) return g;
    if ((g.t === 'and' || g.t === 'or') && rng.next() < 0.5) {
      done = true;
      return g.t === 'and' ? or(g.a, g.b) : and(g.a, g.b);
    }
    if (g.t === 'not') return not(go(g.a));
    if (g.t === 'and' || g.t === 'or' || g.t === 'imp' || g.t === 'iff') return { t: g.t, a: go(g.a), b: go(g.b) };
    return g;
  };
  return go(f);
}

function provable(rng: Rng, target: number): QuickItem | null {
  const three = target >= 900;
  const want = three ? rng.pick(['intuitionistic', 'invalid', 'classical'] as const) : rng.pick(['intuitionistic', 'invalid'] as const);
  for (let i = 0; i < 40; i++) {
    const f = provableCand(rng.fork('c' + i));
    const v = classify(f);
    if (v !== want) continue;
    const vars = atomNames(f).sort();
    const stmt = show(f);
    if (stmt.length > 48) continue;
    const verify: { ok: string[]; bad: string[] } = { ok: [], bad: [] };
    let proofWhy = 'a constructive proof exists';
    if (v !== 'invalid') {
      const b = buildProp({ hyps: [], goal: f }, { family: 'prop', mode: v === 'classical' ? 'tactic' : 'term', hypStyle: false, allowClassical: true, allowTrivial: true, maxCost: 24 });
      if (!b) continue;
      verify.ok.push(b.header + '\n' + b.solution);
      const flat = b.term?.trim().replace(/\s+/g, ' ');
      if (flat && flat.length <= 60) proofWhy = `for example ${tick(flat)}`;
    }
    const cm = countermodel(f);
    const cmText = cm
      ? Object.entries(cm)
          .map(([k, val]) => `${k} ${val ? 'true' : 'false'}`)
          .join(', ')
      : '';
    const opt = (label: string, kind: typeof v): QuickOption => {
      const correct = kind === v;
      let why: string;
      if (v === 'intuitionistic') why = correct ? `It is provable: ${proofWhy}.` : `It is provable without classical logic: ${proofWhy}.`;
      else if (v === 'invalid') why = correct ? `With ${cmText} the statement is false, so no proof can exist.` : `No: with ${cmText} the statement is false.`;
      else
        why = correct
          ? 'It holds in every truth table, but every proof needs excluded middle (`by_cases` or `by_contra`).'
          : kind === 'intuitionistic'
            ? 'It is true, but no constructive proof exists: it needs excluded middle.'
            : 'It holds in every truth table, so it is not refutable; a classical proof exists.';
      return { text: label, correct, why };
    };
    const options = three
      ? [opt('Provable', 'intuitionistic'), opt('Only with classical logic', 'classical'), opt('Not provable', 'invalid')]
      : [opt('Provable', 'intuitionistic'), opt('Not provable', 'invalid')];
    const size = stmt.length;
    const rating = Math.round(420 + 9 * size + (three ? 250 : 0) + (v === 'classical' ? 150 : 0));
    return {
      quick: 'provable',
      rating,
      prompt: `For all propositions ${vars.join(', ')}: can this be proved in Lean?`,
      code: stmt,
      options,
      themes: ['provability', v === 'classical' ? 'classical' : v === 'invalid' ? 'countermodel' : 'constructive'],
      verify,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ types and terms */

function mutateType(f: F, rng: Rng): F[] {
  const out: F[] = [];
  if (f.t === 'imp') {
    out.push(imp(f.b, f.a));
    if (f.b.t === 'imp') out.push(imp(f.b.a, imp(f.a, f.b.b)));
    const { hyps, goal } = uncurry(f);
    const other = ['A', 'B', 'C'].filter((x) => !(goal.t === 'atom' && goal.p === x));
    out.push(hyps.reduceRight((acc, h) => imp(h, acc), atom(rng.pick(other)) as F));
    if (hyps.length > 1) out.push(hyps.slice(1).reduceRight((acc, h) => imp(h, acc), goal));
    if (goal.t === 'and') out.push(hyps.reduceRight((acc, h) => imp(h, acc), and(goal.b, goal.a) as F));
  } else if (f.t === 'and') {
    out.push(and(f.b, f.a), imp(f.a, f.b));
  } else {
    for (const x of ['A', 'B', 'C']) if (!(f.t === 'atom' && f.p === x)) out.push(atom(x));
  }
  return out;
}

/** Peel `k` intros off a type-flavour proof: their names/types become a lambda with annotations. */
function annotatedTerm(pf: Pf, type: F): { term: string; rest: F } | null {
  const ps: string[] = [];
  let p = pf;
  let t = type;
  while (p.k === 'intro' && t.t === 'imp') {
    if (p.body.k === 'andE' && p.body.h === p.name) return null;
    ps.push(`(${p.name} : ${show(t.a, typeLang.style)})`);
    p = p.body;
    t = t.b;
  }
  if (!ps.length) return null;
  return { term: `fun ${ps.join(' ')} => ${flatTerm(p, typeLang)}`, rest: type };
}

function typeOf(rng: Rng, target: number): QuickItem | null {
  const b = typeAttempt(rng.fork('t'), Math.min(900, target));
  if (!b || b.header.includes(') (')) return null; // want implication-style statements
  const at = annotatedTerm(b.pf, b.type);
  if (!at || at.term.length > 64) return null;
  const binders = '(A B C : Type)';
  const e = engine.elab(env(), at.term, binders);
  if (!e.ok || !e.type) return null;
  const correct = e.type;
  const opts: QuickOption[] = [{ text: tick(correct), correct: true, why: 'Each annotated parameter contributes an arrow, and the body has the final type.' }];
  const seen = new Set([correct]);
  for (const m of rng.shuffle(mutateType(b.type, rng))) {
    const s = show(m, typeLang.style);
    if (seen.has(s) || opts.length >= 4) continue;
    const el = engine.elab(env(), `(fun (x : ${s}) => x)`, binders);
    if (!el.ok || engine.defEq(env(), s, correct, binders)) continue;
    seen.add(s);
    opts.push({ text: tick(s), correct: false, why: `The term does not have this type: its parameters and result are ${tick(correct)}.` });
  }
  if (opts.length < 3) return null;
  return {
    quick: 'type-of',
    rating: Math.round(420 + 7 * at.term.length + (b.type.t === 'imp' && b.type.a.t === 'imp' ? 120 : 0)),
    prompt: 'With `A B C : Type`, what is the type of this term?',
    code: at.term,
    options: rng.shuffle(opts),
    themes: ['types', 'functions'],
    verify: { ok: [`example ${binders} : ${correct} := ${at.term}`], bad: [] },
  };
}

function mutateTerm(t: string): string[] {
  const out: string[] = [];
  const swap = (a: string, b: string) => {
    if (t.includes(a)) out.push(t.replace(a, '\u0000').replace(b, a).replace('\u0000', b));
  };
  if (t.includes('.1')) out.push(t.replace('.1', '.2'));
  if (t.includes('.2')) out.push(t.replace('.2', '.1'));
  if (t.includes('Or.inl')) out.push(t.replace('Or.inl', 'Or.inr'));
  if (t.includes('Or.inr')) out.push(t.replace('Or.inr', 'Or.inl'));
  // swap the first two parameters of the outer `fun`
  const m = t.match(/^fun (\S+) (\S+) =>/);
  if (m && m[1] !== m[2]) out.push(t.replace(/^fun (\S+) (\S+) =>/, `fun ${m[2]} ${m[1]} =>`));
  // swap the components of a pair
  const pair = t.match(/[(⟨]([a-z][\w'₂]*), ([a-z][\w'₂]*)[)⟩]/);
  if (pair) swap(pair[1] + ', ' + pair[2], pair[2] + ', ' + pair[1]);
  // use a different bound variable in the last argument position
  const params = [...new Set((t.match(/fun ([^=]*)=>/g) ?? []).flatMap((m) => m.slice(4, -2).match(/[a-z][\w'₂]*/g) ?? []))];
  const lastId = t.match(/([a-z][\w'₂]*)(?=[)⟩\s]*$)/);
  if (lastId && params.includes(lastId[1])) {
    const at = t.lastIndexOf(lastId[1]);
    for (const o of params) if (o !== lastId[1]) out.push(t.slice(0, at) + o + t.slice(at + lastId[1].length));
  }
  const balanced = (x: string) => ['()', '⟨⟩'].every(([o, c]) => x.split(o).length === x.split(c).length);
  return out.map((x) => x.replace(/\u0000/g, '')).filter(balanced);
}

function inhabitant(rng: Rng, target: number): QuickItem | null {
  const useType = rng.next() < 0.5;
  const b = useType ? typeAttempt(rng.fork('t'), Math.min(1000, target)) : propAttempt(rng.fork('p'), Math.min(1100, target), 'term', 'inhabit');
  if (!b || !b.term) return null;
  const term = b.term.trim().replace(/\s+/g, ' ');
  if (term.length > 56) return null;
  const head = b.header.replace(/^(theorem|def) puzzle /, '').replace(/ :=$/, '');
  const kw = useType ? 'def' : 'theorem';
  const check = (t: string) => engine.check(env(), `${kw} puzzle ${head} :=\n  ${t}`, { allowedTactics: [] });
  if (!check(term).complete) return null;
  const opts: QuickOption[] = [{ text: tick(term), correct: true, why: 'It typechecks: every application gets an argument of the type it expects.' }];
  const seen = new Set([term]);
  const bad: string[] = [];
  for (const m of rng.shuffle(mutateTerm(term))) {
    if (seen.has(m) || opts.length >= 4) continue;
    seen.add(m);
    const r = check(m);
    if (r.complete || !r.diagnostics.some((d) => d.severity === 'error')) continue;
    const d = r.diagnostics.find((x) => x.severity === 'error')!;
    if (d.code === 'parse' || d.code === 'unknown-identifier') continue;
    const why =
      d.data?.expected && d.data?.actual && !/\?m/.test(d.data.expected + d.data.actual)
        ? `Type error: it produces ${tick(d.data.actual)} where ${tick(d.data.expected)} is expected.`
        : /\?m/.test(d.message)
          ? 'It does not typecheck: one of its pieces has the wrong type.'
          : `It does not typecheck: ${d.message.split('\n')[0]}`;
    opts.push({ text: tick(m), correct: false, why: why.length > 160 ? why.slice(0, 157) + '…' : why });
    bad.push(`${kw} puzzle ${head} :=\n  ${m}`);
  }
  if (opts.length < 3) return null;
  return {
    quick: 'inhabitant',
    rating: Math.round(Math.max(450, b.rating - 150) + 4 * term.length),
    prompt: 'Which term has this type?',
    code: head,
    options: rng.shuffle(opts),
    themes: ['terms', useType ? 'functions' : 'proofs as terms'],
    verify: { ok: [`${kw} puzzle ${head} :=\n  ${term}`], bad },
  };
}

/* ------------------------------------------------------------------ entry */

export const QUICK_KINDS: QuickKind[] = ['goal-after', 'next-tactic', 'provable', 'type-of', 'inhabitant'];
const MAKERS: Record<QuickKind, (rng: Rng, target: number) => QuickItem | null> = {
  'goal-after': goalAfter,
  'next-tactic': nextTactic,
  provable,
  'type-of': typeOf,
  inhabitant,
};

export function quickAttempt(rng: Rng, target: number, kinds: QuickKind[]): QuickItem | null {
  const kind = rng.pick(kinds);
  return MAKERS[kind](rng.fork(kind), target);
}
