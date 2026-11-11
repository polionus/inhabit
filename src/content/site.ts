import type { AboutCopy, HomeCopy } from './types.ts';

// STUB — placeholder copy so the pages can be built; replaced by the copywriter.
export const home: HomeCopy = {
  hero: {
    eyebrow: 'Learn the Lean 4 theorem prover',
    headline: 'Placeholder headline about Lean',
    lede: 'Placeholder lede. Two sentences about what this is and what you leave with.',
    startLabel: 'Start level one',
    continueLabel: 'Continue',
    aboutLabel: 'What is this?',
    reassurances: ['No install', 'No account', 'Free'],
  },
  demo: {
    heading: 'Placeholder demo heading',
    intro: 'Placeholder intro to the live proof.',
    english: 'If P and Q both hold, then Q and P both hold.',
    code: 'theorem and_swap (P Q : Prop) (h : P ∧ Q) : Q ∧ P := by\n  obtain ⟨hp, hq⟩ := h\n  constructor\n  · exact hq\n  · exact hp',
    steps: [
      { line: 2, note: 'Placeholder note for step one.' },
      { line: 3, note: 'Placeholder note for step two.' },
      { line: 4, note: 'Placeholder note for step three.' },
      { line: 5, note: 'Placeholder note for step four.' },
    ],
    closing: 'Placeholder closing line.',
  },
  whatIsLean: { heading: 'What is Lean?', body: 'Placeholder paragraph.' },
  outcomes: {
    heading: 'What you will be able to do',
    items: [
      { title: 'Placeholder', body: 'Placeholder.' },
      { title: 'Placeholder', body: 'Placeholder.' },
      { title: 'Placeholder', body: 'Placeholder.' },
    ],
  },
  journey: { heading: 'The journey', intro: 'Placeholder.' },
  method: {
    heading: 'How you learn here',
    items: [
      { title: 'Placeholder', body: 'Placeholder.' },
      { title: 'Placeholder', body: 'Placeholder.' },
      { title: 'Placeholder', body: 'Placeholder.' },
    ],
  },
  audience: { heading: 'Who it is for', body: 'Placeholder.' },
  closing: { heading: 'Placeholder', body: 'Placeholder.', cta: 'Start level one' },
};

export const about: AboutCopy = {
  title: 'About Inhabit',
  lede: 'Placeholder lede.',
  sections: [
    { id: 'what-is-lean', title: 'What is Lean?', body: 'Placeholder.' },
    { id: 'how-a-level-works', title: 'How a level works', body: 'Placeholder.' },
  ],
  faq: [{ q: 'Placeholder question?', a: 'Placeholder answer.' }],
  credits: 'Placeholder credits.',
};
