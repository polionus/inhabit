import type { BuiltInChoiceLevel, BuiltInOrderLevel, BuiltInTextLevel, LevelKindDef } from '../types.ts';
import { ChoiceLevelView } from './ChoiceLevel.tsx';
import { OrderLevelView } from './OrderLevel.tsx';
import { TextLevelView } from './TextLevel.tsx';

export const builtInLevelKinds: Record<string, LevelKindDef> = {
  choice: {
    label: 'Check',
    icon: 'check-circle',
    baseXp: 8,
    solutionText: (l) => {
      const c = l as BuiltInChoiceLevel;
      return c.options.find((o) => o.correct)?.text ?? null;
    },
    render: ChoiceLevelView,
  },
  order: {
    label: 'Arrange',
    icon: 'list',
    baseXp: 12,
    solutionText: (l) => (l as BuiltInOrderLevel).lines.join('\n'),
    render: OrderLevelView,
  },
  text: {
    label: 'Answer',
    icon: 'translate',
    baseXp: 15,
    initialBody: (l, mode, draft, progress) => {
      const t = l as BuiltInTextLevel;
      if (mode === 'review') return t.starter ?? '';
      return draft ?? (progress?.status === 'solved' || progress?.status === 'studied' ? (progress.best ?? t.starter ?? '') : (t.starter ?? ''));
    },
    solutionText: (l) => (l as BuiltInTextLevel).accept[0] ?? null,
    render: TextLevelView,
  },
};
