// Flow fill (COMPOSITION_ENGINE.md §9 Phase 6.3): text lines that follow streamlines of a field aligned to the
// outline: parallel to the edge near the boundary, relaxing to level lines inside, like engraving hatching. Each
// line is a curved run (the placement borders use); a spacing check keeps neighbouring lines a band apart.
import { deepestPoint } from '../geometry/deepest';
import { bounds, inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import { partition, repeatSegs } from '../layout/solvers';
import type { FillerNode, Style } from '../model/schema';
import type { Segs } from '../types';
import { registerFiller } from './fillers';
import type { Ctx, RegionResult } from './resolve';
import { layoutOpts } from './resolve';

type FlowNode = Extract<FillerNode, { type: 'flow' }>;

/** Nearest boundary point: distance and the boundary's unit tangent there. */
function nearest(P: Pt[], x: number, y: number): { d: number; t: Pt } {
  let bd = Infinity,
    bt: Pt = [1, 0];
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j],
      [bx, by] = P[i],
      dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy || 1e-12,
      u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)),
      d = Math.hypot(ax + u * dx - x, ay + u * dy - y);
    if (d < bd) {
      bd = d;
      const l = Math.sqrt(l2);
      bt = [dx / l, dy / l];
    }
  }
  return { d: bd, t: bt };
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
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const x = x0 + i * cw,
        y = y0 + j * ch,
        n = nearest(P, x, y),
        k = j * (N + 1) + i;
      sd[k] = inside(P, x, y) ? n.d : -n.d;
      tx[k] = n.t[0];
      ty[k] = n.t[1];
    }
  const cell = (x: number, y: number) => {
    const u = Math.max(0, Math.min(N - 1e-9, (x - x0) / cw)),
      v = Math.max(0, Math.min(N - 1e-9, (y - y0) / ch));
    return { i: Math.floor(u), j: Math.floor(v), fu: u - Math.floor(u), fv: v - Math.floor(v) };
  };
  return {
    /** Signed distance to the edge, bilinear. */
    dist(x: number, y: number) {
      if (x < x0 || y < y0 || x > x0 + N * cw || y > y0 + N * ch) return -1;
      const { i, j, fu, fv } = cell(x, y),
        k = j * (N + 1) + i;
      return (
        sd[k] * (1 - fu) * (1 - fv) +
        sd[k + 1] * fu * (1 - fv) +
        sd[k + N + 1] * (1 - fu) * fv +
        sd[k + N + 2] * fu * fv
      );
    },
    /** Edge tangent, bilinear over the cell's corners after turning each to agree with `ref` (a tangent's sign is
     *  arbitrary, so corners are aligned before blending). */
    tangent(x: number, y: number, ref: Pt): Pt {
      const { i, j, fu, fv } = cell(x, y),
        k = j * (N + 1) + i;
      let ax = 0,
        ay = 0;
      for (const [kk, w] of [
        [k, (1 - fu) * (1 - fv)],
        [k + 1, fu * (1 - fv)],
        [k + N + 1, (1 - fu) * fv],
        [k + N + 2, fu * fv],
      ]) {
        const sg = tx[kk] * ref[0] + ty[kk] * ref[1] < 0 ? -1 : 1;
        ax += sg * w * tx[kk];
        ay += sg * w * ty[kk];
      }
      const l = Math.hypot(ax, ay) || 1;
      return [ax / l, ay / l];
    },
  };
}

/** Steepest a flow line may get (radians from level). */
const MAX_TILT = (40 * Math.PI) / 180;
const polyLen = (L: Pt[]) => L.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - L[i - 1][0], p[1] - L[i - 1][1]) : 0), 0);

