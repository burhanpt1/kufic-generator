// Robust polygon offsetting with Clipper2 (replaces the prototype's offsetPoly, which folded over at sharp tips).
import { EndType, JoinType, inflatePathsD } from '@countertype/clipper2-ts';
import { detectCorners } from './corners';
import type { CornerOptions } from './corners';
import { area, dedupe, orientCCW, perimeter } from './poly';
import type { Pt, Ring } from './types';

/** Decimal places Clipper keeps; coordinates are in cells, so this is far below anything drawn. */
const PRECISION = 4;
const MITER_LIMIT = 4;

/** All pieces of the outline offset inward by d (outward if negative), counter-clockwise, largest first. */
export function offsetPolyline(P: Pt[], d: number): Pt[][] {
  if (Math.abs(d) < 1e-12) return [P.slice()];
  const out = inflatePathsD(
    [P.map(([x, y]) => ({ x, y }))],
    -d,
    JoinType.Miter,
    EndType.Polygon,
    MITER_LIMIT,
    PRECISION,
  );
  return out
    .map(path => orientCCW(dedupe(path.map(q => [q.x, q.y] as Pt))))
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
