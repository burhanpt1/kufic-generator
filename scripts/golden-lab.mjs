// Renders a fixed list of Kufic Lab cases (prototypes/kufic-lab.html, fixed seeds) to SVG and PNG in tests/golden-lab/.
// These are visual references for the composition engine, not byte-exact targets: compare with scripts/compare-lab.mjs.
//   node scripts/golden-lab.mjs [filter]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { LAB_CASES } from '../tests/golden-lab/cases.mjs';
import { toPNG } from './raster.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'tests/golden-lab');
const filter = process.argv[2];

const html = readFileSync(join(root, 'prototypes/kufic-lab.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.eval('genId++; monoId++;'); // stop the start-up generation the page kicks off
for (let i = 0; i < 200 && w.eval('SEALW_STATE') === 'loading'; i++) await new Promise(r => setTimeout(r, 25));
if (w.eval('SEALW_STATE') !== 'on') throw new Error('seal WebAssembly kernel did not load');
// deterministic base parameters for monograms (the page draws them at random)
w.eval(`var monoRandomFixed = () => ({ stroke: 'blocks', curve: 0.4, joins: false, sym: 'none', spineH: 15, flags: 1, loops: 1, loopW: 0.5, armLen: 10, arms: 1, lines: 0, lineGap: 1,
  alternate: false, spiralRings: 3, corners: false, core: 'none', stretchy: true, dots: false, H: 9, stretch: 4, nest: true, overlap: 2, terminal: 'none', palette: 0,
  letterStyle: 'solid', weight: 0.85, soft: 0.2, la: 'knot', frame: 'none', box: 0.7, share: 2, fourfold: false, seed: 4243 })`);

const run = c => {
  w.__case = JSON.parse(JSON.stringify(c));
  switch (c.kind) {
    case 'shape':
      return w.eval('build({ ...FATIMID, ...__case.genome }, __case.text).svg');
    case 'fill':
      return w.eval(
        '(buildFill({ ...fillState, ...__case.state, text: __case.text, border: __case.border }) || {}).svg',
      );
    case 'maze':
      return w.eval('(buildMaze({ ...fillState, ...__case.state, text: __case.text }) || {}).svg');
    case 'mono':
      return w.eval('(monoBuild({ ...monoRandomFixed(), ...__case.params }, __case.text) || {}).svg');
  }
};

const done = [];
for (const c of LAB_CASES) {
  if (filter && !c.id.includes(filter)) continue;
  const t0 = Date.now();
  const svg = run(c);
  if (!svg) throw new Error(`${c.id}: no output`);
  writeFileSync(join(OUT, `${c.id}.svg`), svg + '\n');
  writeFileSync(join(OUT, `${c.id}.png`), toPNG(svg));
  done.push(c);
  console.log(`${c.id}  ${Date.now() - t0} ms`);
}
if (!filter) writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(done, null, 1) + '\n');
w.close();

// demo page: the references side by side
if (!filter) {
  const card = c =>
    `<figure><img src="../tests/golden-lab/${c.id}.png" alt="${c.id}" loading="lazy"><figcaption>${c.id}</figcaption></figure>`;
  writeFileSync(
    join(root, 'demos/golden-lab.html'),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kufic Lab references</title>
<style>
body{margin:0;padding:16px;font:14px/1.4 system-ui,sans-serif;background:#E4E7E2;color:#18302F}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#56676A;max-width:70ch}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
figure{margin:0;background:#F2F3EF;border:1px solid #C7CDC6;border-radius:6px;padding:8px}
img{display:block;width:100%;aspect-ratio:1;object-fit:contain}
figcaption{font-size:12px;color:#56676A;margin-top:4px;word-break:break-all}
</style>
</head>
<body>
<h1>Kufic Lab visual references</h1>
<p>Rendered from <code>prototypes/kufic-lab.html</code> with fixed seeds by <code>scripts/golden-lab.mjs</code>. The composition engine is compared against these with a pixel-diff threshold (<code>scripts/compare-lab.mjs</code>); they are references, not byte-exact targets.</p>
<div class="g">
${done.map(card).join('\n')}
</div>
</body>
</html>
`,
  );
}
