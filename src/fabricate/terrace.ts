// 3D printing with flat levels: a relief whose heights are a few plateaus (the Studio's relief map: ground, patterns,
// bands, letters; or a logo) becomes stacked terraces with vertical walls. Each plateau's outline is traced between
// pixels (marching squares, interpolated), so curves come out smooth instead of stepped, and the triangle count
// follows the outlines, not the area. Outlines of higher plateaus are kept strictly inside lower ones, so the tops,
// walls and bottom share every edge and the solid is closed.
import {
  FillRule,
  JoinType,
  EndType,
  inflatePathsD,
  intersectD,
  simplifyPathsD,
  unionD,
} from '@countertype/clipper2-ts';
import type { PathD, PathsD } from '@countertype/clipper2-ts';
import earcut from 'earcut';
import { clipper2, fromPathsD, toPathsD } from '../kernels/clipper2';
import type { Heightmap, Mesh } from './mesh';

type Ring = [number, number][];
/** Midpoints of a cell's top, right, bottom and left edges, from its top-left corner. */
const MID = [
  [0.5, 0],
  [1, 0.5],
  [0.5, 1],
  [0, 0.5],
];

/** Closed outlines of {v >= t} on a sample grid (outside the grid counts as below), in sample coordinates, all wound
 *  the same way round the inside. */
export function contours(f: ArrayLike<number>, W: number, H: number, t: number): Ring[] {
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= W || j >= H ? -Infinity : f[j * W + i]),
    // crossing points live on grid edges: horizontal edge (i,j)-(i+1,j) or vertical edge (i,j)-(i,j+1)
    hid = (i: number, j: number) => 2 * ((j + 1) * (W + 2) + i + 1),
    vid = (i: number, j: number) => hid(i, j) + 1,
    lerp = (v0: number, v1: number) => (v0 === -Infinity ? 1 : v1 === -Infinity ? 0 : (t - v0) / (v1 - v0)),
    next = new Map<number, number>(),
    pos = new Map<number, [number, number]>();
  for (let j = -1; j < H; j++)
    for (let i = -1; i < W; i++) {
      const tl = at(i, j),
        tr = at(i + 1, j),
        br = at(i + 1, j + 1),
        bl = at(i, j + 1),
        a = tl >= t,
        b = tr >= t,
        c = br >= t,
        d = bl >= t;
      if (a === b && b === c && c === d) continue;
      // edges T, R, B, L with their crossing points (only where the ends differ)
      const E: [number, [number, number]][] = [
        [hid(i, j), [i + lerp(tl, tr), j]],
        [vid(i + 1, j), [i + 1, j + lerp(tr, br)]],
        [hid(i, j + 1), [i + lerp(bl, br), j + 1]],
        [vid(i, j), [i, j + lerp(tl, bl)]],
      ];
      // corners tl, tr, br, bl lie between edges (L,T), (T,R), (R,B), (B,L)
      const corners: [number, number, boolean, number, number][] = [
        [i, j, a, 3, 0],
        [i + 1, j, b, 0, 1],
        [i + 1, j + 1, c, 1, 2],
        [i, j + 1, d, 2, 3],
      ];
      const segment = (cx: number, cy: number, inside: boolean, e1: number, e2: number) => {
        let [p, q] = [E[e1], E[e2]];
        // the inside always on the same hand; judged from the edges' midpoints, since a crossing can sit on a corner
        const [px, py] = MID[e1],
          [qx, qy] = MID[e2],
          cross = (qx - px) * (cy - j - py) - (qy - py) * (cx - i - px);
        if (cross > 0 !== inside) [p, q] = [q, p];
        next.set(p[0], q[0]);
        pos.set(p[0], p[1]);
      };
      if (a === c && b === d) {
        // saddle: the centre decides which pair of opposite corners is cut off
        const centre = (tl + tr + br + bl) / 4 >= t;
        for (const k of corners) if (k[2] !== centre) segment(...k);
      } else {
        // otherwise the line joins the two crossed edges, with any inside corner on the inside
        const crossed = [a !== b, b !== c, c !== d, d !== a].flatMap((x, k) => (x ? [k] : [])),
          [cx, cy] = corners.find(k => k[2])!;
        segment(cx, cy, true, crossed[0], crossed[1]);
      }
    }
  const rings: Ring[] = [],
    seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const r: Ring = [];
    for (let e = start; !seen.has(e); e = next.get(e)!) {
      seen.add(e);
      r.push(pos.get(e)!);
    }
    if (r.length >= 3) rings.push(r);
  }
  return rings;
}

