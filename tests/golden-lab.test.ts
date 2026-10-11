// The engine against the Kufic Lab references. Every lab case must map to a composition that resolves and renders,
// and its render is pixel-compared with the lab's. The references are visual targets, not byte-exact ones: the
// differences were reviewed by eye (more rings fit, sizes differ) and recorded in reviewed.json; a case that gets
// more than 5 points worse than its reviewed score fails, for a human to look at. LAB_COMPARE=1 also writes the
// renders, diff images and a side-by-side page to tests/golden-lab/compare/; after reviewing a deliberate change,
// LAB_COMPARE=update records the new scores.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { renderPlaced } from '../src/render/composition';
import { comparePNG } from '../scripts/compare-lab.mjs';
import { toPNG } from '../scripts/raster.mjs';
import { LAB_CASES } from './golden-lab/cases.mjs';
import { labCaseToComposition } from './golden-lab/compositions';

const dir = join(import.meta.dirname, 'golden-lab'),
  compare = !!process.env.LAB_COMPARE,
  out = join(dir, 'compare'),
  reviewed: Record<string, number> = JSON.parse(readFileSync(join(dir, 'reviewed.json'), 'utf8'));
const report: { id: string; ratio: number; ms: number; warnings: string[] }[] = [];

describe('Kufic Lab cases in the composition engine', () => {
  it.each(LAB_CASES.map(c => [c.id, c] as const))('%s', (id, c) => {
    const t0 = performance.now();
    const placed = resolve(labCaseToComposition(c));
    const svg = renderPlaced(placed, { idPrefix: id });
    const ms = performance.now() - t0;
    expect(svg).toMatch(/^<svg /);
    expect(placed.meta.fill?.ok ?? true).toBe(true);
    const r = comparePNG(readFileSync(join(dir, `${id}.png`)), toPNG(svg));
    if (process.env.LAB_COMPARE !== 'update')
      expect(r.ratio, `${id} differs more from the lab than when reviewed`).toBeLessThanOrEqual(
        (reviewed[id] ?? 0) + 0.05,
      );
    if (compare) {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, `${id}.svg`), svg);
      if (r.diff) writeFileSync(join(out, `${id}.diff.png`), r.diff);
      report.push({ id, ratio: r.ratio, ms, warnings: placed.meta.warnings });
      if (report.length === LAB_CASES.length) {
        writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
        if (process.env.LAB_COMPARE === 'update')
          writeFileSync(
            join(dir, 'reviewed.json'),
            JSON.stringify(Object.fromEntries(report.map(x => [x.id, Math.round(x.ratio * 1000) / 1000])), null, 1) +
              '\n',
          );
        const row = (x: (typeof report)[number]) =>
          `<tr><td>${x.id}<br><small>${(x.ratio * 100).toFixed(1)}% differ${x.ratio > 0.12 ? ' — review' : ''} · ${x.ms.toFixed(0)} ms${x.warnings.length ? '<br>' + x.warnings.join('<br>') : ''}</small></td><td><img src="../${x.id}.png"></td><td><img src="${x.id}.svg"></td></tr>`;
        writeFileSync(
          join(out, 'index.html'),
          `<!doctype html><meta charset="utf-8"><title>Lab vs engine</title><style>body{font:13px system-ui;margin:16px}td{vertical-align:top;padding:6px}img{width:300px}</style><table><tr><th></th><th>Lab</th><th>Engine</th></tr>${report.map(row).join('')}</table>`,
        );
      }
    }
  });
});
