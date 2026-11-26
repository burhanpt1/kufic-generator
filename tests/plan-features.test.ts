// What a plan needs of a text border and its room (from the "Houses of rest" showpiece): the side the text starts
// on, a mark between repeats, openings for doors, text up to an inside corner, a ground under a nested region, and
// text along a straight wall.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { inscribe, inscriptions } from '../src/compose/inscription';
import type { Placed } from '../src/compose/placed';
import { placeMap } from '../src/compose/textBorder';
import { inside } from '../src/geometry/poly';
import type { Pt } from '../src/geometry/types';
import { loadSealWasm } from '../src/kernels/seal';
import type { Composition, FillerNode, TextBorder } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { SheetLayout } from '../src/render/sheet';

await loadSealWasm();

/** Cells per unit of the plan below. */
const K = 0.4;
/** An L-shaped room, in its own units (y down): the inside corner is at (330, 150). */
const L: Pt[] = [
  [0, 150],
  [330, 150],
  [330, 0],
  [760, 0],
  [760, 520],
  [0, 520],
];
const VERSE = 'بسم الله الرحمن الرحيم';
const room = (border: Partial<TextBorder> = {}, fill?: FillerNode, outline?: Composition['root']['child']['outline']) =>
  ({
    version: 1,
    seed: 3,
    canvas: { shape: 'square', margin: 0 },
    style: structuredClone(DEFAULT_STYLE),
    texts: {
      t: { text: VERSE, repeat: 'fill', wordGap: 2 },
      w: { text: 'نور', repeat: 'fill', wordGap: 2 },
      m: { text: 'لا اله الا الله', repeat: 'fill', wordGap: 2 },
    },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: outline ?? { kind: 'poly', points: L },
        // the outline's half-diagonal in cells, so a cell is 1 / K units
        size: outline ? 70 : (Math.hypot(760, 520) / 2) * K,
        borders: [{ type: 'textBorder', text: 't', scale: 0.8, ...border }],
        features: { tips: 'none' },
        ...(fill ? { fill } : {}),
      },
    },
  }) as Composition;
/** A point of the plan in the composition's cells (about the outline's centre). */
const cells = ([x, y]: Pt): Pt => [(x - 380) * K, (y - 260) * K];
type StripItem = Extract<Placed['items'][number], { type: 'strip' }>;
const strips = (p: Placed) => p.items.filter((i): i is StripItem => i.type === 'strip');
const ring0 = (p: Placed) => p.meta.borders[0].rings[0];
/** Where a strip's first letter (its right-hand end) lies. */
const startOf = (s: StripItem) => placeMap(s.place)(s.strip.W, s.strip.Hb / 2);

