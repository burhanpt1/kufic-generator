// Mirrored composition, müsennâ, combined (PORT-PLAN.md §4; lab deco.js musenna, renderMusennaCombined).
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { musenna, musennaArt, refusesMirror } from '../src/script/thuluth/roundel';
import { Alpha, toPixels } from '../src/script/thuluth/raster';

describe('müsennâ', () => {
  it('never mirrors الله', () => {
    for (const t of ['الله', 'اللّٰهُ', 'بسم الله', 'عبدالله', 'لله', 'بِٱللَّهِ'])
      expect(refusesMirror(t), t).toBe(true);
    for (const t of ['علي', 'محمد', 'حسن']) expect(refusesMirror(t), t).toBe(false);
    expect(musenna(thuluth(ROUNDEL_PEN), 'الله')).toEqual([]);
  });
  const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true } }),
    cands = musenna(th, 'علي', { seeds: [11], iters: 1500 });
  it('makes علي one design about a shared lam', () => {
    expect(cands.length).toBeGreaterThan(1);
    expect(cands[0].shared).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < cands.length; i++) expect(cands[i].score).toBeLessThanOrEqual(cands[i - 1].score);
  });
  it('is symmetric about its axis, and draws the shared stroke once', () => {
    const a = musennaArt(th, cands[0]),
      K = 8,
      x0 = a.cx - a.rad,
      y1 = a.cy + a.rad,
      N = Math.ceil(2 * a.rad * K),
      A = new Alpha(N, N);
    A.fill(
      toPixels(
        a.polys,
        x => (x - x0) * K,
        y => (y1 - y) * K,
      ),
    );
    const m = A.mask(100);
    let ink = 0,
      off = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (m[y * N + x]) {
          ink++;
          if (!m[y * N + (N - 1 - x)]) off++;
        }
    expect(ink).toBeGreaterThan(500);
    expect(off / ink).toBeLessThan(0.03);
    expect(a.shared.strokes).toBe(cands[0].shared);
    // drawn apart, the halves share nothing
    expect(musennaArt(th, cands[0], { shareStrokes: false }).shared.strokes).toBe(0);
  });
});

describe('the mirrored roundel filler', () => {
  const comp = (text: string): Composition => ({
    version: 1,
    seed: 3,
    canvas: { shape: 'square', margin: 3 },
    style: structuredClone(DEFAULT_STYLE) as Style,
    texts: { name: { text, repeat: 'once', wordGap: 2 } },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [],
        fill: { type: 'roundel', text: 'name', recipe: { mirror: true, great: { ya: true }, iters: 1500, tries: 2 } },
      },
    },
  });
  it('draws a mirrored علي', () => {
    const c = comp('علي');
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c);
    expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: true });
    expect(p.items.some(i => i.type === 'roundel')).toBe(true);
  });
  it('offers mirroring only where a tall stroke can be shared on the axis', () => {
    const p = resolve(comp('محمد'));
    expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: false, note: 'no tall stroke to share on the axis: not mirrored' }); // prettier-ignore
  });
  it('refuses to mirror الله, and says so', () => {
    const p = resolve(comp('الله'));
    expect(p.meta.fill).toMatchObject({ type: 'roundel', ok: false, note: 'الله is not mirrored' });
  });
});
