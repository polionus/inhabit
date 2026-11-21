/** Node-safe build metadata for Inhabit (no DOM, React, or engine imports). */
export const meta = {
  id: 'inhabit',
  name: 'Inhabit',
  homeTitle: 'Inhabit — learn Lean 4, the theorem prover, by playing',
  description:
    'Inhabit is a free browser game that teaches Lean 4, the theorem prover: you write real proofs, one small goal at a time, with nothing to install.',
  storageKey: 'inhabit.save',
  splashDarkBg: '#0f111a',
  splashDarkInk: '#eceef8',
  splashLightBg: '#f2f3f8',
  splashLightInk: '#151726',
  themeColorDark: '#0f111a',
  themeColorLight: '#f2f3f8',
  ogSiteName: 'Inhabit',
  ogUrl: 'https://polionus.github.io/inhabit/',
  ogImage: 'https://polionus.github.io/inhabit/og.png',
  ogImageAlt: 'Inhabit: learn to write proofs a computer can check. A short Lean proof with its goal view.',
} as const;
