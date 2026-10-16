// The union of a pen's quads: one outline per connected shape (holes, such as a loop's counter, wound the other
// way), so a line is a handful of clean polygons instead of hundreds of overlapping quads.
//
// The quads come in writing order, each overlapping the next, so they are unioned in runs of CHUNK first and the runs
// then unioned together: a sweep over a few dozen quads at a time is several times faster than one over a piece's
// thousand. Each run takes the next run's first quad too, so neighbouring runs overlap instead of meeting on a shared
// edge (rounding would leave slivers along it). Clipper2's C++ (src/kernels/clipper2.ts) does the unions once it has
// loaded; the TypeScript port does the same steps until then.
import { FillRule, simplifyPathsD, unionD } from '@countertype/clipper2-ts';
import type { PathsD } from 'clipper2-wasm/dist/clipper2z';
import { clipper2, fromPathsD, toPathsD } from '../../kernels/clipper2';
import type { Poly } from './types';

const CHUNK = 32;
const PRECISION = 3;

/** Outlines of the union, simplified to within `tolerance` (pen units; 0.02 is a fiftieth of a cell). */
export function outline(polys: readonly Poly[], tolerance = 0.02): Poly[] {
  if (!polys.length) return [];
  const C = clipper2();
  if (C) {
    const runs: PathsD[] = [];
    for (let i = 0; i < polys.length; i += CHUNK) {
      const ps = toPathsD(C, polys.slice(i, i + CHUNK + 1));
      runs.push(C.UnionSelfD(ps, C.FillRule.NonZero, PRECISION));
      ps.delete();
    }
    let u: PathsD;
    if (runs.length === 1) u = runs[0];
    else {
      const all = new C.PathsD();
      for (const r of runs) {
        for (let i = 0, n = r.size(); i < n; i++) {
          const p = r.get(i);
          all.push_back(p);
          p.delete();
        }
        r.delete();
      }
      u = C.UnionSelfD(all, C.FillRule.NonZero, PRECISION);
      all.delete();
    }
    const s = C.SimplifyPathsD(u, tolerance, true);
    u.delete();
    const out = fromPathsD(s);
    s.delete();
    return out;
  }
  const P = (q: readonly (readonly [number, number])[]) => q.map(([x, y]) => ({ x, y }));
  const runs = [];
  for (let i = 0; i < polys.length; i += CHUNK)
    runs.push(unionD(polys.slice(i, i + CHUNK + 1).map(P), [], FillRule.NonZero, PRECISION));
  const u = runs.length === 1 ? runs[0] : unionD(runs.flat(), [], FillRule.NonZero, PRECISION);
  return simplifyPathsD(u, tolerance, true).map(path => path.map(p => [p.x, p.y] as [number, number]));
}