/** Streamline baselines at letter scale s, top to bottom. Each is a left-to-right polyline whose band (the line plus
 *  Hb·s upward) stays inside the region and at least a pitch from the line above. */
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
  },
): Pt[][] {
  const { Hb, s, lineGap, strength } = o,
    margin = o.margin ?? 0.6,
    h = Hb * s,
    pitch = (Hb + lineGap) * s,
    step = Math.max(0.25, s * 0.5),
    b = bounds(P),
    field = o.field ?? fieldOf(P),
    dp = deepestPoint(P),
    R = Math.max(1e-6, dp.r),
    // the edge's pull fades well before the medial axis, where the nearest edge switches sides
    fall = R * (0.1 + 0.25 * strength);
  // direction of the field: the boundary tangent near the edge (oriented rightward), level further in
  // (the edge tangent is oriented along the line's current heading, so it can't flip between neighbouring cells)
  const dir = (x: number, y: number, ref: Pt): Pt => {
    const [tx, ty] = field.tangent(x, y, ref);
    const w = strength * Math.exp(-Math.max(0, field.dist(x, y)) / fall),
      vx = w * tx + (1 - w),
      vy = w * ty,
      l = Math.hypot(vx, vy) || 1;
    return [vx / l, vy / l];
  };
  // the band above a baseline point (normal = up relative to the direction) must be inside, clear of the edge
  const fits = (x: number, y: number, d: Pt) => {
    const nx = d[1],
      ny = -d[0];
    for (const f of [0, 0.5, 1]) {
      const px = x + nx * h * f,
        py = y + ny * h * f;
      if (field.dist(px, py) < margin) return false;
    }
    return true;
  };
  const trace = (x0: number, y0: number, sign: 1 | -1) => {
    const out: Pt[] = [];
    let x = x0,
      y = y0,
      turn = 0,
      prev: Pt | null = null;
    const bends: number[] = [],
      win = Math.max(2, Math.round((2 * h) / step));
    for (let k = 0; k < 4000; k++) {
      const d = dir(x, y, prev ?? [1, 0]);
      if (!fits(x, y, d)) break;
      // lines may bend with the edge but not climb a wall: within MAX_TILT of level
      if (Math.abs(Math.atan2(d[1], d[0])) > MAX_TILT) break;
      if (prev) {
        const da = Math.atan2(prev[0] * d[1] - prev[1] * d[0], prev[0] * d[0] + prev[1] * d[1]);
        turn += Math.abs(da);
        // letters can't bend round a radius much under their own height: the turn over the last two band heights
        // of line must stay under 0.6 rad (a sharper bend crowds the letters on its inside)
        bends.push(da);
        if (bends.length > win) bends.shift();
        if (Math.abs(bends.reduce((a, v) => a + v, 0)) > 0.6) break;
      }
      if (turn > Math.PI * 0.75) break; // don't wrap round a corner
      out.push([x, y]);
      prev = d;
      // midpoint step
      const m = dir(x + (sign * d[0] * step) / 2, y + (sign * d[1] * step) / 2, d);
      x += sign * m[0] * step;
      y += sign * m[1] * step;
    }
    return out;
  };
  const lines: Pt[][] = [];
  // every placed point in a hash of pitch-sized cells: a new line keeps a pitch from all earlier lines
  const hash = new Map<string, Pt[]>(),
    hk = (i: number, j: number) => i + ',' + j;
  const tooClose = (p: Pt) => {
    const i = Math.floor(p[0] / pitch),
      j = Math.floor(p[1] / pitch);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++)
        for (const q of hash.get(hk(i + di, j + dj)) ?? [])
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) < pitch * 0.92) return true;
    return false;
  };
  const minLen = o.minLen ?? 7 * s;
  const grow = (x0: number, y: number, need = minLen) => {
    if (field.dist(x0, y) <= margin || tooClose([x0, y])) return;
    const left = trace(x0, y, -1).reverse(),
      right = trace(x0, y, 1);
    let L = [...left.slice(0, -1), ...right];
    if (L.length < 2) return;
    // keep the stretch around the seed that stays clear of earlier lines
    const seed = Math.max(0, left.length - 1);
    let a = seed,
      z = seed;
    while (a > 0 && !tooClose(L[a - 1])) a--;
    while (z < L.length - 1 && !tooClose(L[z + 1])) z++;
    L = L.slice(a, z + 1);
    if (L.length < 2 || polyLen(L) < need) return;
    lines.push(L);
    for (const p of L) {
      const k = hk(Math.floor(p[0] / pitch), Math.floor(p[1] / pitch));
      if (!hash.has(k)) hash.set(k, []);
      hash.get(k)!.push(p);
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
    field = fieldOf(P);
  let best: { sc: number; s: number; lines: Pt[][]; caps: number[]; groups: Segs[] } | null = null;
  for (const mode of ['words', 'breaks'] as const) {
    if (best) break;
    const segs = script.segments(prep, mode, wg) as Segs,
      total = segs.reduce((a, x) => a + x.minW, 0) + wg * (segs.length - 1);
    for (let i = 0; i < 60; i++) {
      const s = sMax * Math.pow(0.96, i);
      let lines = flowLines(P, { Hb: prep.Hb, s, lineGap: f.lineGap, strength, field, minLen: minCells * s }).filter(
        L => polyLen(L) / s >= minCells,
      );
      let caps = lines.map(L => Math.floor(polyLen(L) / s) - 1);
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
