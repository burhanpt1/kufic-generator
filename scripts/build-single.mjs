// Builds the studio as one self-contained HTML file (dist-single/studio.html), for publishing where pages may make
// no requests: scripts, styles and the evaluation worker are inlined (the worker as a blob, falling back to
// in-thread evaluation where blob workers are refused), and the WebAssembly kernel is already embedded as base64
// (falling back to the identical JS search where WebAssembly is refused). Parts that need the network or other
// pages are left out: the visual critic (calls the Claude API) and the link to the classic tool.
//   node scripts/build-single.mjs
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  out = join(root, 'dist-single'),
  tmp = join(out, 'tmp');

const single = {
  name: 'single-file',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/evolve/pool.ts')) return null;
    const from = "new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })";
    if (!code.includes(from)) throw new Error('pool.ts: worker construction changed; update build-single.mjs');
    return `import InlineWorker from './worker.ts?worker&inline';\n` + code.replace(from, 'new InlineWorker()');
  },
  transformIndexHtml(html) {
    return html
      .replace(/\s*<a href="\.\/index\.html"[^>]*>Classic tool<\/a>/, '')
      .replace(/<details class="group critic" id="critic">/, '<details class="group critic" id="critic" hidden>');
  },
};

rmSync(out, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  logLevel: 'warn',
  base: './',
  plugins: [single],
  worker: { format: 'es' },
  build: {
    outDir: tmp,
    emptyOutDir: true,
    assetsInlineLimit: 1e9,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { input: join(root, 'studio.html'), output: { codeSplitting: false } },
  },
});

let html = readFileSync(join(tmp, 'studio.html'), 'utf8');
const asset = f => readFileSync(join(tmp, f.replace(/^\.\//, '')), 'utf8');
html = html
  .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => {
    const js = asset(src).replace(/<\/(script)/gi, '<\\/$1');
    return `<script type="module">${js}</script>`;
  })
  .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => `<style>${asset(href)}</style>`);
const left = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map(m => m[1]);
if (left.length) throw new Error('not inlined: ' + left.join(', '));
writeFileSync(join(out, 'studio.html'), html);
// The claude.ai artifact variant: the host supplies the document skeleton, and its frame makes downloads and
// address-bar links inert, so those controls are hidden there (copying ratings, letter sets and text still works).
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta (charset|name="viewport")[^>]*>\s*/g, ''),
  body = html
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<button id="(share|saveSvg|savePng)"/g, '<button hidden id="$1"')
    .replace('<select id="fab"', '<select hidden id="fab"');
writeFileSync(join(out, 'kufic-studio.html'), head.trim() + '\n' + body.trim() + '\n');
rmSync(tmp, { recursive: true, force: true });
const kb = Buffer.byteLength(html) / 1024;
console.log(`dist-single/studio.html: ${kb.toFixed(0)} KB`, readdirSync(out));
