// Phase 6.3: flow fill — lines along streamlines that follow the outline.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { flowLines } from '../src/compose/flow';
import { unitRing } from '../src/geometry/outlines';
import type { Outline } from '../src/geometry/outlines';
import { inside } from '../src/geometry/poly';
import type { Pt } from '../src/geometry/types';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';

const scaled = (o: Outline, k: number) => unitRing(o).pts.map(([x, y]) => [x * k, y * k] as Pt);
const SHAPES: [string, Outline][] = [
  ['circle', { kind: 'circle' }],
  ['teardrop', { kind: 'preset', name: 'teardrop' }],
  ['heart', { kind: 'preset', name: 'heart' }],
  ['octagon', { kind: 'polygon', sides: 8 }],
];

describe('flowLines', () => {
  for (const [name, o] of SHAPES)
    it(`${name}: lines and their bands stay inside, apart, gentle and level-ish`, () => {
      const P = scaled(o, 40),
        Hb = 13,
        s = 0.5,
        pitch = (Hb + 1) * s,
        lines = flowLines(P, { Hb, s, lineGap: 1, strength: 0.9 });
      expect(lines.length).toBeGreaterThan(3);
      // (each condition gathered over every step and pair, then checked once: the same tests, without an expect per
      // point pair)
      let minDx = Infinity,
        maxAngle = 0,
        outside: string | null = null,
        minApart = Infinity;
      lines.forEach((L, li) => {
        for (let k = 1; k < L.length; k++) {
          const dx = L[k][0] - L[k - 1][0],
            dy = L[k][1] - L[k - 1][1];
          minDx = Math.min(minDx, dx); // left to right, never doubling back
          maxAngle = Math.max(maxAngle, Math.abs(Math.atan2(dy, dx)));
          // the band above the baseline is inside
          const l = Math.hypot(dx, dy);
          if (!outside && !inside(P, L[k][0] + (dy / l) * Hb * s, L[k][1] - (dx / l) * Hb * s))
            outside = `line ${li}, step ${k}`;
        }
        for (let lj = 0; lj < li; lj++)
          for (const p of L)
            for (const q of lines[lj]) minApart = Math.min(minApart, Math.hypot(p[0] - q[0], p[1] - q[1]));
      });
      expect(minDx).toBeGreaterThan(0);
      expect(maxAngle).toBeLessThanOrEqual((41 * Math.PI) / 180);
      expect(outside).toBe(null);
      expect(minApart).toBeGreaterThan(pitch * 0.9);
    });
  it('strength 0 gives level lines', () => {
    const lines = flowLines(scaled({ kind: 'circle' }, 40), { Hb: 13, s: 0.5, lineGap: 1, strength: 0 });
    for (const L of lines) for (const p of L) expect(Math.abs(p[1] - L[0][1])).toBeLessThan(1e-6);
  });
  it('lines bend with the edge when strength is high', () => {
    const lines = flowLines(scaled({ kind: 'circle' }, 40), { Hb: 13, s: 0.5, lineGap: 1, strength: 1 });
    const bent = lines.filter(L => Math.abs(L[0][1] - L[Math.floor(L.length / 2)][1]) > 1);
    expect(bent.length).toBeGreaterThan(0);
  });
});

describe('flow fill', () => {
  for (const [name, o] of SHAPES)
    it(`${name}: the whole text lays out on flow lines`, () => {
      const c = structuredClone(preset('mihrab-ayat-al-kursi'));
      c.root.child.outline = o;
      c.root.child.fill = { type: 'flow', text: 'ayat', lineGap: 1, strength: 0.8 };
      expect(isValidComposition(c)).toBe(true);
      const p = resolve(c);
      expect(p.meta.fill?.ok, JSON.stringify(p.meta.fill)).toBe(true);
      expect(p.meta.warnings).toEqual([]);
      const last = Math.max(...p.items.map(i => ('ring' in i ? i.ring : 0)));
      expect(
        p.items.filter(i => i.type === 'strip' && i.ring === last && i.place.type === 'run').length,
      ).toBeGreaterThan(3);
    });
});
