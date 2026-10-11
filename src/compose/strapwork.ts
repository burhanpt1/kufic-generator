// Strapwork fill (lab port §4): the text runs along the strands of a geometric star pattern, which weave over and
// under each other. The strands come from Hankin's polygons-in-contact construction: edge midpoints are crossings,
// where two straight strands pass, and the points where rays meet inside a tile are turns. Text sits on the straight
// pieces between nodes, with a clearance at each end so it never runs into a crossing or a corner.
import { bounds, inside as inPoly, segDist, simplifyClosed } from '../geometry/poly';
import { crossingsOf } from './fills';
import type { Pt } from '../geometry/types';
import { partition, repeatSegs } from '../layout/solvers';
import type { FillerNode, Style } from '../model/schema';
import { tiles } from '../ornament/patterns/tilings';
import type { Tiling } from '../ornament/patterns/tilings';
import type { Prepared, ScriptEngine } from '../script/types';
import type { Segs } from '../types';
import { registerFiller } from './fillers';
import type { PlacedItem } from './placed';
import type { Ctx, RegionResult } from './resolve';
import { layoutOpts } from './resolve';

type StrapNode = Extract<FillerNode, { type: 'strapwork' }>;
export type StrapTiling = StrapNode['tiling'];
/** Contact angle (degrees) per tiling: 8-fold 67°, 6- and 12-fold 60°, square 45°. */
export const STRAP_ANGLE: Record<StrapTiling, number> = { '488': 67, hex: 60, '31212': 60, square: 45 };
const TILING: Record<StrapTiling, Tiling> = { '488': '488', hex: 'hex', '31212': '31212', square: 'sq' };

// ---------- the strand graph ----------
export interface GNode {
  k: string;
  p: Pt;
  kind: 'cross' | 'turn';
  e: GEdge[];
}
export interface GEdge {
  a: GNode;
  b: GNode;
  i: number;
}
/** Hankin's construction on tiles as a graph: crossings at edge midpoints, turns where a tile's rays meet. */
export function strandGraph(polys: number[][][], theta: number) {
  const rot = ([x, y]: Pt, t: number): Pt => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
  const nodes = new Map<string, GNode>(),
    key = (p: Pt) => Math.round(p[0] * 50) + ',' + Math.round(p[1] * 50);
  const node = (p: Pt, kind: GNode['kind']) => {
    const k = key(p);
    let n = nodes.get(k);
    if (!n) nodes.set(k, (n = { k, p: [p[0], p[1]], kind, e: [] }));
    if (kind === 'cross') n.kind = 'cross';
    return n;
  };
  const edges: GEdge[] = [],
    link = (a: GNode, b: GNode) => {
      const e = { a, b, i: edges.length };
      edges.push(e);
      a.e.push(e);
      b.e.push(e);
    };
  for (const p of polys) {
    const n = p.length;
    let ar = 0;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = p[i],
        [x2, y2] = p[(i + 1) % n];
      ar += x1 * y2 - x2 * y1;
    }
    const sg = ar > 0 ? 1 : -1;
    const mid = (i: number): Pt => {
      const [x1, y1] = p[i % n],
        [x2, y2] = p[(i + 1) % n];
      return [(x1 + x2) / 2, (y1 + y2) / 2];
    };
    const dir = (i: number): Pt => {
      const [x1, y1] = p[i % n],
        [x2, y2] = p[(i + 1) % n],
        l = Math.hypot(x2 - x1, y2 - y1);
      return [(x2 - x1) / l, (y2 - y1) / l];
    };
    for (let i = 0; i < n; i++) {
      const m1 = mid(i),
        m2 = mid(i + 1),
        df = rot(dir(i), sg * theta),
        e2 = dir(i + 1),
        db = rot([-e2[0], -e2[1]], -sg * theta);
      const det = df[0] * -db[1] - df[1] * -db[0],
        A = node(m1, 'cross'),
        B = node(m2, 'cross');
      if (Math.abs(det) < 1e-6) {
        link(A, B);
        continue;
      }
      const rx = m2[0] - m1[0],
        ry = m2[1] - m1[1],
        t = (rx * -db[1] - ry * -db[0]) / det;
      if (t <= 0) {
        link(A, B);
        continue;
      }
      const q = node([m1[0] + t * df[0], m1[1] + t * df[1]], 'turn');
      link(A, q);
      link(q, B);
    }
  }
  return { nodes: [...nodes.values()], edges };
}