const area = (r: Ring) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
};
const toPaths = (rs: Ring[]): PathsD => rs.map(r => r.map(([x, y]) => ({ x, y })) as PathD);
const toRings = (ps: PathsD): Ring[] =>
  ps.map(p => p.map(q => [q.x, q.y] as [number, number])).filter(r => r.length >= 3);

const insideRing = (r: Ring, x: number, y: number) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i],
      [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** For rings that never cross: how many others contain each one, and the innermost of those (-1 for none). */
function nesting(rings: Ring[]): { depth: number[]; parent: number[] } {
  const box = rings.map(r => {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [x, y] of r) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    return [x0, y0, x1, y1];
  });
  // a coarse grid of buckets, each listing the rings whose box overlaps it
  let X0 = Infinity,
    Y0 = Infinity,
    X1 = -Infinity,
    Y1 = -Infinity;
  for (const [x0, y0, x1, y1] of box)
    [X0, Y0, X1, Y1] = [Math.min(X0, x0), Math.min(Y0, y0), Math.max(X1, x1), Math.max(Y1, y1)];
  const G = Math.max(1, Math.min(128, Math.ceil(Math.sqrt(rings.length)))),
    cw = (X1 - X0) / G || 1,
    ch = (Y1 - Y0) / G || 1,
    cell = (v: number, o: number, s: number) => Math.max(0, Math.min(G - 1, Math.floor((v - o) / s))),
    buckets: number[][] = Array.from({ length: G * G }, () => []);
  box.forEach(([x0, y0, x1, y1], b) => {
    for (let j = cell(y0, Y0, ch); j <= cell(y1, Y0, ch); j++)
      for (let i = cell(x0, X0, cw); i <= cell(x1, X0, cw); i++) buckets[j * G + i].push(b);
  });
  const containers = rings.map((r, a) => {
    // rings never touch, so any vertex will do
    const [x, y] = r[0];
    return buckets[cell(y, Y0, ch) * G + cell(x, X0, cw)].filter(b => {
      if (b === a) return false;
      const [x0, y0, x1, y1] = box[b];
      return x >= x0 && x <= x1 && y >= y0 && y <= y1 && insideRing(rings[b], x, y);
    });
  });
  const depth = containers.map(c => c.length),
    parent = containers.map(c => c.reduce((best, b) => (best < 0 || depth[b] > depth[best] ? b : best), -1));
  return { depth, parent };
}

export interface TerraceOptions {
  widthMM?: number;
  baseMM?: number;
  reliefMM?: number;
  /** Plateau heights (0..1, ascending), or how many evenly spaced ones; 0 or omitted finds them in the image. */
  levels?: number[] | number;
  /** Largest deviation of the simplified outlines from the traced ones, in millimetres. */
  toleranceMM?: number;
}

/** The plateaus of a heightmap: the most common heights among the solid samples (at most eight). */
export function findLevels(hm: Heightmap, max = 8): number[] {
  const hist = new Float64Array(256);
  let total = 0;
  for (let i = 0; i < hm.h.length; i++)
    if (hm.mask[i]) {
      hist[Math.max(0, Math.min(255, Math.round(hm.h[i] * 255)))]++;
      total++;
    }
  const peaks: [number, number][] = [];
  for (let v = 0; v < 256; v++) {
    if (hist[v] < total * 0.003) continue;
    let top = true;
    for (let u = Math.max(0, v - 6); u <= Math.min(255, v + 6) && top; u++)
      if (hist[u] > hist[v] || (hist[u] === hist[v] && u < v)) top = false;
    if (top) peaks.push([hist[v], v / 255]);
  }
  const ls = peaks
    .sort((p, q) => q[0] - p[0])
    .slice(0, max)
    .map(p => p[1])
    .sort((p, q) => p - q);
  return ls.length ? ls : [1];
}

