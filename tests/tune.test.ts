// The basmala tuning page (demos/tune.html): its starts draw, a hand nudge moves only its own piece, and the vowelled
// text has the same pieces as the plain one, so one layout serves both.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import type { Layout } from '../src/script/thuluth/roundel';
import { composeRoundel, roundelPieces } from '../src/script/thuluth/roundel';
import { TUNE_RECIPE, TUNE_TEXT, TUNE_VOWELLED } from '../src/tune/recipe';
import starts from '../src/tune/starts.json';

const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true } });
const pinned = (fixed: Layout) => composeRoundel(th, TUNE_TEXT, { ...TUNE_RECIPE, tries: 1, fixed })[0];

describe('tuning the basmala', () => {
  it('rebuilds each start exactly as recorded', () => {
    const p = roundelPieces(th, TUNE_TEXT, TUNE_RECIPE)!;
    for (const s of starts) {
      expect(s.layout.lv.length).toBe(p.groups.length);
      s.layout.lv.forEach((v, i) => expect(v).toBeLessThan(p.shapes[i].length));
      const r = pinned(s.layout as Layout);
      expect(r.lv).toEqual(s.layout.lv);
      expect(r.wp).toEqual(s.layout.wp);
    }
  });

  it('moves a nudged piece by exactly its nudge, and nothing else', () => {
    const base = starts[0].layout as Layout,
      a = pinned(base),
      b = pinned({ ...base, nudge: [{ i: 5, x: 1.5, y: -0.75 }] });
    b.st.forEach((q, i) => {
      expect(q.x).toBeCloseTo(a.st[i].x + (i === 5 ? 1.5 : 0), 9);
      expect(q.y).toBeCloseTo(a.st[i].y + (i === 5 ? -0.75 : 0), 9);
    });
  });

  it('finds the same pieces in the vowelled basmala as in the plain one', () => {
    const a = roundelPieces(th, TUNE_TEXT, TUNE_RECIPE)!,
      b = roundelPieces(th, TUNE_VOWELLED, TUNE_RECIPE)!;
    expect(b.groups.map(g => g.s)).toEqual(a.groups.map(g => g.s));
    expect(b.shapes.map(s => s.length)).toEqual(a.shapes.map(s => s.length));
  });
});