const other = (e: GEdge, n: GNode) => (e.a === n ? e.b : e.a);
const unit = (a: Pt, b: Pt): Pt => {
  const x = b[0] - a[0],
    y = b[1] - a[1],
    l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

export interface Strand {
  nodes: GNode[];
}
/** Trace strands inside the region: straight on through crossings, round the corner at turns. Over and under
 *  alternate along each strand and differ between the two strands at a crossing (a consistent 2-colouring; where
 *  the region's edge cuts a strand that can't hold, the first state found is kept). */
export function traceStrands(G: ReturnType<typeof strandGraph>, inside: (p: Pt) => boolean) {
  const used = new Set<number>(),
    strands: Strand[] = [];
  const next = (prev: GNode, cur: GNode, e: GEdge): GEdge | null => {
    const din = unit(prev.p, cur.p),
      cand = cur.e.filter(f => f !== e);
    if (cur.kind === 'turn') return cand.length === 1 ? cand[0] : null;
    let best: GEdge | null = null,
      bd = -2;
    for (const f of cand) {
      const dd = unit(cur.p, other(f, cur).p),
        dot = din[0] * dd[0] + din[1] * dd[1];
      if (dot > bd) [bd, best] = [dot, f];
    }
    return bd > 0.9 ? best : null;
  };
  for (const e0 of G.edges) {
    if (used.has(e0.i) || !inside(e0.a.p) || !inside(e0.b.p)) continue;
    // walk back to the strand's start
    let prev = e0.b,
      cur = e0.a,
      e = e0,
      guard = 0;
    while (guard++ < 5000) {
      const f = next(prev, cur, e);
      if (!f || !inside(other(f, cur).p) || f === e0) break;
      prev = cur;
      cur = other(f, cur);
      e = f;
    }
    // then forwards
    const pts = [cur];
    let walker: GEdge | null = e,
      at = cur;
    guard = 0;
    while (walker && !used.has(walker.i) && guard++ < 5000) {
      used.add(walker.i);
      const o = other(walker, at);
      if (!inside(o.p)) break;
      pts.push(o);
      const f = next(at, o, walker);
      at = o;
      walker = f && inside(other(f, at).p) ? f : null;
    }
    if (pts.length >= 2) strands.push({ nodes: pts });
  }
  // passes through crossings (interior nodes of a strand), coloured over/under
  const passes: { si: number; j: number; k: string }[] = [],
    byCross = new Map<string, number[]>(),
    along: number[][] = strands.map(() => []);
  strands.forEach((s, si) =>
    s.nodes.forEach((n, j) => {
      if (n.kind !== 'cross' || j === 0 || j === s.nodes.length - 1) return;
      const id = passes.length;
      passes.push({ si, j, k: n.k });
      along[si].push(id);
      byCross.set(n.k, [...(byCross.get(n.k) ?? []), id]);
    }),
  );
  const over: (boolean | undefined)[] = passes.map(() => undefined),
    adj: number[][] = passes.map(() => []),
    tie = (u: number, v: number) => {
      adj[u].push(v);
      adj[v].push(u);
    };
  // neighbouring passes along a strand differ, and so do the passes through one crossing
  for (const ids of along) for (let i = 1; i < ids.length; i++) tie(ids[i], ids[i - 1]);
  for (const ids of byCross.values())
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) tie(ids[i], ids[j]);
  for (let s = 0; s < passes.length; s++) {
    if (over[s] !== undefined) continue;
    over[s] = passes[s].si % 2 === 0;
    const q = [s];
    while (q.length) {
      const u = q.pop()!;
      for (const v of adj[u])
        if (over[v] === undefined) {
          over[v] = !over[u];
          q.push(v);
        }
    }
  }
  const crossState = new Map<string, { si: number; j: number; over: boolean }[]>();
  passes.forEach((p, i) => crossState.set(p.k, [...(crossState.get(p.k) ?? []), { si: p.si, j: p.j, over: over[i]! }]));
  return { strands, crossState };
}

