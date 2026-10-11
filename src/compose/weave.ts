// Interlaced maze (COMPOSITION_ENGINE.md §9 Phase 6.4): ribbons of text that cross over and under each other. A
// lattice of nodes fills the region; at each node the ribbons either cross straight through (alternating over and
// under, checkerboard fashion) or turn back on rounded corners, in the manner of an orthogonal Celtic knot. Text runs
// on the straight stretches between nodes; the ribbons' edges are drawn as walls, broken where a ribbon passes
// under another, so no letters ever overlap.
import { bounds, inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import { partition, repeatSegs } from '../layout/solvers';
import type { FillerNode, Style } from '../model/schema';
import type { Segs } from '../types';
import type { Ctx, RegionResult } from './resolve';
import { layoutOpts } from './resolve';

type MazeNode = Extract<FillerNode, { type: 'maze' }>;
/** Ports: 0 east, 1 south, 2 west, 3 north (screen y down). */
const DIR: Pt[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const opp = (p: number) => (p + 2) % 4;

/** One pass of a loop through a node: arriving heading `din`, leaving heading `dout` (port indices). */
export interface Pass {
  i: number;
  j: number;
  din: number;
  dout: number;
  /** A straight pass through a crossing, and whether it goes under the other ribbon there. */
  crossing: boolean;
  under: boolean;
}

/** The knot: closed loops over a lattice of nodes where `on` says a node fits the region. */
export function knot(S: number, on: (i: number, j: number) => boolean, seed: number, pCross: number): Pass[][] {
  let rs = seed % 2147483647 || 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const alive = new Uint8Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) alive[j * S + i] = on(i, j) ? 1 : 0;
  // edges between neighbouring nodes: edge[k*4+p] says node k's port p is connected
  const edge = new Uint8Array(S * S * 4);
  const nbk = (k: number, p: number) => {
    const x = (k % S) + DIR[p][0],
      y = Math.floor(k / S) + DIR[p][1];
    return x >= 0 && y >= 0 && x < S && y < S ? y * S + x : -1;
  };
  for (let k = 0; k < S * S; k++)
    if (alive[k])
      for (let p = 0; p < 4; p++) {
        const k2 = nbk(k, p);
        if (k2 >= 0 && alive[k2]) edge[k * 4 + p] = 1;
      }
  const deg = (k: number) => edge[k * 4] + edge[k * 4 + 1] + edge[k * 4 + 2] + edge[k * 4 + 3];
  // every node needs an even degree (each strand that enters must leave): pair odd nodes and remove the cheapest
  // path between each pair, preferring edges along the boundary so the interior keeps its crossings
  const boundary = (k: number) => deg(k) < 4;
  for (let guard = 0; guard < S * S; guard++) {
    const u = [...Array(S * S).keys()].find(k => alive[k] && deg(k) % 2 === 1);
    if (u === undefined) break;
    const dist = new Float64Array(S * S).fill(Infinity),
      from = new Int32Array(S * S).fill(-1),
      done = new Uint8Array(S * S);
    dist[u] = 0;
    let v = -1;
    for (;;) {
      let k = -1;
      for (let q = 0; q < S * S; q++) if (!done[q] && dist[q] < Infinity && (k < 0 || dist[q] < dist[k])) k = q;
      if (k < 0) break;
      done[k] = 1;
      if (k !== u && deg(k) % 2 === 1) {
        v = k;
        break;
      }
      for (let p = 0; p < 4; p++) {
        if (!edge[k * 4 + p]) continue;
        const k2 = nbk(k, p),
          c = dist[k] + (boundary(k) && boundary(k2) ? 1 : 3);
        if (c < dist[k2]) {
          dist[k2] = c;
          from[k2] = k * 4 + p;
        }
      }
    }
    if (v < 0) {
      // an odd node with no partner: cut it off
      for (let p = 0; p < 4; p++)
        if (edge[u * 4 + p]) {
          edge[u * 4 + p] = 0;
          edge[nbk(u, p) * 4 + opp(p)] = 0;
        }
      alive[u] = 0;
      continue;
    }
    for (let k = v; k !== u;) {
      const fp = from[k],
        k1 = fp >> 2,
        p = fp & 3;
      edge[k1 * 4 + p] = 0;
      edge[k * 4 + opp(p)] = 0;
      k = k1;
    }
  }
  const nb = (i: number, j: number, p: number) => {
    const k = j * S + i;
    return edge[k * 4 + p] ? nbk(k, p) : -1;
  };
  for (let k = 0; k < S * S; k++) if (!deg(k)) alive[k] = 0;
  // how ports pair up inside each node
  const link = new Int8Array(S * S * 4).fill(-1),
    cross = new Uint8Array(S * S);
  for (let k = 0; k < S * S; k++) {
    if (!alive[k]) continue;
    const ports = [0, 1, 2, 3].filter(p => nb(k % S, Math.floor(k / S), p) >= 0);
    const pair = (a: number, b: number) => ((link[k * 4 + a] = b), (link[k * 4 + b] = a));
    if (ports.length === 2) pair(ports[0], ports[1]);
    else if (rnd() < pCross) {
      cross[k] = 1;
      pair(0, 2);
      pair(1, 3);
    } else if (rnd() < 0.5) {
      pair(2, 3); // west-north and east-south
      pair(0, 1);
    } else {
      pair(2, 1); // west-south and east-north
      pair(0, 3);
    }
  }
  const used = new Uint8Array(S * S * 4),
    loops: Pass[][] = [];
  for (let k0 = 0; k0 < S * S; k0++)
    for (let p0 = 0; p0 < 4; p0++) {
      if (!alive[k0] || used[k0 * 4 + p0] || nb(k0 % S, Math.floor(k0 / S), p0) < 0) continue;
      const loop: Pass[] = [];
      let k = k0,
        p = p0;
      for (let guard = 0; guard < S * S * 4; guard++) {
        used[k * 4 + p] = 1;
        const k2 = nb(k % S, Math.floor(k / S), p),
          pin = opp(p);
        used[k2 * 4 + pin] = 1;
        const pout = link[k2 * 4 + pin],
          i = k2 % S,
          j = Math.floor(k2 / S),
          straight = pout === p,
          horiz = p % 2 === 0;
        loop.push({
          i,
          j,
          din: p,
          dout: pout,
          crossing: !!cross[k2] && straight,
          under: !!cross[k2] && straight && ((i + j) % 2 === 0) !== horiz,
        });
        k = k2;
        p = pout;
        if (k === k0 && p === p0) break;
      }
      loops.push(loop);
    }
  return loops;
}

const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];

