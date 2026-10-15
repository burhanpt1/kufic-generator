// Thuluth in compositions: style.script picks the engine per region, vector strips render through any placement,
// and the measures (critic, empty space, plotter) read their ink. Goldens in tests/golden-thuluth/
// (UPDATE_GOLDEN_THULUTH=1 rewrites them).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Placed, PlacedItem } from '../src/compose/placed';
import { metrics } from '../src/evolve/critic';
import { emptySpace } from '../src/evolve/space';
import { centrelines } from '../src/fabricate';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { PRESETS, TEXTS } from '../src/model/presets';
import { DEFAULT_STYLE, PALETTES } from '../src/model/style';
import { renderPlaced } from '../src/render/composition';
import { kufi } from '../src/script/kufi';
import { scriptFor, thuluthStyleOf } from '../src/script/registry';
import { parsePolys } from '../src/script/vector';
import { toPNG } from '../scripts/raster.mjs';

const TH: Partial<Style> = { script: 'thuluth', pen: { preset: 'band' } };
const slot = (text: string) => ({ text, repeat: 'fill' as const, wordGap: 2 });
const style = (o: Partial<Style> = {}): Style => ({ ...structuredClone(DEFAULT_STYLE), ...o }) as Style;
const strips = (p: Placed) => p.items.filter((i): i is Extract<PlacedItem, { type: 'strip' }> => i.type === 'strip');

/** The cases kept as goldens: borders on a circle and a polygon, a line fill, and a Kufic ring round thuluth. */
const CASES: Record<string, Composition> = {
  'circle-names': {
    version: 1,
    seed: 11,
    canvas: { shape: 'square', margin: 3 },
    style: style({ ...TH, palette: { ...PALETTES.cobalt }, colouring: 'byRing' }),
    texts: { names: slot(TEXTS.names) },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: 'names', separator: { kind: 'braid', width: 2 } }],
      },
    },
  },
  'octagon-shahada': (() => {
    const c = structuredClone(PRESETS.find(p => p.id === 'octagon-panel')!.comp);
    c.style = { ...c.style, ...TH } as Style;
    return c;
  })(),
  'mihrab-lines': (() => {
    const c = structuredClone(PRESETS.find(p => p.id === 'mihrab-ayat-al-kursi')!.comp);
    c.style = { ...c.style, ...TH } as Style;
    return c;
  })(),
  'kufic-ring-thuluth-centre': {
    version: 1,
    seed: 7,
    canvas: { shape: 'square', margin: 3 },
    style: style({ palette: { ...PALETTES.goldOnLapis } }),
    texts: { ring: slot('محمد علي فاطمة الحسن الحسين'), centre: slot('مودة ورحمة') },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: 'ring', separator: { kind: 'braid', width: 2 } }],
        fill: {
          type: 'region',
          node: {
            type: 'region',
            style: TH,
            outline: { kind: 'circle' },
            borders: [{ type: 'textBorder', text: 'centre', separator: { kind: 'pearls', width: 2 } }],
          },
        },
      },
    },
  },
};

describe('thuluth in compositions', () => {
  it('validates the script and the pen', () => {
    for (const c of Object.values(CASES)) expect(isValidComposition(c)).toBe(true);
    const bad = structuredClone(CASES['circle-names']);
    (bad.style as unknown as { pen: { preset: string } }).pen.preset = 'brush';
    expect(isValidComposition(bad)).toBe(false);
  });
  it('picks the engine from the style, one per pen', () => {
    expect(scriptFor(DEFAULT_STYLE)).toBe(kufi);
    expect(scriptFor(style(TH)).id).toBe('thuluth');
    expect(scriptFor(style(TH))).toBe(scriptFor(style(TH)));
    expect(thuluthStyleOf({ preset: 'roundel', nib: 2 }).nib).toBe(2);
    expect(thuluthStyleOf({ preset: 'roundel' }).floor).toBe(0.3);
  });
  it('writes each region in its own script: a Kufic ring round a thuluth centre', () => {
    const p = resolve(CASES['kufic-ring-thuluth-centre']),
      kinds = new Set(strips(p).map(s => s.strip.kind));
    expect(kinds).toEqual(new Set(['cells', 'vector']));
    expect(p.meta.warnings).toEqual([]);
  });
  it('fits every case without warnings, holds the whole text, and keeps ink in its band', () => {
    for (const [id, c] of Object.entries(CASES)) {
      const p = resolve(c);
      expect(p.meta.warnings, id).toEqual([]);
      for (const s of strips(p).filter(s => s.strip.kind === 'vector')) {
        const st = s.strip as Extract<typeof s.strip, { kind: 'vector' }>,
          pts = st.paths.flatMap(q => parsePolys(q.d)).flat();
        expect(Math.min(...pts.map(q => q[1])), id).toBeGreaterThanOrEqual(-0.01);
        expect(Math.max(...pts.map(q => q[1])), id).toBeLessThanOrEqual(st.Hb + 0.01);
        expect(Math.max(...pts.map(q => q[0])), id).toBeLessThanOrEqual(st.W + 0.01);
      }
    }
    // the names ring holds both lines, whole, a whole number of times
    const rings = resolve(CASES['circle-names']).meta.borders[0].rings;
    expect(rings).toHaveLength(2);
    for (const r of rings) expect(Number.isInteger(r.rep) && r.rep >= 1).toBe(true);
  });
  it('is measured by the critic, the empty-space measure and the plotter', () => {
    const p = resolve(CASES['circle-names']),
      m = metrics(p)!;
    expect(m.rhythm).toBeGreaterThan(0);
    expect(m.density).toBeGreaterThan(0);
    expect(emptySpace(p)).toBeGreaterThan(0);
    const lines = centrelines(p).filter(l => l.kind === 'letter');
    expect(lines.length).toBeGreaterThan(20);
  });
  it('renders deterministically, with the ids prefixed', () => {
    const c = CASES['octagon-shahada'],
      a = renderPlaced(resolve(c), { idPrefix: 'x' });
    expect(renderPlaced(resolve(c), { idPrefix: 'x' })).toBe(a);
    expect(a).toMatch(/^<svg /);
  });
  it('matches the goldens (byte-exact by hash; the PNGs are for looking at)', () => {
    const dir = join(import.meta.dirname, 'golden-thuluth'),
      update = !!process.env.UPDATE_GOLDEN_THULUTH,
      file = join(dir, 'manifest.json'),
      want: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {},
      got: Record<string, string> = {};
    for (const [id, c] of Object.entries(CASES)) {
      const svg = renderPlaced(resolve(c), { idPrefix: id });
      got[id] = createHash('sha256').update(svg).digest('hex');
      if (update) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${id}.png`), toPNG(svg, 600));
      }
    }
    if (update) writeFileSync(file, JSON.stringify(got, null, 2) + '\n');
    else expect(got, 'rendering changed: review, then UPDATE_GOLDEN_THULUTH=1').toEqual(want);
  });
});
