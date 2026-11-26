// The sheet layer (src/render/sheet): parts set into one drawing by box or by size per cell, and the field's lines
// under them left out. The shared pen (src/compose/pen): one letter scale for the text borders of several
// compositions.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { solvePen } from '../src/compose/pen';
import type { Pt } from '../src/geometry/types';
import type { Composition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { aSeries, bbox, drawnPts, outlineOf, SheetLayout } from '../src/render/sheet';
import { U } from '../src/render/svg';

const rect = (w: number, h: number): Pt[] => [
  [0, 0],
  [w, 0],
  [w, h],
  [0, h],
];
/** Sheet units per cell. */
const UNIT = 2.5;
/** A room of a plan: an outline in sheet units, its border text repeating round it. */
const room = (P: Pt[], text: string, scale?: number): Composition => {
  const b = bbox(P);
  return {
    version: 1,
    seed: 3,
    canvas: { shape: 'square', margin: 0 },
    style: structuredClone(DEFAULT_STYLE),
    texts: { t: { text, repeat: 'fill', wordGap: 2 } },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'poly', points: P },
        size: Math.hypot(b.w, b.h) / 2 / UNIT,
        borders: [{ type: 'textBorder', text: 't', ...(scale ? { scale } : {}) }],
        features: { tips: 'none' },
      },
    },
  };
};
const ROOMS = [
  room(rect(420, 400), 'بسم الله الرحمن الرحيم'),
  room(rect(300, 400), 'لا اله الا الله'),
  // an L with its inside corner cut
  room(
    [
      [0, 120],
      [260, 120],
      [300, 80],
      [300, 0],
      [700, 0],
      [700, 480],
      [0, 480],
    ],
    'يا علي مدد',
  ),
];

describe('a sheet', () => {
  it('fits a part into a box, centred, and records what it covers', () => {
    const sh = new SheetLayout(),
      s = sh.nest('<g/>', { x: 10, y: 20, w: 100, h: 50 }, { x: 0, y: 0, w: 400, h: 400 }, rect(100, 50));
    expect(s.k).toBe(4);
    expect(s.box).toEqual({ x: 0, y: 100, w: 400, h: 200 });
    expect(s.map([10, 20])).toEqual([0, 100]);
    expect(sh.covers).toHaveLength(1);
    expect(sh.parts).toHaveLength(0);
  });
  it('sets parts at one size per cell, whatever their outlines', () => {
    const sh = new SheetLayout();
    ROOMS.forEach((c, i) => {
      const pl = resolve(c),
        P = (c.root.child.outline as { points: Pt[] }).points,
        b = bbox(P),
        s = sh.place(pl, { id: `r${i}`, unit: UNIT, centre: [b.x + b.w / 2, b.y + b.h / 2] });
      expect(s.k).toBeCloseTo(UNIT / U, 9);
      // the room lands on its own outline: a cell is the same size in every room
      expect(s.box.w).toBeCloseTo(b.w, 6);
      expect(s.box.h).toBeCloseTo(b.h, 6);
    });
    expect(sh.parts).toHaveLength(3);
    expect(sh.covers).toHaveLength(3);
  });
  it('leaves out the lines of a field under what is set over it', () => {
    const field: Composition = {
      ...room(rect(400, 400), 'نور'),
      texts: { t: { text: 'نور', repeat: 'fill', wordGap: 2 }, w: { text: 'نور', repeat: 'fill', wordGap: 2 } },
    };
    field.root.child.fill = { type: 'pattern', pattern: { tiling: 'square', angle: 45, scale: 12 }, text: 'w' };
    const pl = resolve(field),
      lines = (p: typeof pl) => p.items.filter(i => i.type === 'strip' && i.place.type === 'line').length,
      sh = new SheetLayout(),
      c = bbox(drawnPts(pl, outlineOf(pl).inner!)),
      over = resolve(room(rect(100, 100), 'نور'));
    expect(sh.uncovered(pl)).toEqual(pl);
    sh.place(over, { id: 'o', slot: { x: c.x + c.w * 0.25, y: c.y + c.h * 0.25, w: c.w * 0.5, h: c.h * 0.5 } });
    const shown = sh.uncovered(pl);
    expect(lines(shown)).toBeLessThan(lines(pl));
    expect(lines(shown)).toBeGreaterThan(0);
    // nothing but lines is dropped
    expect(shown.items.filter(i => i.type !== 'strip')).toEqual(pl.items.filter(i => i.type !== 'strip'));
  });
  it('crops to an A-series sheet', () => {
    const v = aSeries({ x: 0, y: 0, w: 100, h: 120 }, 0.05);
    expect(v.h / v.w).toBeCloseTo(Math.SQRT2, 12);
    expect(v.x).toBeCloseTo(-5, 12);
    expect(v.y + v.h / 2).toBeCloseTo(60, 12);
  });
});

describe('one pen for several compositions', () => {
  const rings = (c: Composition) => resolve(c).meta.borders.flatMap(b => b.rings);
  it('records how much of each side of a ring is left to stretching', () => {
    for (const c of ROOMS)
      for (const r of rings(c)) {
        expect(r.runSlack).toHaveLength(r.groupSizes.length);
        expect(r.runSlack.every(s => s >= 0 && s < 1)).toBe(true);
      }
  });
  it('finds the scale every border can share, and sets it', () => {
    const auto = ROOMS.flatMap(rings).map(r => r.scale);
    expect(new Set(auto).size).toBeGreaterThan(1); // each on its own comes out at its own size
    const fit = solvePen(ROOMS)!;
    expect(fit).not.toBeNull();
    for (const c of fit.compositions) {
      const pl = resolve(c);
      expect(pl.meta.warnings).toEqual([]);
      expect(pl.meta.borders.flatMap(b => b.rings).map(r => r.scale)).toEqual([fit.scale]);
    }
    expect(fit.rings).toHaveLength(3);
    // no side is drawn out by more than a fifth, and the pen is the best of those tried
    expect(Math.max(...fit.rings.flatMap(r => r.runSlack))).toBeLessThan(0.2);
    const scores = fit.tried.filter(t => t.score != null).map(t => t.score!);
    expect(fit.score).toBeLessThanOrEqual(Math.min(...scores) + 0.01 + 1e-12);
    // the compositions given are not changed
    expect(ROOMS.every(c => c.root.child.borders.every(b => b.type !== 'textBorder' || b.scale === undefined))).toBe(
      true,
    );
  });
  it('leaves alone a scale set by hand, and the borders it is told to skip', () => {
    const byHand = [ROOMS[0], room(rect(300, 400), 'لا اله الا الله', 0.6)],
      a = solvePen(byHand)!;
    expect(rings(a.compositions[1])[0].scale).toBe(0.6);
    expect(a.rings.every(r => r.comp === 0)).toBe(true);
    const b = solvePen(ROOMS, { takes: (_, comp) => comp !== 2 })!;
    expect(b.compositions[2]).toBe(ROOMS[2]);
    expect(b.rings.map(r => r.comp)).toEqual([0, 1]);
    expect(solvePen([byHand[1]])).toBeNull();
  });
  it('says what stops a larger pen', () => {
    // a long text round a small room: it only goes round at a small scale
    const tight = room(rect(170, 140), 'بسم الله الرحمن الرحيم لا اله الا الله محمد رسول الله'),
      fit = solvePen([ROOMS[0], tight])!;
    expect(fit.tried[0].score).toBeNull();
    expect(fit.limit).toMatchObject({ comp: 1 });
    expect(fit.limit!.scale).toBeGreaterThan(fit.scale);
    expect(fit.limit!.warning).toContain("doesn't fit");
  });
});
