// The union of a pen's quads: one outline per connected shape (holes, such as a loop's counter, wound the other
// way), so a line is a handful of clean polygons instead of hundreds of overlapping quads.
import { FillRule, simplifyPathsD, unionD } from '@countertype/clipper2-ts';
import type { Poly } from './types';

/** Outlines of the union, simplified to within `tolerance` (pen units; 0.02 is a fiftieth of a cell). */
export function outline(polys: readonly Poly[], tolerance = 0.02): Poly[] {
  if (!polys.length) return [];
  const u = unionD(
    polys.map(q => q.map(([x, y]) => ({ x, y }))),
    [],
    FillRule.NonZero,
    3,
  );
  return simplifyPathsD(u, tolerance, true).map(path => path.map(p => [p.x, p.y] as [number, number]));
}
