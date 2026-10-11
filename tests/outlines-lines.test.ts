// Phase 6.1 (outlines of any SVG shape, at any depth) and 6.2 (variable line height in line fills).
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Placed } from '../src/compose/placed';
import { traitsOf } from '../src/evolve/genes';
import { applyTrait, relevantTraits } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';
import { inside } from '../src/geometry/poly';
import { preset, TEXTS } from '../src/model/presets';
import type { Composition } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { SILHOUETTES } from '../src/model/silhouettes';

const base = () => structuredClone(preset('mihrab-ayat-al-kursi'));
const withLines = (outline: Composition['root']['child']['outline'], vary?: number) => {
  const c = base();
  c.root.child.outline = outline;
  c.texts.ayat = { text: TEXTS.ayatKursi, repeat: 'fill', wordGap: 2 };
  if (vary !== undefined) c.root.child.fill = { type: 'lines', text: 'ayat', lineGap: 1, vary };
  return c;
};
type StripItem = Extract<Placed['items'][number], { type: 'strip' }>;
const fillStrips = (p: Placed) => {
  const strips = p.items.filter((i): i is StripItem => i.type === 'strip');
  const last = Math.max(...strips.map(s => s.ring));
  return strips.filter(s => s.ring === last);
};

describe('silhouettes', () => {
  for (const [name, path] of Object.entries(SILHOUETTES))
    it(`${name}: borders and a line fill lay out whole`, () => {
      const c = withLines({ kind: 'svg', path }, 0.5);
      expect(isValidComposition(c)).toBe(true);
      const p = resolve(c);
      expect(p.meta.warnings).toEqual([]);
      expect(p.meta.borders[0].rings.every(r => r.rep >= 1)).toBe(true);
      expect(p.meta.fill?.ok).toBe(true);
    });
  it('small features (a finial, a minaret) stay empty instead of forcing the shape larger', () => {
    for (const k of ['lamp', 'mosque'] as const) {
      const p = resolve(withLines({ kind: 'svg', path: SILHOUETTES[k] }, 1));
      const ring = p.meta.borders[0].rings[0];
      expect(ring.groupSizes.some(n => n === 0)).toBe(true);
      expect(ring.groupSizes.some(n => n > 0)).toBe(true);
      // was 158 for the lamp when every run had to hold text; bands gained headroom above the letters since (98 → 102)
      expect(p.meta.size).toBeLessThan(110);
    }
  });
  it('a nested region can have an SVG outline too', () => {
    const c = base();
    c.root.child.outline = { kind: 'svg', path: SILHOUETTES.dome };
    c.root.child.fill = {
      type: 'region',
      node: {
        type: 'region',
        outline: { kind: 'svg', path: SILHOUETTES.lamp },
        borders: [{ type: 'textBorder', text: 'basmala', separator: { kind: 'lines', width: 1 } }],
        fill: { type: 'abjad', text: 'basmala' },
      },
    };
    const p = resolve(c);
    expect(p.meta.borders.length).toBe(2);
    expect(p.meta.borders.every(b => b.rings.every(r => r.rep >= 1))).toBe(true);
    expect(p.items.some(i => i.type === 'abjad')).toBe(true);
  });
});

describe('variable line height', () => {
  it('vary 0 is exactly the uniform layout', () => {
    const a = base(),
      b = base();
    (b.root.child.fill as { vary?: number }).vary = 0;
    expect(resolve(b)).toEqual(resolve(a));
  });
  for (const [name, outline] of [
    ['teardrop', { kind: 'preset', name: 'teardrop' }],
    ['mihrab', { kind: 'preset', name: 'mihrab' }],
    ['dome', { kind: 'svg', path: SILHOUETTES.dome }],
  ] as const)
    it(`${name}: lines shrink toward narrow parts, stay inside, and reach further`, () => {
      const flat = resolve(withLines(outline, 0)),
        varied = resolve(withLines(outline, 1));
      const fs = fillStrips(flat),
        vs = fillStrips(varied);
      expect(new Set(fs.map(s => s.place.s)).size).toBe(1);
      const scales = vs.map(s => s.place.s);
      expect(Math.max(...scales) / Math.min(...scales)).toBeGreaterThan(1.05);
      expect(Math.min(...scales) / Math.max(...scales)).toBeGreaterThanOrEqual(0.5 - 1e-9);
      // more lines: the narrow parts get used instead of dropped
      const rows = (ss: StripItem[]) =>
        new Set(ss.map(s => (s.place.type === 'line' ? s.place.O[1].toFixed(3) : ''))).size;
      expect(rows(vs)).toBeGreaterThanOrEqual(rows(fs));
      // every line's ends lie inside the outline
      const P = varied.meta.outline;
      for (const s of vs)
        if (s.place.type === 'line') {
          const { O, t } = s.place,
            L = s.strip.W * s.place.s;
          expect(inside(P, O[0], O[1])).toBe(true);
          expect(inside(P, O[0] + t[0] * L, O[1] + t[1] * L)).toBe(true);
        }
    });
  it('is an evolvable trait for line fills only', () => {
    const c = withLines({ kind: 'preset', name: 'teardrop' }, 0);
    expect(relevantTraits(c)).toContain('vary');
    applyTrait(c, 'vary', 1, new Rng(1));
    expect(traitsOf(c).vary).toBe(1);
    expect(isValidComposition(c)).toBe(true);
    expect(relevantTraits(preset('fatimid-medallion'))).not.toContain('vary');
  });
});
