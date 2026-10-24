// Reading paths and fitted lanes for roundels (PORT-PLAN.md §3; lab roundel.js): words placed along a spine in
// reading order, read across and then downward.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import {
  AUTO_PATHS,
  buildRoundel,
  composeRoundel,
  downward,
  headOf,
  lanes,
  pathTargets,
  PATHS,
  stairs,
  toReadingPath,
} from '../src/script/thuluth/roundel';

describe('reading paths', () => {
  it('give each word a target along the path in proportion to its width', () => {
    const T = pathTargets([[[1, 0], [-1, 0]]], [2, 4, 2], 0.5); // prettier-ignore
    // the path (length 2) is scaled to half the text's width (8): 4 units, from x = 2 to x = −2
    expect(T.map(t => +t[0].toFixed(6))).toEqual([1.5, 0, -1.5]);
    expect(T.every(t => t[1] === 0)).toBe(true);
  });
  it('lay level lanes across the disc, the upper lane first, outer lanes shorter', () => {
    const L = lanes(180, 3, 0.6);
    expect(L.map(l => l[0][1])).toEqual([...L.map(l => l[0][1])].sort((a, b) => b - a));
    for (const l of L) expect(l[0][1]).toBeCloseTo(l[1][1], 9);
    for (const l of L) expect(l[0][0]).toBeGreaterThan(l[1][0]); // right to left
    expect(L[1][0][0] - L[1][1][0]).toBeGreaterThan(L[0][0][0] - L[0][1][0]);
  });
  it('make a traced path read downward, keeping its height', () => {
    for (const k of ['calliar1', 'calliar2', 'calliar3', 'calliar4', 'calliar6']) {
      const ys = PATHS[k].flat().map(p => p[1]);
      for (let i = 1; i < ys.length; i++) expect(ys[i], k).toBeLessThanOrEqual(ys[i - 1] + 1e-12);
    }
    // down 1, then a climb of 2 flipped to a fall of 2, set back into the range 1…−1
    const p = downward([[[1, 0], [0, -1], [-1, 1]]]); // prettier-ignore
    p[0].map(q => q[1]).forEach((y, i) => expect(y).toBeCloseTo([1, 1 / 3, -1][i], 9));
  });
});

describe('roundels on fitted lanes', () => {
  const th = thuluth(ROUNDEL_PEN);
  const r = composeRoundel(th, 'اللهم صل على محمد وآل محمد', { elongate: true, cross: true, kern: true, fillTarget: 0.5, tries: 2, iters: 3000, seed: 29, lanes: { deg: 180 } })[0]; // prettier-ignore
  it('fit two to four lanes', () => {
    expect(r.lanes!.n).toBeGreaterThanOrEqual(2);
    expect(r.lanes!.n).toBeLessThanOrEqual(4);
  });
  it('read from the top down: no word climbs back above the one before', () => {
    for (let w = 0; w + 1 < r.wp.length; w++) expect(r.wp[w + 1].y).toBeLessThan(r.wp[w].y + 1.5);
    expect(r.wp.at(-1)!.y).toBeLessThan(r.wp[0].y - 10);
  });
  it('and across: a later word on the same level lies to the left', () => {
    const words: number[][] = [];
    r.groups.forEach((g, i) => (words[g.word] ??= []).push(i));
    // judged by where each word starts (its first letter) against where the earlier one ends
    const end = words.map(gs => Math.min(...gs.map(i => r.st[i].x + r.shapes[i].x0))),
      start = words.map(gs => r.st[gs[0]].x + headOf(r.shapes[gs[0]]).x);
    for (let a = 0; a < words.length; a++)
      for (let b = a + 1; b < words.length; b++)
        if (Math.abs(r.wp[b].y - r.wp[a].y) < 2) expect(start[b], `${a} ${b}`).toBeLessThan(end[a] + 2.5);
  });
});

describe('girift', () => {
  it('seeks stems through horizontals, so words interpenetrate more', () => {
    const th = thuluth(ROUNDEL_PEN),
      run = (girift?: number) => composeRoundel(th, 'بسم الله الرحمن الرحيم', { elongate: true, cross: true, merge: true, fillTarget: 0.5, tries: 2, iters: 4500, seed: 11, girift })[0]; // prettier-ignore
    const plain = run(),
      knot = run(0.12);
    // crossings earn their keep (overlap below nothing), and the text draws in tighter
    expect(knot.overlap).toBeLessThan(0);
    expect(knot.disc.r).toBeLessThan(plain.disc.r);
  });
});

describe('paths, second generation', () => {
  it('lay a staircase of level rows, each shifted left of the one above', () => {
    const S = stairs(3);
    S.forEach(row => expect(row[0][1]).toBe(row[1][1]));
    for (let i = 1; i < S.length; i++) {
      expect(S[i][0][1]).toBeLessThan(S[i - 1][0][1]);
      expect((S[i][0][0] + S[i][1][0]) / 2).toBeLessThan((S[i - 1][0][0] + S[i - 1][1][0]) / 2);
    }
  });
  it('offer every traced master route, each reading downward', () => {
    const routes = Object.keys(PATHS).filter(k => k.startsWith('route:'));
    expect(routes).toHaveLength(64);
    for (const k of routes) {
      const ys = PATHS[k].flat().map(p => p[1]);
      for (let i = 1; i < ys.length; i++) expect(ys[i], k).toBeLessThanOrEqual(ys[i - 1] + 1e-12);
    }
  });
  it('fit the path to the text: auto tries each family and keeps the best finished', () => {
    const th = thuluth(ROUNDEL_PEN),
      b = buildRoundel(th, { text: 'اللهم صل على محمد', compose: { elongate: true, cross: true, tries: 1, iters: 800, path: 'auto' }, judge: 1 })!; // prettier-ignore
    expect(AUTO_PATHS).toContain(b.path);
    // one word has no path to fit
    expect(buildRoundel(th, { text: 'علي', compose: { tries: 1, iters: 300, path: 'auto' } })!.path).toBeUndefined();
  }, 300_000);
});

describe('a drawn path', () => {
  it('is simplified, normalised to the field with y up, and keeps its strokes in drawing order', () => {
    const wobble = Array.from({ length: 30 }, (_, i) => [200 - i * 6, 50 + (i % 2) * 0.5] as [number, number]),
      p = toReadingPath([wobble, [[190, 150], [20, 150]], [[5, 5], [6, 6]]], 220); // prettier-ignore
    expect(p).toHaveLength(2); // the dot is dropped
    expect(p[0].length).toBeLessThanOrEqual(3);
    expect(p[0][0][0]).toBeGreaterThan(p[0].at(-1)![0]); // drawn right to left
    expect(p[0][0][1]).toBeGreaterThan(p[1][0][1]); // the first stroke above the second
    expect(Math.abs(p[1][0][1] - (1 - 300 / 220))).toBeLessThan(1e-3);
  });
});
