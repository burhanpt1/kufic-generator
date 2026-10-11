// Runs: the smooth stretches of a ring between corners, with arc-length parametrisation and frames.
import { dist } from './poly';
import type { Frame, Pt, Ring, Run } from './types';

function makeRun(pts: Pt[], start: Run['start'], end: Run['end']): Run {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, cum, len: cum[cum.length - 1], start, end };
}

/**
 * Split a ring into runs, counter-clockwise (the ring's own order). The first run is the one starting at the
 * bottom-most corner; when two corners tie (a polygon's flat bottom), the run lying lower wins, so a polygon's
 * first run is its bottom edge. A ring without corners is one run starting at its bottom-most point.
 */
export function runsOf(ring: Ring): Run[] {
  const P = ring.pts,
    n = P.length;
  if (!ring.corners.length) {
    let s = 0;
    for (let i = 1; i < n; i++)
      if (P[i][1] > P[s][1] + 1e-9 || (Math.abs(P[i][1] - P[s][1]) <= 1e-9 && P[i][0] < P[s][0])) s = i;
    const pts: Pt[] = [];
    for (let k = 0; k <= n; k++) pts.push(P[(s + k) % n]);
    return [makeRun(pts, null, null)];
  }
  const cs = ring.corners,
    runs: Run[] = [];
  for (let r = 0; r < cs.length; r++) {
    const a = cs[r],
      b = cs[(r + 1) % cs.length],
      pts: Pt[] = [];
    let i = a.index;
    do {
      pts.push(P[i]);
      i = (i + 1) % n;
    } while (i !== b.index);
    pts.push(P[b.index]);
    runs.push(makeRun(pts, a, b));
  }
  const tol = 1e-6 * Math.max(1, ring.perimeter);
  let first = 0;
  const mid = (rn: Run) => frameAt(rn, rn.len / 2).p[1];
  for (let r = 1; r < runs.length; r++) {
    const ya = runs[r].start!.p[1],
      yb = runs[first].start!.p[1];
    if (ya > yb + tol || (Math.abs(ya - yb) <= tol && mid(runs[r]) > mid(runs[first]) + tol)) first = r;
  }
  return runs.slice(first).concat(runs.slice(0, first));
}

/** Position, tangent and inward normal at arc length a along a run (clamped to the run). */
export function frameAt(run: Run, a: number): Frame {
  const { pts, cum } = run;
  a = Math.max(0, Math.min(run.len, a));
  let lo = 0,
    hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= a) lo = mid;
    else hi = mid;
  }
  const f = (a - cum[lo]) / (cum[hi] - cum[lo] || 1),
    p: Pt = [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
  // tangent from the neighbouring points, so it turns smoothly along curves
  const j0 = Math.max(0, lo - 1),
    j1 = Math.min(pts.length - 1, hi + 1),
    tx = pts[j1][0] - pts[j0][0],
    ty = pts[j1][1] - pts[j0][1],
    l = Math.hypot(tx, ty) || 1;
  return { p, t: [tx / l, ty / l], n: [ty / l, -tx / l] };
}