/** Fill a region with an interlaced maze; false when nothing fits (the caller reports it). */
export function weaveFill(f: MazeNode, res: RegionResult, style: Style, ctx: Ctx, sid: number): boolean {
  const slot = ctx.comp.texts[f.text],
    script = ctx.script,
    pts = res.inner!.pts,
    b = bounds(pts),
    half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2,
    cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2,
    letter = { ...style.letter, ascenders: Math.min(style.letter.ascenders, 9) },
    prep = script.prepareLines([slot.text.replace(/\n+/g, ' ')], letter)[0],
    Hb = prep.Hb,
    wg = slot.wordGap,
    sMax = (res.lastScale ?? 1) * 0.85,
    seed = f.seed ?? ctx.comp.seed,
    pCross = 0.35 + 0.55 * f.corridors,
    // a stretch carries text only if it can hold about a word; shorter ones stay plain ribbon
    minCells = 2 * Hb;
  type Edge = { from: Pt; to: Pt; d: Pt; W: number };
  let best: {
    sc: number;
    s: number;
    wr: number;
    edges: Edge[];
    groups: Segs[];
    loops: Pass[][];
    D: number;
    ox: number;
    oy: number;
    R: number;
    cut: number;
  } | null = null;
  for (let S = 3; S <= 12; S++)
    // lattice spacing in ribbon widths: turns need > 2.42 (so turning ribbons clear each other)
    for (const kk of [3.5, 4.5, 6]) {
      const D = (2 * half) / S,
        wr = D / kk, // ribbon width
        w = wr / 1.3, // the text band inside it
        s = w / Hb;
      if (s > sMax || s < 0.2) continue;
      const ox = cx - half,
        oy = cy - half,
        c = (i: number, j: number): Pt => [ox + (i + 0.5) * D, oy + (j + 0.5) * D],
        R = Math.min(D * 0.45, 1.3 * wr),
        cut = wr / 2 + wr * 0.25;
      const on = (i: number, j: number) => {
        const [x, y] = c(i, j),
          e = D * 0.45;
        return [
          [-e, 0],
          [e, 0],
          [0, -e],
          [0, e],
          [0, 0],
        ].every(([dx, dy]) => inside(pts, x + dx, y + dy));
      };
      const loops = knot(S, on, seed, pCross).sort((p, q) => q.length - p.length);
      if (!loops.length) continue;
      // how much of the region the lattice covers, and how interlaced it is
      let fit = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) if (inside(pts, ...c(i, j))) fit++;
      const nodes = new Set(loops.flat().map(q => q.j * S + q.i)).size,
        coverage = nodes / Math.max(1, fit),
        crossings = loops.flat().filter(q => q.crossing).length / 2;
      // edges between consecutive passes, each loop starting from its lowest leftward edge (upright text first)
      const edges: Edge[] = [];
      for (let li = 0; li < loops.length; li++) {
        let L = loops[li];
        const lowest = (Q: Pass[]) => {
          let bi = -1;
          Q.forEach((q, k) => {
            if (q.dout === 2 && (bi < 0 || q.j > Q[bi].j || (q.j === Q[bi].j && q.i > Q[bi].i))) bi = k;
          });
          return bi;
        };
        let k0 = lowest(L);
        if (k0 < 0) {
          // no leftward edge: traverse the other way
          L = L.slice()
            .reverse()
            .map(q => ({ ...q, din: opp(q.dout), dout: opp(q.din) }));
          k0 = Math.max(0, lowest(L));
        }
        L = [...L.slice(k0), ...L.slice(0, k0)];
        loops[li] = L;
        for (let k = 0; k < L.length; k++) {
          const A = L[k],
            B = L[(k + 1) % L.length],
            d = DIR[A.dout],
            rA = A.din !== A.dout ? R : cut,
            rB = B.din !== B.dout ? R : cut,
            from = add(c(A.i, A.j), d, rA),
            to = add(c(B.i, B.j), d, -rB),
            len = Math.hypot(to[0] - from[0], to[1] - from[1]),
            W = Math.floor(len / s) - 1;
          edges.push({ from, to, d, W });
        }
      }
      const text = edges.filter(e => e.W >= minCells),
        caps = text.map(e => e.W),
        sum = caps.reduce((a, x) => a + x, 0);
      if (!caps.length) continue;
      for (const mode of ['words', 'breaks'] as const) {
        const segs0 = script.segments(prep, mode, wg) as Segs,
          one = segs0.reduce((a, x) => a + x.minW, 0) + wg * segs0.length;
        let done = false;
        for (let rep = 1; rep <= 24 && !done; rep++) {
          if (rep * one > sum + wg) break;
          if (rep * segs0.length < caps.length) continue;
          if (sum > rep * one * 1.8) continue;
          const p = partition(repeatSegs(segs0, rep), caps);
          if (!p) continue;
          const sc =
            p.score +
            0.3 * (1 - s / sMax) +
            0.02 * rep +
            0.15 * (1 - text.length / edges.length) +
            0.8 * (1 - coverage) +
            0.3 / (1 + crossings) +
            (mode === 'breaks' ? 0.3 : 0);
          if (!best || sc < best.sc)
            best = { sc, s, wr, edges: text, groups: p.groups as Segs[], loops, D, ox, oy, R, cut };
          done = true;
        }
        if (done) break;
      }
    }
  if (!best) return false;
  const { s, wr, D, ox, oy, R, cut } = best,
    w = Hb * s,
    o = { ...layoutOpts(style, wg), rhythm: true },
    ring = ++ctx.ring;
  best.edges.forEach((e, i) => {
    const st = script.layout(best!.groups[i], prep, e.W, { ...o, wrap: false });
    if (!st) return;
    const t: Pt = [-e.d[0], -e.d[1]],
      n: Pt = [t[1], -t[0]],
      len = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]),
      O = add(add(e.to, n, -w / 2), t, (len - e.W * s) / 2);
    ctx.items.push({ type: 'strip', style: sid, strip: st, place: { type: 'line', O, t, n, s }, ring });
  });
  // ribbon walls: each loop's centreline (rounded at turns) offset to both sides, broken at under-passes
  const c = (i: number, j: number): Pt => [ox + (i + 0.5) * D, oy + (j + 0.5) * D],
    walls: Pt[][] = [];
  for (const L of best.loops) {
    const line: { p: Pt; gap?: 'start' | 'end' }[] = [];
    for (const q of L) {
      const cc = c(q.i, q.j),
        din = DIR[q.din],
        dout = DIR[q.dout];
      if (q.din !== q.dout) {
        // quarter circle tangent to both arms
        const a = add(cc, din, -R),
          centre = add(a, dout, R),
          from = Math.atan2(a[1] - centre[1], a[0] - centre[0]),
          endP = add(cc, dout, R),
          to = Math.atan2(endP[1] - centre[1], endP[0] - centre[0]);
        let dA = to - from;
        if (dA > Math.PI) dA -= 2 * Math.PI;
        if (dA < -Math.PI) dA += 2 * Math.PI;
        for (let k = 0; k <= 8; k++) {
          const th = from + (dA * k) / 8;
          line.push({ p: [centre[0] + R * Math.cos(th), centre[1] + R * Math.sin(th)] });
        }
      } else if (q.under) {
        line.push({ p: add(cc, din, -cut), gap: 'start' }, { p: add(cc, din, cut), gap: 'end' });
      } else line.push({ p: cc });
    }
    // offset to each side; a gap 'start' ends the current wall piece and 'end' begins the next
    for (const side of [1, -1]) {
      const pieces: Pt[][] = [];
      let cur: Pt[] = [];
      const N = line.length;
      const startAt = Math.max(
        0,
        line.findIndex(x => x.gap === 'end'),
      );
      for (let m = 0; m <= N; m++) {
        const k = (startAt + m) % N,
          prev = line[(k - 1 + N) % N].p,
          next = line[(k + 1) % N].p,
          tx = next[0] - prev[0],
          ty = next[1] - prev[1],
          tl = Math.hypot(tx, ty) || 1,
          nrm: Pt = [(ty / tl) * side, (-tx / tl) * side],
          q = add(line[k].p, nrm, wr / 2);
        if (line[k].gap === 'start' && m > 0) {
          cur.push(q);
          pieces.push(cur);
          cur = [];
        } else if (line[k].gap === 'end') {
          if (cur.length) pieces.push(cur);
          cur = [q];
        } else cur.push(q);
      }
      if (cur.length > 1) pieces.push(cur);
      walls.push(...pieces.filter(pc => pc.length > 1));
    }
  }
  ctx.items.push({ type: 'ribbon', style: sid, paths: walls, width: Math.max(0.12, wr * 0.07) });
  const crossings = best.loops.flat().filter(q => q.crossing).length / 2;
  ctx.fill = {
    type: 'maze',
    ok: true,
    scale: s,
    note: `interlaced, ${best.loops.length} ribbon${best.loops.length === 1 ? '' : 's'}, ${crossings} crossings`,
  };
  return true;
}
