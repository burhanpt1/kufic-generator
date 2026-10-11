// Curved and pen strokes (lab strokeLetters). Letters become a graph of stroke centrelines: cells are nodes,
// neighbouring cells are edges (diagonals only where no square path exists). Chains run between junctions and
// ends; straight runs through a crossing continue straight, so strands pass over and under. Chains are drawn as
// smooth paths with rounded corners, or with a slanted broad nib. The pen is a true outline (the Minkowski sum of
// the path with the nib), one filled shape per stroke, instead of the prototype's seven stroked copies.
import type { Source } from './letters';
import { termCmds } from './prims';
import type { RenderOptions } from './svg';
import { f2, pathFrom } from './svg';

type P2 = [number, number];
export interface StrokeOptions {
  stroke: 'curved' | 'pen';
  /** Corner rounding (0 = square corners); the prototype's "curve". */
  curve: number;
}

/** Drop points that lie (within tol) on the line between their neighbours (Ramer–Douglas–Peucker). */
function simplify(P: P2[], tol: number): P2[] {
  if (P.length < 3) return P;
  const keep = new Uint8Array(P.length);
  keep[0] = keep[P.length - 1] = 1;
  const stack: [number, number][] = [[0, P.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!,
      [ax, ay] = P[a],
      [bx, by] = P[b],
      dx = bx - ax,
      dy = by - ay,
      l = Math.hypot(dx, dy) || 1e-12;
    let best = -1,
      far = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / l;
      if (d > far) {
        far = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return P.filter((_, i) => keep[i]);
}

/**
 * The region a slanted broad nib sweeps along a path, as SVG. The nib is a stadium: a line segment (length L, at
 * `angle`) thickened by a disc of diameter t. Its Minkowski sum with one path segment is that segment's
 * parallelogram (the segment swept by the nib line) thickened by the disc, i.e. the parallelogram filled and
 * stroked with width t and round joins. The union over segments comes from filling them all with one winding
 * (nonzero), so no polygon union is needed.
 */
export function nibSweep(P: P2[], L: number, t: number, angle: number, colour: string): string {
  const vx = (Math.cos(angle) * L) / 2,
    vy = (Math.sin(angle) * L) / 2;
  if (P.length === 1) P = [P[0], P[0]];
  let d = '';
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i],
      [bx, by] = P[i + 1];
    let q: P2[] = [
      [ax + vx, ay + vy],
      [bx + vx, by + vy],
      [bx - vx, by - vy],
      [ax - vx, ay - vy],
    ];
    // one winding for all quads, so nonzero filling gives their union
    const area = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
    if (area < 0) q = q.reverse();
    d += 'M' + q.map(([x, y]) => f2(x) + ' ' + f2(y)).join('L') + 'Z';
  }
  return `<path d="${d}" fill="${colour}" stroke="${colour}" stroke-width="${f2(t)}" stroke-linejoin="round"/>`;
}

export function strokeLetters(
  src: Source,
  opt: RenderOptions & StrokeOptions,
  mapPt: (x: number, y: number) => number[],
  isInk: (x: number, y: number) => boolean,
  col: string,
  push: (c: string, s: string) => void,
) {
  const W = src.w,
    H = src.h,
    w = opt.weight,
    ts = opt.terminal,
    paper = opt.paper;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && isInk(x, y);
  const nbrs = (x: number, y: number): P2[] => {
    const out: P2[] = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as P2[])
      if (on(x + dx, y + dy)) out.push([dx, dy]);
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as P2[])
      if (on(x + dx, y + dy) && !on(x + dx, y) && !on(x, y + dy)) out.push([dx, dy]);
    return out;
  };
  const key = (x: number, y: number) => y * W + x,
    deg = new Map<number, P2[]>(),
    cells: P2[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (on(x, y)) {
        cells.push([x, y]);
        deg.set(key(x, y), nbrs(x, y));
      }
  const crossing = (x: number, y: number) => {
    const n = deg.get(key(x, y));
    if (!n || n.length !== 4) return false;
    return n.every(([dx, dy]) => n.some(([ex, ey]) => ex === -dx && ey === -dy));
  };
  const seen = new Set<string>(),
    ekey = (a: number, b: number, c: number, d: number) =>
      a < c || (a === c && b < d) ? `${a},${b},${c},${d}` : `${c},${d},${a},${b}`;
  const chains: { pts: P2[]; closed: boolean }[] = [],
    crosses: P2[] = [];
  const walk = (x0: number, y0: number, dx: number, dy: number) => {
    const pts: P2[] = [[x0, y0]];
    let px = x0,
      py = y0,
      x = x0 + dx,
      y = y0 + dy;
    seen.add(ekey(px, py, x, y));
    for (;;) {
      pts.push([x, y]);
      const n = deg.get(key(x, y))!;
      let nx: number, ny: number;
      if (crossing(x, y)) {
        nx = x + (x - px);
        ny = y + (y - py);
      } else if (n.length === 2) {
        const o = n.find(([ex, ey]) => !(x + ex === px && y + ey === py));
        if (!o) break;
        nx = x + o[0];
        ny = y + o[1];
      } else break;
      const ek = ekey(x, y, nx, ny);
      if (seen.has(ek)) break;
      seen.add(ek);
      px = x;
      py = y;
      x = nx;
      y = ny;
    }
    return pts;
  };
  cells.forEach(([x, y]) => {
    const n = deg.get(key(x, y))!;
    if (n.length === 2 || crossing(x, y)) return;
    n.forEach(([dx, dy]) => {
      if (!seen.has(ekey(x, y, x + dx, y + dy))) chains.push({ pts: walk(x, y, dx, dy), closed: false });
    });
    if (!n.length) chains.push({ pts: [[x, y]], closed: false });
  });
  cells.forEach(([x, y]) => {
    deg.get(key(x, y))!.forEach(([dx, dy]) => {
      if (!seen.has(ekey(x, y, x + dx, y + dy))) {
        const pts = walk(x, y, dx, dy);
        chains.push({ pts, closed: pts.length > 2 && pts[pts.length - 1][0] === x && pts[pts.length - 1][1] === y });
      }
    });
  });
  cells.forEach(([x, y]) => {
    if (crossing(x, y)) crosses.push([x, y]);
  });
  // corners only, then rounded and densely sampled in cell space, then mapped
  const corners = (pts: P2[], closed: boolean) => {
    if (pts.length < 3) return pts.slice();
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i],
        [cx, cy] = pts[i + 1];
      if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) !== 0 || (bx - ax) * (cx - bx) + (by - ay) * (cy - by) < 0)
        out.push(pts[i]);
    }
    out.push(pts[pts.length - 1]);
    if (closed && out.length > 2) out.pop();
    return out;
  };
  const R = Math.max(0, opt.curve) * 1.6;
  const smooth = (cs: P2[], closed: boolean): P2[] => {
    const n = cs.length;
    if (n < 2) return cs.map(([x, y]) => [x + 0.5, y + 0.5]);
    const P = cs.map(([x, y]) => [x + 0.5, y + 0.5] as P2),
      out: P2[] = [];
    const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const seg = (a: P2, b: P2) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        k = Math.max(1, Math.ceil(l * 2));
      for (let i = 1; i <= k; i++) out.push(lerp(a, b, i / k));
    };
    const idx = (i: number) => P[(i + n) % n];
    const startI = closed ? 0 : 1,
      endI = closed ? n : n - 1;
    let prevEnd: P2 | null = closed ? null : P[0];
    if (!closed) out.push(P[0]);
    for (let i = startI; i < endI; i++) {
      const a = idx(i - 1),
        b = idx(i),
        c = idx(i + 1),
        la = Math.hypot(b[0] - a[0], b[1] - a[1]),
        lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const d = Math.min(R, la / 2, lc / 2),
        p1 = lerp(b, a, d / la),
        p2 = lerp(b, c, d / lc);
      if (prevEnd) seg(prevEnd, p1);
      else out.push(p1);
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        out.push([
          (1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0],
          (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1],
        ]);
      }
      prevEnd = p2;
    }
    if (closed) seg(prevEnd!, out[0]);
    else seg(prevEnd!, P[n - 1]);
    return out;
  };
  const scaleAt = (x: number, y: number) => {
    const a = mapPt(x, y),
      b = mapPt(x + 1, y);
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  const mapped = (pts: P2[]) => pts.map(p => mapPt(p[0], p[1]) as P2);
  const dPath = (pts: P2[], closed: boolean) =>
    mapped(pts)
      .map(([X, Y], i) => (i ? 'L' : 'M') + f2(X) + ' ' + f2(Y))
      .join('') + (closed ? 'Z' : '');
  const pen = opt.stroke === 'pen',
    cap = R > 0 ? 'round' : 'square',
    join = R > 0 ? 'round' : 'miter';
  const NIB = (-40 * Math.PI) / 180;
  const drawPath = (pts: P2[], closed: boolean, s: number, colour: string, width: number) => {
    if (!pen) {
      push(
        col,
        `<path d="${dPath(pts, closed)}" fill="none" stroke="${colour}" stroke-width="${f2(width * s)}" stroke-linecap="${cap}" stroke-linejoin="${join}"/>`,
      );
      return;
    }
    // broad nib: the path swept by a slanted nib gives thick and thin strokes, as one filled outline
    push(col, nibSweep(simplify(mapped(pts), 0.15), width * s * 1.25, width * s * 0.32, NIB, colour));
  };
  const banded = opt.letterStyle === 'banded';
  const drawn = chains
    .map(ch => {
      const cs = corners(ch.pts, ch.closed),
        pts = smooth(cs, ch.closed),
        s = scaleAt(ch.pts[0][0] + 0.5, ch.pts[0][1] + 0.5);
      if (ch.pts.length === 1) {
        const [X, Y] = mapPt(ch.pts[0][0] + 0.5, ch.pts[0][1] + 0.5);
        push(col, `<circle cx="${f2(X)}" cy="${f2(Y)}" r="${f2((w * s) / 2)}" fill="${col}"/>`);
        return null;
      }
      drawPath(pts, ch.closed, s, col, w);
      if (banded) drawPath(pts, ch.closed, s, paper, w * 0.4);
      return { ch, pts, s };
    })
    .filter((d): d is { ch: { pts: P2[]; closed: boolean }; pts: P2[]; s: number } => !!d);
  // over and under at crossings: redraw a short stretch of one strand over a paper halo
  crosses.forEach(([cx, cy]) => {
    const horiz = (cx + cy) % 2 === 0;
    for (const dd of drawn) {
      const P = dd.ch.pts;
      let hit = -1;
      for (let i = 1; i < P.length - 1; i++) {
        if (P[i][0] !== cx || P[i][1] !== cy) continue;
        const ddx = cx - P[i - 1][0],
          ddy = cy - P[i - 1][1],
          cls = ddx !== 0 && ddy !== 0 ? ddx * ddy > 0 : ddy === 0;
        if (cls === horiz) {
          hit = i;
          break;
        }
      }
      if (hit < 0) continue;
      const [ax, ay] = P[hit - 1],
        [bx, by] = P[hit + 1],
        k = 0.5;
      const seg: P2[] = [
        [cx + 0.5 + (ax - cx) * k, cy + 0.5 + (ay - cy) * k],
        [cx + 0.5, cy + 0.5],
        [cx + 0.5 + (bx - cx) * k, cy + 0.5 + (by - cy) * k],
      ];
      push(
        col,
        `<path d="${dPath(seg, false)}" fill="none" stroke="${paper}" stroke-width="${f2(w * dd.s * 1.6)}" stroke-linecap="butt"/>`,
      );
      drawPath(seg, false, dd.s, col, w);
      if (banded) drawPath(seg, false, dd.s, paper, w * 0.4);
      break;
    }
  });
  // floriated ends, oriented along the last stretch of each strand
  if (ts !== 'none')
    drawn.forEach(({ ch }) => {
      if (ch.closed) return;
      [
        [0, 1],
        [ch.pts.length - 1, ch.pts.length - 2],
      ].forEach(([e, p]) => {
        const [ex, ey] = ch.pts[e],
          [qx, qy] = ch.pts[p];
        if (src.at(ex, ey) !== 4) return;
        let ux = ex - qx,
          uy = ey - qy;
        const l = Math.hypot(ux, uy);
        ux /= l;
        uy /= l;
        const [rx, ry] = src.right ? [uy, -ux] : [-uy, ux];
        const at = (u: number, v: number) => mapPt(ex + 0.5 + u * rx + v * ux, ey + 0.5 + u * ry + v * uy);
        push(col, pathFrom(termCmds(ts, w), at).replace('<path ', `<path fill="${col}" `));
        if (banded) push(col, pathFrom(termCmds(ts, w * 0.4), at).replace('<path ', `<path fill="${paper}" `));
      });
    });
}
