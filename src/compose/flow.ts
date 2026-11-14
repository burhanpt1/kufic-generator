// Flow fill (COMPOSITION_ENGINE.md §9 Phase 6.3): text lines that follow streamlines of a field aligned to the
// outline: parallel to the edge near the boundary, relaxing to level lines inside, like engraving hatching. Each
// line is a curved run (the placement borders use); a spacing check keeps neighbouring lines a band apart.
//
// The arithmetic here is pinned bit for bit (tests/fill-identity.test.ts): where a shortcut skips work, it is one
// that cannot change a result (see nearer() and the notes at each), and every sum keeps its order.
import { deepestPoint } from '../geometry/deepest';
import { bounds } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import { partition, repeatSegs } from '../layout/solvers';
import type { FillerNode, Style } from '../model/schema';
import type { Segs } from '../types';
import { registerFiller } from './fillers';
import type { Ctx, RegionResult } from './resolve';
import { layoutOpts } from './resolve';

type FlowNode = Extract<FillerNode, { type: 'flow' }>;

/** For a distance test `Math.hypot(dx, dy) < d` done many times: the squared lengths below which it surely holds
 *  and above which it surely fails. dx² + dy² and hypot each carry a relative error under 1e-15, so outside the band
 *  [d²(1 − 1e-9), d²(1 + 1e-9)] the squares decide exactly as hypot would; inside it (and for a d so small or large
 *  that squares would underflow or overflow: lo = -1, hi = Infinity, never surely anything) hypot is asked. */
function nearer(d: number): { lo: number; hi: number } {
  return d > 1e-140 && d < 1e140 ? { lo: d * d * (1 - 1e-9), hi: d * d * (1 + 1e-9) } : { lo: -1, hi: Infinity };
}

