// Curved and pen strokes (lab strokeLetters). Letters become a graph of stroke centrelines: cells are nodes,
// neighbouring cells are edges (diagonals only where no square path exists). Chains run between junctions and
// ends; straight runs through a crossing continue straight, so strands pass over and under. Chains are drawn as
// smooth paths with rounded corners, or with a slanted broad nib. The pen is a true outline (the Minkowski sum of
// the path with the nib), one filled shape per stroke, instead of the prototype's seven stroked copies.
import type { Source } from './letters';
import { termCmds } from './prims';
import type { RenderOptions } from './svg';
import { f2, pathFrom } from './svg';
import { cornerPoints, smoothChain, strokeGraph } from '../geometry/strokegraph';
export { cornerPoints, smoothChain, strokeGraph };

type P2 = [number, number];
/** The broad nib's slant (radians), shared by every pen-drawn stroke. */
export const NIB = (-40 * Math.PI) / 180;
export interface StrokeOptions {
  stroke: 'curved' | 'pen';
  /** Corner rounding (0 = square corners); the prototype's "curve". */
  curve: number;
}

/** Drop points that lie (within tol) on the line between their neighbours (Ramer–Douglas–Peucker). */
export function simplify(P: P2[], tol: number): P2[] {
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
  const { chains, crosses } = strokeGraph(W, H, isInk);
  const R = Math.max(0, opt.curve) * 1.6;
  const corners = cornerPoints,
    smooth = (c: P2[], closed: boolean) => smoothChain(c, closed, R);
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
