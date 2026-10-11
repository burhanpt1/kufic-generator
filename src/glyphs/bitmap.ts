import type { Bitmap, GlyphDef } from '../types';

const cache = new Map<string, Bitmap>();
export const clearBitmapCache = () => cache.clear();

/** Rows -> bitmap (row 0 at the bottom). 7-row glyphs stretch row index 1 so ascenders reach height H. */
export function bitmap(d: GlyphDef, H: number): Bitmap {
  const rows = Array.isArray(d) ? d : d.rows,
    base = Array.isArray(d) ? 0 : d.base;
  if (!rows.length || !rows[0].length) return { w: 1, h: 1, data: new Uint8Array(1), base: 0 };
  const id = rows.join('|') + ':' + H + ':' + base;
  if (cache.has(id)) return cache.get(id)!;
  let r = rows.slice();
  if (r.length === 7 && H > 7) {
    const s = r[1];
    r = [r[0], ...Array(H - 7).fill(s), ...r.slice(1)];
  }
  const h = r.length,
    w = r[0].length,
    data = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) for (let x = 0; x < w; x++) if (r[row][x] === '#') data[(h - 1 - row) * w + x] = 1;
  const bm = { w, h, data, base };
  cache.set(id, bm);
  return bm;
}
