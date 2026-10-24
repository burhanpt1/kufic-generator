// The pen (lab engine3.js): strokes are Catmull-Rom curves through the skeleton points; a broad nib, a line segment of
// width `nib` at angle `ang`, is dragged along each, and the quadrilaterals it sweeps between samples are the ink. A
// second, thin pass at right angles keeps every stroke at least `floor` of the nib thick.
import type { Poly, Sample, SkelPt } from './types';

/** Sample a skeleton: Catmull-Rom with tension `tension` (0.5 = standard); a point with corner = 1 starts a new
 *  smooth piece. `per` samples per span. */
export function sampleStroke(pts: readonly SkelPt[], tension = 0.5, per = 14): Sample[] {
  const pieces: SkelPt[][] = [];
  let cur: SkelPt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    cur.push(pts[i]);
    if (pts[i][3] && i < pts.length - 1) {
      pieces.push(cur);
      cur = [pts[i]];
    }
  }
  pieces.push(cur);
  const out: Sample[] = [];
  pieces.forEach((P, pi) => {
    const n = P.length;
    if (n === 1) {
      out.push({ x: P[0][0], y: P[0][1], w: P[0][2] ?? 1 });
      return;
    }
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)],
        p1 = P[i],
        p2 = P[i + 1],
        p3 = P[Math.min(n - 1, i + 2)];
      for (let k = i === 0 && pi > 0 ? 1 : 0; k < per; k++) {
        const t = k / per,
          t2 = t * t,
          t3 = t2 * t;
        const cr = (a: number, b: number, c: number, d: number) => {
          const m1 = tension * (c - a),
            m2 = tension * (d - b);
          return (2 * t3 - 3 * t2 + 1) * b + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * c + (t3 - t2) * m2;
        };
        out.push({
          x: cr(p0[0], p1[0], p2[0], p3[0]),
          y: cr(p0[1], p1[1], p2[1], p3[1]),
          w: (p1[2] ?? 1) + ((p2[2] ?? 1) - (p1[2] ?? 1)) * t,
        });
      }
    }
    const L = P[n - 1];
    out.push({ x: L[0], y: L[1], w: L[2] ?? 1 });
  });
  return out;
}

/** For each sample sampleStroke(pts, ·, per) gives, the index of the skeleton point its span starts from (the last
 *  point for the final sample of each piece): how a sample is traced back to the letter that drew it. */
export function sampleSpans(pts: readonly SkelPt[], per = 14): number[] {
  const out: number[] = [];
  let start = 0;
  const ends: number[] = [];
  for (let i = 1; i < pts.length; i++) if (pts[i][3] && i < pts.length - 1) ends.push(i);
  ends.push(pts.length - 1);
  ends.forEach((end, pi) => {
    if (end === start) {
      out.push(start);
      return;
    }
    for (let i = start; i < end; i++) for (let k = i === start && pi > 0 ? 1 : 0; k < per; k++) out.push(i);
    out.push(end);
    start = end;
  });
  return out;
}

const ccw = (q: Poly): Poly => {
  let ar = 0;
  for (let k = 0; k < 4; k++) {
    const [x1, y1] = q[k],
      [x2, y2] = q[(k + 1) % 4];
    ar += x1 * y2 - x2 * y1;
  }
  return ar < 0 ? q.reverse() : q;
};

/** The nib's quadrilaterals along a sampled stroke (and the minimum-thickness quads, interleaved: each segment gives
 *  one quad, or two when floor > 0). Pen units, y up. */
export function nibPolys(samples: readonly Sample[], nib: number, angDeg: number, floor: number): Poly[] {
  const a = (angDeg * Math.PI) / 180,
    out: Poly[] = [];
  for (let i = 0; i + 1 < samples.length; i++) {
    const p = samples[i],
      q = samples[i + 1],
      wp = p.w,
      wq = q.w;
    const ap = a + (p.rot || 0),
      aq = a + (q.rot || 0),
      hpx = (Math.cos(ap) * nib) / 2,
      hpy = (Math.sin(ap) * nib) / 2,
      hqx = (Math.cos(aq) * nib) / 2,
      hqy = (Math.sin(aq) * nib) / 2;
    out.push(
      ccw([
        [p.x + hpx * wp, p.y + hpy * wp],
        [q.x + hqx * wq, q.y + hqy * wq],
        [q.x - hqx * wq, q.y - hqy * wq],
        [p.x - hpx * wp, p.y - hpy * wp],
      ]),
    );
    if (floor > 0) {
      const dx = q.x - p.x,
        dy = q.y - p.y,
        l = Math.hypot(dx, dy) || 1,
        fx = ((-dy / l) * nib * floor) / 2,
        fy = ((dx / l) * nib * floor) / 2;
      out.push(
        ccw([
          [p.x + fx * wp, p.y + fy * wp],
          [q.x + fx * wq, q.y + fy * wq],
          [q.x - fx * wq, q.y - fy * wq],
          [p.x - fx * wp, p.y - fy * wp],
        ]),
      );
    }
  }
  return out;
}

/** The rhombic dot: one short stroke at right angles to the nib. */
export function dotPolys(x: number, y: number, nib: number, angDeg: number, floor: number, rot = 0): Poly[] {
  const a = ((angDeg + 90) * Math.PI) / 180 + rot,
    L = nib * 0.95;
  const s: Sample[] = [
    { x: x - (Math.cos(a) * L) / 2, y: y - (Math.sin(a) * L) / 2, w: 1, rot },
    { x: x + (Math.cos(a) * L) / 2, y: y + (Math.sin(a) * L) / 2, w: 1, rot },
  ];
  return nibPolys(s, nib, angDeg, floor);
}

/** SVG path data for polygons, each point mapped to the page and rounded to 0.1 (as the lab wrote it). */
export function polyPath(polys: readonly Poly[], X: (x: number) => number, Y: (y: number) => number): string {
  let d = '';
  for (const q of polys) d += 'M' + q.map(([x, y]) => X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join('L') + 'Z';
  return d;
}