// ---------- geometry helpers ----------
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const cross2 = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];

/** One side of a polyline offset by d (left of travel for d > 0, screen y down), mitred at the joins. */
export function offsetLine(q: Pt[], d: number): Pt[] {
  const n = q.length,
    nrm = (a: Pt, b: Pt): Pt => {
      const [x, y] = unit(a, b);
      return [y, -x];
    };
  return q.map((p, i) => {
    if (i === 0) return add(p, nrm(q[0], q[1]), d);
    if (i === n - 1) return add(p, nrm(q[n - 2], q[n - 1]), d);
    const n1 = nrm(q[i - 1], p),
      n2 = nrm(p, q[i + 1]),
      m: Pt = [n1[0] + n2[0], n1[1] + n2[1]],
      ml = Math.hypot(m[0], m[1]);
    if (ml < 1e-6) return add(p, n1, d);
    const c = (m[0] * n1[0] + m[1] * n1[1]) / ml; // cos of half the turn
    return add(p, [m[0] / ml, m[1] / ml], d / Math.max(c, 0.2));
  });
}

/** Parts of segment a–b outside a convex polygon (Cyrus–Beck), as parameter intervals in [0, 1]. */
function outsideConvex(a: Pt, b: Pt, poly: Pt[]): [number, number][] {
  const d = sub(b, a);
  let t0 = 0,
    t1 = 1;
  const ccw = cross2(sub(poly[1], poly[0]), sub(poly[2], poly[1])) > 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      e = sub(poly[(i + 1) % poly.length], p),
      nIn: Pt = ccw ? [-e[1], e[0]] : [e[1], -e[0]], // inward normal
      num = nIn[0] * (a[0] - p[0]) + nIn[1] * (a[1] - p[1]),
      den = nIn[0] * d[0] + nIn[1] * d[1];
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return [[0, 1]];
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 >= t1) return [[0, 1]];
  }
  const out: [number, number][] = [];
  if (t0 > 1e-9) out.push([0, t0]);
  if (t1 < 1 - 1e-9) out.push([t1, 1]);
  return out;
}
/** Cut the parts of open polylines inside any of the convex polygons. */
export function cutPolylines(lines: Pt[][], holes: Pt[][]): Pt[][] {
  let cur = lines;
  for (const h of holes) {
    const next: Pt[][] = [];
    for (const q of cur) {
      let run: Pt[] = [];
      for (let i = 1; i < q.length; i++) {
        const a = q[i - 1],
          b = q[i],
          at = (t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const keep = outsideConvex(a, b, h);
        if (!keep.length) {
          if (run.length > 1) next.push(run);
          run = [];
          continue;
        }
        keep.forEach(([u, v], k) => {
          if (k > 0 || u > 1e-9) {
            if (run.length > 1) next.push(run);
            run = [at(u)];
          } else if (!run.length) run = [at(u)];
          run.push(at(v));
          if (v < 1 - 1e-9) {
            if (run.length > 1) next.push(run);
            run = [];
          }
        });
      }
      if (run.length > 1) next.push(run);
    }
    cur = next;
  }
  return cur;
}

/** The parts of open polylines inside a closed polygon. */
export function clipToRegion(lines: Pt[][], poly: Pt[]): Pt[][] {
  const out: Pt[][] = [];
  for (const q of lines) {
    let run: Pt[] = [];
    const flush = () => {
      if (run.length > 1) out.push(run);
      run = [];
    };
    for (let i = 1; i < q.length; i++) {
      const a = q[i - 1],
        b = q[i],
        d = sub(b, a),
        ts = [0, 1];
      for (let k = 0, j = poly.length - 1; k < poly.length; j = k++) {
        const e = sub(poly[k], poly[j]),
          den = cross2(d, e);
        if (Math.abs(den) < 1e-12) continue;
        const w = sub(poly[j], a),
          t = cross2(w, e) / den,
          u = cross2(w, d) / den;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
      }
      ts.sort((x, y) => x - y);
      for (let k = 1; k < ts.length; k++) {
        const t0 = ts[k - 1],
          t1 = ts[k];
        if (t1 - t0 < 1e-9) continue;
        const m = add(a, d, (t0 + t1) / 2),
          p0 = add(a, d, t0),
          p1 = add(a, d, t1);
        if (inPoly(poly, m[0], m[1])) {
          if (!run.length) run = [p0];
          else if (len(run[run.length - 1], p0) > 1e-9) {
            flush();
            run = [p0];
          }
          run.push(p1);
        } else flush();
      }
    }
    flush();
  }
  return out;
}

// ---------- layout ----------
export interface Piece {
  /** Straight piece from P to Q along a strand, its usable span after clearances, and capacity in cells. */
  P: Pt;
  Q: Pt;
  c0: number;
  c1: number;
  W: number;
  strand: number;
}
/** The straight pieces of the strands with their end clearances (crossing: half/sin(angle) + s; turn:
 *  half·|cot(φ/2)| + s; strand end: s) and capacity floor((length − clearances) / s). */
export function strandPieces(strands: Strand[], half: number, s: number): Piece[] {
  const out: Piece[] = [];
  const clearance = (st: Strand, j: number, toward: number) => {
    const nodes = st.nodes,
      n = nodes[j],
      here = n.p,
      dir = unit(here, nodes[toward].p);
    if (n.kind === 'cross') {
      // the other strand through (or ending at) this crossing: edges here that aren't along ours
      let sin = 1;
      for (const e of n.e) {
        const c = Math.abs(cross2(dir, unit(here, other(e, n).p)));
        if (c > 0.05) sin = Math.min(sin, c);
      }
      return half / Math.max(sin, 0.2) + s;
    }
    if (j === 0 || j === nodes.length - 1) return s;
    const a = unit(here, nodes[j - 1].p),
      b = unit(here, nodes[j + 1].p),
      phi = Math.max(0.2, Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))));
    return half * Math.abs(1 / Math.tan(phi / 2)) + s;
  };
  strands.forEach((st, si) => {
    for (let j = 1; j < st.nodes.length; j++) {
      const P = st.nodes[j - 1].p,
        Q = st.nodes[j].p,
        c0 = clearance(st, j - 1, j),
        c1 = clearance(st, j, j - 1),
        W = Math.floor((len(P, Q) - c0 - c1) / s);
      out.push({ P, Q, c0, c1, W, strand: si });
    }
  });
  return out;
}

