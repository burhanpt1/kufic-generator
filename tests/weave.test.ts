// Phase 6.4: interlaced maze — ribbons crossing over and under on a knot lattice.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Placed } from '../src/compose/placed';
import { knot } from '../src/compose/weave';
import type { Outline } from '../src/geometry/outlines';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';

const DIR = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

describe('knot', () => {
  for (const [name, on] of [
    ['full 6×6', () => true],
    ['disc', (i: number, j: number) => (i - 3.5) ** 2 + (j - 3.5) ** 2 < 14],
    ['ring', (i: number, j: number) => !(i > 2 && i < 5 && j > 2 && j < 5)],
  ] as const)
    for (const seed of [1, 7, 42])
      it(`${name}, seed ${seed}: closed loops through adjacent nodes, each crossing once over and once under`, () => {
        const S = name === 'full 6×6' ? 6 : 8,
          loops = knot(S, on, seed, 0.6);
        expect(loops.length).toBeGreaterThan(0);
        const passes = new Map<string, { under: number; over: number }>();
        for (const L of loops)
          L.forEach((q, k) => {
            const n = L[(k + 1) % L.length];
            // the next pass is the neighbour in the direction this one leaves
            expect([n.i - q.i, n.j - q.j]).toEqual(DIR[q.dout]);
            expect(n.din).toBe(q.dout);
            expect(on(q.i, q.j)).toBe(true);
            if (q.crossing) {
              const key = q.i + ',' + q.j,
                e = passes.get(key) ?? { under: 0, over: 0 };
              if (q.under) e.under++;
              else e.over++;
              passes.set(key, e);
            }
          });
        for (const e of passes.values()) expect(e).toEqual({ under: 1, over: 1 });
      });
  it('crossings follow the setting', () => {
    const count = (p: number) =>
      knot(8, () => true, 3, p)
        .flat()
        .filter(q => q.crossing).length;
    expect(count(1)).toBeGreaterThan(count(0));
    expect(count(0)).toBe(0);
  });
});

describe('interlaced maze fill', () => {
  const strips = (p: Placed) => p.items.filter(i => i.type === 'strip');
  for (const [name, outline] of [
    ['square', { kind: 'polygon', sides: 4 }],
    ['circle', { kind: 'circle' }],
    ['octagon', { kind: 'polygon', sides: 8 }],
  ] as [string, Outline][])
    it(`${name}: text on ribbons that cross, walls broken at under-passes, no letters overlapping`, () => {
      const c = structuredClone(preset('kufic-maze-tile'));
      c.root.child.outline = outline;
      c.root.child.fill = { ...(c.root.child.fill as { type: 'maze' }), interlace: true } as never;
      expect(isValidComposition(c)).toBe(true);
      const p = resolve(c);
      expect(p.meta.fill?.ok).toBe(true);
      expect(p.meta.fill?.note).toMatch(/interlaced, \d+ ribbons?, [1-9]\d* crossings/);
      const ribbon = p.items.find(i => i.type === 'ribbon');
      expect(ribbon && ribbon.type === 'ribbon' && ribbon.paths.length).toBeGreaterThan(2);
      // strip boxes (line placements) are pairwise disjoint
      const boxes = strips(p).map(it => {
        if (it.type !== 'strip' || it.place.type !== 'line') throw new Error('line placements expected');
        const { O, t, n, s } = it.place,
          W = it.strip.W,
          H = it.strip.kind === 'cells' ? it.strip.Hb : 0,
          q = [O, [O[0] + t[0] * W * s, O[1] + t[1] * W * s], [O[0] + n[0] * H * s, O[1] + n[1] * H * s]];
        const xs = [...q.map(v => v[0]), q[1][0] + n[0] * H * s],
          ys = [...q.map(v => v[1]), q[1][1] + n[1] * H * s];
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      });
      expect(boxes.length).toBeGreaterThan(2);
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const [ax0, ay0, ax1, ay1] = boxes[a],
            [bx0, by0, bx1, by1] = boxes[b];
          const overlap =
            Math.min(ax1, bx1) - Math.max(ax0, bx0) > 1e-6 && Math.min(ay1, by1) - Math.max(ay0, by0) > 1e-6;
          expect(overlap).toBe(false);
        }
    });
});