describe('a text border in a plan', () => {
  it('is unchanged when none of this is asked for', () => {
    const p = resolve(room());
    expect(p.meta.warnings).toEqual([]);
    expect(ring0(p).openings).toBeUndefined();
    expect(isValidComposition(room({ start: 'top', repeatMark: 'star', insideCorners: 'meet' }))).toBe(true);
    expect(isValidComposition(room({ openings: [{ at: [0, 0], width: 0 }] }))).toBe(false);
  });
  it('starts its text on the side asked for', () => {
    const first = (start?: TextBorder['start']) => {
      const p = resolve(room(start ? { start } : {}));
      expect(p.meta.warnings).toEqual([]);
      // the first group's strip: the run the reading starts on
      return startOf(strips(p)[0]);
    };
    const bottom = first(),
      top = first('top'),
      left = first('left'),
      right = first('right');
    expect(bottom[1]).toBeGreaterThan(80);
    expect(top[1]).toBeLessThan(-80);
    expect(left[0]).toBeLessThan(-130);
    expect(right[0]).toBeGreaterThan(130);
  });
  it('starts round a circle where asked, too', () => {
    const at = (start?: TextBorder['start']) => {
      const p = resolve(room({ seam: 4, scale: 1, ...(start ? { start } : {}) }, undefined, { kind: 'circle' }));
      expect(p.meta.warnings).toEqual([]);
      return startOf(strips(p)[0]);
    };
    // with a seam the text starts just past the bottom (or top) of the circle
    expect(at()[1]).toBeGreaterThan(50);
    expect(at('top')[1]).toBeLessThan(-50);
    expect(at('left')[0]).toBeLessThan(-50);
  });
  it('marks where one repeat ends and the next begins, with room for the mark', () => {
    const plain = resolve(room()),
      marked = resolve(room({ repeatMark: 'diamond' })),
      diamonds = (p: Placed) => p.items.filter(i => i.type === 'diamond').length,
      r = ring0(marked);
    expect(marked.meta.warnings).toEqual([]);
    // every repeat that ends inside a side gets one: all but those that end at a corner
    const added = diamonds(marked) - diamonds(plain);
    expect(added).toBeGreaterThan(0);
    expect(added).toBeLessThanOrEqual(r.rep);
    expect(resolve(room({ repeatMark: 'star' })).items.filter(i => i.type === 'star').length).toBe(added);
  });
  it('breaks its text round an opening, at a word', () => {
    // a door in the right-hand wall and one in the bottom wall, given in the plan's own units
    const doors = [
        { at: [760, 380] as [number, number], width: 12 },
        { at: [200, 520] as [number, number], width: 16 },
      ],
      shut = resolve(room()),
      open = resolve(room({ openings: doors })),
      r = ring0(open);
    expect(open.meta.warnings).toEqual([]);
    expect(r.mode).toBe('words');
    // each opening splits its side in two
    expect(r.groupSizes.length).toBe(ring0(shut).groupSizes.length + 2);
    expect(r.openings).toHaveLength(2);
    r.openings!.forEach((quad, i) => {
      const c = cells(doors[i].at),
        mid: Pt = [(quad[0][0] + quad[1][0]) / 2, (quad[0][1] + quad[1][1]) / 2];
      // the gap is where the door is (the band lies a little inside the outline), and as wide as asked
      expect(Math.hypot(mid[0] - c[0], mid[1] - c[1])).toBeLessThan(6);
      expect(Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1])).toBeCloseTo(doors[i].width, 6);
      // no letter stands in it
      for (const s of strips(open)) {
        const at = placeMap(s.place);
        for (let x = 0; x <= s.strip.W; x++) expect(inside(quad, ...at(x, s.strip.Hb / 2))).toBe(false);
      }
    });
  });
  it('runs its text up to an inside corner when told to', () => {
    const clear = resolve(room()),
      meet = resolve(room({ insideCorners: 'meet' })),
      corner = cells([330, 150]),
      // how near the letters come to the inside corner
      near = (p: Placed) =>
        Math.min(
          ...strips(p).flatMap(s => {
            const at = placeMap(s.place);
            return [0, s.strip.W].map(x => {
              const q = at(x, 0);
              return Math.hypot(q[0] - corner[0], q[1] - corner[1]);
            });
          }),
        );
    expect(meet.meta.warnings).toEqual([]);
    expect(near(meet)).toBeLessThan(near(clear) - 4);
    // the room for letters grows by what the two sides no longer give up
    const cap = (p: Placed) => ring0(p).strips.reduce((a, b) => a + b, 0);
    expect(cap(meet)).toBeGreaterThan(cap(clear) + 10);
  });
});

