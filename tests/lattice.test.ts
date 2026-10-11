// Lab port §7: woven lattice.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { latticeItems, planLattice } from '../src/compose/lattice';
import type { Pt } from '../src/geometry/types';
import { inside } from '../src/geometry/poly';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';

const TEXT = 'بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين';
const square: Pt[] = [
  [-30, -30],
  [30, -30],
  [30, 30],
  [-30, 30],
];
const circle: Pt[] = Array.from({ length: 300 }, (_, i) => [
  32 * Math.cos((i * 2 * Math.PI) / 300),
  32 * Math.sin((i * 2 * Math.PI) / 300),
]);

describe.each([
  ['square', square],
  ['circle', circle],
] as [string, Pt[]][])('lattice in a %s', (_, region) => {
  const L = planLattice(TEXT, 2, region, DEFAULT_STYLE, kufi, 1)!,
    items = latticeItems(L, region, DEFAULT_STYLE, kufi, 2, 0, 1),
    strips = items.filter(i => i.type === 'strip');
  it('fits the text on both directions of strap', () => {
    expect(L).not.toBeNull();
    expect(strips).toHaveLength(L.text.length);
    expect(L.rows.length).toBeGreaterThan(1);
    expect(L.cols.length).toBeGreaterThan(1);
  });
  it('keeps letters on their strap, off the crossing squares and inside the region', () => {
    strips.forEach((it, k) => {
      if (it.type !== 'strip' || it.place.type !== 'line') throw new Error('line strips expected');
      const { O, t, n, s } = it.place,
        p = L.text[k].piece,
        across = p.dir === 'h' ? L.cols : L.rows;
      if (p.dir === 'v') {
        // reading down, letter tops facing left, baseline on the right
        expect(t).toEqual([0, -1]);
        expect(n).toEqual([-1, 0]);
      } else expect(t).toEqual([1, 0]);
      for (const [x, y] of [
        [0, 0],
        [it.strip.W, 0],
        [0, it.strip.Hb],
        [it.strip.W, it.strip.Hb],
      ]) {
        const c: Pt = [O[0] + (x * t[0] + y * n[0]) * s, O[1] + (x * t[1] + y * n[1]) * s],
          along = p.dir === 'h' ? c[0] : c[1],
          off = p.dir === 'h' ? c[1] - p.at : c[0] - p.at;
        expect(Math.abs(off)).toBeLessThanOrEqual(L.half - 0.5 * s + 1e-6);
        expect(along).toBeGreaterThanOrEqual(p.a - 1e-6);
        expect(along).toBeLessThanOrEqual(p.b + 1e-6);
        for (const x0 of across) expect(Math.abs(along - x0)).toBeGreaterThanOrEqual(L.half - 1e-6);
        expect(inside(region, c[0], c[1])).toBe(true);
      }
    });
  });
  it('reads horizontals top to bottom, right to left, then verticals right to left, top to bottom', () => {
    const ps = L.text.map(x => x.piece),
      firstV = ps.findIndex(p => p.dir === 'v');
    if (firstV >= 0) expect(ps.slice(firstV).every(p => p.dir === 'v')).toBe(true);
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i];
      if (a.dir !== b.dir) continue;
      if (a.dir === 'h') expect(a.at < b.at || (a.at === b.at && a.a > b.a)).toBe(true);
      else expect(a.at > b.at || (a.at === b.at && a.a < b.a)).toBe(true);
    }
  });
  it('weaves in a checkerboard: the strap on top keeps its edges, the lower one is broken', () => {
    const rib = items.find(i => i.type === 'ribbon');
    if (rib?.type !== 'ribbon') throw new Error('ribbon expected');
    const h = L.half,
      // does an edge line at this offset run through the crossing?
      through = (dir: 'h' | 'v', x: number, y: number) =>
        [-h, h].some(d =>
          rib.paths.some(q =>
            q.some((p, i) => {
              if (!i) return false;
              const a = q[i - 1];
              return dir === 'h'
                ? Math.abs(a[1] - (y + d)) < 1e-6 && Math.min(a[0], p[0]) < x && Math.max(a[0], p[0]) > x
                : Math.abs(a[0] - (x + d)) < 1e-6 && Math.min(a[1], p[1]) < y && Math.max(a[1], p[1]) > y;
            }),
          ),
        );
    let checked = 0;
    L.rows.forEach((y, r) =>
      L.cols.forEach((x, c) => {
        if (!inside(region, x, y) || !inside(region, x + 2 * h, y + 2 * h) || !inside(region, x - 2 * h, y - 2 * h))
          return;
        const hTop = (r + c) % 2 === 0;
        expect(through('h', x, y)).toBe(hTop);
        expect(through('v', x, y)).toBe(!hTop);
        checked++;
      }),
    );
    expect(checked).toBeGreaterThan(0);
  });
});

describe('lattice in compositions', () => {
  it('resolves deterministically in a preset', () => {
    const c = structuredClone(preset('kufic-maze-tile'));
    c.texts.lat = { text: TEXT, repeat: 'once', wordGap: 2 };
    c.root.child.fill = { type: 'lattice', text: 'lat' };
    expect(isValidComposition(c)).toBe(true);
    const a = resolve(c);
    expect(a.meta.fill).toMatchObject({ type: 'lattice', ok: true });
    expect(JSON.stringify(resolve(c))).toBe(JSON.stringify(a));
  });
});
