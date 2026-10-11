import { describe, expect, it } from 'vitest';
import {
  deepestPoint,
  detectCorners,
  flattenPath,
  frameAt,
  importSvgPath,
  inside,
  isSimple,
  makeRing,
  normaliseFree,
  shapeOf,
  signedArea,
  toPathData,
  unitRing,
} from '../src/geometry';
import type { Outline, Pt } from '../src/geometry';

// a D shape: two square corners, and a semicircle that meets the straight edges tangentially
const D_SVG = 'M0 0 H10 A5 5 0 0 1 10 10 H0 Z';
const OUTLINES: [string, Outline][] = [
  ['circle', { kind: 'circle' }],
  ['triangle', { kind: 'polygon', sides: 3 }],
  ['square', { kind: 'polygon', sides: 4 }],
  ['hexagon', { kind: 'polygon', sides: 6 }],
  ['octagon', { kind: 'polygon', sides: 8 }],
  ['12-gon', { kind: 'polygon', sides: 12 }],
  ['star 5', { kind: 'star', points: 5, depth: 0.5 }],
  ['star 8', { kind: 'star', points: 8, depth: 0.55 }],
  ['star 12', { kind: 'star', points: 12, depth: 0.7 }],
  ['teardrop', { kind: 'preset', name: 'teardrop' }],
  ['heart', { kind: 'preset', name: 'heart' }],
  ['mihrab', { kind: 'preset', name: 'mihrab' }],
  ['svg D', { kind: 'svg', path: D_SVG }],
  [
    'poly',
    {
      kind: 'poly',
      points: [
        [0, 0],
        [10, 0],
        [10, 6],
        [5, 9],
        [0, 6],
      ],
    },
  ],
];
const EXPECTED_CORNERS: Record<string, number> = {
  circle: 0,
  triangle: 3,
  square: 4,
  hexagon: 6,
  octagon: 8,
  '12-gon': 12,
  'star 5': 10,
  'star 8': 16,
  'star 12': 24,
  teardrop: 1,
  heart: 2,
  mihrab: 3,
  'svg D': 2,
  poly: 5,
};
const SIZE = 20,
  INSETS = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map(f => f * SIZE);