/** The region's signed distance (positive inside) and nearest-edge tangent, sampled once on a grid. */
function fieldOf(P: Pt[]) {
  const b = bounds(P),
    N = 96,
    pad = 1,
    x0 = b.x0 - pad,
    y0 = b.y0 - pad,
    cw = (b.x1 - b.x0 + 2 * pad) / N,
    ch = (b.y1 - b.y0 + 2 * pad) / N,
    sd = new Float64Array((N + 1) * (N + 1)),
    tx = new Float64Array((N + 1) * (N + 1)),
    ty = new Float64Array((N + 1) * (N + 1));
  // the edges, from P[i - 1] to P[i] (the closing edge first), unpacked once: start, vector, squared length, unit
  // tangent
  const n = P.length,
    eax = new Float64Array(n),
    eay = new Float64Array(n),
    edx = new Float64Array(n),
    edy = new Float64Array(n),
    el2 = new Float64Array(n),
    etx = new Float64Array(n),
    ety = new Float64Array(n);
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [ax, ay] = P[j],
      [bx, by] = P[i],
      dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy || 1e-12,
      l = Math.sqrt(l2);
    eax[i] = ax;
    eay[i] = ay;
    edx[i] = dx;
    edy[i] = dy;
    el2[i] = l2;
    etx[i] = dx / l;
    ety[i] = dy / l;
  }
  // the edges in groups of EDGE_GROUP, each with the box of its edges' points (as they are computed, start + u·vector
  // for u from 0 to 1): no point of the group is nearer a sample than its box is
  const ng = Math.ceil(n / EDGE_GROUP),
    gx0 = new Float64Array(ng).fill(Infinity),
    gx1 = new Float64Array(ng).fill(-Infinity),
    gy0 = new Float64Array(ng).fill(Infinity),
    gy1 = new Float64Array(ng).fill(-Infinity);
  for (let e = 0; e < n; e++) {
    const g = Math.floor(e / EDGE_GROUP),
      ex = eax[e] + 1 * edx[e],
      ey = eay[e] + 1 * edy[e];
    gx0[g] = Math.min(gx0[g], eax[e], ex);
    gx1[g] = Math.max(gx1[g], eax[e], ex);
    gy0[g] = Math.min(gy0[g], eay[e], ey);
    gy1[g] = Math.max(gy1[g], eay[e], ey);
  }
  const cross = new Float64Array(n);
  let last = -1; // the edge nearest the sample before
  for (let j = 0; j <= N; j++) {
    const y = y0 + j * ch;
    // where the outline crosses this row of samples: a sample is inside when an odd number of crossings lie to its
    // right (the even-odd test of geometry/poly's inside(), edge by edge, with the crossings found once per row)
    let nc = 0;
    for (let i = 0, q = n - 1; i < n; q = i++) {
      const xi = P[i][0],
        yi = P[i][1],
        xj = P[q][0],
        yj = P[q][1];
      if (yi > y !== yj > y) cross[nc++] = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    }
    for (let i = 0; i <= N; i++) {
      const x = x0 + i * cw,
        k = j * (N + 1) + i;
      // The nearest boundary point: its distance and the boundary's unit tangent there (the first edge at the
      // least distance, a distance being Math.hypot's). Squared lengths decide between two edges while they differ
      // by more than their error (the margin of nearer()); only near-ties, and the winner, are measured exactly.
      // An edge that is surely farther than some other edge can't be the nearest, so whole groups are passed over
      // by their boxes: against the nearest so far, and against the edge that was nearest the sample before
      // (which is close to nearest here too).
      let be = -1, // the nearest edge so far
        bq = Infinity, // its squared distance
        bpx = 0, // and its offset from the sample
        bpy = 0,
        bd = Infinity, // its distance, when measured
        measured = true,
        // squared distance over which an edge is surely farther than the nearest so far, or than `last`
        over = Infinity,
        overLast = Infinity;
      if (last >= 0) {
        const u = Math.max(0, Math.min(1, ((x - eax[last]) * edx[last] + (y - eay[last]) * edy[last]) / el2[last])),
          px = eax[last] + u * edx[last] - x,
          py = eay[last] + u * edy[last] - y,
          q = px * px + py * py;
        if (q > 1e-280 && q < 1e280) overLast = q * (1 + 1e-9);
      }
      for (let g = 0; g < ng; g++) {
        const ex = x < gx0[g] ? gx0[g] - x : x > gx1[g] ? x - gx1[g] : 0,
          ey = y < gy0[g] ? gy0[g] - y : y > gy1[g] ? y - gy1[g] : 0,
          far = ex * ex + ey * ey;
        if (far > over || far > overLast) continue;
        for (let e = g * EDGE_GROUP, end = Math.min(n, e + EDGE_GROUP); e < end; e++) {
          const u = Math.max(0, Math.min(1, ((x - eax[e]) * edx[e] + (y - eay[e]) * edy[e]) / el2[e])),
            px = eax[e] + u * edx[e] - x,
            py = eay[e] + u * edy[e] - y,
            q = px * px + py * py;
          if (q > over) continue; // surely farther
          if (be >= 0 && bq > 1e-280 && bq < 1e280 && q < bq * (1 - 1e-9)) {
            // surely nearer
            be = e;
            bq = q;
            bpx = px;
            bpy = py;
            measured = false;
            over = q > 1e-280 ? q * (1 + 1e-9) : Infinity;
            continue;
          }
          const d = Math.hypot(px, py);
          if (!measured) {
            bd = Math.hypot(bpx, bpy);
            measured = true;
          }
          if (d < bd) {
            be = e;
            bq = q;
            bpx = px;
            bpy = py;
            bd = d;
            over = q > 1e-280 && q < 1e280 ? q * (1 + 1e-9) : Infinity;
          }
        }
      }
      if (!measured) bd = Math.hypot(bpx, bpy);
      last = be;
      let c = false;
      for (let m = 0; m < nc; m++) if (x < cross[m]) c = !c;
      sd[k] = c ? bd : -bd;
      tx[k] = be < 0 ? 1 : etx[be];
      ty[k] = be < 0 ? 0 : ety[be];
    }
  }
  const S = N + 1,
    uMax = N - 1e-9,
    xEnd = x0 + N * cw,
    yEnd = y0 + N * ch;
  return {
    /** Signed distance to the edge, bilinear. */
    dist(x: number, y: number) {
      if (x < x0 || y < y0 || x > xEnd || y > yEnd) return -1;
      const u = Math.max(0, Math.min(uMax, (x - x0) / cw)),
        v = Math.max(0, Math.min(uMax, (y - y0) / ch)),
        i = Math.floor(u),
        j = Math.floor(v),
        fu = u - i,
        fv = v - j,
        k = j * S + i;
      return (
        sd[k] * (1 - fu) * (1 - fv) +
        sd[k + 1] * fu * (1 - fv) +
        sd[k + N + 1] * (1 - fu) * fv +
        sd[k + N + 2] * fu * fv
      );
    },
    /** Edge tangent, bilinear over the cell's corners after turning each to agree with `ref` (a tangent's sign is
     *  arbitrary, so corners are aligned before blending). */
    tangent(x: number, y: number, rx: number, ry: number, out: Float64Array) {
      const u = Math.max(0, Math.min(uMax, (x - x0) / cw)),
        v = Math.max(0, Math.min(uMax, (y - y0) / ch)),
        i = Math.floor(u),
        j = Math.floor(v),
        fu = u - i,
        fv = v - j,
        k = j * S + i;
      let ax = 0,
        ay = 0;
      // the four corners in turn: k, k + 1, k + N + 1, k + N + 2
      let kk = k,
        w = (1 - fu) * (1 - fv),
        sg = tx[kk] * rx + ty[kk] * ry < 0 ? -1 : 1;
      ax += sg * w * tx[kk];
      ay += sg * w * ty[kk];
      kk = k + 1;
      w = fu * (1 - fv);
      sg = tx[kk] * rx + ty[kk] * ry < 0 ? -1 : 1;
      ax += sg * w * tx[kk];
      ay += sg * w * ty[kk];
      kk = k + N + 1;
      w = (1 - fu) * fv;
      sg = tx[kk] * rx + ty[kk] * ry < 0 ? -1 : 1;
      ax += sg * w * tx[kk];
      ay += sg * w * ty[kk];
      kk = k + N + 2;
      w = fu * fv;
      sg = tx[kk] * rx + ty[kk] * ry < 0 ? -1 : 1;
      ax += sg * w * tx[kk];
      ay += sg * w * ty[kk];
      const l = Math.hypot(ax, ay) || 1;
      out[0] = ax / l;
      out[1] = ay / l;
    },
  };
}

