// Lab port §4: strapwork fill.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { clipToRegion, cutPolylines, planStrapwork, strapItems } from '../src/compose/strapwork';
import type { StrapTiling } from '../src/compose/strapwork';
import { traitsOf } from '../src/evolve/genes';
import { applyTrait, randomComposition } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';
import type { Pt } from '../src/geometry/types';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';

const TEXT = 'بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين';
const octagon: Pt[] = Array.from({ length: 8 }, (_, i) => {
  const t = Math.PI / 8 + (i * Math.PI) / 4;
  return [40 * Math.cos(t), 40 * Math.sin(t)];
});
const circle: Pt[] = Array.from({ length: 400 }, (_, i) => {
  const t = (i * 2 * Math.PI) / 400;
  return [36 * Math.cos(t), 36 * Math.sin(t)];
});

describe.each([
  ['488', octagon],
  ['hex', circle],
  ['31212', octagon],
  ['square', circle],
] as [StrapTiling, Pt[]][])('strapwork %s', (tiling, region) => {
  const L = planStrapwork(TEXT, 2, tiling, region, DEFAULT_STYLE, kufi)!;
  it('fits the text', () => {
    expect(L).not.toBeNull();
    expect(L.text.length).toBeGreaterThan(2);
  });
  it('keeps every text piece inside its strap, with half a cell of margin', () => {
    const items = strapItems(L, region, DEFAULT_STYLE, kufi, 2, 0, 1),
      strips = items.filter(i => i.type === 'strip');
    expect(strips).toHaveLength(L.text.length);
    strips.forEach((it, k) => {
      if (it.type !== 'strip' || it.place.type !== 'line') throw new Error('line strips expected');
      const { O, t, n, s } = it.place,
        { piece } = L.text[k],
        u: Pt = [piece.Q[0] - piece.P[0], piece.Q[1] - piece.P[1]],
        len = Math.hypot(u[0], u[1]);
      u[0] /= len;
      u[1] /= len;
      // centred in the usable span whichever way it reads
      const lo = piece.c0,
        hi = len - piece.c1;
      for (const [x, y] of [
        [0, 0],
        [it.strip.W, 0],
        [0, it.strip.Hb],
        [it.strip.W, it.strip.Hb],
      ]) {
        const c: Pt = [O[0] + (x * t[0] + y * n[0]) * s, O[1] + (x * t[1] + y * n[1]) * s],
          d: Pt = [c[0] - piece.P[0], c[1] - piece.P[1]],
          along = d[0] * u[0] + d[1] * u[1],
          across = Math.abs(u[0] * d[1] - u[1] * d[0]);
        expect(across).toBeLessThanOrEqual(L.half - 0.5 * s + 1e-6);
        expect(along).toBeGreaterThanOrEqual(lo - 1e-6);
        expect(along).toBeLessThanOrEqual(hi + 1e-6);
      }
      // letters upright: the strip's up never points down the screen
      expect(n[1]).toBeLessThanOrEqual(1e-9);
    });
  });
  it('alternates over and under along every strand, one strap over at each crossing', () => {
    const byStrand = new Map<number, { j: number; over: boolean }[]>();
    for (const passes of L.crossState.values()) {
      if (passes.length === 2) expect(passes[0].over).not.toBe(passes[1].over);
      for (const p of passes) byStrand.set(p.si, [...(byStrand.get(p.si) ?? []), p]);
    }
    let checked = 0;
    for (const ps of byStrand.values()) {
      if (ps.length < 4) continue;
      ps.sort((a, b) => a.j - b.j);
      for (let i = 1; i < ps.length; i++) expect(ps[i].over).not.toBe(ps[i - 1].over);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('draws strap edges only inside the region', () => {
    const rib = strapItems(L, region, DEFAULT_STYLE, kufi, 2, 0, 1).find(i => i.type === 'ribbon');
    if (rib?.type !== 'ribbon') throw new Error('ribbon expected');
    const r = Math.max(...region.map(p => Math.hypot(p[0], p[1])));
    for (const q of rib.paths) for (const p of q) expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(r + 1e-6);
  });
});

describe('polyline cutting', () => {
  it('cuts the part of a line inside a convex hole', () => {
    const out = cutPolylines(
      [
        [
          [-10, 0],
          [10, 0],
        ],
      ],
      [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ],
      ],
    );
    expect(out).toEqual([
      [
        [-10, 0],
        [-1, 0],
      ],
      [
        [1, 0],
        [10, 0],
      ],
    ]);
    expect(
      cutPolylines(
        [
          [
            [0, 5],
            [3, 5],
          ],
        ],
        [
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ],
        ],
      ),
    ).toEqual([
      [
        [0, 5],
        [3, 5],
      ],
    ]);
  });
  it('clips lines to a region', () => {
    const sq: Pt[] = [
      [-5, -5],
      [5, -5],
      [5, 5],
      [-5, 5],
    ];
    expect(
      clipToRegion(
        [
          [
            [-10, 0],
            [0, 0],
            [0, 10],
          ],
        ],
        sq,
      ),
    ).toEqual([
      [
        [-5, 0],
        [0, 0],
        [0, 5],
      ],
    ]);
  });
});

describe('in compositions', () => {
  const c = structuredClone(preset('octagon-panel'));
  c.texts.long = { text: TEXT, repeat: 'once', wordGap: 2 };
  c.root.child.fill = { type: 'strapwork', text: 'long', tiling: '488' };
  it('resolves deterministically, with letters and straps', () => {
    expect(isValidComposition(c)).toBe(true);
    const a = resolve(c),
      b = resolve(c);
    expect(a.meta.fill).toMatchObject({ type: 'strapwork', ok: true });
    expect(a.items.some(i => i.type === 'ribbon')).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('is an evolvable fill with its own tiling', () => {
    const rng = new Rng(3),
      r = randomComposition(c.texts, { rng, locks: { fill: 'strapwork', tiling: 'hex' } });
    expect(isValidComposition(r)).toBe(true);
    expect(r.root.child.fill).toMatchObject({ type: 'strapwork', tiling: 'hex' });
    applyTrait(r, 'tiling', 'square', rng);
    expect(traitsOf(r)).toMatchObject({ fill: 'strapwork', tiling: 'square' });
  });
});