/** "Is an edge of this closed polygon within r of p?" for r up to rMax, with the edges bucketed on a grid. */
export function edgesNear(pts: Pt[], rMax: number) {
  const h = Math.max(rMax, 1e-6),
    grid = new Map<string, number[]>(),
    cellOf = (v: number) => Math.floor(v / h);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j],
      [bx, by] = pts[i];
    for (let gx = cellOf(Math.min(ax, bx)); gx <= cellOf(Math.max(ax, bx)); gx++)
      for (let gy = cellOf(Math.min(ay, by)); gy <= cellOf(Math.max(ay, by)); gy++) {
        const k = gx + ',' + gy;
        const l = grid.get(k);
        if (l) l.push(j);
        else grid.set(k, [j]);
      }
  }
  return (p: Pt, r: number) => {
    const gx = cellOf(p[0]),
      gy = cellOf(p[1]);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of grid.get(gx + dx + ',' + (gy + dy)) ?? [])
          if (segDist(p, pts[j], pts[(j + 1) % pts.length]) < r) return true;
    return false;
  };
}

export interface StrapLayout {
  a: number;
  s: number;
  half: number;
  strands: Strand[];
  crossState: ReturnType<typeof traceStrands>['crossState'];
  /** Pieces carrying text, in reading order, with their segment groups. */
  text: { piece: Piece; groups: Segs }[];
  pieces: Piece[];
  score: number;
}

