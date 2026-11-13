/**
 * Screenshot a route of the running dev server, for visual checks.
 *
 *   npx vite --port 5181 --strictPort &            # start a dev server on your own port
 *   node scripts/shot.ts --port 5181 --route '#/map' --out /tmp/map.png
 *
 * Options:
 *   --port N          dev server port (default 5173)
 *   --route HASH      e.g. '#/level/logic-03' (default '#/')
 *   --out FILE        PNG path (required)
 *   --width N --height N   viewport (default 1366x820); --mobile = 390x800
 *   --theme dark|light     forces the theme (default dark)
 *   --save FILE       JSON file put into localStorage['inhabit.save'] before load (a save export)
 *   --ls KEY=FILE     extra localStorage entry from a file (repeatable)
 *   --full            full-page screenshot
 *   --click SELECTOR  click after load (repeatable, in order)
 *   --type TEXT       type into the focused element after clicks
 *   --wait MS         extra wait before the shot (default 400)
 *   --eval JS         run JS in the page before the shot; its result is printed
 * Prints console errors from the page. Uses the installed Google Chrome (no download).
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const all = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1]] : []));
const one = (name: string, d?: string): string | undefined => all(name)[0] ?? d;
const flag = (name: string) => argv.includes(`--${name}`);

const out = one('out');
if (!out) {
  console.error('missing --out');
  process.exit(2);
}
const mobile = flag('mobile');
const width = Number(one('width', mobile ? '390' : '1366'));
const height = Number(one('height', mobile ? '800' : '820'));
const theme = one('theme', 'dark')!;
const url = `http://localhost:${one('port', '5173')}/${one('route', '#/')}`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, colorScheme: theme === 'light' ? 'light' : 'dark', hasTouch: mobile });
const entries: [string, string][] = [];
const save = one('save');
if (save) entries.push(['inhabit.save', readFileSync(save, 'utf8')]);
for (const kv of all('ls')) {
  const i = kv.indexOf('=');
  entries.push([kv.slice(0, i), readFileSync(kv.slice(i + 1), 'utf8')]);
}
await ctx.addInitScript((es: [string, string][]) => {
  for (const [k, v] of es) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
}, entries);
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('[console.error]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
for (const sel of all('click')) await page.click(sel, { timeout: 5000 });
const typed = one('type');
if (typed) await page.keyboard.type(typed);
await page.waitForTimeout(Number(one('wait', '400')));
const js = one('eval');
if (js) console.log('[eval]', JSON.stringify(await page.evaluate(js)));
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) console.log(`[warn] horizontal page overflow: ${overflow}px`);
await page.screenshot({ path: out, fullPage: flag('full') });
console.log(`wrote ${out} (${width}x${height}, ${theme})`);
await browser.close();
