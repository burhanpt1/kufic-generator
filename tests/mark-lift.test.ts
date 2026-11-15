// Vowels lifted over a stroke that covers their letter (SolveOptions.markLift). The roundel option innerGap sets the
// unjoined pieces of a word close by their ink: in الرحمن the hah's head runs in over the ra, where the ra's shadda and
// fatha stood, and the marks' search, which moves a mark by small steps and pays for each step on ink, left them
// under the head, on the letters. With markLift (on whenever innerGap is set) such a vowel is seated beyond the
// covering stroke before the search, in its letter's column, the vowel over its shadda. Off, nothing changes
// (tests/roundel-identity.test.ts pins the drawings as they were).
import { describe, expect, it } from 'vitest';
import { thuluthStyleOf } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth/engine';
import type { BuiltRoundel, RoundelOptions } from '../src/script/thuluth/roundel';
import { buildRoundel, composeRoundel, finishRoundel, markReading, strokeQuads } from '../src/script/thuluth/roundel';

const th = thuluth(thuluthStyleOf({ preset: 'roundel' })),
  BASMALA = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
  PEN: RoundelOptions = { elongate: true, cross: true, kern: true, tries: 4, iters: 6000 },
  build = (how: RoundelOptions, frame = {}) => buildRoundel(th, { text: BASMALA, compose: { ...PEN, ...how }, frame })!;

/** The vowels' pen samples that lie inside the letters' ink, as the pen draws it. */
function marksOnInk(b: BuiltRoundel): number {
  const quads = b.r.shapes.flatMap((S, g) => strokeQuads(th, S.b.strokes, b.r.st[g].x, b.r.st[g].y)),
    inside = (P: [number, number][], x: number, y: number) => {
      let c = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++)
        if (P[i][1] > y !== P[j][1] > y && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0])
          c = !c;
      return c;
    };
  let n = 0;
  for (const s of b.f.solved!.strokes)
    for (const q of s.s)
      if (quads.some(Q => q.x >= Q.x0 && q.x <= Q.x1 && q.y >= Q.y0 && q.y <= Q.y1 && inside(Q.p, q.x, q.y))) n++;
  return n;
}

describe('marks lifted over a covering stroke', () => {
  it('changes nothing when off', () => {
    const r = composeRoundel(th, BASMALA, { ...PEN, tries: 1, iters: 600, lanes: {}, innerGap: 0.7 })[0],
      plain = finishRoundel(th, structuredClone(r), '', {}),
      off = finishRoundel(th, structuredClone(r), '', { markLift: false }),
      on = finishRoundel(th, structuredClone(r), '', { markLift: true });
    expect(off).toEqual(plain);
    expect(on.solved!.items).not.toEqual(plain.solved!.items);
  });
  for (const [mode, how, was] of [
    ['fitted lanes', { lanes: {}, wordGap: 2.4 }, 0],
    ['ruled lines', { ruled: true, wordGap: 1.6 }, 2],
  ] as [string, RoundelOptions, number][])
    it(`leaves the vocalised basmala in ${mode} no more marks on ink with innerGap than without it`, () => {
      const without = build(how),
        lifted = build({ ...how, innerGap: 0.7 });
      // (measured with innerGap and the marks as they were: 2 in lanes, 3 on ruled lines)
      expect(without.f.marksUnplaced).toBe(was);
      expect(lifted.f.marksUnplaced).toBe(0);
      // none is reported on ink, and none is drawn on it
      expect(marksOnInk(lifted)).toBe(0);
      // every vowel still stands in the order of its word's letters
      expect(markReading(th, lifted.r, lifted.f).crossed).toBe(0);
    });
  it('is on with innerGap unless the frame turns it off', () => {
    const how: RoundelOptions = { lanes: {}, wordGap: 2.4, innerGap: 0.7 },
      off = build(how, { markLift: false });
    expect(off.f.marksUnplaced).toBe(2);
    expect(marksOnInk(off)).toBeGreaterThan(0);
  });
});