describe('a ground under a nested region', () => {
  const medallion = (ground?: FillerNode, share?: number): FillerNode =>
    ({
      type: 'region',
      ...(ground ? { ground } : {}),
      ...(share ? { share } : {}),
      node: {
        type: 'region',
        outline: { kind: 'star', points: 8, depth: 0.78 },
        borders: [{ type: 'ornamentBorder', ornament: 'braid', width: 2 }],
        fill: { type: 'monogram', text: 'm', method: 'seal', params: {} },
      },
    }) as FillerNode;
  const nested = (p: Placed) => p.items.filter(i => i.type === 'outline')[1] as { outer: Pt[] };
  it('takes a share of the space', () => {
    const whole = resolve(room({}, medallion())),
      half = resolve(room({}, medallion(undefined, 0.5))),
      reach = (p: Placed) => Math.max(...nested(p).outer.map(q => q[0])) - Math.min(...nested(p).outer.map(q => q[0]));
    expect(reach(half)).toBeCloseTo(reach(whole) / 2, 1);
  });
  it('writes a star field round the medallion and leaves out the words under it', () => {
    const c = room(
      {},
      medallion({ type: 'pattern', pattern: { tiling: '488', angle: 67, scale: 12 }, text: 'w' }, 0.55),
    );
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c),
      star = nested(p).outer,
      border = strips(p).filter(s => s.ring === 1).length,
      field = strips(p).filter(s => s.place.type === 'line' && s.ring !== 1);
    expect(p.meta.warnings).toEqual([]);
    expect(p.meta.fill).toMatchObject({ type: 'region', ok: true });
    expect(border).toBeGreaterThan(0);
    expect(field.length).toBeGreaterThan(50);
    for (const s of field) {
      const at = placeMap(s.place);
      for (const k of [0, 0.5, 1]) expect(inside(star, ...at(s.strip.W * k, s.strip.Hb / 2))).toBe(false);
    }
    // the field is laid before the medallion, so the medallion lies over it
    expect(p.items.indexOf(field[0])).toBeLessThan(p.items.findIndex(i => i === (nested(p) as unknown)));
  });
  it('cuts a tiled or drawn ground away under the medallion', () => {
    const p = resolve(room({}, medallion({ type: 'iznik', iznik: { fold: 8, scale: 6 } }, 0.5))),
      tiles = p.items.find(i => i.type === 'tilework') as { area: Pt[][] };
    expect(tiles.area).toHaveLength(2);
    expect(tiles.area[1]).toEqual(nested(p).outer);
    const slotless = room(
      {},
      medallion({ type: 'pattern', pattern: { tiling: 'hex', angle: 60, scale: 4 }, text: 'no' }),
    );
    expect(isValidComposition(slotless)).toBe(false);
  });
});

describe('text along a segment', () => {
  const style = structuredClone(DEFAULT_STYLE);
  it('fills the length with whole repeats, sized to the depth given', () => {
    const got = inscribe({ text: VERSE, from: [0, 0], to: [200, 0], depth: 10 }, style, 0)!;
    expect(got).not.toBeNull();
    expect(got.rep).toBeGreaterThan(1);
    expect(got.depth).toBeCloseTo(10, 6);
    const s = got.items[0] as StripItem,
      at = placeMap(s.place);
    // centred on the segment, inside its length, upright (the letters rise up the page)
    expect(at(0, s.strip.Hb / 2)[0]).toBeGreaterThanOrEqual(0);
    expect(at(s.strip.W, s.strip.Hb / 2)[0]).toBeLessThanOrEqual(200);
    expect(at(0, 0)[1]).toBeGreaterThan(0);
    expect(at(0, s.strip.Hb)[1]).toBeLessThan(at(0, 0)[1]);
    expect(inscribe({ text: VERSE, from: [0, 0], to: [200, 0], depth: 10, repeat: 'once' }, style, 0)!.rep).toBe(1);
  });
  it('runs up a wall, and says when a text is too long for its segment', () => {
    const up = inscribe({ text: 'نور', from: [0, 60], to: [0, 0], scale: 1, align: 'base' }, style, 0)!,
      at = placeMap((up.items[0] as StripItem).place);
    // going up the page, the letters rise to the left
    expect(at(0, 5)[0]).toBeLessThan(at(0, 0)[0]);
    expect(at(0, 0)[0]).toBeCloseTo(0, 6);
    expect(inscribe({ text: VERSE, from: [0, 0], to: [20, 0], scale: 1 }, style, 0)).toBeNull();
    const pl = inscriptions(
      [
        { text: VERSE, from: [0, 0], to: [200, 0], depth: 10 },
        { text: VERSE, from: [0, 0], to: [20, 0], scale: 1 },
      ],
      style,
    );
    expect(pl.meta.warnings).toEqual(["inscription 2 doesn't fit its segment"]);
    expect(pl.items).toHaveLength(1);
  });
  it("is written onto a sheet in the sheet's units", () => {
    const sh = new SheetLayout(),
      w = sh.write([{ text: 'نور', from: [0, 100], to: [300, 100], depth: 30 }], style, { id: 'w', unit: 2.5 });
    expect(w).toEqual([]);
    expect(sh.parts).toHaveLength(1);
    expect(sh.parts[0]).toMatch(/^<g transform="translate\([-\d. ]+\) scale\(0\.25\)">/);
  });
});
