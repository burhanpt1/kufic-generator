// Sharp-corner detection on dense polylines. A point is a corner when the direction change across an arc-length
// window around it exceeds a threshold and is the largest within that window, so it works the same for polygons
// (few vertices) and for densely sampled curves, and survives the extra points offsetting adds.
import { dist, perimeter } from './poly';
import type { Corner, Pt } from './types';

export interface CornerOptions {
  /** Minimum direction change, radians. Default 0.35 (20°): every vertex of a regular 12-gon counts, a dense circle doesn't. */
  threshold?: number;
  /** Half-width of the arc-length window. Default 1% of the perimeter. */
  window?: number;
}

const MAX_CLEARANCE = 3;

/** Point at arc length s along a closed polyline with cumulative lengths cum (cum[n] = perimeter). */
function pointAt(P: Pt[], cum: number[], s: number): Pt {
  const L = cum[cum.length - 1];
  s = ((s % L) + L) % L;
  let lo = 0,
    hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const a = P[lo % P.length],
    b = P[hi % P.length],
    f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** Turn and geometry at point i, measured over ±w of arc length. */
export function cornerAt(P: Pt[], cum: number[], i: number, w: number) {
  const p = P[i],
    a = pointAt(P, cum, cum[i] - w),
    b = pointAt(P, cum, cum[i] + w);
  const l1 = dist(a, p) || 1,
    l2 = dist(p, b) || 1;
  const t1: Pt = [(p[0] - a[0]) / l1, (p[1] - a[1]) / l1],
    t2: Pt = [(b[0] - p[0]) / l2, (b[1] - p[1]) / l2];
  const cross = t1[0] * t2[1] - t1[1] * t2[0],
    dot = t1[0] * t2[0] + t1[1] * t2[1],
    turn = Math.atan2(cross, dot);
  // counter-clockwise on screen: a convex corner turns with negative cross product
  const convex = turn < 0,
    interior = convex ? Math.PI - Math.abs(turn) : Math.PI + Math.abs(turn);
  const n1: Pt = [t1[1], -t1[0]],
    n2: Pt = [t2[1], -t2[0]];
  let bx = n1[0] + n2[0],
    by = n1[1] + n2[1];
  const bl = Math.hypot(bx, by);
  if (bl < 1e-9) [bx, by] = n1;
  else {
    bx /= bl;
    by /= bl;
  }
  const clearance = Math.min(MAX_CLEARANCE, Math.abs(1 / Math.tan(interior / 2)));
  return { turn, convex, interior, bisector: [bx, by] as Pt, clearance };
}

export function cumulative(P: Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i <= P.length; i++) cum.push(cum[i - 1] + dist(P[i - 1], P[i % P.length]));
  return cum;
}

/** Corners of a closed polyline (counter-clockwise on screen), in index order. */
export function detectCorners(P: Pt[], opts: CornerOptions = {}): Corner[] {
  const n = P.length;
  if (n < 3) return [];
  const threshold = opts.threshold ?? 0.35,
    w = opts.window ?? perimeter(P) * 0.01,
    cum = cumulative(P),
    L = cum[n];
  const info = P.map((_, i) => cornerAt(P, cum, i, w)),
    mag = info.map(c => Math.abs(c.turn));
  const out: Corner[] = [];
  for (let i = 0; i < n; i++) {
    if (mag[i] < threshold) continue;
    // non-maximum suppression within the window (ties go to the earlier point)
    let best = true;
    for (let k = 1; k < n && best; k++) {
      const j = (i + k) % n,
        dj = Math.min(Math.abs(cum[j] - cum[i]), L - Math.abs(cum[j] - cum[i]));
      if (dj > w) break;
      if (mag[j] > mag[i]) best = false;
    }
    for (let k = 1; k < n && best; k++) {
      const j = (i - k + n) % n,
        dj = Math.min(Math.abs(cum[j] - cum[i]), L - Math.abs(cum[j] - cum[i]));
      if (dj > w) break;
      if (mag[j] >= mag[i]) best = false;
    }
    if (!best) continue;
    const c = info[i];
    out.push({
      index: i,
      p: P[i],
      interior: c.interior,
      convex: c.convex,
      bisector: c.bisector,
      clearance: c.clearance,
    });
  }
  return out;
}