/** Steepest a flow line may get (radians from level). */
const MAX_TILT = (40 * Math.PI) / 180;
const polyLen = (L: Pt[]) => L.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - L[i - 1][0], p[1] - L[i - 1][1]) : 0), 0);
/** Where across its band a baseline point is tested: the baseline, the middle, the top. */
const BAND = [0, 0.5, 1];
/** Steps a streamline is traced for, at most, each way from its seed. */
const MAX_STEPS = 4000;
/** Cells of the spacing hash that lie outside its table are keyed by one number while both indices are within
 *  ±KEY_LIM, by a string beyond. */
const KEY_LIM = 2 ** 25;
/** The most cells the spacing hash keeps as a table (the region's bounds in pitches; more go by key). */
const MAX_TABLE = 1 << 18;
/** Edges per group in the nearest-edge search. */
const EDGE_GROUP = 16;

/** Streamline baselines at letter scale s, top to bottom. Each is a left-to-right polyline whose band (the line plus
 *  Hb·s upward) stays inside the region and at least a pitch from the line above. `field` and `deepest` are the
 *  region's own (fieldOf, deepestPoint), for a caller that asks for lines at several scales. */
export function flowLines(
  P: Pt[],
  o: {
    Hb: number;
    s: number;
    lineGap: number;
    strength: number;
    margin?: number;
    minLen?: number;
    field?: ReturnType<typeof fieldOf>;
    deepest?: ReturnType<typeof deepestPoint>;
  },
): Pt[][] {
  const { Hb, s, lineGap, strength } = o,
    margin = o.margin ?? 0.6,
    h = Hb * s,
    pitch = (Hb + lineGap) * s,
    step = Math.max(0.25, s * 0.5),
    b = bounds(P),
    field = o.field ?? fieldOf(P),
    dp = o.deepest ?? deepestPoint(P),
    R = Math.max(1e-6, dp.r),
    // the edge's pull fades well before the medial axis, where the nearest edge switches sides
    fall = R * (0.1 + 0.25 * strength);
  // direction of the field: the boundary tangent near the edge (oriented rightward), level further in
  // (the edge tangent is oriented along the line's current heading, so it can't flip between neighbouring cells)
  // (a direction is written into a pair kept for it: a trace takes two per step)
  const tv = new Float64Array(2);
  const dir = (x: number, y: number, rx: number, ry: number, out: Float64Array) => {
    field.tangent(x, y, rx, ry, tv);
    const w = strength * Math.exp(-Math.max(0, field.dist(x, y)) / fall),
      vx = w * tv[0] + (1 - w),
      vy = w * tv[1],
      l = Math.hypot(vx, vy) || 1;
    out[0] = vx / l;
    out[1] = vy / l;
  };
  // the band above a baseline point (normal = up relative to the direction) must be inside, clear of the edge
  const fits = (x: number, y: number, dx: number, dy: number) => {
    const nx = dy,
      ny = -dx;
    for (const f of BAND) {
      const px = x + nx * h * f,
        py = y + ny * h * f;
      if (field.dist(px, py) < margin) return false;
    }
    return true;
  };
  const lines: Pt[][] = [];
  // every placed point in a hash of pitch-sized cells: a new line keeps a pitch from all earlier lines. A cell holds
  // one run of points per line that passes through it (x, y, x, y, …) with the run's bounding box: a line is thin,
  // so its box tells at once that a point a pitch above or below it is clear of all its points. The cells over the
  // region's bounds are a table; any beyond it go by key.
  type Run = { line: number; x0: number; x1: number; y0: number; y1: number; pts: number[] };
  const ci0 = Math.floor(b.x0 / pitch) - 1,
    cj0 = Math.floor(b.y0 / pitch) - 1,
    cols = Math.floor(b.x1 / pitch) + 2 - ci0,
    rows = Math.floor(b.y1 / pitch) + 2 - cj0,
    table: (Run[] | undefined)[] | null =
      cols > 0 && rows > 0 && cols * rows <= MAX_TABLE ? new Array<Run[] | undefined>(cols * rows) : null,
    beyond = new Map<number | string, Run[]>(),
    hk = (i: number, j: number) =>
      i >= -KEY_LIM && i < KEY_LIM && j >= -KEY_LIM && j < KEY_LIM ? i * (2 * KEY_LIM) + j : i + ',' + j,
    cell = (i: number, j: number) => {
      const a = i - ci0,
        c = j - cj0;
      return table && a >= 0 && a < cols && c >= 0 && c < rows ? table[c * cols + a] : beyond.get(hk(i, j));
    },
    apart = pitch * 0.92,
    { lo, hi } = nearer(apart);
  /** Is a point of these runs within `apart` of (px, py)? */
  const near = (runs: Run[], px: number, py: number) => {
    for (const r of runs) {
      // no point of the run is nearer than its box
      const ex = px < r.x0 ? r.x0 - px : px > r.x1 ? px - r.x1 : 0,
        ey = py < r.y0 ? r.y0 - py : py > r.y1 ? py - r.y1 : 0;
      if (ex * ex + ey * ey > hi) continue;
      const c = r.pts;
      for (let t = 0; t < c.length; t += 2) {
        const dx = px - c[t],
          dy = py - c[t + 1],
          q = dx * dx + dy * dy;
        if (q < lo) return true;
        if (q > hi) continue;
        if (Math.hypot(dx, dy) < apart) return true;
      }
    }
    return false;
  };
  const tooClose = (px: number, py: number) => {
    const i = Math.floor(px / pitch),
      j = Math.floor(py / pitch),
      a = i - ci0,
      c = j - cj0;
    if (table && a >= 1 && a < cols - 1 && c >= 1 && c < rows - 1) {
      // the nine cells are all in the table
      for (let k = (c - 1) * cols + a - 1, end = k + 3 * cols; k < end; k += cols)
        for (let t = k; t < k + 3; t++) {
          const runs = table[t];
          if (runs && near(runs, px, py)) return true;
        }
      return false;
    }
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const runs = cell(i + di, j + dj);
        if (runs && near(runs, px, py)) return true;
      }
    return false;
  };
  // the turns of the last two band heights of a line, oldest first, in a ring (a trace takes at most MAX_STEPS)
  const winAsked = Math.max(2, Math.round((2 * h) / step)),
    win = winAsked < MAX_STEPS ? winAsked : MAX_STEPS,
    bends = new Float64Array(win),
    dv = new Float64Array(2),
    mv = new Float64Array(2),
    // the points of the two traces from a seed (x, y, x, y, …): most seeds come to nothing, so points are only made
    // into a line once it is kept
    leftward = new Float64Array(2 * MAX_STEPS),
    rightward = new Float64Array(2 * MAX_STEPS),
    joined = new Float64Array(4 * MAX_STEPS);
  /** A streamline from a seed, one way, into `out`; returns its number of points. It stops at the edge, where it
   *  would climb or bend too far, and where it comes within a pitch of an earlier line (the seed itself is the
   *  caller's to test). */
  const trace = (x0: number, y0: number, sign: 1 | -1, out: Float64Array) => {
    let n = 0,
      x = x0,
      y = y0,
      turn = 0,
      // the direction at the point before (level, before the first)
      pvx = 1,
      pvy = 0,
      nb = 0, // turns recorded
      bent = 0; // the sizes of the turns in the ring, added up as they come and go (near enough: see below)
    for (let k = 0; k < MAX_STEPS; k++) {
      // (a point near an earlier line used to be traced past and cut off afterwards, with all that followed it)
      if (k && tooClose(x, y)) break;
      dir(x, y, pvx, pvy, dv);
      const dx = dv[0],
        dy = dv[1];
      if (!fits(x, y, dx, dy)) break;
      // lines may bend with the edge but not climb a wall: within MAX_TILT of level
      if (Math.abs(Math.atan2(dy, dx)) > MAX_TILT) break;
      if (k) {
        const da = Math.atan2(pvx * dy - pvy * dx, pvx * dx + pvy * dy);
        turn += Math.abs(da);
        // letters can't bend round a radius much under their own height: the turn over the last two band heights
        // of line must stay under 0.6 rad (a sharper bend crowds the letters on its inside)
        const at = nb % win;
        if (nb >= win) bent -= Math.abs(bends[at]);
        bent += Math.abs(da);
        bends[at] = da;
        nb++;
        // The turns are summed oldest first, as the sum of a list would be. Their sum can't be over 0.6 while
        // their sizes add up to less: `bent` keeps that total to within 1e-8 (at most MAX_STEPS turns of at most
        // π come and go), so under 0.59 the sum needn't be made.
        if (!(bent < 0.59)) {
          let sum = 0;
          if (nb > win) for (let t = nb % win; t < win; t++) sum += bends[t];
          for (let t = 0, e = nb > win ? nb % win : nb; t < e; t++) sum += bends[t];
          if (Math.abs(sum) > 0.6) break;
        }
      }
      if (turn > Math.PI * 0.75) break; // don't wrap round a corner
      out[2 * n] = x;
      out[2 * n + 1] = y;
      n++;
      pvx = dx;
      pvy = dy;
      // midpoint step
      dir(x + (sign * dx * step) / 2, y + (sign * dy * step) / 2, dx, dy, mv);
      x += sign * mv[0] * step;
      y += sign * mv[1] * step;
    }
    return n;
  };
  const minLen = o.minLen ?? 7 * s;
  const grow = (x0: number, y: number, need = minLen) => {
    if (field.dist(x0, y) <= margin || tooClose(x0, y)) return;
    // the stretch around the seed that stays clear of earlier lines: the leftward trace from its far end to the
    // point before the seed, then the rightward one from the seed on
    const nl = trace(x0, y, -1, leftward),
      nr = trace(x0, y, 1, rightward);
    if (Math.max(0, nl - 1) + nr < 2) return;
    let m = 0;
    for (let k = nl - 1; k >= 1; k--) {
      joined[m++] = leftward[2 * k];
      joined[m++] = leftward[2 * k + 1];
    }
    for (let k = 0; k < 2 * nr; k++) joined[m++] = rightward[k];
    // its length, summed as polyLen sums it
    let len = 0;
    for (let t = 2; t < m; t += 2) len = len + Math.hypot(joined[t] - joined[t - 2], joined[t + 1] - joined[t - 1]);
    if (len < need) return;
    const L: Pt[] = [];
    for (let t = 0; t < m; t += 2) L.push([joined[t], joined[t + 1]]);
    lines.push(L);
    for (const [x, y] of L) {
      const i = Math.floor(x / pitch),
        j = Math.floor(y / pitch),
        a = i - ci0,
        c = j - cj0;
      let runs = cell(i, j);
      if (!runs) {
        runs = [];
        if (table && a >= 0 && a < cols && c >= 0 && c < rows) table[c * cols + a] = runs;
        else beyond.set(hk(i, j), runs);
      }
      let r = runs[runs.length - 1];
      if (!r || r.line !== lines.length) runs.push((r = { line: lines.length, x0: x, x1: x, y0: y, y1: y, pts: [] }));
      if (x < r.x0) r.x0 = x;
      if (x > r.x1) r.x1 = x;
      if (y < r.y0) r.y0 = y;
      if (y > r.y1) r.y1 = y;
      r.pts.push(x, y);
    }
  };
  // first down the middle, then wherever a long line still fits clear of the others (a lobe the middle missed);
  // short fragments there would scatter the reading
  for (let y = b.y0 + margin + h; y <= b.y1 - margin; y += pitch) grow(dp.p[0], y);
  const long = Math.max(minLen, (b.x1 - b.x0) / 3);
  for (let y = b.y0 + margin + h; y <= b.y1 - margin; y += pitch / 2)
    for (let x = b.x0 + margin; x <= b.x1 - margin; x += pitch / 2) grow(x, y, long);
  // reading order: top to bottom, and right to left at the same height
  const mid = (L: Pt[]) => L[Math.floor(L.length / 2)];
  lines.sort((p, q) => {
    const a = mid(p),
      c = mid(q);
    return Math.abs(a[1] - c[1]) > pitch * 0.5 ? a[1] - c[1] : c[0] - a[0];
  });
  return lines;
}

