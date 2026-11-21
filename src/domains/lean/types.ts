import type {
  TemplateCodexEntry,
  TemplateHint,
  TemplateLevel,
  TemplateUnlocks,
  TemplateWorld,
} from '../../template/types.ts';

export type Hint = TemplateHint;

export interface LeanUnlocks extends TemplateUnlocks {
  tactics?: string[];
  lemmas?: string[];
  codex?: string[];
}

export interface ProofLevel extends TemplateLevel {
  kind: 'proof';
  english: string;
  setup?: string;
  header: string;
  starter: string;
  after?: string;
  mode: 'tactic' | 'term';
  solutions: string[];
  hints: Hint[];
  extraTactics?: string[];
  forbidden?: string[];
  mustUse?: string[];
  showTerm?: boolean;
  grants?: string[];
  unlocks?: LeanUnlocks;
}

export interface ParsonsLevel extends TemplateLevel {
  kind: 'parsons';
  english: string;
  setup?: string;
  header: string;
  lines: string[];
  distractors?: string[];
  hints: Hint[];
  grants?: string[];
  unlocks?: LeanUnlocks;
}

export interface ChoiceOption {
  text: string;
  correct?: boolean;
  feedback: string;
}

export interface LeanChoiceLevel extends TemplateLevel {
  kind: 'choice';
  question: string;
  code?: string;
  setup?: string;
  options: ChoiceOption[];
  grants?: string[];
  unlocks?: LeanUnlocks;
}

export interface PredictLevel extends TemplateLevel {
  kind: 'predict';
  setup?: string;
  code: string;
  line: number;
  question?: string;
  options: ChoiceOption[];
  grants?: string[];
  unlocks?: LeanUnlocks;
}

export interface FormalizeLevel extends TemplateLevel {
  kind: 'formalize';
  english: string;
  setup?: string;
  binders?: string;
  starter?: string;
  accept: string[];
  mistakes?: { statement: string; feedback: string }[];
  hints: Hint[];
  grants?: string[];
  unlocks?: LeanUnlocks;
}

export type LeanLevel =
  | ProofLevel
  | ParsonsLevel
  | LeanChoiceLevel
  | PredictLevel
  | FormalizeLevel;

export interface LeanLemma {
  name: string;
  source: string;
  origin: 'core' | 'game';
  doc: string;
}

export interface LeanWorld extends TemplateWorld {
  levels: LeanLevel[];
  codex: TemplateCodexEntry[];
  lemmas: LeanLemma[];
}

export interface LeanLevelContext {
  world: LeanWorld;
  level: LeanLevel;
  index: number;
  lemmas: LeanLemma[];
  allowedTactics: string[];
  codex: string[];
}

export interface TheoremIdea {
  id: string;
  area: 'logic' | 'numbers' | 'sets' | 'functions' | 'mixed';
  difficulty: 1 | 2 | 3;
  title: string;
  english: string;
  statement: string;
  strategy: string;
  definitions?: string;
  proof: string;
}

export interface GraduateSection {
  id: string;
  title: string;
  body: string;
}

export interface PhrasebookRow {
  game: string;
  mathlib: string;
  note?: string;
}

export interface HomeDemo {
  heading: string;
  intro: string;
  english: string;
  code: string;
  steps: { line: number; note: string }[];
  closing: string;
}
