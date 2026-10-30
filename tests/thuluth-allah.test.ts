// The name of God as one ligature (style.allah): its lams keep their spacing however a line is drawn out, and its
// shadda and small alif sit over the heh, clear of the second lam (the lab set them on its stem).
import { describe, expect, it } from 'vitest';
import { isLetter, ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { roundelPieces } from '../src/script/thuluth/roundel';

const HEHS = ['round', 'almond', 'eye', 'tear', 'tall'] as const;

describe('the ligature of the name of God', () => {
  for (const heh of HEHS)
    it(`keeps its lams together and its marks clear of the second lam (${heh} heh)`, () => {
      const th = thuluth({ ...ROUNDEL_PEN, allah: { heh } }),
        plain = th.buildStrokes('الله', {}),
        drawn = th.buildStrokes('الله', { kashida: 6 });
      const xs = (b: typeof plain) => b.placed.filter(isLetter).map(p => p.ox);
      // drawing the line out moves nothing inside the ligature
      const shift = xs(drawn)[1] - xs(plain)[1];
      xs(drawn)
        .slice(1)
        .forEach((x, i) => expect(x).toBeCloseTo(xs(plain)[i + 1] + shift, 9));
      // the two marks are the last strokes; both lie left of the second lam's stem
      const lam = plain.placed.filter(isLetter)[2],
        stem = lam.ox + Math.min(...lam.g.s.flatMap(s => s.pts.filter(q => q[1] > 5).map(q => q[0]))),
        marks = plain.strokes.slice(-2);
      for (const m of marks) expect(Math.max(...m.s.map(q => q.x))).toBeLessThan(stem - 0.5);
    });

  it('sets its own marks in a vowelled text, keeping only the heh’s', () => {
    const th = thuluth({ ...ROUNDEL_PEN, allah: { heh: 'tall' } }),
      p = roundelPieces(th, 'بِسْمِ اللَّهِ', {})!,
      g = p.groups.find(q => q.allah)!;
    expect(g.marks!.map(m => m.k)).toEqual([2]);
  });

  it('is off unless asked for', () => {
    const th = thuluth(ROUNDEL_PEN);
    expect(th.style.allah).toBeUndefined();
  });
});
