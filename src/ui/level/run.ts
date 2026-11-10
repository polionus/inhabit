import type { MutableRefObject } from 'react';
import type { Level } from '../../content/types.ts';
import type { LevelSession } from '../../game/env.ts';

export interface EditorApi {
  insert?: (text: string) => void;
  setBody?: (text: string) => void;
}

export interface RunCompletion {
  body?: string;
  selfAssessed?: boolean;
  /** Passed, but only by looking at the answer (e.g. "I see the difference"). */
  studied?: boolean;
  term?: string;
}

/** What each level-kind component gets from the LevelPlayer. */
export interface Run {
  level: Level;
  mode: 'play' | 'review';
  session: LevelSession;
  fontSize: number;
  solved: boolean;
  /** Initial text for body levels (draft, best solution or starter). */
  initialBody: string;
  attempt(): void;
  complete(c?: RunCompletion): void;
  saveDraft(text: string): void;
  api: MutableRefObject<EditorApi>;
}

export const hintsOf = (l: Level) => ('hints' in l ? l.hints : []);
