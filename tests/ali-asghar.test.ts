// Ali Asghar (src/showpiece/aliAsghar): the name in a thuluth cartouche framed by ornament alone, one A3 sheet per
// layout. `npm run ali-asghar` writes the print files to docs/ali-asghar, and fabrication files for swoop 27.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { PNG } from 'pngjs';
import { laserSVG, plotterSVG, reliefSVG } from '../src/fabricate';
import { cropToObject, heightmapFromPixels, heightmapToMesh, meshStats, meshToSTL } from '../src/fabricate/mesh';
import { toPNG } from '../scripts/raster.mjs';
import { isValidComposition } from '../src/model/schema';
import { ALI_ASGHAR_LAYOUTS, aliAsgharComposition, aliAsgharPlaque, aliAsgharSheet } from '../src/showpiece/aliAsghar';
import type { AliAsgharLayout } from '../src/showpiece/aliAsghar';

describe('Ali Asghar', () => {
  for (const v of ['lapis', 'cobalt'] as const)
    it(`${v}: a cartouche with no text round it, on one A3 landscape sheet`, () => {
      const c = aliAsgharComposition(v);
      expect(isValidComposition(c)).toBe(true);
      expect(Object.keys(c.texts)).toEqual(['names']);
      const s = aliAsgharSheet(v);
      expect(s.placed.meta.warnings).toEqual([]);
      expect(s.placed.meta.fill).toMatchObject({ type: 'roundel', ok: true });
      expect(s.w / s.h).toBeCloseTo(Math.SQRT2, 6);
      expect(s.svg).toContain('width="420mm" height="297mm"');
      if (process.env.ALI_ASGHAR) {
        mkdirSync('docs/ali-asghar', { recursive: true });
        writeFileSync(`docs/ali-asghar/ali-asghar-${v}.svg`, s.svg);
      }
    }, 60000);
  for (const layout of Object.keys(ALI_ASGHAR_LAYOUTS).filter(k => k !== 'side') as AliAsgharLayout[])
    it(`${layout}: the swoops or the shelf are drawn`, () => {
      const c = aliAsgharComposition('lapis', layout);
      expect(isValidComposition(c)).toBe(true);
      const p = resolve(c),
        m = p.meta.fill?.type === 'roundel' ? p.meta.fill.metrics : undefined;
      expect(p.meta.warnings).toEqual([]);
      expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: true });
      // the swoop: the ya's tail under أصغر and the ra's own
      if (layout.startsWith('swoop')) expect(m?.tails).toBe(2);
      if (process.env.ALI_ASGHAR) {
        mkdirSync('docs/ali-asghar', { recursive: true });
        writeFileSync(`docs/ali-asghar/ali-asghar-${layout}.svg`, aliAsgharSheet('lapis', layout).svg);
        // the chosen one also for making: a plotter drawing (letter outlines, and the pen's centreline), laser
        // layers and a relief depth map, 400 mm wide
        if (layout === 'swoop-27') {
          writeFileSync(`docs/ali-asghar/${layout}-plotter.svg`, plotterSVG(p, { widthMM: 400 }));
          writeFileSync(`docs/ali-asghar/${layout}-plotter-centre.svg`, plotterSVG(p, { widthMM: 400, pen: 'centre' }));
          writeFileSync(`docs/ali-asghar/${layout}-laser.svg`, laserSVG(p, { widthMM: 400 }));
          writeFileSync(`docs/ali-asghar/${layout}-relief.svg`, reliefSVG(p));
        }
      }
    }, 60000);
  it('swoop 27 as a plaque: no tiles, a watertight solid 200 mm wide', () => {
    const p = resolve(aliAsgharPlaque());
    expect(p.items.some(i => i.type === 'tilework')).toBe(false);
    expect(p.items.some(i => i.type === 'roundel')).toBe(true);
    const relief = reliefSVG(p),
      solid = (width: number, resolution: number) => {
        // the black floor outside the outline is cut away, so the solid is the plaque's own shape
        const hm = heightmapFromPixels(cropToObject(PNG.sync.read(toPNG(relief, width))), { cutBelow: 0.05 });
        return heightmapToMesh(hm, { widthMM: 200, baseMM: 3, reliefMM: 4, resolution });
      };
    const m = solid(600, 256),
      st = meshStats(m);
    expect(st.max[0] - st.min[0]).toBeGreaterThan(198);
    expect(st.max[2]).toBeCloseTo(7, 5);
    // closed: every edge has exactly one twin running the other way
    const e = new Map<string, number>(),
      T = m.triangles;
    for (let t = 0; t < T.length; t += 3)
      for (const [a, b] of [[T[t], T[t + 1]], [T[t + 1], T[t + 2]], [T[t + 2], T[t]]]) e.set(a + ',' + b, (e.get(a + ',' + b) ?? 0) + 1); // prettier-ignore
    for (const [k, c] of e) expect(c === 1 && e.get(k.split(',').reverse().join(',')) === 1).toBe(true);
    if (process.env.ALI_ASGHAR) {
      mkdirSync('docs/ali-asghar', { recursive: true });
      writeFileSync('docs/ali-asghar/swoop-27-plaque-relief.svg', relief);
      // a 0.2 mm grid for filament printers, 0.1 mm for resin
      for (const [res, name] of [
        [1024, 'fdm'],
        [2048, 'resin'],
      ] as const)
        writeFileSync(`docs/ali-asghar/swoop-27-plaque-${name}.stl`, meshToSTL(solid(2600, res), 'ali-asghar'));
    }
  }, 300000);
});
