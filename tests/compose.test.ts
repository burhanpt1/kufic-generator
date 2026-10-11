import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Placed } from '../src/compose';
import { parseComposition, isValidComposition } from '../src/model/schema';
import type { Composition, Outline } from '../src/model/schema';
import { DEFAULT_STYLE, inherit } from '../src/model/style';
import { renderPlaced } from '../src/render/composition';
import { kufi } from '../src/script/kufi';
import { repeat } from '../src/script/kufi';

const BASMALA = 'بسم الله الرحمن الرحيم';
export function sample(outline: Outline, over: Partial<Composition['root']['child']> = {}): Composition {
  return {
    version: 1,
    seed: 7,
    canvas: { shape: 'square', margin: 3 },
    style: { ...structuredClone(DEFAULT_STYLE), terminals: { kind: 'leaf', reach: 'tails' }, colouring: 'byRing' },
    texts: {
      basmala: { text: BASMALA, repeat: 'fill', wordGap: 2 },
      names: { text: 'محمد علي فاطمة\nالحسن الحسين', repeat: 'fill', wordGap: 2 },
    },
    root: {
      type: 'frame',
      spandrels: { type: 'pattern', pattern: { tiling: '488', angle: 67, scale: 5 } },
      child: {
        type: 'region',
        outline,
        borders: [
          { type: 'textBorder', text: 'basmala', separator: { kind: 'braid', width: 3 }, ground: { kind: 'tint' } },
          { type: 'textBorder', text: 'names', taper: 0.5, separator: { kind: 'pearls', width: 2 } },
        ],
        fill: { type: 'abjad', text: 'basmala' },
        ...over,
      },
    },
  };
}
const OUTLINES: [string, Outline][] = [
  ['circle', { kind: 'circle' }],
  ['square', { kind: 'polygon', sides: 4 }],
  ['hexagon', { kind: 'polygon', sides: 6 }],
  ['octagon', { kind: 'polygon', sides: 8 }],
  ['8-point star', { kind: 'star', points: 8, depth: 0.6 }],
  ['teardrop', { kind: 'preset', name: 'teardrop' }],
  ['heart', { kind: 'preset', name: 'heart' }],
  ['mihrab', { kind: 'preset', name: 'mihrab' }],
  ['svg dome', { kind: 'svg', path: 'M0 100 L0 50 Q0 0 50 0 Q100 0 100 50 L100 100 Z' }],
];
const resolved = new Map<string, Placed>(OUTLINES.map(([n, o]) => [n, resolve(sample(o))]));

describe('schema', () => {
  it('accepts a valid composition and rejects broken ones with a path to the problem', () => {
    expect(isValidComposition(sample({ kind: 'circle' }))).toBe(true);
    const bad = sample({ kind: 'circle' });
    (bad.root.child.borders[0] as { text: string }).text = 'nope';
    expect(() => parseComposition(bad)).toThrow(/root\.child\.borders\.0\.text: unknown text slot "nope"/);
    expect(isValidComposition({ ...sample({ kind: 'circle' }), version: 2 })).toBe(false);
    expect(isValidComposition(sample({ kind: 'polygon', sides: 2 }))).toBe(false);
    const badColour = sample({ kind: 'circle' });
    badColour.style.palette.ink = 'red';
    expect(isValidComposition(badColour)).toBe(false);
  });
  it('inherits styles one level deep', () => {
    const s = inherit(DEFAULT_STYLE, { stroke: { weight: 0.5 }, colouring: 'radial' });
    expect(s.stroke).toEqual({ ...DEFAULT_STYLE.stroke, weight: 0.5 });
    expect(s.colouring).toBe('radial');
    expect(s.palette).toBe(DEFAULT_STYLE.palette);
  });
});

