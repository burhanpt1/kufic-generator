// The thuluth lab (prototypes/thuluth-lab/) as an oracle: runs its bundle in headless Chromium, the way the lab ran.
// Development only (needs Playwright, which is not a project dependency; set PLAYWRIGHT_MODULE to its path if it is
// installed globally). Tests never call this: they compare against the committed references.
//
//   node scripts/thuluth-lab.mjs references      re-render the lab references into tests/golden-thuluth-lab/ (twice,
//                                                 to check the lab is deterministic) and rasterise them to PNG
//   node scripts/thuluth-lab.mjs eval <file.js>   run a script against the lab (its body gets the lab's globals;
//                                                 `return` a JSON-serialisable value) and print the result as JSON
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toPNG } from './raster.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  lab = join(root, 'prototypes/thuluth-lab'),
  refs = join(root, 'tests/golden-thuluth-lab');

async function playwright() {
  const spec = process.env.PLAYWRIGHT_MODULE;
  try {
    return spec ? await import(pathToFileURL(spec).href) : await import('playwright');
  } catch {
    throw new Error('Playwright is needed: npm i -g playwright, then PLAYWRIGHT_MODULE=<its index.mjs>');
  }
}

/** Run `body` (a function body using the lab's globals) in a fresh page with the lab loaded; args are passed as `args`. */
export async function runLab(body, args = null) {
  const { chromium } = await playwright();
  const b = await chromium.launch();
  try {
    const pg = await b.newPage();
    await pg.setContent('<body></body>');
    await pg.addScriptTag({ content: readFileSync(join(lab, 'thuluth-lab.bundle.js'), 'utf8') });
    return await pg.evaluate(new Function('args', body), args);
  } finally {
    await b.close();
  }
}

/** The reference set (as tools/render_reference.py renders it). */
export const SPEC = [
  'زينب وقصي',
  'بسم الله الرحمن الرحيم',
  'محمد رسول الله',
  'الحمد لله',
  'قصي',
  'صبر',
  'سبحان الله',
  'حافظوا على',
  'مودة ورحمة',
];
const REFERENCE_BODY = `
  const [SPEC, rc] = args, res = {};
  BODY = 1.45; NIB_FLOOR = 0.3; LOOP_GAP = 1.8; useLearned(true, 1 / 1.25 * 1.12);
  SPEC.forEach((t, i) => { res['line-' + String(i).padStart(2, '0') + '-roundel'] = renderLine(t, { U: 10, nib: 1.6, ang: 69, pad: 2 }); });
  BODY = 1.25; NIB_FLOOR = 0.43; LOOP_GAP = 0.9; useLearned(true, 1 / 1.25 * 1.12);
  SPEC.forEach((t, i) => { res['line-' + String(i).padStart(2, '0') + '-tile'] = renderLine(t, { U: 10, nib: 0.95, ang: 69, pad: 2 }); });
  BODY = 1.45; NIB_FLOOR = 0.3; LOOP_GAP = 1.8; useLearned(true, 1 / 1.25 * 1.12); const pen = { nib: 1.6, ang: 69 };
  useGreat(true, { ya: true, yaWide: 2.6, yaDeep: 1.3 }); const fx = JSON.parse(JSON.stringify(rc.layout)); fx.wp[0].y += 1.4;
  const r = composeRoundel(rc.text, { ...pen, elongate: true, cross: true, fillTarget: 0.5, noRise: true, cradle: true, oval: 1.45, emph: 'ب', kern: true, tries: 1, fixed: fx })[0];
  const wi = r.groups.findIndex(g => g.s === 'و'); scaleGroup(r, wi, 0.62, pen.nib); r.groups[wi].tint = '#2aa6a0'; placeUnder(r, wi, 1, 0.7, 0);
  shapeBowl(r, { oval: 1.45, clear: 5.6, autoOval: true }); const f = fitFrame(r, { ...pen, markReach: 2.2, ornaments: true, density: 0.6 });
  res['cartouche-zainab-qusay'] = renderRoundel(r, { ...pen, U: 12, field: '#1f3f8f', gold: '#f4f6f7', goldDark: '#16306e', outline: '#16306e', bg: '#f4f6f7', solved: f.solved, discScale: 1.0, noOutline: true, counters: '#2aa6a0' });
  useGreat(false);
  [8, 10, 12].forEach(fold => { res['tiling-' + fold + 'fold'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">' + iznikField(800, { fold, density: 3 }) + '</svg>'; });
  return res;`;
/** Raster width per reference kind: lines are long and low, so they get more pixels. */
export const widthOf = id => (id.startsWith('line-') ? 960 : id.startsWith('cartouche') ? 800 : 600);
const norm = s => s.replace(/\b(gd|fd|r)\d+\b/g, 'id'); // renderer ids are counters, not content

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'references') {
    const rc = JSON.parse(readFileSync(join(lab, 'layouts/zainab-qusay.json'), 'utf8'));
    const a = await runLab(REFERENCE_BODY, [SPEC, rc]),
      b = await runLab(REFERENCE_BODY, [SPEC, rc]);
    const diff = Object.keys(a).filter(k => norm(a[k]) !== norm(b[k]));
    mkdirSync(refs, { recursive: true });
    const manifest = Object.keys(a).map(id => {
      // the tilings are megabytes of SVG: keep only their raster
      if (!id.startsWith('tiling-')) writeFileSync(join(refs, `${id}.svg`), a[id]);
      writeFileSync(join(refs, `${id}.png`), toPNG(a[id], widthOf(id)));
      return { id, width: widthOf(id) };
    });
    writeFileSync(join(refs, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
    console.log(
      `${manifest.length} references;`,
      diff.length ? `NOT deterministic: ${diff.join(', ')}` : 'deterministic',
    );
  } else if (cmd === 'eval' && arg) {
    console.log(JSON.stringify(await runLab(readFileSync(arg, 'utf8'))));
  } else {
    console.error('usage: thuluth-lab.mjs references | eval <file.js>');
    process.exit(2);
  }
}
