// Robust polygon offsetting with Clipper2 (replaces the prototype's offsetPoly, which folded over at sharp tips).
import { EndType, JoinType, inflatePathsD } from '@countertype/clipper2-ts';
import { clipper2, fromPathsD, toPathsD } from '../kernels/clipper2';
import { detectCorners } from './corners';
import type { CornerOptions } from './corners';
import { area, dedupe, orientCCW, perimeter } from './poly';
import type { Pt, Ring } from './types';

/** Decimal places Clipper keeps; coordinates are in cells, so this is far below anything drawn. */
const PRECISION = 4;
const MITER_LIMIT = 4;

/** All pieces of the outline offset inward by d (outward if negative), counter-clockwise, largest first. */
/** Mitred offset of closed polygons by d (outward if positive): Clipper2's C++ once it has loaded (2–3× faster; the
 *  same shapes, though rounding can move a point by a hair), else its TypeScript port. */
export function inflate(paths: Pt[][], d: number, miterLimit = MITER_LIMIT, precision = PRECISION): Pt[][] {
  const C = clipper2();
  if (C) {
    const ps = toPathsD(C, paths),
      r = C.InflatePathsD(ps, d, C.JoinType.Miter, C.EndType.Polygon, miterLimit, precision, 0);
    ps.delete();
    const out = fromPathsD(r);
    r.delete();
    return out;
  }
  return inflatePathsD(
    paths.map(P => P.map(([x, y]) => ({ x, y }))),
    d,
    JoinType.Miter,
    EndType.Polygon,
    miterLimit,
    precision,
  ).map(path => path.map(q => [q.x, q.y] as Pt));
}

export function offsetPolyline(P: Pt[], d: number): Pt[][] {
  if (Math.abs(d) < 1e-12) return [P.slice()];
  return inflate([P], -d)
    .map(path => orientCCW(dedupe(path)))
    .filter(p => p.length >= 3)
    .sort((a, b) => area(b) - area(a));
}

export function makeRing(pts: Pt[], corners?: CornerOptions): Ring {
  pts = orientCCW(dedupe(pts));
  return { pts, corners: detectCorners(pts, corners), area: area(pts), perimeter: perimeter(pts) };
}

/**
 * The ring inset by d: the largest piece of the offset (an inward offset can split a shape at a narrow neck; the
 * main body is the region that carries on). null when nothing of meaningful size is left.
 */
export function insetRing(ring: Ring, d: number, corners?: CornerOptions): Ring | null {
  const pieces = offsetPolyline(ring.pts, d);
  if (!pieces.length) return null;
  const r = makeRing(pieces[0], corners);
  return r.area > ring.area * 1e-4 ? r : null;
}
