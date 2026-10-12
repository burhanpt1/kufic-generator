// Text on straps (strapwork and woven lattice), after the owner's review: every strap that can hold words carries
// them (the text repeats round the pattern), straps too short for words get a small ornament instead of standing
// empty, letters sit well inside their strap, and the first strap is marked so the eye knows where to start.
import type { Segs } from '../types';

/** Letters take this share of a strap's width; the rest is clear strap above and below them. */
export const LETTER_FILL = 0.68;
/** Letter scale for a strap of half-width `half`, letters `Hb` cells tall. */
export const strapScale = (half: number, Hb: number) => (2 * half * LETTER_FILL) / Hb;
/** Cells kept free at the start of the first strap for the start mark. */
export const markCells = (half: number, s: number) => Math.ceil((1.8 * half) / s);

export interface TextMode {
  mode: 'words' | 'breaks';
  segs: Segs;
  /** Natural width of one pass of the text, in cells. */
  total: number;
}
export interface StrapFill {
  mode: 'words' | 'breaks';
  /** Indices (into the capacities given) of the straps that carry text, in reading order, with their groups. */
  used: number[];
  groups: Segs[];
  /** Whole passes of the text. */
  rep: number;
  score: number;
}

/** Pour the text into straps of the given capacities (cells, in reading order): each strap takes as many of the
 *  next segments as fit, and the text starts over when it runs out, so every strap carries words. With `once` the
 *  text goes round one time and later straps stay free. A strap too short for the next segment is skipped (it gets
 *  ornament). Linear in the text poured, so it stays fast for long patterns. */
export function fillStraps(modes: TextMode[], caps: number[], once: boolean): StrapFill | null {
  let best: StrapFill | null = null;
  for (const m of modes) {
    const n = m.segs.length;
    if (!n) continue;
    const wg = m.segs.wg ?? 0,
      used: number[] = [],
      groups: Segs[] = [];
    let k = 0,
      cost = 0;
    for (let i = 0; i < caps.length; i++) {
      if (once && k >= n) break;
      const c = caps[i],
        g: Segs = [];
      let w = 0;
      g.wg = wg;
      while (!(once && k >= n)) {
        const seg = m.segs[k % n],
          gap = g.length ? (g[g.length - 1].endsWord ? wg : 1) : 0;
        if (w + gap + seg.minW > c) break;
        g.push({ ...seg, rep: Math.floor(k / n), endsWord: k % n === n - 1 ? true : seg.endsWord });
        w += gap + seg.minW;
        k++;
      }
      if (!g.length) continue;
      used.push(i);
      groups.push(g);
      const sl = (c - w) / c;
      // stretching is cheap up to a fifth of the strap; breaking a word across straps costs a little
      cost += sl * sl + (g[g.length - 1].endsWord ? 0 : 0.3);
    }
    if (!used.length || k < n) continue; // the whole text at least once
    const score = cost / used.length + (m.mode === 'breaks' ? 0.12 : 0);
    if (!best || score < best.score) best = { mode: m.mode, used, groups, rep: Math.ceil(k / n), score };
    if (m.mode === 'words' && best) break; // whole words worked
  }
  return best;
}
