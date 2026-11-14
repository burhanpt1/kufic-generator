// The great bowl with the options a recipe leaves out (Studio passes `bowl` without `clear`): the default clearance
// was exactly the gap every letter keeps from the bowl, so the lowest letter stood on the bottom of the inner ellipse,
// the bowl's half-width came out infinite and the build threw (RangeError: Invalid typed array length); a hair more
// clearance gave a bowl hundreds of pen units wide.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth/engine';
import { bowlOval, buildRoundel, composeRoundel } from '../src/script/thuluth/roundel';

const th = thuluth({ ...ROUNDEL_PEN, great: { nun: true, ya: true } }),
  TEXTS = ['محمد حسن', 'نور علي', 'بُرْهَان وَشَمِيرَة'],
  compose = { tries: 1, iters: 800, seed: 7 };

describe('the great bowl with default options', () => {
  it('has a finite oval of the composition’s own size, at any clearance', () => {
    for (const text of TEXTS) {
      const r = composeRoundel(th, text, compose)[0],
        xs = r.shapes.flatMap((S, i) => S.b.strokes.flatMap(s => s.s.map(q => q.x + r.st[i].x))),
        width = Math.max(...xs) - Math.min(...xs);
      for (const clear of [undefined, 0, 2.6, 2.61, 3, 5.6]) {
        const bo = bowlOval(th, structuredClone(r), clear == null ? {} : { clear })!;
        expect(bo, text).not.toBeNull();
        for (const v of [bo.b, bo.aL, bo.aR]) expect(Number.isFinite(v), `${text} clear ${clear}`).toBe(true);
        expect(bo.aL + bo.aR, `${text} clear ${clear}`).toBeLessThan(3 * width);
      }
    }
  });
  it('defaults to the clearance the recipes ask for (the gap and three pen units: 5.6 at the roundel pen)', () => {
    for (const text of TEXTS) {
      const r = composeRoundel(th, text, compose)[0],
        d = bowlOval(th, structuredClone(r), {})!,
        e = bowlOval(th, structuredClone(r), { clear: 5.6 })!;
      expect([d.b, d.aL, d.aR, d.cx, d.cy]).toEqual([e.b, e.aL, e.aR, e.cx, e.cy]);
    }
  });
  it('builds a roundel with `bowl: {}` and with the names preset’s `bowl: { free: true }`', () => {
    for (const text of TEXTS)
      for (const bowl of [{}, { free: true }]) {
        const b = buildRoundel(th, { text, bowl, compose })!;
        expect(b.r.bowlGrow, text).toBeDefined();
        expect(Number.isFinite(b.r.disc.r) && b.r.disc.r < 200, text).toBe(true);
      }
  });
});
