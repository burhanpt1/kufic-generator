// The star field written with a whole surah: the pattern's lines, in reading order (rows from the top, right to left),
// carry the text word by word at the largest size at which all of it fits once on the lines left visible; the
// remaining lines are finished in the field's own word, so every star stays whole.
import type { PlacedItem } from '../compose/placed';
import { patternSegments, stripOnSegment, WORD_LINE } from '../compose/patternText';
import { inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import type { PatternSpec } from '../model/schema';
import type { CellStrip } from '../script/types';
import type { Writer } from './radial';

const inkRows = (st: CellStrip): [number, number] => {
  let lo = st.Hb,
    hi = -1;
  for (let y = 0; y < st.Hb; y++)
    for (let x = 0; x < st.W; x++)
      if (st.data[y * st.W + x]) {
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
        break;
      }
  return [lo, hi];
};

export interface SurahField {
  items: PlacedItem[];
  /** Letter scale the surah was written at, and as a multiple of the field word's. */
  s: number;
  factor: number;
  /** Lines carrying the surah, and lines finished in the field word. */
  surahLines: number;
  /** The words as written, line after line in reading order (to check nothing is dropped or repeated). */
  words: string[];
  fillLines: number;
}

/** Write `words` (in order) along the pattern's visible lines; null if they don't fit even at the field word's size. */
export function surahField(
  w: Writer,
  words: string[],
  fillWord: string,
  pattern: PatternSpec,
  clip: Pt[],
  c: Pt,
  radius: number,
  hidden: Pt[][],
  sid: number,
  ring: number,
  maxFactor = 1,
): SurahField | null {
  const a = pattern.scale,
    isHidden = (p: Pt) => hidden.some(H => inside(H, p[0], p[1]));
  // visible segments in reading order: rows from the top, right to left within a row
  const segs0 = patternSegments(pattern, clip, c, radius);
  // each end of a line stops short of whatever it meets there (a star's point, or a line passing over) by as much as
  // the angle needs for the two bands of letters (h tall) to stay clear of each other
  const h = WORD_LINE * a * 1.25,
    dir = (P: Pt, Q: Pt): Pt => {
      const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
      return [(Q[0] - P[0]) / L, (Q[1] - P[1]) / L];
    },
    near = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-3,
    onSeg = (E: Pt, [A, B]: [Pt, Pt]) => {
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]),
        t = ((E[0] - A[0]) * (B[0] - A[0]) + (E[1] - A[1]) * (B[1] - A[1])) / (L * L),
        X: Pt = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
      return t > 1e-4 && t < 1 - 1e-4 && near(E, X);
    },
    clearance = (E: Pt, out: Pt, self: number) => {
      let d = 0.35 * WORD_LINE * a;
      segs0.forEach((sg, k) => {
        if (k === self) return;
        const [A, B] = sg;
        if (near(E, A) || near(E, B)) {
          // two lines leaving the same point at angle θ: clear at (h/2)·cot(θ/2)
          const o = near(E, A) ? dir(A, B) : dir(B, A),
            th = Math.acos(Math.max(-1, Math.min(1, out[0] * o[0] + out[1] * o[1])));
          if (th > 1e-3) d = Math.max(d, h / 2 / Math.tan(th / 2) + 0.15 * h);
        } else if (onSeg(E, sg)) {
          // a line passing through: clear at (h/2)(1/sinθ + 1/tanθ)
          const o = dir(A, B),
            c0 = Math.abs(out[0] * o[0] + out[1] * o[1]),
            th = Math.acos(Math.min(1, c0));
          if (th > 1e-3) d = Math.max(d, (h / 2) * (1 / Math.sin(th) + 1 / Math.tan(th)) + 0.15 * h);
        }
      });
      return d;
    },
    gaps = segs0.map(([P, Q], k) => [clearance(P, dir(P, Q), k), clearance(Q, dir(Q, P), k)]),
    trimEnds = (P: Pt, Q: Pt): [Pt, Pt] | null => {
      const k = segs0.findIndex(([A, B]) => A === P && B === Q),
        [g0, g1] = gaps[k],
        L = Math.hypot(Q[0] - P[0], Q[1] - P[1]),
        u = dir(P, Q);
      if (L - g0 - g1 <= 0) return null;
      return [
        [P[0] + u[0] * g0, P[1] + u[1] * g0],
        [Q[0] - u[0] * g1, Q[1] - u[1] * g1],
      ];
    };
  const segs = segs0
    .filter(([P, Q]) => {
      const m: Pt = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
      return !isHidden(P) && !isHidden(Q) && !isHidden(m);
    })
    .map(([P, Q]) => trimEnds(P, Q))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map(([P, Q]) => ({ P, Q, L: Math.hypot(Q[0] - P[0], Q[1] - P[1]), mx: (P[0] + Q[0]) / 2, my: (P[1] + Q[1]) / 2 }));
  const y0 = Math.min(...segs.map(q => q.my)),
    row = (q: (typeof segs)[number]) => Math.floor((q.my - y0) / (a / 2));
  segs.sort((p, q) => row(p) - row(q) || q.mx - p.mx);
  // one letter size for the surah and the field word, set so the tallest letters (alif, lam) stay within the line's
  // width: taller, they collide where lines cross
  const fill = w.strip(fillWord)!,
    [flo, fhi] = inkRows(fill),
    ref = w.strip('الله نور')!,
    [rlo, rhi] = inkRows(ref),
    s0 = (WORD_LINE * a * 1.25) / (rhi - rlo + 1),
    // the surah's strips share one band position, so their baselines line up along a line
    midS = (rlo + rhi + 1) / 2,
    midF = (flo + fhi + 1) / 2,
    wordW = new Map<string, number>(),
    widthOf = (x: string) => {
      if (!wordW.has(x)) wordW.set(x, w.strip(x)?.W ?? Infinity);
      return wordW.get(x)!;
    };
  // greedy fill at scale s: how many words each segment takes (or null if the text runs out of lines)
  const plan = (s: number) => {
    const takes: number[] = [];
    let i = 0;
    for (const q of segs) {
      if (i >= words.length) break;
      const room = q.L / s;
      // a line's natural width is its words' widths plus a two-cell gap between each (exact for this engine)
      let n = 0,
        width = 0;
      while (i + n < words.length) {
        const add = (n ? 2 : 0) + widthOf(words[i + n]);
        if (width + add > room) break;
        width += add;
        n++;
      }
      takes.push(n);
      i += n;
    }
    return i >= words.length ? takes : null;
  };
  let best: { s: number; takes: number[] } | null = null;
  // letters no larger than the field word's: bigger, they collide where lines cross and the stars blur (tried 1.8×)
  for (let f = 1; f <= maxFactor + 1e-9; f += 0.05) {
    const t = plan(s0 * f);
    if (!t) break;
    best = { s: s0 * f, takes: t };
  }
  if (!best) return null;
  const items: PlacedItem[] = [],
    written: string[] = [];
  let i = 0,
    used = 0;
  best.takes.forEach((n, k) => {
    if (!n) return;
    const st = w.strip(words.slice(i, i + n).join(' '));
    if (st) written.push(...words.slice(i, i + n));
    if (st) items.push(stripOnSegment(segs[k].P, segs[k].Q, st, best!.s, midS, sid, ring));
    i += n;
    used = k + 1;
  });
  if (i < words.length) return null;
  // the rest of the lines in the field word, at its own size
  const unit = fill.W + 2;
  let fillLines = 0;
  for (const q of segs.filter((_, k) => k >= used || !best!.takes[k])) {
    const k = Math.floor(q.L / s0 / unit + 2 / unit);
    if (k < 1) continue;
    const st = w.strip(Array(k).fill(fillWord).join(' '));
    if (!st || st.W * s0 > q.L + 1e-6) continue;
    items.push(stripOnSegment(q.P, q.Q, st, s0, midF, sid, ring));
    fillLines++;
  }
  return { items, s: best.s, factor: best.s / s0, surahLines: used, fillLines, words: written };
}
