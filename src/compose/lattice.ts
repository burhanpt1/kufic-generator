// Woven lattice (lab port §7): horizontal and vertical text straps cross the region and weave in a checkerboard
// (the strap at row r, column c is on top when r + c is even). Text skips the crossing squares. It flows through
// the horizontal straps (top to bottom, right to left), then the vertical ones (right to left, top to bottom),
// which read downwards with the letter tops facing left and the baseline on the right. Unlike the interlaced maze
// (a knot of loops on a lattice), the straps run straight across and are clipped by the region's outline.
import { bounds } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import { partition, repeatSegs } from '../layout/solvers';
import type { FillerNode, Style } from '../model/schema';
import type { Prepared, ScriptEngine } from '../script/types';
import type { Segs } from '../types';
import { crossingsOf } from './fills';
import { registerFiller } from './fillers';
import type { PlacedItem } from './placed';
import type { Ctx, RegionResult } from './resolve';
import { layoutOpts } from './resolve';
import { clipToRegion, cutPolylines } from './strapwork';

type LatticeNode = Extract<FillerNode, { type: 'lattice' }>;

export interface LatticePiece {
  /** 'h': along y = at, from a to b in x; 'v': along x = at, from a to b in y (a < b). */
  dir: 'h' | 'v';
  at: number;
  a: number;
  b: number;
  W: number;
}
export interface LatticePlan {
  s: number;
  half: number;
  rows: number[];
  cols: number[];
  pieces: LatticePiece[];
  text: { piece: LatticePiece; groups: Segs }[];
  prep: Prepared;
  score: number;
}

/** The region's inside intervals along a horizontal (or, transposed, vertical) line. */
const transpose = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [y, x]);

/** Straps, their text pieces and the letter scale for a text in a region; null if it doesn't fit. */
export function planLattice(
  text: string,
  wg: number,
  pts: Pt[],
  style: Style,
  script: ScriptEngine,
  sMax: number,
): LatticePlan | null {
  const prep = script.prepareLines([text.replace(/\n+/g, ' ')], style.letter)[0],
    Hb = prep.Hb,
    b = bounds(pts),
    cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2,
    rowsAt = crossingsOf(pts),
    colsAt = crossingsOf(transpose(pts));
  const modes = (['words', 'breaks'] as const).map(mode => {
    const segs = script.segments(prep, mode, wg) as Segs;
    return { mode, segs, total: segs.reduce((x, g) => x + g.minW, 0) + wg * (segs.length - 1) };
  });
  let best: LatticePlan | null = null;
  for (let i = 0; i < 60; i++) {
    const s = sMax * Math.pow(0.95, i),
      bh = Hb * s,
      // half a cell of clear strap above and below the letters, as in strapwork
      half = bh / 2 + 0.5 * s,
      spacing = 3 * (Hb + 1) * s; // 3 × band pitch
    const lines = (lo: number, hi: number, c: number) => {
      const out: number[] = [];
      for (let k = Math.ceil((lo - c) / spacing); c + k * spacing <= hi; k++) out.push(c + k * spacing);
      return out;
    };
    const rows = lines(b.y0 + half, b.y1 - half, cy),
      cols = lines(b.x0 + half, b.x1 - half, cx);
    if (!rows.length || !cols.length) continue;
    // pieces: inside the region on both edges of the strap, clear of the crossing squares and the outline
    const pieces: LatticePiece[] = [];
    const cut = (dir: 'h' | 'v', at: number, across: number[], ivAt: (v: number) => [number, number][]) => {
      const iv = ivAt(at - half).flatMap(([p, q]) =>
        ivAt(at + half).flatMap(([u, v]) =>
          Math.min(q, v) > Math.max(p, u) ? [[Math.max(p, u), Math.min(q, v)]] : [],
        ),
      );
      for (const [p, q] of iv) {
        // the gaps between crossing squares (any whose square reaches into this stretch), a cell clear of each
        let a = p + s;
        const push = (bb: number) => {
          const W = Math.floor((bb - a) / s);
          if (W >= 5) pieces.push({ dir, at, a, b: bb, W });
        };
        for (const x of across)
          if (x + half + s > a && x - half - s < q - s) {
            push(Math.min(x - half - s, q - s));
            a = Math.max(a, x + half + s);
          }
        push(q - s);
      }
    };
    rows.forEach(y => cut('h', y, cols, rowsAt));
    cols.forEach(x => cut('v', x, rows, colsAt));
    if (!pieces.length) continue;
    // reading order: horizontal straps top to bottom, right to left; then vertical ones right to left, top to bottom
    const order = [
      ...pieces.filter(p => p.dir === 'h').sort((p, q) => p.at - q.at || q.a - p.a),
      ...pieces.filter(p => p.dir === 'v').sort((p, q) => q.at - p.at || p.a - q.a),
    ];
    const all = order.reduce((x, p) => x + p.W, 0);
    for (const m of modes) {
      // spare straps: when there are too many, the longest pieces carry the text (kept in reading order)
      let chosen = order;
      if (order.length > m.segs.length || all > 1.9 * m.total) {
        const keep = new Set<LatticePiece>();
        let cap = 0;
        for (const p of [...order].sort((x, y) => y.W - x.W)) {
          if (cap >= 1.3 * m.total || keep.size >= m.segs.length) break;
          keep.add(p);
          cap += p.W;
        }
        chosen = order.filter(p => keep.has(p));
      }
      const caps = chosen.map(p => p.W),
        sum = caps.reduce((x, c) => x + c, 0);
      if (sum < m.total || sum > 2.2 * m.total || caps.length > m.segs.length) continue;
      const part = partition(repeatSegs(m.segs, 1), caps);
      if (!part) continue;
      const score = part.score + (m.mode === 'breaks' ? 0.12 : 0) + 0.25 * (1 - s / sMax) + 0.3 * (1 - sum / all);
      if (!best || score < best.score)
        best = {
          s,
          half,
          rows,
          cols,
          pieces,
          prep,
          score,
          text: chosen.map((piece, k) => ({ piece, groups: part.groups[k] as Segs })),
        };
    }
  }
  return best;
}