/** The pattern scale, straps and text pieces for a text in a region (lab port §4 layout); null if it doesn't fit. */
export function planStrapwork(
  text: string,
  wg: number,
  tiling: StrapTiling,
  pts: Pt[],
  style: Style,
  script: ScriptEngine,
): (StrapLayout & { prep: Prepared }) | null {
  const prep = script.prepareLines([text.replace(/\n+/g, ' ')], style.letter)[0],
    Hb = prep.Hb,
    b = bounds(pts),
    cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2,
    R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2,
    theta = (STRAP_ANGLE[tiling] * Math.PI) / 180,
    aMax = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2.5,
    // distances are measured on a simplified outline (curved outlines have thousands of points); ok() allows for it
    tol = 0.05,
    coarse = simplifyClosed(pts, tol),
    rows = crossingsOf(coarse),
    isIn = (p: Pt) => rows(p[1]).some(([x0, x1]) => p[0] > x0 && p[0] < x1);
  const modes = (['words', 'breaks'] as const).map(mode => {
    const segs = script.segments(prep, mode, wg) as Segs;
    return { mode, segs, total: segs.reduce((x, g) => x + g.minW, 0) + wg * (segs.length - 1) };
  });
  let best: StrapLayout | null = null;
  for (let i = 0, a = aMax; i < 18; i++, a *= 0.88) {
    const bh = 0.15 * a,
      s = bh / Hb,
      // half a cell of clear strap above and below the letters (the lab had a quarter, and letters touched)
      half = bh / 2 + 0.5 * s;
    // strands run on past the region's edge and are clipped there; text only goes on pieces well inside
    const close = edgesNear(coarse, a),
      nearMemo = new Map<Pt, boolean>(),
      near = (p: Pt) => {
        let v = nearMemo.get(p);
        if (v === undefined) nearMemo.set(p, (v = isIn(p) || close(p, a)));
        return v;
      },
      ok = (p: Pt) => isIn(p) && !close(p, half + 0.5 * s + tol);
    const m = 2 * a,
      inBox = (q: number[]) => q[0] > b.x0 - m && q[0] < b.x1 + m && q[1] > b.y0 - m && q[1] < b.y1 + m;
    const G = strandGraph(
        tiles(TILING[tiling], a, cx, cy, R + 2 * a).filter(poly => poly.some(inBox)),
        theta,
      ),
      { strands, crossState } = traceStrands(G, near),
      pieces = strandPieces(strands, half, s),
      usable = pieces.filter(p => {
        if (p.W < 5) return false;
        const t = unit(p.P, p.Q),
          u = add(p.P, t, p.c0),
          v = add(p.Q, t, -p.c1);
        return ok(u) && ok(v) && ok([(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]);
      }),
      all = usable.reduce((x, p) => x + p.W, 0);
    if (!usable.length) continue;
    for (const m of modes) {
      // spare straps: give the text only the longest pieces when there are too many
      let chosen = usable;
      if (usable.length > m.segs.length || all > 1.6 * m.total) {
        chosen = [];
        let cap = 0;
        for (const p of [...usable].sort((x, y) => y.W - x.W)) {
          if (cap >= 1.3 * m.total || chosen.length >= m.segs.length) break;
          chosen.push(p);
          cap += p.W;
        }
      }
      const caps = chosen.map(p => p.W),
        sum = caps.reduce((x, c) => x + c, 0);
      if (sum < m.total || sum > 2.2 * m.total || caps.length > m.segs.length) continue;
      // reading order: rows of height 2·bh from the top, right to left within a row
      const row = (p: Piece) => Math.floor(((p.P[1] + p.Q[1]) / 2 - b.y0) / (2 * bh)),
        mx = (p: Piece) => (p.P[0] + p.Q[0]) / 2;
      chosen = [...chosen].sort((x, y) => row(x) - row(y) || mx(y) - mx(x));
      const part = partition(
        repeatSegs(m.segs, 1),
        chosen.map(p => p.W),
      );
      if (!part) continue;
      const score = part.score + (m.mode === 'breaks' ? 0.12 : 0) + 0.7 * (1 - sum / all) + 0.12 * (a / aMax);
      if (!best || score < best.score)
        best = {
          a,
          s,
          half,
          strands,
          crossState,
          pieces,
          score,
          text: chosen.map((piece, k) => ({ piece, groups: part.groups[k] as Segs })),
        };
    }
  }
  return best ? { ...best, prep } : null;
}

function strapwork(f: StrapNode, res: RegionResult, style: Style, ctx: Ctx, sid: number) {
  const slot = ctx.comp.texts[f.text],
    pts = res.inner!.pts,
    L = planStrapwork(slot.text, slot.wordGap, f.tiling, pts, style, ctx.script);
  if (!L) {
    ctx.fill = { type: 'strapwork', ok: false, note: "the text doesn't fit this region's straps" };
    return;
  }
  ctx.items.push(...strapItems(L, pts, style, ctx.script, slot.wordGap, sid, ++ctx.ring));
  ctx.fill = { type: 'strapwork', ok: true, scale: L.s, note: `${L.text.length} straps` };
}

/** Text strips on their pieces, then the strap edges, broken where a strap passes under another and clipped to
 *  the region. */
export function strapItems(
  L: StrapLayout & { prep: Prepared },
  region: Pt[],
  style: Style,
  script: ScriptEngine,
  wg: number,
  sid: number,
  ring: number,
): PlacedItem[] {
  const items: PlacedItem[] = [],
    o = layoutOpts(style, wg),
    prep = L.prep,
    s = L.s;
  for (const { piece, groups } of L.text) {
    let P = piece.P,
      Q = piece.Q,
      c0 = piece.c0,
      c1 = piece.c1,
      t = unit(P, Q),
      n: Pt = [t[1], -t[0]];
    // keep letters upright: the "up" normal mustn't point down the screen
    if (n[1] > 1e-9) {
      [P, Q, c0, c1] = [Q, P, c1, c0];
      t = [-t[0], -t[1]];
      n = [t[1], -t[0]];
    }
    const st = script.layout(groups, prep, piece.W, { ...o, wrap: false });
    if (!st) continue;
    const span = len(P, Q) - c0 - c1,
      off = c0 + (span - st.W * s) / 2,
      O = add(add(P, t, off), n, (-st.Hb * s) / 2);
    items.push({ type: 'strip', style: sid, strip: st, place: { type: 'line', O, t, n, s }, ring });
  }
  // strap edges: both sides of every strand, cut where it passes under; open ends get a cap
  const lines: Pt[][] = [],
    holes: Pt[][] = [];
  L.strands.forEach(st => {
    const q = st.nodes.map(nd => nd.p),
      closed = st.nodes.length > 3 && st.nodes[0] === st.nodes[st.nodes.length - 1];
    if (closed) {
      // a loop: mitre the join where it closes, no end caps
      const ext = [q[q.length - 2], ...q, q[1]];
      lines.push(offsetLine(ext, L.half).slice(1, -1), offsetLine(ext, -L.half).slice(1, -1));
      return;
    }
    const l = offsetLine(q, L.half),
      r = offsetLine(q, -L.half);
    lines.push(l, r, [l[0], r[0]], [l[l.length - 1], r[r.length - 1]]);
  });
  for (const [, passes] of L.crossState) {
    const ov = passes.find(p => p.over);
    if (!ov || passes.length < 2) continue;
    const nodes = L.strands[ov.si].nodes,
      c = nodes[ov.j].p,
      back = add(c, sub(nodes[ov.j - 1].p, c), 0.42),
      fwd = add(c, sub(nodes[ov.j + 1].p, c), 0.42),
      t = unit(back, fwd),
      w = L.half * 0.999, // the over strap's own edges lie just outside
      nn: Pt = [t[1] * w, -t[0] * w];
    // the over strap's stretch through the crossing: the under strap's edges stop at its sides
    holes.push([add(back, nn), add(fwd, nn), add(fwd, nn, -1), add(back, nn, -1)]);
  }
  items.push({
    type: 'ribbon',
    style: sid,
    paths: clipToRegion(cutPolylines(lines, holes), region),
    width: Math.max(0.1, s * 0.35),
  });
  return items;
}

registerFiller('strapwork', (f, res, style, ctx, sid) => strapwork(f as StrapNode, res, style, ctx, sid));
