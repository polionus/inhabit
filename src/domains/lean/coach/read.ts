/**
 * Reading a proof state: say what the goal IS, ask a question that points at the next move without
 * naming it, say how each hypothesis bears on the goal, and (on request) name the tool.
 *
 * Works only from the engine's printed strings. Pure TypeScript, no DOM, never throws.
 */
import type { Goal } from '../engine/types.ts';
import {
  PREDICATES,
  matchBind,
  norm,
  occurs,
  parse,
  replaceAll,
  splitArgs,
  stripParens,
  telescope,
  type Kind,
  type Parsed,
} from './parse.ts';

export interface ReadContext {
  /** Canonical tactic names the level allows; null = everything. */
  allowedTactics: string[] | null;
  mode: 'tactic' | 'term';
  codex?: string[];
}

/** One hypothesis and how it bears on the goal; names no tactic. */
export interface Use {
  hyp: string;
  text: string;
}

/** One move: a tactic (or a term construct) and what it does to THIS goal. */
export interface Tool {
  /** What to type, e.g. `intro h` or `fun h => _`. One move, never a whole proof. */
  code: string;
  /** Canonical tactic name (tactic mode only). */
  tactic?: string;
  /** What it will do to this goal. */
  says: string;
  /** Other allowed tactics that do the same job here (never longer than two). */
  also?: { code: string; tactic: string }[];
  /** `goal`, or the hypothesis it is about. */
  about: string;
}

export interface Reading {
  /** Head connective of the first goal. */
  shape: Kind;
  say: string;
  ask: string;
  uses: Use[];
  /** null when no rule applies or nothing allowed fits. */
  tools: Tool[] | null;
  goalCount: number;
}

const MAX_USES = 4;
const MAX_TOOLS = 4;

