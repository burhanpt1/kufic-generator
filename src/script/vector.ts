import { Alpha } from './thuluth/raster';
import type { CellStrip, VectorStrip } from './types';

// VectorStrip paths: straight-line polygons only ("M x y L x y … Z"), in strip cells, y up from the band's outer edge.
export type Polygon = [number, number][];

/** The polygons of a VectorStrip path. */
export function parsePolys(d: string): Polygon[] {
  const out: Polygon[] = [];
  for (const part of d.split('Z')) {
    const body = part.trim();
    if (!body) continue;
    out.push(
      body
        .slice(1)
        .split('L')
        .map(pt => {
          const [x, y] = pt.trim().split(/\s+/).map(Number);
          return [x, y] as [number, number];
        }),
    );
  }
  return out;
}

/** Open polylines (M x y L x y …, no Z), as VectorStrip.lines writes them. */
export function parseLines(d: string): Polygon[] {
  return d
    .split('M')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.split('L').map(pt => pt.trim().split(/\s+/).map(Number) as [number, number]));
}

const cellsOf = new WeakMap<VectorStrip, CellStrip>();
/** A vector strip seen as cells (ink where a cell is at least a fifth covered; vowels as marks), for measures that
 *  read cells: the critic, the empty-space raster. */
export function rasterCells(st: VectorStrip): CellStrip {
  let c = cellsOf.get(st);
  if (c) return c;
  const W = Math.max(1, Math.ceil(st.W)),
    H = Math.max(1, Math.ceil(st.Hb)),
    data = new Uint8Array(W * H),
    tag = new Uint8Array(W * H);
  for (const p of st.paths) {
    const A = new Alpha(W, H);
    // cell rows count up from the outer edge; the rasteriser's rows count down
    A.fill(parsePolys(p.d).map(q => q.map(([x, y]) => [x, H - y] as [number, number])));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (A.a[(H - 1 - y) * W + x] > 50 && !data[y * W + x]) {
          data[y * W + x] = p.role === 'letter' ? 1 : 2;
          tag[y * W + x] = p.tag;
        }
  }
  c = { kind: 'cells', W, Hb: H, base: st.base, data, tag };
  cellsOf.set(st, c);
  return c;
}
