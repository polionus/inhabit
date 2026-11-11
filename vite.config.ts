import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any sub-path (GitHub Pages project sites).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the big, rarely-changing pieces so the app shell and caching stay small.
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@codemirror') || id.includes('@lezer') || id.includes('codemirror') || id.includes('style-mod') || id.includes('crelt') || id.includes('w3c-keyname')) return 'codemirror';
            if (id.includes('/react') || id.includes('scheduler') || id.includes('zustand')) return 'react';
            return 'vendor';
          }
          if (id.includes('/src/engine/')) return 'engine';
          if (id.includes('/src/content/')) return 'content';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
