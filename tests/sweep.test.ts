// The sweep (src/script/thuluth/roundel/sweep.ts). `npm run sweep` writes many roundels per text to docs/sweep: a PNG
// each, manifest.json (family, seed, recipe, critic features, taste score, checks) and index.html, a contact sheet
// best first. SWEEP_TEXTS ('|'-separated), SWEEP_N (seeds per family), SWEEP_FAMILIES (comma-separated: free, lanes,
// mirror, path:<name>), SWEEP_PREFIX (ids) and SWEEP_OUT set it. Without SWEEP, a small sweep checks the shape of its output.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import type { SweepFamily } from '../src/script/thuluth/roundel';
import { sweep } from '../src/script/thuluth/roundel';
import { toPNG } from '../scripts/raster.mjs';

const RUN = !!process.env.SWEEP;

describe('sweep', () => {
  it('gives every candidate its family, recipe, features, score and drawing; never a mirrored الله', () => {
    const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true } }),
      items = sweep(th, ['علي', 'الله'], { n: 1, families: ['free', 'mirror'], tries: 1, iters: 800 });
    expect(items.filter(i => i.text === 'علي').map(i => i.family)).toEqual(['free', 'mirror']);
    expect(items.filter(i => i.text === 'الله').map(i => i.family)).toEqual(['free']);
    for (const i of items) {
      expect(i.svg.startsWith('<svg')).toBe(true);
      expect(Number.isFinite(i.score)).toBe(true);
      expect(i.features.unity).toBeGreaterThan(0);
    }
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
  });

  it.runIf(RUN)(
    'writes the sweep',
    () => {
      const texts = (process.env.SWEEP_TEXTS ?? 'بسم الله الرحمن الرحيم|اللهم صل على محمد وآل محمد|الحمد لله رب العالمين').split('|'), // prettier-ignore
        families = (process.env.SWEEP_FAMILIES?.split(',') as SweepFamily[]) ?? undefined,
        out = process.env.SWEEP_OUT ?? join(import.meta.dirname, '../docs/sweep'),
        th = thuluth({ ...ROUNDEL_PEN, great: { ya: true } }),
        items = sweep(th, texts, { n: +(process.env.SWEEP_N ?? 3), families, prefix: process.env.SWEEP_PREFIX });
      mkdirSync(out, { recursive: true });
      for (const i of items) writeFileSync(join(out, `${i.id}.png`), toPNG(i.svg, 480));
      const manifest = items.map(m => ({ ...m, svg: undefined }));
      writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
      const byText = texts.map(t => manifest.filter(m => m.text === t).sort((a, b) => b.score - a.score));
      writeFileSync(
        join(out, 'index.html'),
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sweep</title><style>body{margin:0;padding:12px;font:14px system-ui;background:#f4efe3;color:#1d2440}h2{font-size:18px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}figure{margin:0}img{width:100%;display:block;border-radius:6px}figcaption{font-size:11px;color:#5b6377}</style>` +
          byText.map((ms, k) => `<h2 dir="rtl">${texts[k]}</h2><div class="g">${ms.map(m => `<figure><img src="${m.id}.png" loading="lazy"><figcaption>${m.id} · ${m.family} · ${m.score.toFixed(2)}${m.checks ? ` · space ${m.checks.wordSpace.toFixed(1)} · stray ${m.checks.strayMarks + m.checks.strayDots}` : ''}</figcaption></figure>`).join('')}</div>`).join(''), // prettier-ignore
      );
      expect(items.length).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
