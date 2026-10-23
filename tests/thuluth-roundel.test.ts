// Thuluth roundels and cartouches (src/script/thuluth/roundel, ported from the lab's roundel.js, bowl.js,
// counters.js and marks2.js). The lab's wedding cartouche, rebuilt from its recipe, must match the lab's own rendering
// (tests/golden-thuluth-lab/cartouche-zainab-qusay.png) up to the rasteriser's small differences at edges.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE, PALETTES } from '../src/model/style';
import { renderPlaced } from '../src/render/composition';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import type { RoundelSpec } from '../src/script/thuluth/roundel';
import { buildRoundel, findCounters, renderRoundel, roundelArt } from '../src/script/thuluth/roundel';
import { comparePNG } from '../scripts/compare-lab.mjs';
import { toPNG } from '../scripts/raster.mjs';

const lab = join(import.meta.dirname, '../prototypes/thuluth-lab'),
  rc = JSON.parse(readFileSync(join(lab, 'layouts/zainab-qusay.json'), 'utf8'));
const fixed = structuredClone(rc.layout);
fixed.wp[0].y += 1.4; // as the lab's reference renders it
const great = { ya: true, yaWide: 2.6, yaDeep: 1.3 };
const SPEC: RoundelSpec = {
  text: rc.text,
  compose: { elongate: true, cross: true, fillTarget: 0.5, noRise: true, cradle: true, oval: 1.45, emph: 'ب', kern: true, tries: 1, fixed }, // prettier-ignore
  tweaks: [{ at: 'و', scale: 0.62, tint: '#2aa6a0', under: { group: 1, gap: 0.7 } }],
  bowl: { oval: 1.45, clear: 5.6, autoOval: true },
  // the marks as the lab drew them when it rendered the reference, before the rules from the Arabic sources
  frame: { markReach: 2.2, ornaments: true, density: 0.6, fathaRule: false, allSigns: false, ornPen: 0.42 },
};
const PAINT = { U: 12, field: '#1f3f8f', gold: '#f4f6f7', goldDark: '#16306e', outline: '#16306e', bg: '#f4f6f7', discScale: 1.0, noOutline: true, counters: '#2aa6a0' }; // prettier-ignore

const th = thuluth({ ...ROUNDEL_PEN, great });
const built = buildRoundel(th, SPEC)!;
const svg = renderRoundel(th, built.r, built.f, PAINT);

describe('thuluth roundels', () => {
  it('rebuilds the lab cartouche from its recipe', () => {
    const ref = readFileSync(join(import.meta.dirname, 'golden-thuluth-lab/cartouche-zainab-qusay.png'));
    const { ratio } = comparePNG(ref, toPNG(svg, 800));
    expect(ratio).toBeLessThan(0.025);
  });
  it('is deterministic', () => {
    const again = buildRoundel(th, SPEC)!;
    expect(renderRoundel(th, again.r, again.f, PAINT).replace(/r\d+/g, '')).toBe(svg.replace(/r\d+/g, ''));
  });
  it('places every dot and vowel, and keeps all the ink inside the frame', () => {
    const { f, r } = built;
    expect(f.missing).toBe(0);
    // zay 1, ya 2, nun 1, ba 1; qaf 2, ya 2
    expect(f.solved!.dots).toHaveLength(9);
    // fatha, sukun, fatha on Zainab; fatha on the waw; damma, fatha, shadda on Qusay
    expect(f.solved!.count).toBeGreaterThanOrEqual(7);
    const art = roundelArt(th, r, f, { discScale: 1 });
    for (const u of art.units)
      for (const q of u.polys)
        for (const [x, y] of q) expect(Math.hypot((x - art.cx) / art.oval, y - art.cy)).toBeLessThan(art.Rf);
  });
  it('finds the counters inside letters, and not the space under the great bowl', () => {
    const art = roundelArt(th, built.r, built.f, { discScale: 1, counters: '#000000' });
    expect(art.counters.length).toBeGreaterThanOrEqual(1);
    const open = findCounters(th, [{ ang: 69, s: [{ x: 0, y: 0, w: 1 }, { x: 5, y: 0, w: 1 }] }]); // prettier-ignore
    expect(open).toEqual([]);
  });
});

describe('the roundel filler', () => {
  const comp = (): Composition => ({
    version: 1,
    seed: 3,
    canvas: { shape: 'square', margin: 3 },
    style: { ...structuredClone(DEFAULT_STYLE), palette: { ...PALETTES.cobalt } } as Style,
    texts: {
      ring: { text: 'محمد علي فاطمة الحسن الحسين', repeat: 'fill', wordGap: 2 },
      names: { text: rc.text, repeat: 'once', wordGap: 2 },
    },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: 'ring', separator: { kind: 'braid', width: 2 } }],
        fill: {
          type: 'roundel',
          text: 'names',
          colours: { field: '#1f3f8f', letters: '#f4f6f7', line: '#16306e', counters: '#2aa6a0' },
          recipe: {
            ...SPEC.compose,
            fixed,
            great,
            tweaks: SPEC.tweaks,
            bowl: { clear: 5.6, autoOval: true },
            markReach: 2.2,
            ornaments: true,
            density: 0.6,
          } as never,
        },
      },
    },
  });
  it('validates, fits inside a Kufic ring, and renders', () => {
    const c = comp();
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c);
    expect(p.meta.warnings).toEqual([]);
    expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: true });
    const it = p.items.find(i => i.type === 'roundel')!;
    expect(it).toBeDefined();
    const out = renderPlaced(p, { idPrefix: 'r' });
    expect(out).toContain('fill="#2aa6a0"');
    expect(renderPlaced(resolve(comp()), { idPrefix: 'r' })).toBe(out);
  });
  it('rejects a bad recipe', () => {
    const c = comp();
    (c.root.child.fill as { recipe: { oval: number } }).recipe.oval = 9;
    expect(isValidComposition(c)).toBe(false);
  });
});
