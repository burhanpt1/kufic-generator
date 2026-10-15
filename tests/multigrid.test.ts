// Quasi-periodic tilings (de Bruijn multigrids) and their Iznik dressing, ported from the thuluth lab's multigrid.js:
// the dressing must reproduce the lab's own renderings (tests/golden-thuluth-lab/tiling-*.png) exactly, the tilings
// must have their symmetry, and both must work in compositions for either script.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE, PALETTES } from '../src/model/style';
import { iznikField, multigrid } from '../src/ornament/patterns/multigrid';
import { tiles } from '../src/ornament/patterns/tilings';
import { renderPlaced } from '../src/render/composition';
import { comparePNG } from '../scripts/compare-lab.mjs';
import { toPNG } from '../scripts/raster.mjs';

const refs = join(import.meta.dirname, 'golden-thuluth-lab');

describe('multigrid tilings', () => {
  for (const N of [4, 5, 6])
    it(`${2 * N}-fold: rhombs of one edge, symmetric under a turn of π/${N}`, () => {
      const rh = multigrid(N, 30, 2);
      expect(rh.length).toBeGreaterThan(100);
      for (const t of rh)
        for (let i = 0; i < 4; i++) {
          const [a, b] = [t.q[i], t.q[(i + 1) % 4]];
          expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeCloseTo(2, 9);
        }
      // the set of rhomb centres maps onto itself (within the reach, away from its edge)
      const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
      const centres = rh.map(t => [t.q.reduce((s, p) => s + p[0], 0) / 4, t.q.reduce((s, p) => s + p[1], 0) / 4]);
      const set = new Set(centres.map(([x, y]) => key(x, y))),
        c = Math.cos(Math.PI / N),
        s = Math.sin(Math.PI / N);
      for (const [x, y] of centres.filter(([x, y]) => Math.hypot(x, y) < 25))
        expect(set.has(key(x * c - y * s, x * s + y * c))).toBe(true);
    });
  it('serves star patterns as a tiling, translated to the centre', () => {
    const p = tiles('mg10', 2, 50, 40, 20);
    expect(p.length).toBeGreaterThan(50);
    expect(p.every(q => q.length === 4)).toBe(true);
    const near = p.filter(q => q.some(([x, y]) => Math.hypot(x - 50, y - 40) < 1.5));
    expect(near.length).toBeGreaterThan(0);
  });
});

describe('the Iznik dressing', () => {
  for (const fold of [8, 10, 12])
    it(`reproduces the lab's ${fold}-fold tiling exactly`, () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${iznikField(800, { fold, density: 3 })}</svg>`; // prettier-ignore
      expect(comparePNG(readFileSync(join(refs, `tiling-${fold}fold.png`)), toPNG(svg, 600)).ratio).toBe(0);
    });
});

describe('in compositions', () => {
  const comp = (fill: Composition['root']['child']['fill'], extra: Partial<Composition['root']> = {}): Composition => ({
    version: 1,
    seed: 1,
    canvas: { shape: 'square', margin: 3 },
    style: { ...structuredClone(DEFAULT_STYLE), palette: { ...PALETTES.cobalt } } as Style,
    texts: { m: { text: 'محمد علي', repeat: 'fill', wordGap: 2 } },
    root: {
      type: 'frame',
      ...extra,
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: 'm', separator: { kind: 'braid', width: 2 } }],
        fill,
      },
    },
  });
  it('draws star patterns on the quasi-periodic tilings', () => {
    for (const tiling of ['mg8', 'mg10', 'mg12'] as const) {
      const c = comp({ type: 'pattern', pattern: { tiling, angle: 60, scale: 5 } });
      expect(isValidComposition(c)).toBe(true);
      const svg = renderPlaced(resolve(c), { idPrefix: tiling });
      expect(svg).toMatch(/<path id="mg\d+-pat\d+" d="M/);
    }
  });
  it('lays Iznik tilework as a fill, a band ground and the corners, deterministically', () => {
    const c = comp(
      { type: 'iznik', iznik: { fold: 10, scale: 4, seams: true } },
      {
        spandrels: { type: 'iznik', iznik: { fold: 8, scale: 4 } },
      },
    );
    (c.root.child as { borders: { ground?: unknown }[] }).borders[0].ground = { kind: 'iznik', iznik: { fold: 12, scale: 3 } }; // prettier-ignore
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c);
    expect(p.meta.warnings).toEqual([]);
    expect(p.meta.fill).toMatchObject({ type: 'iznik', ok: true });
    expect(p.items.filter(i => i.type === 'tilework')).toHaveLength(3);
    const svg = renderPlaced(p, { idPrefix: 'z' });
    expect(svg).toContain(PALETTES.cobalt.ink2);
    expect(renderPlaced(resolve(c), { idPrefix: 'z' })).toBe(svg);
  });
  it('rejects an unknown symmetry', () => {
    expect(isValidComposition(comp({ type: 'iznik', iznik: { fold: 9 as 8, scale: 4 } }))).toBe(false);
  });
});
