// Small polyline helpers.
import type { Pt } from './types';

/** Shoelace area, signed: negative for counter-clockwise on screen (y down). */
export function signedArea(P: Pt[]): number {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i],
      [x2, y2] = P[(i + 1) % P.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
export const area = (P: Pt[]) => Math.abs(signedArea(P));

export function perimeter(P: Pt[]): number {
  let l = 0;
  for (let i = 0; i < P.length; i++) l += dist(P[i], P[(i + 1) % P.length]);
  return l;
}
export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Counter-clockwise on screen (negative shoelace area). */
export const orientCCW = (P: Pt[]): Pt[] => (signedArea(P) > 0 ? P.slice().reverse() : P);

export function bounds(P: Pt[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of P) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** Drop consecutive duplicates (and a closing duplicate of the first point). */
export function dedupe(P: Pt[], eps = 1e-9): Pt[] {
  const out: Pt[] = [];
  for (const p of P) if (!out.length || dist(out[out.length - 1], p) > eps) out.push(p);
  while (out.length > 1 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  return out;
}

/** Even-odd point-in-polygon test. */
export function inside(P: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i],
      [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Distance from a point to a segment. */
export function segDist(q: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l2 = dx * dx + dy * dy,
    u = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(q[0] - a[0] - u * dx, q[1] - a[1] - u * dy);
}

/** Do two segments properly cross (touching endpoints excluded)? */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a),
    d2 = o(c, d, b),
    d3 = o(a, b, c),
    d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True if no two non-adjacent edges of the closed polyline cross. O(n²); fine for tests and moderate n. */
export function isSimple(P: Pt[]): boolean {
  const n = P.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false;
    }
  return true;
}

/** Resample a closed polyline at (roughly) even arc-length spacing, keeping the given indices exactly. */
export function resample(P: Pt[], step: number, keep: Set<number> = new Set()): { pts: Pt[]; kept: number[] } {
  const out: Pt[] = [],
    kept: number[] = [],
    n = P.length;
  for (let i = 0; i < n; i++) {
    const a = P[i],
      b = P[(i + 1) % n];
    if (keep.has(i)) kept.push(out.length);
    out.push(a);
    const k = Math.floor(dist(a, b) / step);
    for (let j = 1; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return { pts: out, kept };
}

/** Closed-polyline simplification (Ramer–Douglas–Peucker), keeping points that deviate more than tol. */
export function simplifyClosed(P: Pt[], tol: number): Pt[] {
  if (P.length < 8) return P;
  // split at the point farthest from P[0], simplify both halves as open chains
  let far = 0;
  for (let i = 1; i < P.length; i++) if (dist(P[0], P[i]) > dist(P[0], P[far])) far = i;
  const chain = (Q: Pt[]) => {
    const keep = new Uint8Array(Q.length);
    keep[0] = keep[Q.length - 1] = 1;
    const st: [number, number][] = [[0, Q.length - 1]];
    while (st.length) {
      const [a, b] = st.pop()!;
      let best = -1,
        bd = tol;
      for (let i = a + 1; i < b; i++) {
        const d = segDist(Q[i], Q[a], Q[b]);
        if (d > bd) {
          bd = d;
          best = i;
        }
      }
      if (best >= 0) {
        keep[best] = 1;
        st.push([a, best], [best, b]);
      }
    }
    return Q.filter((_, i) => keep[i]);
  };
  const a = chain(P.slice(0, far + 1)),
    b = chain(P.slice(far).concat([P[0]]));
  return a.concat(b.slice(1, -1));
}