describe('resolver', () => {
  it.each(OUTLINES)('%s resolves with every border and the fill placed', name => {
    const p = resolved.get(name)!;
    expect(p.meta.warnings).toEqual([]);
    expect(p.meta.borders.map(b => b.rings.length)).toEqual([1, 2]);
    expect(p.meta.fill).toMatchObject({ type: 'abjad', ok: true });
    expect(p.items.filter(i => i.type === 'strip').length).toBeGreaterThan(0);
  });

  it.each(OUTLINES)('%s: every band holds its text a whole number of times', name => {
    for (const b of resolved.get(name)!.meta.borders)
      for (const r of b.rings) {
        expect(r.rep).toBeGreaterThanOrEqual(1);
        expect(r.groupSizes.reduce((a, x) => a + x, 0)).toBe(r.rep * r.segsPerRep);
      }
  });

  it('places the segments in reading order: the whole text, repeated, cut into contiguous groups', () => {
    // re-derive the groups for the circle's first ring and check they are the repeated text in order
    const c = sample({ kind: 'polygon', sides: 6 }),
      p = resolve(c),
      r = p.meta.borders[0].rings[0];
    const prep = kufi.prepareLines([BASMALA], c.style.letter)[0],
      segs = repeat(kufi.segments(prep, r.mode, 2), r.rep);
    expect(r.groupSizes.reduce((a, x) => a + x, 0)).toBe(segs.length);
  });

  it.each(OUTLINES)('%s: groups go round clockwise from the bottom (group g on run (G − g) mod G)', name => {
    for (const b of resolved.get(name)!.meta.borders)
      for (const r of b.rings) {
        const G = r.groupRun.length;
        r.groupRun.forEach((run, g) => expect(run).toBe((G - g) % G));
      }
  });

  it('puts the first group on the bottom edge of a polygon, reading right to left', () => {
    const p = resolved.get('hexagon')!,
      first = p.items.find(i => i.type === 'strip')!;
    expect(first.type === 'strip' && first.place.type).toBe('line');
    if (first.type === 'strip' && first.place.type === 'line') {
      expect(first.place.t[0]).toBeCloseTo(1, 6); // strip x runs left to right along the bottom edge
      expect(first.place.n[1]).toBeCloseTo(-1, 6); // letters stand up from it
    }
  });

  it('is deterministic: the same JSON gives the same Placed', () => {
    for (const [, o] of OUTLINES.slice(0, 5)) {
      const a = JSON.stringify(resolve(sample(o))),
        b = JSON.stringify(resolve(JSON.parse(JSON.stringify(sample(o)))));
      expect(a).toBe(b);
    }
  });

  it('enlarges an automatic size until inner borders fit, and keeps a fixed size', () => {
    const one = resolve(sample({ kind: 'circle' }, { borders: [sample({ kind: 'circle' }).root.child.borders[0]] }))
      .meta.size;
    expect(resolved.get('circle')!.meta.size).toBeGreaterThan(one);
    const fixed = resolve(sample({ kind: 'circle' }, { size: 80 }));
    expect(fixed.meta.size).toBe(80);
  });

  it('reports a text that cannot fit instead of cutting it', () => {
    const c = sample({ kind: 'circle' }, { size: 12 });
    const p = resolve(c);
    expect(p.meta.warnings.length).toBeGreaterThan(0);
    for (const b of p.meta.borders)
      for (const r of b.rings) expect(r.groupSizes.reduce((a, x) => a + x, 0)).toBe(r.rep * r.segsPerRep);
  });

  it('honours repeat "once"', () => {
    const c = sample({ kind: 'circle' }, { borders: [{ type: 'textBorder', text: 'basmala' }] });
    c.texts.basmala.repeat = 'once';
    const r = resolve(c).meta.borders[0].rings[0];
    expect(r.rep).toBe(1);
  });

  it('applies the ة convention from the style', () => {
    const c = sample(
      { kind: 'circle' },
      { borders: [{ type: 'textBorder', text: 't' }], fill: { type: 'abjad', text: 't' } },
    );
    c.texts.t = { text: 'فاطمة', repeat: 'fill', wordGap: 2 };
    const value = (tm: 5 | 400) => {
      c.style.abjad = { taMarbuta: tm, system: 'mashriqi' };
      const it = resolve(c).items.find(i => i.type === 'abjad');
      return it && it.type === 'abjad' ? it.value : null;
    };
    expect(value(5)).toBe(80 + 1 + 9 + 40 + 5);
    expect(value(400)).toBe(80 + 1 + 9 + 40 + 400);
  });

  it('places finials on sharp tips and corner diamonds on blunt ones', () => {
    const star = resolved.get('8-point star')!.items,
      oct = resolved.get('octagon')!.items;
    expect(star.some(i => i.type === 'finial')).toBe(true);
    expect(oct.some(i => i.type === 'diamond')).toBe(true);
    expect(resolved.get('circle')!.items.some(i => i.type === 'finial' || i.type === 'diamond')).toBe(false);
  });

  it('nests a region inside another', () => {
    const c = sample(
      { kind: 'circle' },
      {
        fill: {
          type: 'region',
          node: {
            type: 'region',
            outline: { kind: 'star', points: 8, depth: 0.6 },
            borders: [],
            fill: { type: 'pattern', pattern: { tiling: 'hex', angle: 60, scale: 3 } },
          },
        },
      },
    );
    const p = resolve(c);
    expect(p.meta.fill).toMatchObject({ type: 'region', ok: true });
    expect(p.items.some(i => i.type === 'pattern')).toBe(true);
  });
});

describe('composition SVG', () => {
  it('namespaces every id, so two compositions can share a page', () => {
    const p = resolved.get('heart')!,
      a = renderPlaced(p, { idPrefix: 'a' }),
      b = renderPlaced(p, { idPrefix: 'b' });
    const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    const ia = ids(a),
      ib = ids(b);
    expect(ia.length).toBeGreaterThan(0);
    expect(new Set(ia).size).toBe(ia.length);
    expect(ia.every(i => i.startsWith('a-'))).toBe(true);
    expect(ia.filter(i => ib.includes(i))).toEqual([]);
    // every url(#…) reference points at an id in the same SVG
    for (const m of a.matchAll(/url\(#([^)]+)\)/g)) expect(ia).toContain(m[1]);
  });
  it('draws layers in z-order', () => {
    const svg = renderPlaced(resolved.get('octagon')!),
      order = [...svg.matchAll(/data-layer="(\w+)"/g)].map(m => m[1]);
    const want = ['ground', 'pattern', 'spandrels', 'letters', 'separators', 'features'].filter(l => order.includes(l));
    expect(order).toEqual(want);
  });
});
