// Visual comparison against the Kufic Lab references in tests/golden-lab/.
//   node scripts/compare-lab.mjs <dir-with-candidate-svgs> [--threshold 0.12] [--out <dir for diff PNGs>]
// For each reference id with a candidate <id>.svg, rasterises it at the reference size and reports the share of pixels
// that differ (pixelmatch, anti-aliasing tolerant). Cases above the threshold are flagged for human review; the exit
// code is 1 if any are flagged. These are not byte-exact targets: the new engine is expected to differ in detail.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { toPNG } from './raster.mjs';

export function comparePNG(refBuf, candBuf) {
  const a = PNG.sync.read(refBuf),
    b = PNG.sync.read(candBuf);
  if (a.width !== b.width || Math.abs(a.height - b.height) > 2)
    return { ratio: 1, reason: `size ${b.width}×${b.height} vs ${a.width}×${a.height}` };
  const h = Math.min(a.height, b.height),
    crop = p => p.data.subarray(0, a.width * h * 4);
  const diff = new PNG({ width: a.width, height: h });
  const n = pixelmatch(crop(a), crop(b), diff.data, a.width, h, { threshold: 0.2 });
  return { ratio: n / (a.width * h), diff: PNG.sync.write(diff) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    ref = join(root, 'tests/golden-lab');
  const args = process.argv.slice(2),
    cand = args.find(a => !a.startsWith('--') && !/^[\d.]+$/.test(a));
  const tIdx = args.indexOf('--threshold'),
    threshold = tIdx >= 0 ? +args[tIdx + 1] : 0.12;
  const oIdx = args.indexOf('--out'),
    out = oIdx >= 0 ? args[oIdx + 1] : null;
  if (!cand) {
    console.error('usage: compare-lab.mjs <candidate-dir> [--threshold 0.12] [--out dir]');
    process.exit(2);
  }
  if (out) mkdirSync(out, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(ref, 'manifest.json'), 'utf8'));
  let flagged = 0,
    seen = 0;
  for (const { id } of manifest) {
    const p = join(cand, `${id}.svg`);
    if (!existsSync(p)) continue;
    seen++;
    const r = comparePNG(readFileSync(join(ref, `${id}.png`)), toPNG(readFileSync(p, 'utf8')));
    const bad = r.ratio > threshold;
    if (bad) flagged++;
    console.log(
      `${bad ? 'REVIEW' : 'ok    '}  ${(r.ratio * 100).toFixed(1).padStart(5)}%  ${id}${r.reason ? '  ' + r.reason : ''}`,
    );
    if (out && r.diff) writeFileSync(join(out, `${id}.diff.png`), r.diff);
  }
  console.log(`${seen} compared, ${flagged} flagged above ${(threshold * 100).toFixed(0)}%`);
  process.exit(flagged ? 1 : 0);
}