/** Letters on their pieces, then the strap edges, broken under the strap on top and clipped to the region. */
export function latticeItems(
  L: LatticePlan,
  region: Pt[],
  style: Style,
  script: ScriptEngine,
  wg: number,
  sid: number,
  ring: number,
): PlacedItem[] {
  const items: PlacedItem[] = [],
    o = layoutOpts(style, wg),
    s = L.s;
  for (const { piece: p, groups } of L.text) {
    const st = script.layout(groups, L.prep, p.W, { ...o, wrap: false });
    if (!st) continue;
    const off = (p.b - p.a - st.W * s) / 2,
      hb = (st.Hb * s) / 2;
    // horizontal: baseline below the strap's centre line; vertical: reading down, tops left, baseline right
    const place =
      p.dir === 'h'
        ? { type: 'line' as const, O: [p.a + off, p.at + hb] as Pt, t: [1, 0] as Pt, n: [0, -1] as Pt, s }
        : { type: 'line' as const, O: [p.at + hb, p.b - off] as Pt, t: [0, -1] as Pt, n: [-1, 0] as Pt, s };
    items.push({ type: 'strip', style: sid, strip: st, place, ring });
  }
  const b = bounds(region),
    h = L.half,
    lines: Pt[][] = [],
    holes: Pt[][] = [];
  for (const y of L.rows)
    for (const d of [-h, h])
      lines.push([
        [b.x0 - 1, y + d],
        [b.x1 + 1, y + d],
      ]);
  for (const x of L.cols)
    for (const d of [-h, h])
      lines.push([
        [x + d, b.y0 - 1],
        [x + d, b.y1 + 1],
      ]);
  // at each crossing the strap on top (horizontal when r + c is even) breaks the other's edges
  const w = h * 0.999,
    e = h * 1.5;
  L.rows.forEach((y, r) =>
    L.cols.forEach((x, c) =>
      holes.push(
        (r + c) % 2 === 0
          ? [
              [x - e, y - w],
              [x + e, y - w],
              [x + e, y + w],
              [x - e, y + w],
            ]
          : [
              [x - w, y - e],
              [x + w, y - e],
              [x + w, y + e],
              [x - w, y + e],
            ],
      ),
    ),
  );
  items.push({
    type: 'ribbon',
    style: sid,
    paths: clipToRegion(cutPolylines(lines, holes), region),
    width: Math.max(0.1, s * 0.35),
  });
  return items;
}

function lattice(f: LatticeNode, res: RegionResult, style: Style, ctx: Ctx, sid: number) {
  const slot = ctx.comp.texts[f.text],
    pts = res.inner!.pts,
    L = planLattice(slot.text, slot.wordGap, pts, style, ctx.script, (res.lastScale ?? 1) * 0.85);
  if (!L) {
    ctx.fill = { type: 'lattice', ok: false, note: "the text doesn't fit this region's straps" };
    return;
  }
  ctx.items.push(...latticeItems(L, pts, style, ctx.script, slot.wordGap, sid, ++ctx.ring));
  ctx.fill = { type: 'lattice', ok: true, scale: L.s, note: `${L.text.length} straps` };
}

registerFiller('lattice', (f, res, style, ctx, sid) => lattice(f as LatticeNode, res, style, ctx, sid));
