// Reading order judged from the letters' bodies (roundel/bodies.ts): what made the dense roundels unreadable was not
// the letters but their order, a dropped letter landing under the next word or a word slid in to the right of another's
// dropped letters. The rule is kept by the composer in every mode, weighed by the judge, and reported as a check; and
// the filler ornaments stay in the pockets among the letters, where they cannot be taken for stray dots.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { isLetter } from '../src/script/thuluth/engine';
import type { ReadingFaultPair, Roundel } from '../src/script/thuluth/roundel';
import {
  buildRoundel,
  composeRoundel,
  letterBodies,
  readingFault,
  roundelChecks,
  roundelPieces,
  roundelReadingFault,
} from '../src/script/thuluth/roundel';

const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true } }),
  nib = th.style.nib,
  BASMALA = 'بسم الله الرحمن الرحيم',
  SALAWAT = 'اللهم صل على محمد وآل محمد',
  quick = { elongate: true, cross: true, kern: true, tries: 1, iters: 1500, seed: 5 };

describe('letter bodies', () => {
  const pieces = roundelPieces(th, BASMALA, { elongate: true, kern: true })!,
    plain = (s: string) => pieces.shapes[pieces.groups.findIndex(g => g.s === s)].find(S => !S.stacked && !S.elong && !S.cost)!; // prettier-ignore
  it('leave out a tail and a stem: the ra is a head, the alif a foot, the hah a whole head', () => {
    // li is the letter's index in its group
    const lr = letterBodies(plain('لر'), nib),
      ra = lr.find(b => b.li === 1)!,
      lam = lr.find(b => b.li === 0)!;
    // the final ra sweeps 5 pens left and 3 down; its body is the short head at the baseline
    expect(ra.x1 - ra.x0).toBeLessThan(3.5);
    expect(ra.y0).toBeGreaterThan(-2.5);
    // a lam is a 10-pen stem on a foot
    expect(lam.y1).toBeLessThan(4.5);
    const hah = letterBodies(plain('حمن'), nib).find(b => b.li === 0)!;
    expect(hah.y1 - hah.y0).toBeGreaterThan(5);
  });
  it('are measured from each letter where it is placed, so a stacked letter carries its body down with it', () => {
    // stacked joins are on offer only when asked for
    const withStacks = roundelPieces(th, BASMALA, { elongate: true, kern: true, stackPull: 1.6 })!,
      gi = withStacks.groups.findIndex(g => g.s === 'حمن'),
      stacked = withStacks.shapes[gi].find(S => S.stacked)!,
      mimAt = stacked.b.placed.find(p => isLetter(p) && p.li === 1)!;
    expect(isLetter(mimAt) && mimAt.oy).toBeLessThan(-2);
    const mim = letterBodies(stacked, nib).find(b => b.li === 1)!;
    expect(mim.y1).toBeLessThan(letterBodies(stacked, nib).find(b => b.li === 0)!.y0 + 1);
  });
});

describe('the reading-order fault', () => {
  const [r] = composeRoundel(th, BASMALA, { ...quick, lanes: {} }),
    words = (rr: Roundel) => {
      const m = new Map<number, number[]>();
      rr.groups.forEach((g, i) => m.set(g.word, [...(m.get(g.word) || []), i]));
      return m;
    },
    moved = (rr: Roundel, word: number, dx: number, dy: number) => ({
      ...rr,
      st: rr.st.map((p, i) => (rr.groups[i].word === word ? { x: p.x + dx, y: p.y + dy } : p)),
    });
  it('is zero for a composition on lanes, read from the top down', () => {
    expect(roundelReadingFault(r, nib)).toBe(0);
  });
  it('faults a later word set level with an earlier one and to its right', () => {
    // الرحيم carried up onto الرحمن's line, to its right
    const w2 = words(r).get(2)!,
      w3 = words(r).get(3)!,
      right = Math.max(...w2.map(i => r.st[i].x + r.shapes[i].x1)) + 6 - Math.min(...w3.map(i => r.st[i].x + r.shapes[i].x0)), // prettier-ignore
      up = r.st[w2[0]].y - r.st[w3[0]].y,
      det: ReadingFaultPair[] = [];
    expect(roundelReadingFault(moved(r, 3, right, up), nib, det)).toBeGreaterThan(0);
    expect(det.every(d => d.kind === 'level')).toBe(true);
    expect(det.every(d => r.groups[d.a.g].word === 2 && r.groups[d.b.g].word === 3)).toBe(true);
  });
  it('faults a later word set higher than an earlier one, even up and away from it', () => {
    // الرحيم lifted above بسم, off to the left: nothing level, nothing in one column, still out of order
    const w0 = words(r).get(0)!,
      w3 = words(r).get(3)!,
      top = Math.max(...w0.map(i => r.st[i].y + r.shapes[i].y1)),
      bot = Math.min(...w3.map(i => r.st[i].y + r.shapes[i].y0)),
      left = Math.min(...w0.map(i => r.st[i].x + r.shapes[i].x0)) - 8 - Math.max(...w3.map(i => r.st[i].x + r.shapes[i].x1)), // prettier-ignore
      det: ReadingFaultPair[] = [];
    expect(roundelReadingFault(moved(r, 3, left, top - bot + 4), nib, det)).toBeGreaterThan(0);
    expect(det.every(d => d.kind === 'above')).toBe(true);
  });
  it('faults an earlier word dropped under a later one, and not a tail swept under it', () => {
    // الرحمن carried down to stand under الرحيم, in its column
    const w2 = words(r).get(2)!,
      w3 = words(r).get(3)!,
      cx = (w: number[]) => (Math.min(...w.map(i => r.st[i].x + r.shapes[i].x0)) + Math.max(...w.map(i => r.st[i].x + r.shapes[i].x1))) / 2, // prettier-ignore
      det: ReadingFaultPair[] = [],
      drop = r.st[w3[0]].y - r.st[w2[0]].y - 12;
    expect(roundelReadingFault(moved(r, 2, cx(w3) - cx(w2), drop), nib, det)).toBeGreaterThan(0);
    expect(det.some(d => d.kind === 'above')).toBe(true);
    // the same words in order, the tail of الرحمن's nun sweeping under the first letters of الرحيم: no body in another's
    // column or level, no fault
    expect(roundelReadingFault(r, nib)).toBe(0);
  });
  it("spares a word riding on another word's elongation, and faults one set beside it on the line", () => {
    const pieces = roundelPieces(th, BASMALA, { elongate: true, kern: true })!,
      long = pieces.shapes[0].find(S => S.elong === 13)!,
      sh = long.shelves[0],
      alif = pieces.shapes[1][0],
      groups = [pieces.groups[0], pieces.groups[1]],
      at = (x: number, y: number) =>
        readingFault({
          groups,
          shapes: [long, alif],
          pos: [
            { x: 0, y: 0 },
            { x, y },
          ],
          nib,
        });
    expect(sh).toBeDefined();
    // an alif set over بسم's kashida, within its span: a rider; the same alif on the baseline beside the kashida, level
    // with بسم's letters and to the right of its sin and mim: out of order
    expect(at(sh.x1 - 2, sh.y + 1.5)).toBe(0);
    expect(at(sh.x1 - 2, 0)).toBeGreaterThan(0);
  });
});