const c = (s: string) => '`' + norm(s).replace(/`/g, "'") + '`';
const wrap = (t: string) => (/\s/.test(t) && !/^\(.*\)$/.test(t) ? `(${t})` : t);

interface HypInfo {
  name: string;
  type: string;
  p: Parsed;
  /** A part of a conjunction (`h.1`), offered as a ready-made fact; never taken apart again. */
  virtual?: boolean;
}

interface Env {
  locals: Set<string>;
  /** Proofs, in context order. */
  proofs: HypInfo[];
  /** name → type for non-proof locals (data). */
  data: Map<string, string>;
}

function mkEnv(g: Goal): Env {
  const locals = new Set<string>();
  for (const h of g.hyps) for (const n of h.names) locals.add(n);
  const proofs: HypInfo[] = [];
  const data = new Map<string, string>();
  for (const h of g.hyps) {
    for (const n of h.names) {
      if (h.isProof) proofs.push({ name: n, type: norm(h.type), p: parse(h.type, locals) });
      else data.set(n, norm(h.type));
    }
  }
  // the parts of conjunctions are facts too: `h : A ∧ B` gives `h.1 : A` and `h.2 : B`
  const real = [...proofs];
  const expand = (h: HypInfo, depth: number) => {
    if (depth === 0) return;
    let parts: [string, string][] | null = null;
    if (h.p.kind === 'and') parts = [[h.p.a ?? '', h.p.b ?? '']];
    else if (h.p.kind === 'mem') {
      const s = parse(h.p.b ?? '', locals);
      if (s.kind === 'inter') parts = [[`${h.p.a} ∈ ${s.a}`, `${h.p.a} ∈ ${s.b}`]];
    }
    if (!parts) return;
    [parts[0][0], parts[0][1]].forEach((t, i) => {
      const v: HypInfo = { name: `${h.name}.${i + 1}`, type: norm(t), p: parse(t, locals), virtual: true };
      proofs.push(v);
      expand(v, depth - 1);
    });
  };
  for (const h of real) expand(h, 2);
  return { locals, proofs, data };
}

const fresh = (env: Env, ...cands: string[]): string => {
  for (const x of cands) if (!env.locals.has(x)) return x;
  return cands[0] + "'";
};

const isSetKind = (k: Kind) => k === 'inter' || k === 'union' || k === 'diff' || k === 'compl' || k === 'empty' || k === 'setof' || k === 'image' || k === 'preimage';

function isSetExpr(e: string, env: Env): boolean {
  const p = parse(e, env.locals);
  if (isSetKind(p.kind)) return true;
  if (p.kind === 'atom' && p.head && !p.args) return /^Set\b/.test(env.data.get(p.head) ?? '');
  return false;
}

function isFunExpr(e: string, env: Env): boolean {
  const p = parse(e, env.locals);
  if (p.kind === 'atom' && p.head && !p.args) {
    const t = env.data.get(p.head);
    return !!t && t.includes('→') && !/→\s*Prop$/.test(t);
  }
  return false;
}

const termSyms = ['+', '*', '-', '/', '%', '^'];
const mentionsNumber = (e: string) => /\d/.test(e) || termSyms.some((s) => e.includes(` ${s} `));

// ---------------------------------------------------------------------------------------------
// Tools collector
// ---------------------------------------------------------------------------------------------

interface Spec {
  /** Tactic alternatives: [code, canonical tactic name], most preferred first. */
  tactics: [string, string][];
  /** Term construct (term mode). Omit when there is none. */
  term?: string;
  says: string;
  termSays?: string;
  about: string;
  score: number;
}

class Collector {
  list: (Tool & { score: number })[] = [];
  private ctx: ReadContext;
  constructor(ctx: ReadContext) {
    this.ctx = ctx;
  }
  add(s: Spec): void {
    if (this.ctx.mode === 'term') {
      if (!s.term) return;
      this.push({ code: s.term, says: s.termSays ?? s.says, about: s.about, score: s.score });
      return;
    }
    const allowed = this.ctx.allowedTactics;
    const alt = s.tactics.find(([, t]) => allowed === null || allowed.includes(t));
    if (!alt) return;
    const also = s.tactics
      .filter((x) => x !== alt && (allowed === null || allowed.includes(x[1])) && x[1] !== alt[1])
      .slice(0, 2)
      .map(([code, tactic]) => ({ code, tactic }));
    this.push({ code: alt[0], tactic: alt[1], says: s.says, also: also.length ? also : undefined, about: s.about, score: s.score });
  }
  private push(t: Tool & { score: number }) {
    if (this.list.some((x) => x.code === t.code)) return;
    this.list.push(t);
  }
}

// ---------------------------------------------------------------------------------------------
// Negations and clashes
// ---------------------------------------------------------------------------------------------

/** The proposition that `p` denies, if `p` is a negation. */
function negOf(p: Parsed, env: Env): string | null {
  switch (p.kind) {
    case 'not':
      return p.a ?? null;
    case 'nmem':
      return `${p.a} ∈ ${p.b}`;
    case 'ne':
      return `${p.a} = ${p.b}`;
    case 'mem': {
      const s = parse(p.b ?? '', env.locals);
      return s.kind === 'compl' ? `${p.a} ∈ ${s.a}` : null;
    }
    case 'imp':
      return p.b !== undefined && stripParens(p.b) === 'False' ? p.a ?? null : null;
    default:
      return null;
  }
}

const sameProp = (a: string, b: string) => stripParens(a) === stripParens(b);

function findClash(env: Env): { neg: HypInfo; pos: HypInfo } | null {
  for (const h of env.proofs) {
    const n = negOf(h.p, env);
    if (n === null) continue;
    const other = env.proofs.find((o) => o !== h && sameProp(o.type, n));
    if (other) return { neg: h, pos: other };
  }
  return null;
}

/** A term that proves `text` from the hypotheses alone, when one is easy to see (at most two levels deep). */
function provide(text: string, env: Env, depth = 2, skip?: HypInfo): string | null {
  const q = stripParens(text);
  const hit = env.proofs.find((h) => h !== skip && sameProp(h.type, q));
  if (hit) return hit.name;
  if (depth === 0) return null;
  const p = parse(q, env.locals);
  const arg = (t: string | null) => (t && /\s/.test(t) ? `(${t})` : t);
  // a hypothesis that is a function ending in `q`, fed with things we can provide
  for (const h of env.proofs) {
    if (h === skip || h.virtual && depth < 2) continue;
    const tele = telescope(h.type, env.locals);
    if (!tele.premises.length && !tele.binders.length) continue;
    const names = tele.binders.map((b) => b.name);
    const bind = matchBind(tele.conclusion, names, q);
    if (!bind || names.some((n) => bind[n] === undefined)) continue;
    const codes = tele.premises.map((pr) => provide(inst(pr, bind), env, depth - 1, h));
    if (codes.some((x) => !x)) continue;
    const args = [...tele.binders.filter((b) => !b.implicit).map((b) => wrap(bind[b.name])), ...codes.map((x) => arg(x))];
    return `${h.name} ${args.join(' ')}`.trim();
  }
  switch (p.kind) {
    case 'true':
      return 'trivial';
    case 'and': {
      const a = provide(p.a ?? '', env, depth - 1, skip);
      const b = a && provide(p.b ?? '', env, depth - 1, skip);
      return a && b ? `⟨${a}, ${b}⟩` : null;
    }
    case 'or': {
      const a = provide(p.a ?? '', env, depth - 1, skip);
      if (a) return `Or.inl ${arg(a)}`;
      const b = provide(p.b ?? '', env, depth - 1, skip);
      return b ? `Or.inr ${arg(b)}` : null;
    }
    case 'exists': {
      const v = p.vars?.[0];
      if (!v || (p.vars?.length ?? 0) !== 1) return null;
      for (const h of env.proofs) {
        if (h === skip) continue;
        const m = matchBind(p.b ?? '', [v], h.type);
        if (m && m[v] !== undefined) return `⟨${m[v]}, ${h.name}⟩`;
      }
      return null;
    }
    case 'mem': {
      const x = p.a ?? '';
      const s = parse(p.b ?? '', env.locals);
      if (s.kind === 'inter') {
        const a = provide(`${x} ∈ ${s.a}`, env, depth - 1, skip);
        const b = a && provide(`${x} ∈ ${s.b}`, env, depth - 1, skip);
        return a && b ? `⟨${a}, ${b}⟩` : null;
      }
      if (s.kind === 'union') {
        const a = provide(`${x} ∈ ${s.a}`, env, depth - 1, skip);
        if (a) return `Or.inl ${arg(a)}`;
        const b = provide(`${x} ∈ ${s.b}`, env, depth - 1, skip);
        return b ? `Or.inr ${arg(b)}` : null;
      }
      if (s.kind === 'image') {
        for (const eq of env.proofs) {
          if (eq === skip) continue;
          const m = matchBind(`${wrap(s.a ?? '')} a0 = ${x}`, ['a0'], eq.type);
          if (!m || m.a0 === undefined) continue;
          const mem = provide(`${m.a0} ∈ ${s.b}`, env, depth - 1, skip);
          if (mem) return `⟨${m.a0}, ${mem}, ${eq.name}⟩`;
        }
        return null;
      }
      return null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// The goal
// ---------------------------------------------------------------------------------------------

const predWords = (info: string, args: string[]) => info.replace(/\{(\d)\}/g, (_, i) => args[+i] ?? '…');

interface Described {
  say: string;
  ask: string;
}

function describeMem(x: string, sRaw: string, env: Env): Described {
  const s = parse(sRaw, env.locals);
  const X = c(x);
  switch (s.kind) {
    case 'inter':
      return { say: `You need to show ${X} is in both ${c(s.a ?? '')} and ${c(s.b ?? '')}.`, ask: "Being in an intersection means being in each set. Which of the two can you already prove, and what's left?" };
    case 'union':
      return { say: `You need to show ${X} is in ${c(s.a ?? '')} or in ${c(s.b ?? '')}.`, ask: "Being in either set is enough. Which one can you actually prove from what you have?" };
    case 'compl':
      return { say: `You need to show ${X} is not in ${c(s.a ?? '')}.`, ask: `Not being in a set means ${c(x + ' ∈ ' + (s.a ?? ''))} leads to a contradiction. What do you get to assume, and what do you need to reach?` };
    case 'diff':
      return { say: `You need to show ${X} is in ${c(s.a ?? '')} and not in ${c(s.b ?? '')}.`, ask: "That's two claims at once—a membership and a non-membership. Which one is easier to handle first?" };
    case 'empty':
      return { say: `You're asked to show ${X} is in the empty set. Nothing is, so your hypotheses must contradict each other.`, ask: "Which two hypotheses can't both be true?" };
    case 'setof':
      return { say: `You need to show ${X} satisfies the rule defining ${c(s.text)}.`, ask: 'What does that condition actually say for this element once you write it out?' };
    case 'image':
      return { say: `You need to show ${X} is the output of ${c(s.a ?? '')} on some element of ${c(s.b ?? '')}.`, ask: 'Which input element would work, and why is it in the set?' };
    case 'preimage':
      return { say: `You need to show ${c(s.a ?? '')} sends ${X} into ${c(s.b ?? '')}.`, ask: 'Once you unfold that, what fact about the output do you need?' };
    default:
      return { say: `You need to show ${X} belongs to ${c(sRaw)}.`, ask: 'Do you have a hypothesis that gives this directly, or one that leads to it?' };
  }
}

function describe(gp: Parsed, env: Env, g: Goal): Described {
  const A = c(gp.a ?? '');
  const B = c(gp.b ?? '');
  switch (gp.kind) {
    case 'forall': {
      const v = gp.vars?.[0] ?? 'x';
      return {
        say: `You need ${c(gp.text)} to hold for every ${c(v)}.`,
        ask: `You can't check every ${c(v)} one by one—so pick an arbitrary ${c(v)}. Once you have it in hand, what's left to prove?`,
      };
    }
    case 'imp':
      return {
        say: `The goal is an implication: if ${A} then ${B}.`,
        ask: "To prove an implication, you get to assume its left side. What would you then have, and what's left to show?",
      };
    case 'iff':
      return {
        say: `You're proving an "if and only if": ${A} and ${B} each have to imply the other.`,
        ask: "That's two implications packed together. Which direction looks easier first, and what do you assume in it?",
      };
    case 'and':
      return {
        say: `This is a conjunction: you need to prove both ${A} and ${B}.`,
        ask: 'You have to prove both halves. Which half do you already see how to build?',
      };
    case 'or':
      return {
        say: `This is a disjunction: proving either ${A} or ${B} is enough.`,
        ask: 'Which side can you actually prove from your hypotheses? If neither is clear yet, does one of your hypotheses split the problem in two?',
      };
    case 'not':
      return {
        say: `You're trying to show ${c(gp.text)}—that ${A} cannot be true.`,
        ask: `Assume ${A} is true anyway and see what breaks. If you had ${A}, what could you do with it to reach a contradiction?`,
      };
    case 'ne':
      return {
        say: `You're showing ${c(gp.text)}: the two sides are different.`,
        ask: `Suppose they were equal, ${c((gp.a ?? '') + ' = ' + (gp.b ?? ''))}. What goes wrong?`,
      };
    case 'nmem':
      return {
        say: `You need to show ${c(gp.a ?? '')} is not in ${c(gp.b ?? '')}.`,
        ask: 'Suppose it were in there. What would that let you use, and what contradiction would you aim for?',
      };
    case 'exists': {
      const v = gp.vars?.[0] ?? 'x';
      return {
        say: `You need to show there is some ${c(v)} with ${c(gp.b ?? '')}.`,
        ask: `You have to pick a concrete ${c(v)}. Which value in front of you looks like it works, and what's left to check for it?`,
      };
    }
    case 'eq': {
      const l = gp.a ?? '';
      const r = gp.b ?? '';
      if (isSetExpr(l, env) || isSetExpr(r, env)) {
        return {
          say: `You're proving the sets ${c(l)} and ${c(r)} are equal, meaning they have the exact same elements.`,
          ask: 'To show two sets have the same elements, pick an arbitrary element—what do you need to check about it?',
        };
      }
      if (isFunExpr(l, env) || isFunExpr(r, env)) {
        return {
          say: `You're proving the functions ${c(l)} and ${c(r)} are equal, meaning they give the same output on every input.`,
          ask: 'Pick an arbitrary input—what equation do you need to show for it?',
        };
      }
      if (sameProp(l, r)) return { say: `This is an equation whose two sides are already identical: ${c(gp.text)}.`, ask: 'When both sides are the exact same expression, is there anything left to prove?' };
      return {
        say: `You're proving an equation: ${c(l)} equals ${c(r)}.`,
        ask: 'Do both sides already simplify to the same thing? If not, which hypothesis lets you rewrite one side?',
      };
    }
    case 'mem':
      return describeMem(gp.a ?? '', gp.b ?? '', env);
    case 'subset':
      return {
        say: `You need to show every element of ${A} is also in ${B}.`,
        ask: 'Take an arbitrary element of the first set. What do you know about it, and what do you need to show?',
      };
    case 'dvd':
      return {
        say: `${c(gp.text)} means ${B} is a multiple of ${A}: ${B} equals ${A} times some number.`,
        ask: 'Which multiplier gives the target?',
      };
    case 'false':
      return {
        say: "The goal is False, so you're looking for a contradiction.",
        ask: 'Do two of your hypotheses clash? Or is there a negation you can feed a proof to?',
      };
    case 'true':
      return { say: 'The goal is True, which holds with no assumptions.', ask: 'Which basic fact closes True right away?' };
    case 'pred': {
      const info = PREDICATES[gp.head ?? ''];
      const args = splitArgs(gp.args ?? '');
      const means = info ? predWords(info.means, args) : null;
      return {
        say: means ? `${c(gp.text)} is a definition: ${means}.` : `${c(gp.text)} is a definition.`,
        ask: "Once you expand what that definition means, what's the statement you actually need to prove?",
      };
    }
    case 'rel':
      return { say: `You're proving a comparison: ${c(gp.text)}.`, ask: 'What do you know about the two sides that settles it?' };
    default: {
      const match = env.proofs.find((h) => sameProp(h.type, g.target));
      if (!match && findClash(env)) return { say: `The goal is ${c(gp.text)}, and it doesn't break down into smaller parts.`, ask: 'Do two of your hypotheses contradict each other—and what follows from a contradiction?' };
      if (match) return { say: `The goal is ${c(gp.text)}, and it doesn't break down into smaller parts.`, ask: 'One of your hypotheses already has this exact type. Which one?' };
      const ends = env.proofs.find((h) => {
        const t = telescope(h.type, env.locals);
        return (t.premises.length > 0 || t.binders.length > 0) && matchBind(t.conclusion, t.binders.map((b) => b.name), g.target) !== null;
      });
      if (ends) return { say: `The goal is ${c(gp.text)}, and it doesn't break down into smaller parts.`, ask: 'One of your hypotheses ends in this exact goal. What does it need from you to get there?' };
      return { say: `The goal is ${c(gp.text)}, and it doesn't break down into smaller parts.`, ask: 'Which hypotheses can build it, directly or in a couple of steps?' };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Tools for the goal's shape
// ---------------------------------------------------------------------------------------------

function goalTools(gp: Parsed, g: Goal, env: Env, T: Collector): void {
  const A = c(gp.a ?? '');
  const B = c(gp.b ?? '');
  const S = 80;
  if (['and', 'or', 'exists'].includes(gp.kind) || (gp.kind === 'mem' && ['inter', 'union', 'image'].includes(parse(gp.b ?? '', env.locals).kind))) {
    // only the plain shapes (`⟨ha, hb⟩`, `Or.inl h`, `⟨w, h⟩`): a deeper term would write the proof for the learner
    const code = provide(g.target, env, 1);
    if (code && !code.includes('(')) {
      T.add({
        tactics: [[`exact ${code}`, 'exact']],
        term: code,
        says: `${c('exact ' + code)} builds the goal straight from hypotheses you already have, and closes it.`,
        termSays: `${c(code)} builds the goal straight from hypotheses you already have.`,
        about: 'goal',
        score: 97,
      });
    }
  }
  if (!['false', 'forall', 'imp', 'not', 'ne', 'nmem', 'true'].includes(gp.kind)) {
    T.add({
      tactics: [['by_contra hn', 'by_contra']],
      says: `${c('by_contra hn')} assumes the opposite of the goal as ${c('hn')} and leaves ${c('False')} to prove.`,
      about: 'goal',
      score: 30,
    });
  }
  switch (gp.kind) {
    case 'forall': {
      const v = gp.vars?.[0] ?? 'x';
      T.add({
        tactics: [[`intro ${v}`, 'intro'], [`rintro ${v}`, 'rintro'], [`intros ${v}`, 'intros']],
        term: `fun ${v} => _`,
        says: `${c('intro ' + v)} takes an arbitrary ${c(v)} and leaves the body ${c(gp.b ?? '')} to prove.`,
        termSays: `${c('fun ' + v + ' => _')} builds the function: ${c(v)} is any value, and the ${c('_')} stands for a proof of ${c(gp.b ?? '')}.`,
        about: 'goal',
        score: S,
      });
      break;
    }
    case 'imp': {
      const h = fresh(env, 'h', 'h1', 'h2', 'hp');
      const pa = parse(gp.a ?? '', env.locals);
      if (pa.kind === 'and' || (pa.kind === 'mem' && parse(pa.b ?? '', env.locals).kind === 'inter')) {
        T.add({ tactics: [['rintro ⟨h1, h2⟩', 'rintro']], says: `${c('rintro ⟨h1, h2⟩')} assumes ${A} and splits it into its two parts ${c('h1')} and ${c('h2')} in one step, leaving ${B} to prove.`, about: 'goal', score: 79 });
      } else if (pa.kind === 'or' || pa.kind === 'exists') {
        T.add({
          tactics: [[pa.kind === 'or' ? 'rintro (h1 | h2)' : 'rintro ⟨w, hw⟩', 'rintro']],
          says: pa.kind === 'or' ? `${c('rintro (h1 | h2)')} assumes ${A} and splits into the two cases, leaving ${B} to prove in each.` : `${c('rintro ⟨w, hw⟩')} assumes ${A}, takes out the witness ${c('w')}, and leaves ${B} to prove.`,
          about: 'goal',
          score: 79,
        });
      }
      T.add({
        tactics: [[`intro ${h}`, 'intro'], [`rintro ${h}`, 'rintro'], [`intros ${h}`, 'intros']],
        term: `fun ${h} => _`,
        says: `${c('intro ' + h)} moves ${A} into your hypotheses as ${c(h)} and leaves ${B} to prove.`,
        termSays: `${c('fun ' + h + ' => _')} builds the implication: ${c(h)} is a proof of ${A}, and the ${c('_')} stands for a proof of ${B}.`,
        about: 'goal',
        score: S,
      });
      break;
    }
    case 'not':
    case 'ne':
    case 'nmem': {
      const h = fresh(env, 'h', 'h1', 'hp');
      const supposed = gp.kind === 'not' ? gp.a ?? '' : gp.kind === 'ne' ? `${gp.a} = ${gp.b}` : `${gp.a} ∈ ${gp.b}`;
      T.add({
        tactics: [[`intro ${h}`, 'intro'], [`rintro ${h}`, 'rintro'], [`intros ${h}`, 'intros']],
        term: `fun ${h} => _`,
        says: `${c('intro ' + h)} assumes ${c(supposed)} as ${c(h)} and leaves ${c('False')} to prove.`,
        termSays: `${c('fun ' + h + ' => _')} supposes ${c(supposed)} as ${c(h)}, and the ${c('_')} stands for a proof of ${c('False')}.`,
        about: 'goal',
        score: S,
      });
      break;
    }
    case 'iff':
      T.add({
        tactics: [['constructor', 'constructor'], ['refine ⟨?_, ?_⟩', 'refine']],
        term: '⟨_, _⟩',
        says: `${c('constructor')} splits the goal into two: ${c(`${gp.a} → ${gp.b}`)} and ${c(`${gp.b} → ${gp.a}`)}.`,
        termSays: `${c('⟨_, _⟩')} needs two proofs: one of ${c(`${gp.a} → ${gp.b}`)} and one of ${c(`${gp.b} → ${gp.a}`)}.`,
        about: 'goal',
        score: S,
      });
      break;
    case 'and':
      T.add({
        tactics: [['constructor', 'constructor'], ['refine ⟨?_, ?_⟩', 'refine']],
        term: '⟨_, _⟩',
        says: `${c('constructor')} splits the goal into two goals: ${A}, then ${B}.`,
        termSays: `${c('⟨_, _⟩')} needs two proofs: one of ${A} and one of ${B}.`,
        about: 'goal',
        score: S,
      });
      break;
    case 'or':
      T.add({
        tactics: [['left', 'left']],
        term: 'Or.inl _',
        says: `${c('left')} chooses the left side and leaves ${A} to prove.`,
        termSays: `${c('Or.inl _')} chooses the left side; the ${c('_')} stands for a proof of ${A}.`,
        about: 'goal',
        score: S,
      });
      T.add({
        tactics: [['right', 'right']],
        term: 'Or.inr _',
        says: `${c('right')} chooses the right side and leaves ${B} to prove.`,
        termSays: `${c('Or.inr _')} chooses the right side; the ${c('_')} stands for a proof of ${B}.`,
        about: 'goal',
        score: S - 1,
      });
      break;
    case 'exists': {
      const v = gp.vars?.[0] ?? 'x';
      T.add({
        tactics: [['use w', 'use'], ['refine ⟨w, ?_⟩', 'refine'], ['exists w', 'exists']],
        term: '⟨w, _⟩',
        says: `${c('use w')} offers a value ${c('w')} of your choice as the ${c(v)} and leaves ${c(gp.b ?? '')} (with ${c('w')} in place of ${c(v)}) to prove.`,
        termSays: `${c('⟨w, _⟩')} offers a value ${c('w')} for ${c(v)}; the ${c('_')} stands for a proof of ${c(gp.b ?? '')} with ${c('w')} in place of ${c(v)}.`,
        about: 'goal',
        score: S,
      });
      break;
    }
    case 'eq': {
      const l = gp.a ?? '';
      const r = gp.b ?? '';
      if (isSetExpr(l, env) || isSetExpr(r, env)) {
        T.add({
          tactics: [['ext x', 'ext']],
          term: 'Set.ext fun x => _',
          says: `${c('ext x')} turns the goal into ${c(`x ∈ ${l} ↔ x ∈ ${r}`)} for an arbitrary ${c('x')}.`,
          termSays: `${c('Set.ext fun x => _')} asks for a proof of ${c(`x ∈ ${l} ↔ x ∈ ${r}`)} for an arbitrary ${c('x')}.`,
          about: 'goal',
          score: S,
        });
      } else if (isFunExpr(l, env) || isFunExpr(r, env)) {
        T.add({
          tactics: [['funext x', 'funext'], ['ext x', 'ext']],
          term: 'funext fun x => _',
          says: `${c('funext x')} turns the goal into ${c(`${wrap(l)} x = ${wrap(r)} x`)} for an arbitrary ${c('x')}.`,
          termSays: `${c('funext fun x => _')} asks for a proof of ${c(`${wrap(l)} x = ${wrap(r)} x`)} for an arbitrary ${c('x')}.`,
          about: 'goal',
          score: S,
        });
      } else {
        const same = sameProp(l, r);
        T.add({
          tactics: [['rfl', 'rfl']],
          term: 'rfl',
          says: same ? `${c('rfl')} closes the goal because both sides are already the same.` : `${c('rfl')} closes the goal if both sides compute to the same thing, and fails if they don't.`,
          termSays: same ? `${c('rfl')} proves it because both sides are already the same.` : `${c('rfl')} proves it if both sides compute to the same thing, and fails if they don't.`,
          about: 'goal',
          score: same ? 95 : mentionsNumber(l + r) ? 60 : 45,
        });
        // induction on a natural-number variable that the goal mentions
        for (const [name, type] of env.data) {
          if (type === 'Nat' && occurs(name, g.target)) {
            T.add({
              tactics: [[`induction ${name}`, 'induction']],
              term: undefined,
              says: `${c('induction ' + name)} splits the proof into the case ${c(name + ' = 0')} and the step from ${c('k')} to ${c('k + 1')}, where you may use the claim for ${c('k')}.`,
              about: 'goal',
              score: 40,
            });
            break;
          }
        }
        if (!same) {
          T.add({
            tactics: [['rw [e]', 'rw'], ['rewrite [e]', 'rewrite']],
            says: `${c('rw [e]')} replaces the left side of an equation ${c('e')} by its right side wherever it occurs in the goal. Name a hypothesis or a lemma for ${c('e')}.`,
            about: 'goal',
            score: 52,
          });
          T.add({ tactics: [['symm', 'symm']], says: `${c('symm')} swaps the two sides of the goal: it becomes ${c(`${r} = ${l}`)}.`, about: 'goal', score: 30 });
        }
        T.add({
          tactics: [['calc', 'calc']],
          says: `${c('calc')} lets you walk from ${c(l)} to ${c(r)} in small steps, each one justified on its own line.`,
          about: 'goal',
          score: 35,
        });
      }
      break;
    }
    case 'mem': {
      const x = gp.a ?? '';
      const s = parse(gp.b ?? '', env.locals);
      switch (s.kind) {
        case 'inter':
          T.add({
            tactics: [['constructor', 'constructor'], ['refine ⟨?_, ?_⟩', 'refine']],
            term: '⟨_, _⟩',
            says: `${c('constructor')} splits the goal into ${c(`${x} ∈ ${s.a}`)} and ${c(`${x} ∈ ${s.b}`)}.`,
            termSays: `${c('⟨_, _⟩')} needs a proof of ${c(`${x} ∈ ${s.a}`)} and a proof of ${c(`${x} ∈ ${s.b}`)}.`,
            about: 'goal',
            score: S,
          });
          break;
        case 'union':
          T.add({ tactics: [['left', 'left']], term: 'Or.inl _', says: `${c('left')} leaves ${c(`${x} ∈ ${s.a}`)} to prove.`, termSays: `${c('Or.inl _')}: the ${c('_')} stands for a proof of ${c(`${x} ∈ ${s.a}`)}.`, about: 'goal', score: S });
          T.add({ tactics: [['right', 'right']], term: 'Or.inr _', says: `${c('right')} leaves ${c(`${x} ∈ ${s.b}`)} to prove.`, termSays: `${c('Or.inr _')}: the ${c('_')} stands for a proof of ${c(`${x} ∈ ${s.b}`)}.`, about: 'goal', score: S - 1 });
          break;
        case 'compl':
          T.add({
            tactics: [['intro h', 'intro'], ['rintro h', 'rintro']],
            term: 'fun h => _',
            says: `${c('intro h')} assumes ${c(`${x} ∈ ${s.a}`)} as ${c('h')} and leaves ${c('False')} to prove.`,
            termSays: `${c('fun h => _')} supposes ${c(`${x} ∈ ${s.a}`)} as ${c('h')}; the ${c('_')} stands for a proof of ${c('False')}.`,
            about: 'goal',
            score: S,
          });
          break;
        case 'diff':
          T.add({
            tactics: [['constructor', 'constructor'], ['refine ⟨?_, ?_⟩', 'refine']],
            term: '⟨_, _⟩',
            says: `${c('constructor')} splits the goal into ${c(`${x} ∈ ${s.a}`)} and ${c(`${x} ∉ ${s.b}`)}.`,
            termSays: `${c('⟨_, _⟩')} needs a proof of ${c(`${x} ∈ ${s.a}`)} and one of ${c(`${x} ∉ ${s.b}`)}.`,
            about: 'goal',
            score: S,
          });
          break;
        case 'setof':
          T.add({
            tactics: [['show', 'show'], ['change', 'change']],
            says: `${c('show')} restates the goal with the set's condition written out for ${c(x)}, so you can see what is needed.`,
            about: 'goal',
            score: 55,
          });
          break;
        case 'image':
          T.add({
            tactics: [['use a', 'use'], ['refine ⟨a, ?_, ?_⟩', 'refine']],
            term: '⟨a, _, _⟩',
            says: `${c('use a')} offers an element ${c('a')} of your choice and leaves what remains about it to prove.`,
            termSays: `${c('⟨a, _, _⟩')} offers an element ${c('a')}, a proof that it is in the set, and a proof that it maps to ${c(x)}.`,
            about: 'goal',
            score: S,
          });
          break;
        case 'preimage':
          T.add({
            tactics: [['show', 'show'], ['change', 'change']],
            says: `${c('show')} restates ${c(gp.text)} in its unfolded form, as a statement about ${c(`${wrap(s.a ?? '')} ${wrap(x)}`)}.`,
            about: 'goal',
            score: 55,
          });
          break;
        default:
          break;
      }
      break;
    }
    case 'subset':
      {
        const sa = parse(gp.a ?? '', env.locals);
        if (sa.kind === 'inter') T.add({ tactics: [['rintro x ⟨h1, h2⟩', 'rintro']], says: `${c('rintro x ⟨h1, h2⟩')} takes an arbitrary ${c('x')} and splits ${c('x ∈ ' + gp.a)} into ${c('h1 : x ∈ ' + sa.a)} and ${c('h2 : x ∈ ' + sa.b)}, leaving ${c('x ∈ ' + gp.b)} to prove.`, about: 'goal', score: 79 });
        if (sa.kind === 'union') T.add({ tactics: [['rintro x (h1 | h2)', 'rintro']], says: `${c('rintro x (h1 | h2)')} takes an arbitrary ${c('x')} and splits into the cases ${c('x ∈ ' + sa.a)} and ${c('x ∈ ' + sa.b)}.`, about: 'goal', score: 79 });
      }
      T.add({
        tactics: [['intro x hx', 'intro'], ['rintro x hx', 'rintro']],
        term: 'fun x hx => _',
        says: `${c('intro x hx')} takes an arbitrary ${c('x')} with ${c('hx : x ∈ ' + (gp.a ?? ''))} and leaves ${c(`x ∈ ${gp.b}`)} to prove.`,
        termSays: `${c('fun x hx => _')}: ${c('x')} is arbitrary, ${c('hx')} proves ${c(`x ∈ ${gp.a}`)}, and the ${c('_')} stands for a proof of ${c(`x ∈ ${gp.b}`)}.`,
        about: 'goal',
        score: S,
      });
      break;
    case 'dvd':
      T.add({
        tactics: [['use c', 'use'], ['refine ⟨c, ?_⟩', 'refine'], ['exists c', 'exists']],
        term: '⟨c, _⟩',
        says: `${c('use c')} picks the multiplier ${c('c')} of your choice and leaves ${c(`${gp.b} = ${wrap(gp.a ?? '')} * c`)} to prove.`,
        termSays: `${c('⟨c, _⟩')} picks the multiplier ${c('c')}; the ${c('_')} stands for a proof of ${c(`${gp.b} = ${wrap(gp.a ?? '')} * c`)}.`,
        about: 'goal',
        score: S,
      });
      break;
    case 'true':
      T.add({ tactics: [['trivial', 'trivial'], ['constructor', 'constructor']], term: 'trivial', says: `${c('trivial')} proves ${c('True')}.`, about: 'goal', score: S });
      break;
    case 'pred': {
      const args = splitArgs(gp.args ?? '');
      const f = args[0] ?? 'f';
      switch (gp.head) {
        case 'Function.Injective':
          T.add({
            tactics: [['intro a b h', 'intro'], ['rintro a b h', 'rintro'], ['unfold Function.Injective', 'unfold']],
            term: 'fun a b h => _',
            says: `${c('intro a b h')} unfolds the definition: it takes ${c('a')} and ${c('b')} with ${c('h : ' + f + ' a = ' + f + ' b')} and leaves ${c('a = b')} to prove.`,
            termSays: `${c('fun a b h => _')}: ${c('h')} proves ${c(f + ' a = ' + f + ' b')}, and the ${c('_')} stands for a proof of ${c('a = b')}.`,
            about: 'goal',
            score: S,
          });
          break;
        case 'Function.Surjective':
          T.add({
            tactics: [['intro b', 'intro'], ['rintro b', 'rintro'], ['unfold Function.Surjective', 'unfold']],
            term: 'fun b => _',
            says: `${c('intro b')} unfolds the definition: it takes an arbitrary ${c('b')} and leaves ${c('∃ a, ' + f + ' a = b')} to prove.`,
            termSays: `${c('fun b => _')}: ${c('b')} is arbitrary, and the ${c('_')} stands for a proof of ${c('∃ a, ' + f + ' a = b')}.`,
            about: 'goal',
            score: S,
          });
          break;
        case 'Function.LeftInverse':
        case 'Function.RightInverse':
          T.add({
            tactics: [['intro x', 'intro'], ['rintro x', 'rintro'], ['unfold ' + gp.head, 'unfold']],
            term: 'fun x => _',
            says: `${c('intro x')} unfolds the definition: it takes an arbitrary ${c('x')} and leaves an equation to prove.`,
            termSays: `${c('fun x => _')}: ${c('x')} is arbitrary, and the ${c('_')} stands for a proof of the equation.`,
            about: 'goal',
            score: S,
          });
          break;
        case 'Even':
        case 'Odd':
          T.add({
            tactics: [['use r', 'use'], ['refine ⟨r, ?_⟩', 'refine'], ['unfold ' + gp.head, 'unfold']],
            term: '⟨r, _⟩',
            says: `${c('use r')} picks the number ${c('r')} (your choice) and leaves the equation ${c(`${args[0] ?? 'n'} = ` + (gp.head === 'Even' ? 'r + r' : '2 * r + 1'))} to prove.`,
            termSays: `${c('⟨r, _⟩')} picks ${c('r')}; the ${c('_')} stands for a proof of ${c(`${args[0] ?? 'n'} = ` + (gp.head === 'Even' ? 'r + r' : '2 * r + 1'))}.`,
            about: 'goal',
            score: S,
          });
          break;
        default:
          T.add({ tactics: [['unfold ' + (gp.head ?? ''), 'unfold'], ['show', 'show']], says: `${c('unfold ' + (gp.head ?? ''))} replaces the definition by what it says.`, about: 'goal', score: 50 });
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------------------------
// Hypotheses
// ---------------------------------------------------------------------------------------------

interface HypResult {
  use?: { text: string; score: number };
}

/** Substitute bindings into a premise. */
const inst = (text: string, b: Record<string, string>) => {
  let t = text;
  for (const [k, v] of Object.entries(b)) t = replaceAll(t, k, wrap(v));
  return t;
};

function analyseHyp(h: HypInfo, gp: Parsed, g: Goal, env: Env, T: Collector, clash: { neg: HypInfo; pos: HypInfo } | null): HypResult {
  const H = c(h.name);
  const goalText = g.target;
  const out: HypResult = {};
  const p = h.p;
  const goalIsFalse = gp.kind === 'false';

  // 1. exactly the goal
  if (sameProp(h.type, goalText)) {
    out.use = { text: `${H} says exactly what the goal says.`, score: 100 };
    T.add({
      tactics: [['assumption', 'assumption']],
      says: `${c('assumption')} looks through your hypotheses for one that matches the goal, and finds ${H}.`,
      about: h.name,
      score: 93,
    });
    T.add({
      tactics: [[`exact ${h.name}`, 'exact']],
      term: h.name,
      says: `${c('exact ' + h.name)} closes the goal: ${H} already has the type ${c(goalText)}.`,
      termSays: `${H} has the type ${c(goalText)}, which is exactly the goal, so it is the whole proof.`,
      about: h.name,
      score: 100,
    });
    return out;
  }

  // 2. a hypothesis that is a function/implication ending in the goal
  const tele = telescope(h.type, env.locals);
  const hasArrows = (tele.premises.length > 0 || tele.binders.length > 0) && !['not', 'nmem', 'ne'].includes(p.kind);
  if (hasArrows) {
    const names = tele.binders.map((b) => b.name);
    const bind = matchBind(tele.conclusion, names, goalText);
    if (bind) {
      // binders the conclusion did not fix may be fixed by a premise that matches a hypothesis
      for (let pass = 0; pass < 2; pass++) {
        for (const q of tele.premises) {
          const open = names.filter((n) => bind[n] === undefined && occurs(n, q));
          if (!open.length) continue;
          for (const o of env.proofs) {
            if (o === h) continue;
            const m = matchBind(inst(q, bind), open, o.type);
            if (m) {
              Object.assign(bind, m);
              break;
            }
          }
        }
      }
      const premises = tele.premises.map((q) => inst(q, bind));
      const supplied = premises.map((q) => provide(q, env, 2, h));
      const unbound = names.filter((n) => bind[n] === undefined);
      const allThere = supplied.every(Boolean) && unbound.length === 0;
      if (allThere && !(tele.premises.length === 0 && tele.binders.length === 0)) {
        const args = [...tele.binders.filter((b) => !b.implicit).map((b) => wrap(bind[b.name])), ...supplied.map((s) => (/\s/.test(s!) ? `(${s})` : s!))];
        const call = `${h.name} ${args.join(' ')}`.trim();
        out.use = { text: `${H} turns ${premises.map(c).join(' and ')} into ${c(goalText)}, which is your goal, and you already have what it needs.`, score: 96 };
        T.add({
          tactics: [[`exact ${call}`, 'exact']],
          term: call,
          says: `${c('exact ' + call)} feeds ${supplied.map((s) => c(s!)).join(' and ')} to ${H}, which gives exactly the goal.`,
          termSays: `${c(call)} feeds what ${H} needs to ${H}; the result has exactly the type of the goal.`,
          about: h.name,
          score: 96,
        });
        T.add({
          tactics: [[`apply ${h.name}`, 'apply']],
          says: `${c('apply ' + h.name)} uses ${H} backwards: the goal becomes ${premises.map(c).join(' and ')}, which you already have.`,
          about: h.name,
          score: 86,
        });
      } else {
        const left = premises.length ? premises.map(c).join(' and ') : 'its arguments';
        out.use = { text: `${H} ends in ${c(tele.conclusion)}, which is the shape of your goal. To use it you would first need ${left}.`, score: 88 };
        T.add({
          tactics: [[`apply ${h.name}`, 'apply'], [`refine ${h.name} ?_`, 'refine']],
          term: `${h.name} _`,
          says: premises.length
            ? `${c('apply ' + h.name)} uses ${H} backwards: the goal becomes ${premises.map(c).join(' and ')}.`
            : `${c('apply ' + h.name)} uses ${H} to close the goal, once its arguments are filled in.`,
          termSays: `${c(h.name + ' _')} applies ${H}; each ${c('_')} stands for a proof of ${premises.length ? premises.map(c).join(' or ') : 'one of its arguments'}.`,
          about: h.name,
          score: 88,
        });
      }
      return out;
    }
    // premise available: forward reasoning
    if (tele.binders.length === 0 && tele.premises.length >= 1) {
      const first = env.proofs.find((o) => o !== h && sameProp(o.type, tele.premises[0]));
      if (first) {
        const rest = tele.premises.length > 1 ? tele.premises.slice(1) : [];
        const result = rest.length ? rest.reduceRight((acc, q) => `${q} → ${acc}`, tele.conclusion) : tele.conclusion;
        out.use = { text: `${H} turns ${c(tele.premises[0])} into ${c(result)}, and you already have ${c(tele.premises[0])} as ${c(first.name)}.`, score: 84 };
        T.add({
          tactics: [[`have h2 := ${h.name} ${first.name}`, 'have']],
          term: `${h.name} ${first.name}`,
          says: `${c(`have h2 := ${h.name} ${first.name}`)} adds ${c(result)} to your hypotheses as ${c('h2')}.`,
          termSays: `${c(`${h.name} ${first.name}`)} is a proof of ${c(result)}.`,
          about: h.name,
          score: 70,
        });
        return out;
      }
    }
    // ∀ with a local variable to feed it
    if (tele.binders.length > 0 && p.kind === 'forall') {
      const v = [...env.data.entries()].find(([n, t]) => t !== 'Prop' && !/^Type|^Set|→/.test(t) && occurs(n, goalText));
      if (v) {
        out.use = { text: `${H} holds for every ${c(tele.binders[0].name)}. You can ask it about ${c(v[0])}, which the goal mentions.`, score: 72 };
        T.add({
          tactics: [[`specialize ${h.name} ${v[0]}`, 'specialize'], [`have h2 := ${h.name} ${v[0]}`, 'have']],
          term: `${h.name} ${v[0]}`,
          says: `${c(`specialize ${h.name} ${v[0]}`)} replaces ${H} by its instance for ${c(v[0])}.`,
          termSays: `${c(`${h.name} ${v[0]}`)} is ${H} instantiated at ${c(v[0])}.`,
          about: h.name,
          score: 65,
        });
        return out;
      }
    }
  }

  const negCase = () => {
      const neg = negOf(p, env) ?? '';
      if (clash && clash.neg === h) {
        const other = clash.pos;
        out.use = { text: `${H} says ${c(neg)} is impossible, but ${c(other.name)} says it is true. They cannot both hold.`, score: goalIsFalse ? 99 : 92 };
        if (goalIsFalse) {
          T.add({
            tactics: [[`exact ${h.name} ${other.name}`, 'exact']],
            term: `${h.name} ${other.name}`,
            says: `${c(`exact ${h.name} ${other.name}`)} feeds ${c(other.name)} to ${H}, which gives ${c('False')}.`,
            termSays: `${c(`${h.name} ${other.name}`)} feeds ${c(other.name)} to ${H}, which gives ${c('False')}.`,
            about: h.name,
            score: 98,
          });
          T.add({ tactics: [[`apply ${h.name}`, 'apply']], says: `${c('apply ' + h.name)} turns the goal ${c('False')} into ${c(neg)}, which you have as ${c(other.name)}.`, about: h.name, score: 87 });
        } else {
          T.add({ tactics: [['exfalso', 'exfalso']], says: `${c('exfalso')} changes the goal to ${c('False')}, which ${H} and ${c(other.name)} can then settle.`, about: h.name, score: 84 });
        }
        T.add({
          tactics: [['contradiction', 'contradiction'], [`exact absurd ${other.name} ${h.name}`, 'exact']],
          term: `absurd ${other.name} ${h.name}`,
          says: `${c('contradiction')} finds ${H} and ${c(other.name)} clashing and closes the goal.`,
          termSays: `${c(`absurd ${other.name} ${h.name}`)} puts the proof ${c(other.name)} of ${c(neg)} next to ${H}, which denies it, and that proves anything.`,
          about: h.name,
          score: 97,
        });
      } else if (goalIsFalse && provide(neg, env, 2, h)) {
        const code = provide(neg, env, 2, h)!;
        const call = `${h.name} ${/\s/.test(code) ? `(${code})` : code}`;
        out.use = { text: `${H} says ${c(neg)} is impossible, and you can build a proof of ${c(neg)} from your hypotheses. That gives a contradiction.`, score: 97 };
        T.add({
          tactics: [[`exact ${call}`, 'exact']],
          term: call,
          says: `${c('exact ' + call)} feeds ${c(code)}, a proof of ${c(neg)}, to ${H}, which gives ${c('False')}.`,
          termSays: `${c(call)} feeds ${c(code)}, a proof of ${c(neg)}, to ${H}, which gives ${c('False')}.`,
          about: h.name,
          score: 97,
        });
        T.add({ tactics: [[`apply ${h.name}`, 'apply']], says: `${c('apply ' + h.name)} turns the goal ${c('False')} into ${c(neg)}.`, about: h.name, score: 86 });
      } else if (goalIsFalse) {
        out.use = { text: `${H} says ${c(neg)} is impossible. If you can prove ${c(neg)}, you have your contradiction.`, score: 90 };
        T.add({
          tactics: [[`apply ${h.name}`, 'apply'], [`exfalso`, 'exfalso']],
          term: `${h.name} _`,
          says: `${c('apply ' + h.name)} turns the goal ${c('False')} into ${c(neg)}.`,
          termSays: `${c(h.name + ' _')}: the ${c('_')} stands for a proof of ${c(neg)}, and ${H} turns it into ${c('False')}.`,
          about: h.name,
          score: 90,
        });
      } else {
        out.use = { text: `${H} says ${c(neg)} is impossible. If you could get ${c(neg)} from somewhere, you would have a contradiction.`, score: 55 };
        T.add({
          tactics: [['exfalso', 'exfalso'], ['by_contra hn', 'by_contra']],
          term: `absurd _ ${h.name}`,
          says: `${c('exfalso')} changes the goal to ${c('False')}, so that ${H} can be used against a proof of ${c(neg)}.`,
          termSays: `${c(`absurd _ ${h.name}`)}: the ${c('_')} stands for a proof of ${c(neg)}, which ${H} refutes.`,
          about: h.name,
          score: 40,
        });
      }
  };
  if (h.virtual && !['not', 'nmem', 'ne', 'false', 'eq'].includes(p.kind) && !(p.kind === 'mem' && parse(p.b ?? '', env.locals).kind === 'compl')) return out;
  switch (p.kind) {
    case 'and': {
      const [h1, h2] = [fresh(env, 'h1', 'hp'), fresh(env, 'h2', 'hq')];
      const side = sameProp(p.a ?? '', goalText) ? '1' : sameProp(p.b ?? '', goalText) ? '2' : null;
      if (side) {
        out.use = { text: `${H} is a conjunction, and one of its two parts is exactly the goal.`, score: 99 };
        T.add({
          tactics: [[`exact ${h.name}.${side}`, 'exact']],
          term: `${h.name}.${side}`,
          says: `${c(`exact ${h.name}.${side}`)} takes the ${side === '1' ? 'left' : 'right'} part of ${H}, which is exactly the goal.`,
          termSays: `${c(`${h.name}.${side}`)} is the ${side === '1' ? 'left' : 'right'} part of ${H}, which is exactly the goal.`,
          about: h.name,
          score: 97,
        });
      }
      out.use ??= { text: `${H} is a conjunction: it holds ${c(p.a ?? '')} and ${c(p.b ?? '')}, each usable on its own.`, score: 70 };
      T.add({
        tactics: [[`obtain ⟨${h1}, ${h2}⟩ := ${h.name}`, 'obtain'], [`rcases ${h.name} with ⟨${h1}, ${h2}⟩`, 'rcases'], [`cases ${h.name}`, 'cases']],
        term: `${h.name}.1`,
        says: `${c(`obtain ⟨${h1}, ${h2}⟩ := ${h.name}`)} splits ${H} into ${c(h1 + ' : ' + p.a)} and ${c(h2 + ' : ' + p.b)}.`,
        termSays: `${c(h.name + '.1')} is a proof of ${c(p.a ?? '')} and ${c(h.name + '.2')} is a proof of ${c(p.b ?? '')}.`,
        about: h.name,
        score: 72,
      });
      break;
    }
    case 'exists': {
      const v = p.vars?.[0] ?? 'w';
      const w = fresh(env, v, 'w');
      out.use = { text: `${H} says some ${c(v)} exists with ${c(p.b ?? '')}. You can take such a value and use what is known about it.`, score: 74 };
      T.add({
        tactics: [[`obtain ⟨${w}, h${w}⟩ := ${h.name}`, 'obtain'], [`rcases ${h.name} with ⟨${w}, h${w}⟩`, 'rcases'], [`cases ${h.name}`, 'cases']],
        term: `Exists.elim ${h.name} (fun ${w} h${w} => _)`,
        says: `${c(`obtain ⟨${w}, h${w}⟩ := ${h.name}`)} gives you a value ${c(w)} and ${c('h' + w)}, the fact ${c(p.b ?? '')} about it.`,
        termSays: `${c(`Exists.elim ${h.name} (fun ${w} h${w} => _)`)} hands you a value ${c(w)} and ${c('h' + w)}, the fact ${c(p.b ?? '')} about it; the ${c('_')} stands for a proof of the goal.`,
        about: h.name,
        score: 76,
      });
      break;
    }
    case 'iff': {
      const a = p.a ?? '';
      const b = p.b ?? '';
      const hypA = env.proofs.find((o) => o !== h && sameProp(o.type, a));
      const hypB = env.proofs.find((o) => o !== h && sameProp(o.type, b));
      if (sameProp(goalText, `${b} → ${a}`) || sameProp(goalText, `${a} → ${b}`)) {
        const dir = sameProp(goalText, `${a} → ${b}`) ? 'mp' : 'mpr';
        out.use = { text: `${H} says ${c(a)} and ${c(b)} imply each other, and one direction of it is exactly the goal.`, score: 97 };
        T.add({ tactics: [[`exact ${h.name}.${dir}`, 'exact']], term: `${h.name}.${dir}`, says: `${c(`exact ${h.name}.${dir}`)} takes that direction of ${H}, which is exactly the goal.`, termSays: `${c(`${h.name}.${dir}`)} is that direction of ${H}, which is exactly the goal.`, about: h.name, score: 97 });
      } else if (sameProp(goalText, `${b} ↔ ${a}`)) {
        out.use = { text: `${H} says ${c(a)} and ${c(b)} imply each other, and the goal is the same statement turned around.`, score: 96 };
        T.add({ tactics: [[`exact ${h.name}.symm`, 'exact']], term: `${h.name}.symm`, says: `${c(`exact ${h.name}.symm`)} turns ${H} around, which is exactly the goal.`, termSays: `${c(h.name + '.symm')} is ${H} turned around, which is exactly the goal.`, about: h.name, score: 96 });
      } else if (sameProp(goalText, b) && hypA) {
        out.use = { text: `${H} says ${c(a)} and ${c(b)} imply each other. You have ${c(a)} as ${c(hypA.name)}, and the goal is ${c(b)}.`, score: 97 };
        T.add({ tactics: [[`exact ${h.name}.mp ${hypA.name}`, 'exact']], term: `${h.name}.mp ${hypA.name}`, says: `${c(`exact ${h.name}.mp ${hypA.name}`)} turns your proof of ${c(a)} into one of ${c(b)}.`, termSays: `${c(`${h.name}.mp ${hypA.name}`)} turns your proof of ${c(a)} into one of ${c(b)}.`, about: h.name, score: 97 });
      } else if (sameProp(goalText, a) && hypB) {
        out.use = { text: `${H} says ${c(a)} and ${c(b)} imply each other. You have ${c(b)} as ${c(hypB.name)}, and the goal is ${c(a)}.`, score: 97 };
        T.add({ tactics: [[`exact ${h.name}.mpr ${hypB.name}`, 'exact']], term: `${h.name}.mpr ${hypB.name}`, says: `${c(`exact ${h.name}.mpr ${hypB.name}`)} turns your proof of ${c(b)} into one of ${c(a)}.`, termSays: `${c(`${h.name}.mpr ${hypB.name}`)} turns your proof of ${c(b)} into one of ${c(a)}.`, about: h.name, score: 97 });
      } else if (sameProp(goalText, b)) {
        out.use = { text: `${H} says ${c(a)} and ${c(b)} imply each other, and the goal is the right side, so proving ${c(a)} would be enough.`, score: 86 };
        T.add({ tactics: [[`apply ${h.name}.mp`, 'apply']], term: `${h.name}.mp _`, says: `${c(`apply ${h.name}.mp`)} turns the goal into ${c(a)}.`, termSays: `${c(h.name + '.mp _')}: the ${c('_')} stands for a proof of ${c(a)}.`, about: h.name, score: 86 });
      } else if (sameProp(goalText, a)) {
        out.use = { text: `${H} says ${c(a)} and ${c(b)} imply each other, and the goal is the left side, so proving ${c(b)} would be enough.`, score: 86 };
        T.add({ tactics: [[`apply ${h.name}.mpr`, 'apply']], term: `${h.name}.mpr _`, says: `${c(`apply ${h.name}.mpr`)} turns the goal into ${c(b)}.`, termSays: `${c(h.name + '.mpr _')}: the ${c('_')} stands for a proof of ${c(b)}.`, about: h.name, score: 86 });
      } else {
        out.use = { text: `${H} says ${c(a)} and ${c(b)} imply each other, so either can be turned into the other.`, score: 66 };
        T.add({
          tactics: [[`obtain ⟨hmp, hmpr⟩ := ${h.name}`, 'obtain'], [`rcases ${h.name} with ⟨hmp, hmpr⟩`, 'rcases']],
          term: `${h.name}.mp`,
          says: `${c(`obtain ⟨hmp, hmpr⟩ := ${h.name}`)} splits ${H} into the two implications ${c('hmp : ' + a + ' → ' + b)} and ${c('hmpr : ' + b + ' → ' + a)}.`,
          termSays: `${c(h.name + '.mp')} is the implication ${c(a + ' → ' + b)} and ${c(h.name + '.mpr')} is ${c(b + ' → ' + a)}.`,
          about: h.name,
          score: 60,
        });
      }
      break;
    }
    case 'or': {
      out.use = { text: `${H} says ${c(p.a ?? '')} or ${c(p.b ?? '')}. You don't know which, so your proof has to work in both cases.`, score: 76 };
      T.add({
        tactics: [[`cases ${h.name}`, 'cases'], [`rcases ${h.name} with ${fresh(env, 'hp', 'h1')} | ${fresh(env, 'hq', 'h2')}`, 'rcases'], [`obtain ${fresh(env, 'hp', 'h1')} | ${fresh(env, 'hq', 'h2')} := ${h.name}`, 'obtain']],
        term: `Or.elim ${h.name} (fun hp => _) (fun hq => _)`,
        says: `${c('cases ' + h.name)} splits into two goals: one where ${c(p.a ?? '')} holds and one where ${c(p.b ?? '')} holds. Each needs its own proof of the goal.`,
        termSays: `${c(`Or.elim ${h.name} (fun hp => _) (fun hq => _)`)} runs two proofs of the goal: one assuming ${c(p.a ?? '')} as ${c('hp')}, one assuming ${c(p.b ?? '')} as ${c('hq')}.`,
        about: h.name,
        score: 77,
      });
      break;
    }
    case 'false':
      out.use = { text: `${H} is ${c('False')}. Nobody can have that, so the goal follows at once.`, score: 98 };
      T.add({
        tactics: [['contradiction', 'contradiction'], [`exfalso`, 'exfalso']],
        term: `${h.name}.elim`,
        says: `${c('contradiction')} closes any goal when a hypothesis is ${c('False')}.`,
        termSays: `${c(h.name + '.elim')} turns a proof of ${c('False')} into a proof of anything.`,
        about: h.name,
        score: 98,
      });
      break;
    case 'eq': {
      const l = p.a ?? '';
      const r = p.b ?? '';
      const lhsIn = occurs(l, goalText) && !sameProp(l, r);
      const rhsIn = occurs(r, goalText) && !sameProp(l, r);
      if (sameProp(goalText, `${r} = ${l}`)) {
        out.use = { text: `${H} says ${c(`${l} = ${r}`)}, which is the goal with its sides swapped.`, score: 94 };
        T.add({ tactics: [[`exact ${h.name}.symm`, 'exact'], [`symm`, 'symm']], term: `${h.name}.symm`, says: `${c(`exact ${h.name}.symm`)} flips ${H} around, which is exactly the goal.`, termSays: `${c(h.name + '.symm')} is ${H} with its sides swapped, which is exactly the goal.`, about: h.name, score: 94 });
      } else if (lhsIn) {
        const after = replaceAll(goalText, l, wrap(r));
        out.use = { text: `${H} says ${c(`${l} = ${r}`)}, and ${c(l)} appears in the goal: you can swap it for ${c(r)}.`, score: 80 };
        T.add({ tactics: [[`rw [${h.name}]`, 'rw'], [`rewrite [${h.name}]`, 'rewrite']], term: `${h.name} ▸ _`, says: `${c(`rw [${h.name}]`)} replaces ${c(l)} by ${c(r)} in the goal, which becomes ${c(after)}.`, termSays: `${c(h.name + ' ▸ _')} rewrites ${c(l)} to ${c(r)}; the ${c('_')} stands for a proof of the goal with that swap made.`, about: h.name, score: 82 });
      } else if (rhsIn) {
        const after = replaceAll(goalText, r, wrap(l));
        out.use = { text: `${H} says ${c(`${l} = ${r}`)}, and ${c(r)} appears in the goal: you can swap it for ${c(l)}.`, score: 78 };
        T.add({ tactics: [[`rw [← ${h.name}]`, 'rw'], [`rewrite [← ${h.name}]`, 'rewrite']], term: `${h.name} ▸ _`, says: `${c(`rw [← ${h.name}]`)} replaces ${c(r)} by ${c(l)} in the goal, which becomes ${c(after)}.`, termSays: `${c(h.name + ' ▸ _')} rewrites ${c(r)} to ${c(l)}; the ${c('_')} stands for a proof of the goal with that swap made.`, about: h.name, score: 80 });
      }
      {
        const varSide = env.data.has(l) && !env.locals.has('') ? l : env.data.has(r) ? r : null;
        if (varSide && !sameProp(l, r)) {
          T.add({
            tactics: [[`subst ${h.name}`, 'subst']],
            says: `${c('subst ' + h.name)} replaces ${c(varSide)} by ${c(varSide === l ? r : l)} everywhere, and ${H} disappears.`,
            about: h.name,
            score: 58,
          });
        }
      }
      break;
    }
    case 'dvd':
      {
        const w = fresh(env, 'm', 'k', 'c');
        out.use = { text: `${H} says ${c(p.b ?? '')} is a multiple of ${c(p.a ?? '')}: ${c(p.b ?? '')} equals ${c(wrap(p.a ?? ''))} times some number. You can take that number.`, score: 68 };
        T.add({
          tactics: [[`obtain ⟨${w}, h${w}⟩ := ${h.name}`, 'obtain'], [`rcases ${h.name} with ⟨${w}, h${w}⟩`, 'rcases'], [`cases ${h.name}`, 'cases']],
          says: `${c(`obtain ⟨${w}, h${w}⟩ := ${h.name}`)} gives you a number ${c(w)} and ${c('h' + w)} : ${c(`${p.b} = ${wrap(p.a ?? '')} * ${w}`)}.`,
          about: h.name,
          score: 72,
        });
      }
      break;
    case 'not':
    case 'nmem':
    case 'ne':
      negCase();
      break;
    case 'mem': {
      const x = p.a ?? '';
      const s = parse(p.b ?? '', env.locals);
      if (s.kind === 'compl') {
        negCase();
      } else if (s.kind === 'inter') {
        out.use = { text: `${H} says ${c(x)} is in both ${c(s.a ?? '')} and ${c(s.b ?? '')}; each fact is usable on its own.`, score: 70 };
        T.add({
          tactics: [[`obtain ⟨${fresh(env, 'h1')}, ${fresh(env, 'h2')}⟩ := ${h.name}`, 'obtain'], [`rcases ${h.name} with ⟨h1, h2⟩`, 'rcases'], [`cases ${h.name}`, 'cases']],
          term: `${h.name}.1`,
          says: `${c(`obtain ⟨h1, h2⟩ := ${h.name}`)} splits ${H} into ${c('h1 : ' + x + ' ∈ ' + s.a)} and ${c('h2 : ' + x + ' ∈ ' + s.b)}.`,
          termSays: `${c(h.name + '.1')} proves ${c(x + ' ∈ ' + s.a)} and ${c(h.name + '.2')} proves ${c(x + ' ∈ ' + s.b)}.`,
          about: h.name,
          score: 72,
        });
      } else if (s.kind === 'union') {
        out.use = { text: `${H} says ${c(x)} is in ${c(s.a ?? '')} or in ${c(s.b ?? '')}. The proof has to work in both cases.`, score: 74 };
        T.add({
          tactics: [[`cases ${h.name}`, 'cases'], [`rcases ${h.name} with h1 | h2`, 'rcases'], [`obtain h1 | h2 := ${h.name}`, 'obtain']],
          term: `Or.elim ${h.name} (fun h1 => _) (fun h2 => _)`,
          says: `${c('cases ' + h.name)} splits into two goals: one where ${c(x + ' ∈ ' + s.a)} holds and one where ${c(x + ' ∈ ' + s.b)} holds.`,
          termSays: `${c(`Or.elim ${h.name} (fun h1 => _) (fun h2 => _)`)} runs two proofs of the goal, one for each case.`,
          about: h.name,
          score: 75,
        });
      } else if (s.kind === 'empty') {
        out.use = { text: `${H} says ${c(x)} is in the empty set. That cannot be, so the goal follows at once.`, score: 98 };
        T.add({
          tactics: [['contradiction', 'contradiction'], ['exfalso', 'exfalso'], [`cases ${h.name}`, 'cases']],
          term: `${h.name}.elim`,
          says: `${c('contradiction')} closes the goal, because nothing is in the empty set.`,
          termSays: `${c(h.name + '.elim')} turns the impossible membership into a proof of anything.`,
          about: h.name,
          score: 97,
        });
      } else if (s.kind === 'image') {
        out.use = { text: `${H} says ${c(x)} is a value of ${c(s.a ?? '')} at some element of ${c(s.b ?? '')}. You can take that element and use it.`, score: 72 };
        T.add({
          tactics: [['obtain ⟨a, ha, hfa⟩ := ' + h.name, 'obtain'], ['rcases ' + h.name + ' with ⟨a, ha, hfa⟩', 'rcases']],
          term: `${h.name}.elim (fun a ha => _)`,
          says: `${c('obtain ⟨a, ha, hfa⟩ := ' + h.name)} gives you the element ${c('a')}, the fact ${c('ha')} that it is in the set, and the equation ${c('hfa')}.`,
          about: h.name,
          score: 73,
        });
      } else if (s.kind === 'preimage' || s.kind === 'setof') {
        out.use = { text: `${H} is a membership that unfolds into a condition on ${c(x)}.`, score: 45 };
      }
      break;
    }
    case 'pred': {
      const args = splitArgs(p.args ?? '');
      if (p.head === 'Even' || p.head === 'Odd') {
        const n = args[0] ?? 'n';
        const form = p.head === 'Even' ? `${n} = r + r` : `${n} = 2 * r + 1`;
        out.use = { text: `${H} is a definition: ${c(n)} has the form ${c(form)} for some ${c('r')}. You can take such an ${c('r')}.`, score: 68 };
        T.add({
          tactics: [[`obtain ⟨r, hr⟩ := ${h.name}`, 'obtain'], [`rcases ${h.name} with ⟨r, hr⟩`, 'rcases'], [`cases ${h.name}`, 'cases']],
          term: `Exists.elim ${h.name} (fun r hr => _)`,
          says: `${c(`obtain ⟨r, hr⟩ := ${h.name}`)} gives you a number ${c('r')} and ${c('hr : ' + form)}.`,
          termSays: `${c(`Exists.elim ${h.name} (fun r hr => _)`)} gives you a number ${c('r')} and ${c('hr : ' + form)}.`,
          about: h.name,
          score: 72,
        });
      } else if (p.head === 'Function.Surjective') {
        const f = args[0] ?? 'f';
        out.use = { text: `${H} says every value is hit by ${c(f)}: for any ${c('b')} you can find an ${c('a')} with ${c(f + ' a = b')}.`, score: 62 };
        const v = [...env.data.entries()].find(([n, t]) => !/^Type|^Set|→|Prop/.test(t) && occurs(n, goalText));
        if (v) {
          T.add({
            tactics: [[`obtain ⟨a, ha⟩ := ${h.name} ${v[0]}`, 'obtain'], [`rcases ${h.name} ${v[0]} with ⟨a, ha⟩`, 'rcases']],
            term: `Exists.elim (${h.name} ${v[0]}) (fun a ha => _)`,
            says: `${c(`obtain ⟨a, ha⟩ := ${h.name} ${v[0]}`)} gives you an ${c('a')} with ${c(f + ' a = ' + v[0])}.`,
            termSays: `${c(`Exists.elim (${h.name} ${v[0]}) (fun a ha => _)`)} gives you an ${c('a')} with ${c(f + ' a = ' + v[0])}.`,
            about: h.name,
            score: 66,
          });
        }
      } else if (p.head === 'Function.Injective') {
        const f = args[0] ?? 'f';
        out.use = { text: `${H} says ${c(f)} never maps two different inputs to the same output, so equal outputs give equal inputs.`, score: 50 };
      } else if (PREDICATES[p.head ?? '']) {
        out.use = { text: `${H} is a definition (${c(p.text)}); it can be unfolded to what it says.`, score: 40 };
      }
      break;
    }
    case 'subset': {
      out.use = { text: `${H} says every element of ${c(p.a ?? '')} is in ${c(p.b ?? '')}, so a proof that ${c('x ∈ ' + p.a)} gives ${c('x ∈ ' + p.b)}.`, score: 50 };
      break;
    }
    case 'forall': {
      out.use = { text: `${H} holds for every ${c(p.vars?.[0] ?? 'x')}: you can ask it about any particular value.`, score: 50 };
      break;
    }
    default:
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

function read(goals: Goal[], ctx: ReadContext): Reading | null {
  if (!goals.length) return null;
  const g = goals[0];
  const env = mkEnv(g);
  const gp = parse(g.target, env.locals);
  const d = describe(gp, env, g);

  let say = d.say;
  if (goals.length > 1) {
    const tag = g.caseName ? ` (case ${c(g.caseName)})` : '';
    say = `${goals.length} goals are open. You are reading the first${tag}. ${say}`;
  }

  const T = new Collector(ctx);
  const clash = findClash(env);
  const goalIsFalse = gp.kind === 'false';
  const uses: { hyp: string; text: string; score: number }[] = [];

  goalTools(gp, g, env, T);
  for (const h of env.proofs) {
    const r = analyseHyp(h, gp, g, env, T, clash);
    if (r.use) uses.push({ hyp: h.name, text: r.use.text, score: r.use.score });
  }
  // a clash is worth saying when the goal is False even if no single hypothesis rule fired
  if (goalIsFalse && clash && !uses.some((u) => u.hyp === clash.neg.name)) {
    uses.push({ hyp: clash.neg.name, text: `${c(clash.neg.name)} and ${c(clash.pos.name)} contradict each other.`, score: 99 });
  }
  uses.sort((a, b) => b.score - a.score);
  const tools = T.list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.score - a.t.score || a.i - b.i)
    .slice(0, MAX_TOOLS)
    .map(({ t }) => ({ code: t.code, tactic: t.tactic, says: t.says, also: t.also, about: t.about }));

  return {
    shape: gp.kind,
    say,
    ask: d.ask,
    uses: uses.slice(0, MAX_USES).map(({ hyp, text }) => ({ hyp, text })),
    tools: tools.length ? tools : null,
    goalCount: goals.length,
  };
}

export function readGoal(goals: Goal[], ctx: ReadContext): Reading | null {
  try {
    return read(goals, ctx);
  } catch {
    return null;
  }
}
