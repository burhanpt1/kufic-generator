// The drawn outline of thuluth ink (cleanOutline): the pen's quads fan out on a turn and leave a comb of notches;
// drawn, the notches are closed and nothing else moves.
import { describe, expect, it } from 'vitest';
import { thuluthStyleOf } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth/engine';
import { cleanOutline, outline } from '../src/script/thuluth/outline';
import type { Poly } from '../src/script/thuluth/types';

const area = (ps: Poly[]) =>
  ps.reduce((a, q) => a + q.reduce((s, [x, y], i) => s + x * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * y, 0) / 2, 0); // prettier-ignore
const th = thuluth(thuluthStyleOf({ preset: 'roundel' }));

describe('the drawn outline of thuluth ink', () => {
  for (const text of ['بسم الله الرحمن الرحيم', 'محمد', 'شمس']) {
    it(`closes the notches of ${text} and keeps its ink`, () => {
      const b = th.buildStrokes(text, {});
      for (const s of b.strokes) {
        const quads = th.strokePolys(s),
          plain = outline(quads, 0),
          clean = cleanOutline(quads),
          a0 = area(plain),
          a1 = area(clean),
          points = (ps: Poly[]) => ps.reduce((n, q) => n + q.length, 0);
        // the stroke keeps its weight: the notches are a sliver, and so is the rounding to a thousandth of a unit
        expect(Math.abs(a1 - a0)).toBeLessThan(0.03 * a0 + 0.05);
        // and the outline it draws is far lighter than the quads it came from
        expect(points(clean)).toBeLessThan(quads.length * 4);
      }
    });
  }
  it('leaves a plain quad as it was', () => {
    const q: Poly = [[0, 0], [2, 0], [2, 1], [0, 1]]; // prettier-ignore
    expect(area(cleanOutline([q]))).toBeCloseTo(2, 2);
  });
  it('fills a notch narrower than twice its reach and leaves a wider gap open', () => {
    const bar = (x0: number, x1: number): Poly => [[x0, 0], [x1, 0], [x1, 1], [x0, 1]], // prettier-ignore
      base: Poly = [[0, -1], [3, -1], [3, 0], [0, 0]]; // prettier-ignore
    expect(area(cleanOutline([base, bar(0, 1), bar(1.1, 2)], 0.07))).toBeGreaterThan(4.99);
    expect(area(cleanOutline([base, bar(0, 1), bar(1.5, 2.5)], 0.07))).toBeLessThan(5.02);
  });
});
