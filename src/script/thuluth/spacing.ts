// Ink spacing on a straight line (ThuluthStyle.pieceGap, wordSpace): a piece of writing seen from its two sides, and
// how far one may slide towards another on the same baseline before less than a set clearance is left between their
// inks. The roundel composer sets the pieces of a word this way (roundel/compose.ts innerGap); this is the same
// measure for the line engine (engine.ts setLine) and the strip adapter (adapter.ts layout).
import type { Poly } from './types';

/** Two tall stems that face each other across a break in a word (the alif and the lam of ال) keep this many times the
 *  clearance asked: two heavy uprights as near as a tail and a head read as one block. */
export const STEM_SPACE = 2;
/** The height of a band (pen units). */
const BAND = 0.1;

/** Ink seen from the left and from the right: in bands BAND high (band k holds the heights from (k0 + k) * BAND up),
 *  the least and the greatest x of the ink (±Infinity where a band has none); and its extent. */
export interface Sides {
  k0: number;
  lo: Float64Array;
  hi: Float64Array;
  x0: number;
  x1: number;
}
/** The sides of ink given as polygons (the pen's quads, the dots), moved by dx. */
export function sidesOf(polys: readonly Poly[], dx = 0): Sides {
  let y0 = Infinity,
    y1 = -Infinity,
    x0 = Infinity,
    x1 = -Infinity;
  for (const q of polys)
    for (const [x, y] of q) {
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  if (y0 > y1) return { k0: 0, lo: new Float64Array(0), hi: new Float64Array(0), x0: 0, x1: 0 };
  const k0 = Math.floor(y0 / BAND) - 1,
    n = Math.ceil(y1 / BAND) + 2 - k0,
    lo = new Float64Array(n).fill(Infinity),
    hi = new Float64Array(n).fill(-Infinity);
  // (an outline's extremes in a band lie on its edges: each edge walked in steps well under a band)
  for (const q of polys)
    for (let i = 0; i < q.length; i++) {
      const [ax, ay] = q[i],
        [bx, by] = q[(i + 1) % q.length],
        m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (BAND * 0.4)));
      for (let t = 0; t <= m; t++) {
        const x = ax + ((bx - ax) * t) / m + dx,
          k = Math.floor((ay + ((by - ay) * t) / m) / BAND) - k0;
        if (k < 0 || k >= n) continue;
        if (x < lo[k]) lo[k] = x;
        if (x > hi[k]) hi[k] = x;
      }
    }
  return { k0, lo, hi, x0: x0 + dx, x1: x1 + dx };
}

/** How far to the right ink B, lying to the left of A on the same baseline, can move before less than `c` is left
 *  between the two (pen units; Infinity when it could pass A by): the first place where any of B's ink seen from the
 *  right comes within c of any of A's seen from the left. Heights are taken band by band, two bands counted a band
 *  nearer than they are, so it errs by at most that on the side of more space. */
function slideRoom(A: Sides, B: Sides, c: number): number {
  const reach = Math.ceil(c / BAND) + 1,
    near = new Float64Array(reach + 1);
  for (let d = 0; d <= reach; d++) {
    const dy = Math.max(0, d - 1) * BAND;
    near[d] = dy < c ? Math.sqrt(c * c - dy * dy) : dy === 0 ? 0 : -1;
  }
  let room = Infinity;
  for (let b = 0; b < B.hi.length; b++) {
    const xb = B.hi[b];
    if (xb === -Infinity) continue;
    const at = b + B.k0 - A.k0;
    for (let a = Math.max(0, at - reach), e = Math.min(A.lo.length - 1, at + reach); a <= e; a++) {
      const w = near[Math.abs(a - at)];
      if (w >= 0 && A.lo[a] - xb - w < room) room = A.lo[a] - xb - w;
    }
  }
  return room;
}

/** slideRoom, kept for each pair of sides and clearance (a pair is measured once however often it is set). */
export function slideRooms() {
  const kept = new Map<number, WeakMap<Sides, WeakMap<Sides, number>>>();
  return (A: Sides, B: Sides, c: number): number => {
    let forC = kept.get(c);
    if (!forC) {
      if (kept.size > 64) kept.clear();
      kept.set(c, (forC = new WeakMap()));
    }
    let forA = forC.get(A);
    if (!forA) forC.set(A, (forA = new WeakMap()));
    let v = forA.get(B);
    if (v === undefined) forA.set(B, (v = slideRoom(A, B, c)));
    return v;
  };
}
