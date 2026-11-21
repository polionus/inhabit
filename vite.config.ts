import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GAMES, type GameId } from './src/games/registry.ts';

function resolveGameId(): GameId {
  const raw = process.env.VITE_GAME ?? 'inhabit';
  if (!(raw in GAMES)) {
    throw new Error(`Unknown VITE_GAME="${raw}". Expected one of: ${Object.keys(GAMES).join(', ')}`);
  }
  return raw as GameId;
}

const VIRTUAL_DISC_ID = 'virtual:game-disc';
const RESOLVED_VIRTUAL_DISC_ID = '\0' + VIRTUAL_DISC_ID;

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function gameDiscPlugin(): Plugin {
  const gameId = resolveGameId();
  const entry = GAMES[gameId];
  const { meta } = entry;

  return {
    name: 'game-disc-plugin',
    resolveId(id) {
      if (id === VIRTUAL_DISC_ID) return RESOLVED_VIRTUAL_DISC_ID;
      return null;
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_DISC_ID) {
        return `import disc from ${JSON.stringify(entry.discModule)};\nexport { disc };\nexport default disc;\n`;
      }
      return null;
    },
    transformIndexHtml(html) {
      const ogTags = meta.ogUrl
        ? [
            `<meta property="og:type" content="website" />`,
            `<meta property="og:site_name" content="${escAttr(meta.ogSiteName)}" />`,
            `<meta property="og:title" content="${escAttr(meta.homeTitle)}" />`,
            `<meta property="og:description" content="${escAttr(meta.description)}" />`,
            `<meta property="og:url" content="${escAttr(meta.ogUrl)}" />`,
            `<meta property="og:image" content="${escAttr(meta.ogImage)}" />`,
            `<meta property="og:image:width" content="1200" />`,
            `<meta property="og:image:height" content="630" />`,
            `<meta property="og:image:alt" content="${escAttr(meta.ogImageAlt)}" />`,
            `<meta name="twitter:card" content="summary_large_image" />`,
            `<meta name="twitter:image" content="${escAttr(meta.ogImage)}" />`,
            `<meta name="twitter:title" content="${escAttr(meta.homeTitle)}" />`,
            `<meta name="twitter:description" content="${escAttr(meta.description)}" />`,
          ].join('\n    ')
        : '';

      const map: Record<string, string> = {
        '%GAME_TITLE%': escAttr(meta.homeTitle),
        '%GAME_DESCRIPTION%': escAttr(meta.description),
        '%GAME_STORAGE_KEY%': meta.storageKey,
        '%GAME_SPLASH_DARK_BG%': meta.splashDarkBg,
        '%GAME_SPLASH_DARK_INK%': meta.splashDarkInk,
        '%GAME_SPLASH_LIGHT_BG%': meta.splashLightBg,
        '%GAME_SPLASH_LIGHT_INK%': meta.splashLightInk,
        '%GAME_THEME_COLOR_DARK%': meta.themeColorDark,
        '%GAME_THEME_COLOR_LIGHT%': meta.themeColorLight,
        '%GAME_OG_TAGS%': ogTags,
      };
      let out = html;
      for (const [k, v] of Object.entries(map)) out = out.replaceAll(k, v);
      return out;
    },
  };
}

// Relative base so the build works from any sub-path (GitHub Pages project sites).
export default defineConfig({
  base: './',
  plugins: [gameDiscPlugin(), react()],
  build: {
    rollupOptions: {
      output: {
        // Split the big, rarely-changing pieces so the app shell and caching stay small.
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@codemirror') || id.includes('@lezer') || id.includes('codemirror') || id.includes('style-mod') || id.includes('crelt') || id.includes('w3c-keyname')) return 'codemirror';
            if (id.includes('/react') || id.includes('scheduler') || id.includes('zustand')) return 'react';
            if (/node_modules\/(peerjs|webrtc-adapter|sdp|eventemitter3|peerjs-js-binarypack|@swc\/helpers)\//.test(id)) return 'peerjs';
            return 'vendor';
          }
          if (id.includes('/src/domains/lean/engine/')) return 'engine';
          if (/\/src\/games\/inhabit\/content\/(guide|graduate|ideas)\.ts$|\/src\/games\/inhabit\/content\/chapters\/(?!index|meta)/.test(id)) return undefined;
          if (id.includes('/src/games/inhabit/content/lessons/')) return 'lessons';
          if (id.includes('/src/games/inhabit/content/')) return 'content';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
