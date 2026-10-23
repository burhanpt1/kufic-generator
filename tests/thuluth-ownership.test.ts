// Strokes record their letter: every sample knows which letter drew it, through joins, stacking and redrawing.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { redraw } from '../src/script/thuluth/drawn';
import { sampleSpans, sampleStroke } from '../src/script/thuluth/pen';
import type { SkelPt } from '../src/script/thuluth/types';

describe('stroke ownership', () => {
  it('traces each sample to the skeleton point its span starts from', () => {
    const pts: SkelPt[] = [[0, 0], [1, 1], [2, 0, 1, 1], [3, 1], [4, 0, 1, 1], [5, 2]]; // prettier-ignore
    for (const per of [6, 14]) expect(sampleSpans(pts, per)).toHaveLength(sampleStroke(pts, 0.5, per).length);
    expect(sampleSpans([[0, 0]])).toEqual([0]);
  });
  const th = thuluth(ROUNDEL_PEN);
  it('gives every sample of a word its letter, in writing order, and joins to no letter', () => {
    const b = th.buildStrokes('محمد', { kashida: 3 });
    for (const s of b.strokes) {
      expect(s.own).toHaveLength(s.s.length);
      expect(s.wi).toBe(0);
    }
    const seen = b.strokes.flatMap(s => s.own!).filter(o => o >= 0);
    expect(new Set(seen)).toEqual(new Set([0, 1, 2, 3]));
    expect(b.strokes.some(s => s.own!.includes(-1))).toBe(true); // the kashidas
    const main = b.strokes.reduce((m, s) => (s.s.length > m.s.length ? s : m)),
      order = main.own!.filter(o => o >= 0);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
  });
  it('keeps owners through a stacked join, and a redrawn part belongs to the letter that redraws it', () => {
    const b = th.buildStrokes('لمح', { stacks: { 2: { dx: 1, dy: -4 } } }),
      s = b.strokes.reduce((m, q) => (q.s.length > m.s.length ? q : m));
    expect(s.own).toHaveLength(s.s.length);
    redraw(s, 10, [[0, 0], [-3, -3], [-6, 0]], 2, 0.5); // prettier-ignore
    expect(s.own).toHaveLength(s.s.length);
    expect(s.own!.slice(10).every(o => o === 2)).toBe(true);
  });
});
