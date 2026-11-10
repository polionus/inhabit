import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/dejavu-mono/latin-400.css';
import '@fontsource/dejavu-mono/latin-700.css';
import '@fontsource/noto-sans-math/latin-400.css';
import '@fontsource-variable/source-serif-4/index.css';
import './ui/styles.css';
import { App } from './ui/App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
