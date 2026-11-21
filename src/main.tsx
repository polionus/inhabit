import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/dejavu-mono/latin-400.css';
import '@fontsource/dejavu-mono/latin-700.css';
import '@fontsource/noto-sans-math/latin-400.css';
import '@fontsource-variable/source-serif-4/index.css';
import '@fontsource-variable/figtree/index.css';
import './template/styles.css';
import { GameApp } from './template/App.tsx';
import disc from 'virtual:game-disc';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameApp disc={disc} />
  </StrictMode>,
);
