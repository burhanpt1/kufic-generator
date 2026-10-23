// Shaped fields (PLAN-2 §3; roundel/fields.ts): Derman's classical fields as outlines that a roundel fills.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { renderPlaced } from '../src/render/composition';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import type { FieldName } from '../src/script/thuluth/roundel';
import { buildRoundel, edgeDistance, fieldLanes, fieldPolygon, FIELDS, fitField, inPolygon, roundelArt, roundelParts } from '../src/script/thuluth/roundel'; // prettier-ignore

const NAMES = Object.keys(FIELDS) as FieldName[];

describe('shaped fields', () => {
  it('are closed outlines one unit high either way, with lanes inside them', () => {
    for (const n of NAMES) {
      const P = fieldPolygon(n);
      expect(Math.max(...P.map(p => p[1]))).toBeCloseTo(1, 6);
      expect(Math.min(...P.map(p => p[1]))).toBeCloseTo(-1, 6);
      expect(inPolygon(P, 0, 0)).toBe(true);
      for (const lane of fieldLanes(n, 3, 0.55))
        for (const [x, y] of lane) expect(inPolygon(P, x * 0.99, y), n).toBe(true);
    }
  });
  it('fit round points with their margins, as small as they can', () => {
    const pts: [number, number, number][] = [[-3, 0, 1], [3, 0, 1], [0, 2, 1], [0, -2, 1]]; // prettier-ignore
    for (const n of NAMES) {
      const f = fitField(n, pts),
        P = fieldPolygon(n);
      for (const [x, y, m] of pts) {
        const u = (x - f.cx) / f.k,
          v = (y - f.cy) / f.k;
        expect(inPolygon(P, u, v), n).toBe(true);
        expect(edgeDistance(P, u, v) * f.k).toBeGreaterThanOrEqual(m - 1e-6);
      }
      // a field a tenth smaller no longer holds them anywhere near
      expect(f.k).toBeLessThan(40);
    }
  });
  it('keep the letters, dots, vowels and ornaments of a roundel inside the outline', () => {
    const th = thuluth(ROUNDEL_PEN),
      b = buildRoundel(th, { text: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ', compose: { elongate: true, cross: true, kern: true, tries: 1, iters: 1500, seed: 29, field: 'drop', lanes: {} }, frame: { ornaments: true, density: 0.4 }, judge: 1 })!; // prettier-ignore
    // the field as drawn (roundelArt's Rf)
    const d = b.r.disc,
      P = fieldPolygon('drop'),
      k = roundelArt(th, b.r, b.f).Rf;
    expect(d.field).toBe('drop');
    let out = 0,
      n = 0;
    for (const u of roundelParts(b.r, { solved: b.f.solved }))
      for (const q of u.s ?? (u.dot ? [{ x: u.dot[0], y: u.dot[1] }] : [])) {
        n++;
        if (!inPolygon(P, (q.x - d.cx) / k, (q.y - d.cy) / k)) out++;
      }
    expect(n).toBeGreaterThan(100);
    expect(out).toBe(0);
  }, 120_000);
  it('draw as a composition, with the finial at a pointed field', () => {
    const c: Composition = {
      version: 1,
      seed: 3,
      canvas: { shape: 'square', margin: 3 },
      style: structuredClone(DEFAULT_STYLE) as Style,
      texts: { t: { text: 'محمد علي', repeat: 'once', wordGap: 2 } },
      root: { type: 'frame', child: { type: 'region', outline: { kind: 'circle' }, borders: [], fill: { type: 'roundel', text: 't', recipe: { field: 'mihrab', tries: 1, iters: 800 } } } }, // prettier-ignore
    };
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c);
    expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: true });
    const svg = renderPlaced(p, { idPrefix: 'f' });
    expect(svg).not.toContain('<ellipse cx="0" cy="0"');
    expect(svg.match(/Q/g)!.length).toBeGreaterThanOrEqual(16); // the finial's petals
  }, 120_000);
});