/** Heightmap → stacked flat terraces with smooth outlines. */
export function terraceMesh(hm: Heightmap, o: TerraceOptions = {}): Mesh & { failedFaces: number } {
  const { width: W, height: H } = hm,
    widthMM = o.widthMM ?? 120,
    mmpp = widthMM / W,
    base = o.baseMM ?? 2,
    relief = Math.max(1e-3, o.reliefMM ?? 3),
    tol = (o.toleranceMM ?? 0.03) / mmpp,
    gap = 0.02,
    levels =
      Array.isArray(o.levels) && o.levels.length
        ? [...o.levels].sort((p, q) => p - q)
        : typeof o.levels === 'number' && o.levels >= 2
          ? Array.from({ length: o.levels }, (_, k) => k / ((o.levels as number) - 1))
          : findLevels(hm);
  const solid = hm.solid ?? Float32Array.from(hm.mask, m => m - 0.5);

  // regions: R0 is the whole solid, Rk where the height is past halfway from level k-1 to level k, each kept a hair
  // inside the one below so outlines never touch, and pulled in a hair itself, which parts rings that touch at a point
  const clean = (rs: Ring[]) =>
    inflatePathsD(
      unionD(simplifyPathsD(toPaths(rs), tol, true), FillRule.EvenOdd),
      -gap,
      JoinType.Miter,
      EndType.Polygon,
      2,
      4,
    );
  const regions: { rings: Ring[]; z: number }[] = [];
  let below = clean(contours(solid, W, H, 0));
  regions.push({ rings: toRings(below), z: base + relief * levels[0] });
  for (let k = 1; k < levels.length; k++) {
    const t = (levels[k - 1] + levels[k]) / 2,
      shrunk = inflatePathsD(below, -gap, JoinType.Miter, EndType.Polygon, 2, 4),
      rk = intersectD(clean(contours(hm.h, W, H, t)), shrunk, FillRule.NonZero, 4);
    if (!rk.length) break;
    regions.push({ rings: toRings(rk), z: base + relief * levels[k] });
    below = rk;
  }

  // to millimetres, y up; outer rings counter-clockwise and holes clockwise
  // (on a 0.1 µm grid, so the triangulator hands back exactly the same coordinates)
  const q = (v: number) => Math.round(v * 1e4) / 1e4,
    mm = (r: Ring): Ring =>
      r
        .map(([x, y]): [number, number] => [q((x + 0.5) * mmpp), q((H - 0.5 - y) * mmpp)])
        .filter(([x, y], i, a) => {
          const [px, py] = a[(i + a.length - 1) % a.length];
          return x !== px || y !== py;
        });
  for (const reg of regions) {
    reg.rings = reg.rings.map(mm).filter(r => r.length >= 3);
    const d = nesting(reg.rings).depth;
    reg.rings = reg.rings.map((r, i) => (area(r) > 0 === (d[i] % 2 === 0) ? r : r.slice().reverse()));
  }

  const positions: number[] = [],
    tris: number[] = [],
    ids = new Map<number, number>(),
    zs = new Map<number, number>();
  // coordinates sit on the 0.1 µm grid, so a vertex's key is exact: x and y in grid steps, and which height
  const vert = (x: number, y: number, z: number) => {
    if (!zs.has(z)) zs.set(z, zs.size);
    const k = (Math.round(x * 1e4) * 2 ** 24 + Math.round(y * 1e4)) * 16 + zs.get(z)!;
    let v = ids.get(k);
    if (v === undefined) {
      v = positions.length / 3;
      positions.push(x, y, z);
      ids.set(k, v);
    }
    return v;
  };
  /** Triangles (vertex ids) wound counter-clockwise seen from above. */
  const ccw = (t: number[][]) =>
    t.map(([p, q, r]) =>
      (positions[q * 3] - positions[p * 3]) * (positions[r * 3 + 1] - positions[p * 3 + 1]) -
        (positions[q * 3 + 1] - positions[p * 3 + 1]) * (positions[r * 3] - positions[p * 3]) >
      0
        ? [p, q, r]
        : [p, r, q],
    );
  /** A triangulation is right when its open edges are exactly the face's ring edges (the inside on their left). */
  const fits = (t: number[][], ringEdges: [number, number][]) => {
    const e = new Map<number, number>(),
      V = positions.length / 3,
      key = (p: number, q: number) => p * V + q;
    for (const [p, q, r] of t)
      for (const [a, b] of [
        [p, q],
        [q, r],
        [r, p],
      ]) {
        if (e.has(key(b, a))) e.delete(key(b, a));
        else e.set(key(a, b), (e.get(key(a, b)) ?? 0) + 1);
      }
    if (e.size !== ringEdges.length) return false;
    return ringEdges.every(([a, b]) => e.get(key(a, b)) === 1);
  };
  /** Close the slivers a triangulation left open: chain its open edges into loops and fan each loop. */
  const patch = (t: number[][], ringEdges: [number, number][]) => {
    const V = positions.length / 3,
      key = (p: number, q: number) => p * V + q,
      open = new Map<number, [number, number]>();
    for (const [p, q, r] of t)
      for (const [a, b] of [
        [p, q],
        [q, r],
        [r, p],
      ]) {
        if (open.has(key(b, a))) open.delete(key(b, a));
        else open.set(key(a, b), [a, b]);
      }
    const ring = new Set(ringEdges.map(([a, b]) => key(a, b))),
      next = new Map<number, number>();
    // a gap is bounded by ring edges no triangle covers, and by triangle edges facing it the other way
    for (const [a, b] of ringEdges) if (!open.has(key(a, b))) next.set(a, b);
    for (const [k, [a, b]] of open) if (!ring.has(k)) next.set(b, a);
    const out = t.slice();
    while (next.size) {
      const [start] = next.keys(),
        loop: number[] = [];
      for (let v: number | undefined = start; v !== undefined && !loop.includes(v);) {
        loop.push(v);
        const w = next.get(v);
        next.delete(v);
        v = w;
      }
      for (let i = 1; i + 1 < loop.length; i++) out.push([loop[0], loop[i], loop[i + 1]]);
    }
    return out;
  };
  let failed = 0;
  /** Even-odd faces of a set of non-crossing rings at height z, facing up (or down). */
  const faces = (rings: Ring[], z: number, up: boolean) => {
    const { depth: d, parent } = nesting(rings),
      oriented = rings.map((r, i) => (area(r) > 0 === (d[i] % 2 === 0) ? r : r.slice().reverse()));
    const C = clipper2(),
      key = (x: number, y: number) => Math.round(x * 1e4) + ',' + Math.round(y * 1e4);
    // one face at a time: an outer ring and its holes
    oriented.forEach((outer, a) => {
      if (d[a] % 2) return;
      const group = [outer, ...oriented.filter((_, b) => parent[b] === a)],
        at = new Map<string, number>(),
        ringEdges: [number, number][] = [];
      for (const r of group)
        r.forEach(([x, y], i) => {
          const v = vert(x, y, z),
            [nx, ny] = r[(i + 1) % r.length];
          at.set(key(x, y), v);
          ringEdges.push([v, vert(nx, ny, z)]);
        });
      let t: number[][] | null = null;
      // Clipper2's constrained triangulation (no added vertices), with and without Delaunay flips, then ear clipping,
      // each checked; whatever is still open gets patched
      for (const delaunay of [true, false]) {
        if (!C || t) break;
        const paths = toPathsD(C, group),
          res = C.TriangulateD(paths, 4, delaunay),
          out = res.result.value === 0 ? fromPathsD(res.solution) : [];
        paths.delete();
        res.solution.delete();
        const vs = out.map(q => q.map(([x, y]) => at.get(key(x, y))));
        if (vs.length && vs.every(q => q.length === 3 && q.every(v => v !== undefined))) {
          const c = ccw(vs as number[][]);
          if (fits(c, ringEdges)) t = c;
        }
      }
      if (!t) {
        const flat: number[] = [],
          starts: number[] = [],
          vs: number[] = [];
        for (const r of group) {
          if (r !== outer) starts.push(flat.length / 2);
          for (const [x, y] of r) {
            flat.push(x, y);
            vs.push(at.get(key(x, y))!);
          }
        }
        const e = earcut(flat, starts),
          c = ccw(Array.from({ length: e.length / 3 }, (_, k) => [vs[e[k * 3]], vs[e[k * 3 + 1]], vs[e[k * 3 + 2]]]));
        t = fits(c, ringEdges) ? c : patch(c, ringEdges);
        if (!fits(t, ringEdges)) failed++;
      }
      for (const [p, q, r] of t) tris.push(...(up ? [p, q, r] : [p, r, q]));
    });
  };

  faces(regions[0].rings, 0, false);
  regions.forEach((reg, k) => {
    const z0 = k ? regions[k - 1].z : 0,
      upper = regions[k + 1]?.rings ?? [];
    faces([...reg.rings, ...upper], reg.z, true);
    // walls: the inside is on the left of every ring, so the outside is on the right
    for (const r of reg.rings)
      for (let i = 0; i < r.length; i++) {
        const [ax, ay] = r[i],
          [bx, by] = r[(i + 1) % r.length],
          at = vert(ax, ay, reg.z),
          bt = vert(bx, by, reg.z),
          ab = vert(ax, ay, z0),
          bb = vert(bx, by, z0);
        tris.push(bt, at, ab, bt, ab, bb);
      }
  });
  return { positions: Float32Array.from(positions), triangles: Uint32Array.from(tris), failedFaces: failed };
}
