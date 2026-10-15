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

/** A stroke of varying width as one filled outline: a quad per segment, each end at its own width, and a disc at
 *  every point for round joins and caps. Screen coordinates; one winding throughout, so nonzero fill unions them. */
function widthOutline(P: P2[], W: number[], colour: string): string {
  let d = '';
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i],
      [bx, by] = P[i + 1],
      l = Math.hypot(bx - ax, by - ay) || 1,
      nx = -(by - ay) / l,
      ny = (bx - ax) / l,
      ha = W[i] / 2,
      hb = W[i + 1] / 2;
    let q: P2[] = [
      [ax + nx * ha, ay + ny * ha],
      [bx + nx * hb, by + ny * hb],
      [bx - nx * hb, by - ny * hb],
      [ax - nx * ha, ay - ny * ha],
    ];
    const area = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
    if (area < 0) q = q.reverse();
    d += 'M' + q.map(([x, y]) => f2(x) + ' ' + f2(y)).join('L') + 'Z';
  }
  P.forEach(([x, y], i) => {
    const r = W[i] / 2;
    d += `M${f2(x - r)} ${f2(y)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(x + r)} ${f2(y)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(x - r)} ${f2(y)}Z`;
  });
  return `<path d="${d}" fill="${colour}"/>`;
}

/** Straight runs of a chain's cells in one direction (dx, dy), as index ranges [i, j] of at least `min` cells. */
function runs(P: P2[], dx: number, dy: number, min: number): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  for (let j = 1; j <= P.length; j++) {
    const go =
      j < P.length &&
      Math.abs(P[j][0] - P[j - 1][0]) === Math.abs(dx) &&
      Math.abs(P[j][1] - P[j - 1][1]) === Math.abs(dy);
    if (!go) {
      if (j - i >= min) out.push([i, j - 1]);
      i = j;
    }
  }
  return out;
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
  const contrast = pen ? 0 : (opt.contrast ?? 0),
    taper = pen ? 0 : (opt.taper ?? 0),
    shaped = contrast > 0 || taper > 0;
  /** Width factor at each point of a chain: thinner where it runs across the band (contrast) and toward a free stem
   *  end (taper, over its last three cells). `ends` marks which ends are stem tips. */
  const widths = (pts: P2[], ends: [boolean, boolean]) => {
    const n = pts.length,
      len = [0];
    for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return pts.map((_, i) => {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(n - 1, i + 1)],
        tx = Math.abs(b[0] - a[0]),
        ty = Math.abs(b[1] - a[1]),
        across = tx + ty ? ty / (tx + ty) : 0;
      let f = 1 - 0.5 * contrast * across;
      const T = 3;
      if (ends[0] && len[i] < T) f *= 1 - taper * 0.6 * (1 - len[i] / T);
      if (ends[1] && len[n - 1] - len[i] < T) f *= 1 - taper * 0.6 * (1 - (len[n - 1] - len[i]) / T);
      return f;
    });
  };
  const drawPath = (
    pts: P2[],
    closed: boolean,
    s: number,
    colour: string,
    width: number,
    ends?: [boolean, boolean],
  ) => {
    if (!pen && shaped) {
      const f = widths(pts, ends ?? [false, false]);
      push(
        col,
        widthOutline(
          mapped(pts),
          f.map(k => k * width * s),
          colour,
        ),
      );
      return;
    }
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
      const tip = (e: P2) => !ch.closed && src.at(e[0], e[1]) === 4,
        ends: [boolean, boolean] = [tip(ch.pts[0]), tip(ch.pts[ch.pts.length - 1])];
      drawPath(pts, ch.closed, s, col, w, ends);
      if (banded) drawPath(pts, ch.closed, s, paper, w * 0.4, ends);
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
  // flourishes: a leaf sprouting from each long free stem (one ending in open space), on its open side, angled
  // toward its tip (Fatimid floriated Kufic). Only where a clear patch beside the stem leaves room, so a leaf never
  // reads as a stroke of the letter; never on bowls and bodies, never on frames.
  if (!pen && opt.flourish === 'sprouts') {
    const empty = (x: number, y: number) => !isInk(x, y),
      // not on frames (closed rings, or strokes running along the grid's edge)
      edge = (P: P2[]) => P.some(([x, y]) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1),
      clear = (x: number, y: number, side: number) =>
        [-1, 0, 1].every(dy => empty(x + side, y + dy) && empty(x + 2 * side, y + dy));
    drawn.forEach(({ ch }, k) => {
      if (ch.closed || edge(ch.pts)) return;
      const last = ch.pts.length - 1;
      for (const [i, j] of runs(ch.pts, 0, 1, 5)) {
        // the run must end the strand: its tip is free
        const tipAt = j === last ? j : i === 0 ? i : -1;
        if (tipAt < 0) continue;
        const from = tipAt === j ? i : j,
          m = ch.pts[Math.round(from + (tipAt - from) * 0.6)],
          [x, y] = m,
          dyTip = Math.sign(ch.pts[tipAt][1] - y) || -1,
          openL = clear(x, y, -1),
          openR = clear(x, y, 1);
        if (!openL && !openR) continue;
        const side = openL && openR ? (k % 2 ? 1 : -1) : openL ? -1 : 1,
          l = Math.SQRT2,
          ux = side / l,
          uy = dyTip / l,
          rx = -uy,
          ry = ux;
        const at = (u: number, v: number) => mapPt(x + 0.5 + u * rx + v * ux, y + 0.5 + u * ry + v * uy);
        push(col, pathFrom(termCmds('leaf', w * 0.8), at).replace('<path ', `<path fill="${col}" `));
      }
    });
  }
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
