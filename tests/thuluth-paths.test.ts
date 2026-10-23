// Reading paths and fitted lanes for roundels (PORT-PLAN.md §3; lab roundel.js): words placed along a spine in
// reading order, read across and then downward.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { composeRoundel, downward, lanes, pathTargets, PATHS } from '../src/script/thuluth/roundel';

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
    const box = words.map(gs => ({
      x0: Math.min(...gs.map(i => r.st[i].x + r.shapes[i].x0)),
      x1: Math.max(...gs.map(i => r.st[i].x + r.shapes[i].x1)),
    }));
    for (let a = 0; a < words.length; a++)
      for (let b = a + 1; b < words.length; b++)
        if (Math.abs(r.wp[b].y - r.wp[a].y) < 2) expect(box[b].x1, `${a} ${b}`).toBeLessThan(box[a].x0 + 2.5);
  });
});
