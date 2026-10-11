// Unit outlines for every Outline kind (COMPOSITION_ENGINE.md §3.2), ported from the lab's outline(), CURVES and
// curveUnit(). Polygons and stars are normalised to edge distance 1 (inradius 1); curves, uploaded paths and point
// lists to a maximum radius of 1. All run counter-clockwise on screen and start at their bottom-most corner.
import { makeRing } from './offset';
import { bounds, dedupe, orientCCW } from './poly';
import { importSvgPath } from './svgpath';
import type { Pt, Ring } from './types';

export type PresetName = 'teardrop' | 'heart' | 'mihrab';
export type Outline =
  | { kind: 'circle' }
  | { kind: 'polygon'; sides: number; rotation?: number }
  | { kind: 'star'; points: number; depth: number }
  | { kind: 'preset'; name: PresetName }
  | { kind: 'svg'; path: string }
  | { kind: 'poly'; points: [number, number][] };

export const CIRCLE_SEGMENTS = 256;

/** Points around a circle of radius r, counter-clockwise on screen, starting at the bottom. */
export function circlePoints(r: number, n = CIRCLE_SEGMENTS, cx = 0, cy = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 - (i * 2 * Math.PI) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** Regular polygon, edge distance 1, first edge along the bottom (left to right). rotation in degrees. */
export function polygonPoints(sides: number, rotation = 0): Pt[] {
  const R = 1 / Math.cos(Math.PI / sides),
    rot = (rotation * Math.PI) / 180,
    V: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = Math.PI / 2 + Math.PI / sides - (i * 2 * Math.PI) / sides + rot;
    V.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  return V;
}

/** Star with the given points and valley depth (inner/outer radius), edge distance 1, starting at the bottom tip. */
export function starPoints(points: number, depth: number): Pt[] {
  const V: Pt[] = [];
  for (let i = 0; i < points; i++) {
    const a = Math.PI / 2 - (i * 2 * Math.PI) / points;
    V.push([Math.cos(a), Math.sin(a)]);
    const b = a - Math.PI / points;
    V.push([depth * Math.cos(b), depth * Math.sin(b)]);
  }
  const [P, Q] = V,
    dx = Q[0] - P[0],
    dy = Q[1] - P[1],
    d = Math.abs(P[0] * dy - P[1] * dx) / Math.hypot(dx, dy);
  return V.map(([x, y]) => [x / d, y / d]);
}

// ---- curved presets (lab CURVES) ----
function teardrop(): Pt[] {
  const P: Pt[] = [],
    n = 360;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    P.push([0.95 * Math.sin(t) * Math.pow(Math.sin(t / 2), 1.6), -Math.cos(t)]);
  }
  return P;
}
/** Two circular lobes meeting at a shallow notch, joined to the tip by tangent lines (not the parametric heart,
 *  whose cusps wasted most of the outline). */
function heart(): Pt[] {
  const P: Pt[] = [],
    a = 0.46,
    R = 0.6,
    T = [0, 1.45];
  const tang = (sx: number) => {
    const cx = sx * a,
      dx = T[0] - cx,
      dy = T[1],
      d = Math.hypot(dx, dy),
      base = Math.atan2(dy, dx),
      off = Math.acos(R / d);
    return base - sx * off;
  };
  const tR = tang(1),
    tL = tang(-1),
    cy = -Math.sqrt(R * R - a * a),
    notchR = Math.atan2(cy, -a),
    notchL = Math.atan2(cy, a);
  for (let i = 0; i < 40; i++) {
    const f = i / 40,
      px = a + R * Math.cos(tR),
      py = R * Math.sin(tR);
    P.push([T[0] + (px - T[0]) * f, T[1] + (py - T[1]) * f]);
  }
  const a0 = tR;
  let a1 = notchR;
  while (a1 > a0) a1 -= 2 * Math.PI;
  for (let i = 0; i < 140; i++) {
    const th = a0 + ((a1 - a0) * i) / 140;
    P.push([a + R * Math.cos(th), R * Math.sin(th)]);
  }
  const b0 = notchL;
  let b1 = tL;
  while (b1 > b0) b1 -= 2 * Math.PI;
  for (let i = 0; i < 140; i++) {
    const th = b0 + ((b1 - b0) * i) / 140;
    P.push([-a + R * Math.cos(th), R * Math.sin(th)]);
  }
  for (let i = 0; i < 40; i++) {
    const f = i / 40,
      px = -a + R * Math.cos(tL),
      py = R * Math.sin(tL);
    P.push([px + (T[0] - px) * f, py + (T[1] - py) * f]);
  }
  return P;
}
/** Pointed (two-centred) arch on straight sides over a flat base. */
function mihrab(): Pt[] {
  const P: Pt[] = [],
    a = 0.62,
    ys = -0.1,
    R = 2 * a;
  for (let i = 0; i < 40; i++) P.push([-a + (2 * a * i) / 40, 1]);
  for (let i = 0; i < 50; i++) P.push([a, 1 - ((1 - ys) * i) / 50]);
  for (let i = 0; i < 70; i++) {
    const th = (-(Math.PI / 3) * i) / 70;
    P.push([-a + R * Math.cos(th), ys + R * Math.sin(th)]);
  }
  for (let i = 0; i < 70; i++) {
    const th = Math.PI + Math.PI / 3 - ((Math.PI / 3) * i) / 70;
    P.push([a + R * Math.cos(th), ys + R * Math.sin(th)]);
  }
  for (let i = 0; i < 50; i++) P.push([-a, ys + ((1 - ys) * i) / 50]);
  return P;
}
export const PRESETS: Record<PresetName, () => Pt[]> = { teardrop, heart, mihrab };

/** Centre on the bounding box, scale to max radius 1, orient counter-clockwise, start at the bottom-most corner. */
export function normaliseFree(P: Pt[]): Ring {
  P = dedupe(P);
  const b = bounds(P),
    cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2;
  P = P.map(([x, y]) => [x - cx, y - cy]);
  const r = Math.max(...P.map(([x, y]) => Math.hypot(x, y))) || 1;
  P = orientCCW(P.map(([x, y]) => [x / r, y / r] as Pt));
  return startAtBottomCorner(makeRing(P));
}

/** Rotate the point order so the ring starts at its bottom-most corner (or bottom-most point). */
export function startAtBottomCorner(ring: Ring): Ring {
  const P = ring.pts;
  const cand = ring.corners.length ? ring.corners.map(c => c.index) : P.map((_, i) => i);
  let s = cand[0];
  for (const i of cand)
    if (P[i][1] > P[s][1] + 1e-9 || (Math.abs(P[i][1] - P[s][1]) <= 1e-9 && P[i][0] < P[s][0])) s = i;
  if (!s) return ring;
  const n = P.length,
    pts = P.slice(s).concat(P.slice(0, s));
  return {
    ...ring,
    pts,
    corners: ring.corners.map(c => ({ ...c, index: (c.index - s + n) % n })).sort((a, b) => a.index - b.index),
  };
}

/** The unit ring for an outline. */
export function unitRing(o: Outline): Ring {
  switch (o.kind) {
    case 'circle':
      return makeRing(circlePoints(1));
    case 'polygon':
      return makeRing(polygonPoints(o.sides, o.rotation));
    case 'star':
      return makeRing(starPoints(o.points, o.depth));
    case 'preset':
      return normaliseFree(PRESETS[o.name]());
    case 'svg':
      return normaliseFree(importSvgPath(o.path));
    case 'poly':
      return normaliseFree(o.points.map(([x, y]) => [x, y] as Pt));
  }
}
