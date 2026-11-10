import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any sub-path (GitHub Pages project sites).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