describe('unit outlines', () => {
  it.each(OUTLINES)('%s runs counter-clockwise on screen and starts at its bottom-most corner', (name, o) => {
    const r = unitRing(o);
    expect(signedArea(r.pts)).toBeLessThan(0);
    expect(r.corners.length).toBe(EXPECTED_CORNERS[name]);
    // the first point is the bottom-most corner (the bottom-most point when there are none)
    const ys = (r.corners.length ? r.corners.map(c => c.p) : r.pts).map(p => p[1]);
    expect(r.pts[0][1]).toBeCloseTo(Math.max(...ys), 9);
    if (r.corners.length) expect(r.corners[0].index).toBe(0);
  });
  it('normalises regular polygons and stars to edge distance 1', () => {
    for (const o of [
      { kind: 'polygon', sides: 5 },
      { kind: 'star', points: 8, depth: 0.55 },
    ] as Outline[]) {
      const P = unitRing(o).pts,
        [a, b] = [P[0], P[1]];
      const d = Math.abs(a[0] * (b[1] - a[1]) - a[1] * (b[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(d).toBeCloseTo(1, 9);
    }
  });
  it('gives polygons their bottom edge as the first run, left to right', () => {
    const runs = shapeOf({ kind: 'polygon', sides: 6 }).runs(1);
    const [a, b] = [runs[0].pts[0], runs[0].pts[runs[0].pts.length - 1]];
    expect(a[1]).toBeCloseTo(b[1], 9);
    expect(a[0]).toBeLessThan(b[0]);
    expect(a[1]).toBeCloseTo(1, 9);
  });
  it('normalises free shapes to a maximum radius of 1', () => {
    for (const name of ['teardrop', 'heart', 'mihrab'] as const) {
      const r = unitRing({ kind: 'preset', name });
      expect(Math.max(...r.pts.map(([x, y]) => Math.hypot(x, y)))).toBeCloseTo(1, 9);
    }
  });
});

describe('offsets', () => {
  it.each(OUTLINES)('%s: inward offsets never self-intersect, keep their corners and shrink', (name, o) => {
    const s = shapeOf(o);
    let lastArea = Infinity,
      lastRuns: number[] | null = null;
    for (const d of INSETS) {
      const r = s.ring(SIZE, d)!;
      expect(r, `ring at inset ${d}`).not.toBeNull();
      expect(isSimple(r.pts), `simple at inset ${d}`).toBe(true);
      expect(signedArea(r.pts)).toBeLessThan(0);
      expect(r.corners.length, `corners at inset ${d}`).toBe(EXPECTED_CORNERS[name]);
      expect(r.area).toBeLessThan(lastArea);
      lastArea = r.area;
      const runs = s.runs(SIZE, d).map(rn => rn.len);
      if (lastRuns) runs.forEach((l, i) => expect(l, `run ${i} at inset ${d}`).toBeLessThan(lastRuns![i] + 1e-9));
      lastRuns = runs;
      // every ring lies inside the outline
      if (d > 0) {
        const outer = s.ring(SIZE)!.pts;
        for (let i = 0; i < r.pts.length; i += 7) expect(inside(outer, r.pts[i][0], r.pts[i][1])).toBe(true);
      }
    }
  });
  it('offsets a polygon exactly: a square of side 40 inset by 5 has side 30', () => {
    const r = shapeOf({ kind: 'polygon', sides: 4 }).ring(20, 5)!;
    expect(r.area).toBeCloseTo(900, 3);
  });
  it('returns null once nothing is left', () => {
    expect(shapeOf({ kind: 'polygon', sides: 4 }).ring(10, 11)).toBeNull();
    expect(shapeOf({ kind: 'circle' }).ring(10, 10)).toBeNull();
  });
  it('keeps a usable ring at sharp tips where the prototype folded over', () => {
    const s = shapeOf({ kind: 'star', points: 12, depth: 0.45 });
    for (const d of [1, 2, 3]) expect(isSimple(s.ring(20, d)!.pts)).toBe(true);
  });
});

describe('corners and runs', () => {
  it('reports interior angle, convexity, inward bisector and clearance', () => {
    const r = makeRing(
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ].map(([x, y]) => [x, y] as Pt),
    );
    expect(r.corners).toHaveLength(4);
    for (const c of r.corners) {
      expect(c.convex).toBe(true);
      expect(c.interior).toBeCloseTo(Math.PI / 2, 6);
      expect(c.clearance).toBeCloseTo(1, 6);
      // the bisector points into the square
      expect(inside(r.pts, c.p[0] + c.bisector[0], c.p[1] + c.bisector[1])).toBe(true);
    }
    const star = unitRing({ kind: 'star', points: 6, depth: 0.5 });
    expect(star.corners.filter(c => !c.convex)).toHaveLength(6);
  });
  it('finds no corners on a smooth curve and one at a cusp', () => {
    expect(detectCorners(unitRing({ kind: 'circle' }).pts)).toHaveLength(0);
    expect(unitRing({ kind: 'preset', name: 'teardrop' }).corners).toHaveLength(1);
  });
  it('gives frames whose normal points inward and whose tangent follows the run', () => {
    const s = shapeOf({ kind: 'preset', name: 'heart' }),
      ring = s.ring(10)!;
    for (const rn of s.runs(10))
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const fr = frameAt(rn, rn.len * f);
        expect(Math.hypot(...fr.t)).toBeCloseTo(1, 9);
        expect(fr.t[0] * fr.n[0] + fr.t[1] * fr.n[1]).toBeCloseTo(0, 9);
        expect(inside(ring.pts, fr.p[0] + fr.n[0] * 0.3, fr.p[1] + fr.n[1] * 0.3)).toBe(true);
      }
  });
  it('splits a ring into runs that cover its whole perimeter', () => {
    for (const [, o] of OUTLINES) {
      const s = shapeOf(o),
        total = s.runs(10).reduce((a, rn) => a + rn.len, 0);
      expect(total).toBeCloseTo(s.ring(10)!.perimeter, 6);
    }
  });
});

describe('SVG path import', () => {
  it('parses lines, curves and arcs, absolute and relative', () => {
    const rect = flattenPath('M0 0 H10 V5 H0 Z')[0];
    expect(rect).toEqual([
      [0, 0],
      [10, 0],
      [10, 5],
      [0, 5],
    ]);
    const rel = flattenPath('m0 0 l10 0 l0 5 l-10 0 z')[0];
    expect(rel).toEqual(rect);
    const circle = importSvgPath('M-10 0 A10 10 0 1 0 10 0 A10 10 0 1 0 -10 0 Z');
    expect(Math.max(...circle.map(([x, y]) => Math.abs(Math.hypot(x, y) - 10)))).toBeLessThan(0.02);
    const curve = importSvgPath('M0 0 C 0 -10 20 -10 20 0 S 40 10 40 0 Q 20 30 0 0 Z');
    expect(curve.length).toBeGreaterThan(20);
  });
  it('accepts arc flags written without separators', () => {
    const a = importSvgPath('M0 0a5 5 0 10 10 0a5 5 0 10-10 0z'),
      b = importSvgPath('M0 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 z');
    expect(a).toEqual(b);
  });
  it('detects corners at tangent breaks only', () => {
    expect(normaliseFree(importSvgPath('M0 0 H10 V5 H0 Z')).corners).toHaveLength(4);
    expect(normaliseFree(importSvgPath('M-10 0 A10 10 0 1 0 10 0 A10 10 0 1 0 -10 0 Z')).corners).toHaveLength(0);
    expect(unitRing({ kind: 'svg', path: D_SVG }).corners).toHaveLength(2);
  });
  it('round-trips: export and re-import gives the same outline', () => {
    for (const [, o] of OUTLINES) {
      // free normalisation on both sides, since polygons are scaled differently (edge distance 1)
      const r = normaliseFree(unitRing(o).pts),
        back = normaliseFree(importSvgPath(toPathData(r.pts, 6)));
      expect(back.pts.length).toBe(r.pts.length);
      back.pts.forEach((p, i) => {
        expect(p[0]).toBeCloseTo(r.pts[i][0], 4);
        expect(p[1]).toBeCloseTo(r.pts[i][1], 4);
      });
      expect(back.corners.length).toBe(r.corners.length);
    }
  });
  it('rejects bad path data', () => {
    expect(() => importSvgPath('L 10 10')).toThrow();
    expect(() => importSvgPath('M0 0 C 1 2')).toThrow();
    expect(() => importSvgPath('M0 0 L10 10')).toThrow();
  });
});

describe('deepest point', () => {
  it('is the centre of a circle, at its radius', () => {
    const d = deepestPoint(shapeOf({ kind: 'circle' }).ring(10)!.pts);
    expect(Math.hypot(...d.p)).toBeLessThan(0.05);
    expect(d.r).toBeGreaterThan(9.9);
  });
  it('sits in the wide part of a teardrop, well inside it', () => {
    const ring = shapeOf({ kind: 'preset', name: 'teardrop' }).ring(10)!,
      d = deepestPoint(ring.pts);
    expect(inside(ring.pts, d.p[0], d.p[1])).toBe(true);
    expect(d.p[1]).toBeGreaterThan(0); // below the centre: the bulb is at the bottom
    expect(d.r).toBeGreaterThan(3);
  });
});