function flowFill(f: FlowNode, res: RegionResult, style: Style, ctx: Ctx, sid: number) {
  const slot = ctx.comp.texts[f.text],
    P = res.inner!.pts,
    script = ctx.script,
    prep = script.prepareLines([slot.text.replace(/\n+/g, ' ')], style.letter)[0],
    wg = slot.wordGap,
    sMax = (res.lastScale ?? 1) * 0.85,
    strength = f.strength ?? 0.8,
    minCells = 7,
    field = fieldOf(P),
    deepest = deepestPoint(P);
  // the lines at each scale of the scan and what each holds: the same for whole words and for broken ones
  const SCALES = 60,
    scaleOf = (i: number) => sMax * Math.pow(0.96, i),
    atScale: ({ lines: Pt[][]; caps: number[] } | undefined)[] = new Array(SCALES);
  const linesAt = (i: number) => {
    let c = atScale[i];
    if (!c) {
      const s = scaleOf(i),
        lines: Pt[][] = [],
        caps: number[] = [];
      for (const L of flowLines(P, {
        Hb: prep.Hb,
        s,
        lineGap: f.lineGap,
        strength,
        field,
        deepest,
        minLen: minCells * s,
      })) {
        const cells = polyLen(L) / s;
        if (cells >= minCells) {
          lines.push(L);
          caps.push(Math.floor(cells) - 1);
        }
      }
      atScale[i] = c = { lines, caps };
    }
    return c;
  };
  let best: { sc: number; s: number; lines: Pt[][]; caps: number[]; groups: Segs[] } | null = null;
  for (const mode of ['words', 'breaks'] as const) {
    if (best) break;
    const segs = script.segments(prep, mode, wg) as Segs,
      total = segs.reduce((a, x) => a + x.minW, 0) + wg * (segs.length - 1);
    for (let i = 0; i < SCALES; i++) {
      const s = scaleOf(i);
      let { lines, caps } = linesAt(i);
      const sum = caps.reduce((a, c) => a + c, 0);
      if (sum < total) continue;
      if (sum > total * 1.9) {
        if (i) break;
        // a short text in a large region: the middle lines only, at full size
        const mid = (lines.length - 1) / 2,
          order = lines.map((_, k) => k).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q),
          keep = new Set<number>();
        let c = 0;
        for (const k of order) {
          keep.add(k);
          c += caps[k];
          if (c >= total * 1.25) break;
        }
        lines = lines.filter((_, k) => keep.has(k));
        caps = caps.filter((_, k) => keep.has(k));
      }
      if (caps.length > segs.length) continue;
      const p = partition(repeatSegs(segs, 1), caps);
      if (!p) continue;
      const sc = p.score + 0.25 * (1 - s / sMax) + (mode === 'breaks' ? 0.12 : 0);
      if (!best || sc < best.sc) best = { sc, s, lines, caps, groups: p.groups as Segs[] };
    }
  }
  if (!best) {
    ctx.fill = { type: 'flow', ok: false, note: "the text doesn't fit this region" };
    return;
  }
  const ring = ++ctx.ring,
    o = layoutOpts(style, wg),
    s = best.s;
  best.lines.forEach((L, i) => {
    // a line with a word or two isn't stretched across all its length: at most a quarter over its natural width,
    // centred on the line
    const g = best!.groups[i],
      nat = g.reduce((a, x) => a + x.minW, 0) + wg * (g.length - 1),
      W = Math.min(best!.caps[i], nat + Math.max(1, Math.floor(nat * 0.25))),
      st = script.layout(g, prep, W, { ...o, wrap: false });
    if (!st) return;
    const cum = [0];
    for (let k = 1; k < L.length; k++) cum.push(cum[k - 1] + Math.hypot(L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1]));
    const len = cum[cum.length - 1];
    ctx.items.push({
      type: 'strip',
      style: sid,
      strip: st,
      place: { type: 'run', pts: L, cum, off: (len - W * s) / 2, sx: s, s },
      ring,
    });
  });
  ctx.fill = { type: 'flow', ok: true, scale: s, note: `${best.lines.length} lines` };
}

registerFiller('flow', (f, res, style, ctx, sid) => flowFill(f as FlowNode, res, style, ctx, sid));