describe('composed roundels read in order', () => {
  for (const [name, text, fam] of [
    ['the basmala on lanes', BASMALA, { lanes: {} }],
    ['the basmala ruled', BASMALA, { ruled: true }],
    ['the salawat ruled', SALAWAT, { ruled: true }],
    ['the salawat free', SALAWAT, { stack: true }],
  ] as const)
    it(name, () => {
      const b = buildRoundel(th, { text, compose: { ...quick, ...fam }, frame: { ornaments: true, density: 0.35 } })!;
      // at this little effort a ruled line may still pack two words until their bodies nearly touch (a breach under a
      // pen); nothing stands over or right of an earlier word
      expect(roundelReadingFault(b.r, nib)).toBeLessThan(1);
      expect(roundelChecks(th, b.r, b.f).reading).toBeLessThan(1);
    });
  it('and the rule can be turned off', () => {
    const on = composeRoundel(th, BASMALA, { ...quick, ruled: true }),
      off = composeRoundel(th, BASMALA, { ...quick, ruled: true, reading: false });
    expect(on[0].E).toBeLessThanOrEqual(off[0].E + roundelReadingFault(off[0], nib) * 25 + 1e-6);
  });
}, 240_000);

describe('filler ornaments', () => {
  it('sit in pockets among the letters, with ink on three sides or to both left and right, never out by the rim', () => {
    const b = buildRoundel(th, { text: BASMALA, compose: { ...quick, lanes: {} }, frame: { ornaments: true, density: 0.5 } })!, // prettier-ignore
      orn = b.f.solved!.strokes.filter(s => s.orn),
      // the letters' ink, sampled
      ink = b.r.shapes.flatMap((S, i) => S.b.strokes.flatMap(s => s.s.map(q => [q.x + b.r.st[i].x, q.y + b.r.st[i].y] as [number, number]))); // prettier-ignore
    expect(orn.length).toBeGreaterThan(0);
    const centres = new Map<string, [number, number]>();
    orn.forEach(s => {
      const xs = s.s.map(q => q.x),
        ys = s.s.map(q => q.y);
      centres.set(xs[0].toFixed(0) + ',' + ys[0].toFixed(0), [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]); // prettier-ignore
    });
    for (const [cx, cy] of centres.values()) {
      const reach = 6 * nib + 2,
        side = (dx: number, dy: number) =>
          ink.some(([x, y]) => (dx ? Math.sign(x - cx) === dx && Math.abs(y - cy) < 1.5 && Math.abs(x - cx) < reach : Math.sign(y - cy) === dy && Math.abs(x - cx) < 1.5 && Math.abs(y - cy) < reach)); // prettier-ignore
      const hits = [side(1, 0), side(-1, 0), side(0, 1), side(0, -1)];
      expect(hits.filter(Boolean).length >= 3 || (hits[0] && hits[1]), `${cx.toFixed(1)},${cy.toFixed(1)}`).toBe(true);
    }
  }, 120_000);
});
