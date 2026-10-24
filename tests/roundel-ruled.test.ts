// Ruled composition, the constrained mode: words sit exactly on ruled lines, in reading order, and the alignment check
// reports it.
import { describe, expect, it } from 'vitest';
import { thuluthStyleOf } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth/engine';
import { alignment } from '../src/script/thuluth/roundel/checks';
import { composeRoundel, headOf, twoLevels } from '../src/script/thuluth/roundel/compose';

const th = thuluth(thuluthStyleOf({ preset: 'roundel' })),
  SALAWAT = 'اللهم صل على محمد وآل محمد';

describe('ruled composition', () => {
  const [r] = composeRoundel(th, SALAWAT, { ruled: true, elongate: true, kern: true, tries: 1, iters: 1500, seed: 5 });
  const heads = (rr: typeof r) => {
    const first = new Map<number, number>();
    rr.groups.forEach((g, i) => !first.has(g.word) && first.set(g.word, i));
    return [...first.values()].map(g => ({ x: rr.st[g].x + headOf(rr.shapes[g]).x, y: rr.wp[rr.groups[g].word].y })); // prettier-ignore
  };
  it('puts every word on its line, the lines read downward and each line from the right', () => {
    const { breaks } = r.ruled!,
      hs = heads(r),
      lineOf = (w: number) => breaks.filter(b => b <= w).length - 1;
    expect(breaks[0]).toBe(0);
    expect(breaks.length).toBeGreaterThanOrEqual(2);
    for (let w = 1; w < hs.length; w++) {
      if (lineOf(w) === lineOf(w - 1)) {
        expect(r.wp[w].y).toBeCloseTo(r.wp[w - 1].y, 9);
        expect(hs[w].x).toBeLessThan(hs[w - 1].x);
      } else expect(r.wp[w].y).toBeLessThan(r.wp[w - 1].y);
    }
  });
  it('is deterministic', () => {
    const [r2] = composeRoundel(th, SALAWAT, { ruled: true, elongate: true, kern: true, tries: 1, iters: 1500, seed: 5 }); // prettier-ignore
    expect(r2.wp).toEqual(r.wp);
    expect(r2.lv).toEqual(r.lv);
  });
  it('reports baselines shared', () => {
    expect(alignment(r, th.style.nib).baselines).toBeLessThan(alignment(composeRoundel(th, SALAWAT, { lanes: {}, tries: 1, iters: 1500, seed: 5 })[0], th.style.nib).baselines); // prettier-ignore
  });
  it('measures two levels', () => {
    expect(twoLevels([1, 1, 5, 5])).toBe(0);
    expect(twoLevels([0, 1, 2])).toBeCloseTo(0.5);
  });
}, 300_000);
