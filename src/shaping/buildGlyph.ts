import { bitmap } from '../glyphs/bitmap';
import { COMB, DOTS, HAMZA_ON, ORDER, S } from '../glyphs/marks';
import { def } from '../glyphs/overrides';
import { ANCHOR, ANCHOR_BELOW } from '../glyphs/tables';
import type { Form, GlyphDef, MarksMode, Unit, VowelStyle } from '../types';

interface Mark {
  side: string;
  shape: string;
  layer: number;
  ax: number | null | undefined;
}
interface PlacedMark extends Mark {
  s: { w: number; h: number; c: [number, number][] };
  v: number;
  x0: number | null;
  y0: number;
}
/** cells: [x, y, v] with v 1 letter, 2 vowel, 3 dot; y up, 0 = baseline. */
export interface Glyph {
  w: number;
  cells: [number, number, number][];
  top: number;
  bottom: number;
  form: Form;
  key: string;
}

// marks for one unit -> [{side, shape, layer, ax}]
export function unitMarks(u: Unit, mode: MarksMode, style: VowelStyle): Mark[] {
  const out: Mark[] = [];
  if (mode === 'off') return out;
  for (const p of u.parts) {
    const dot = DOTS[p.c];
    if (dot) {
      const [side, sh0] = dot.split(':');
      const onlyJoin = sh0.endsWith('*');
      const sh = sh0.replace('*', '');
      if (!onlyJoin || u.form === 'ini' || u.form === 'med') out.push({ side, shape: sh, layer: 1, ax: p.ax });
    }
    if (HAMZA_ON[p.c]) {
      const [side, sh] = HAMZA_ON[p.c].split(':');
      out.push({ side, shape: sh, layer: 1, ax: p.ax });
    }
    if (mode === 'all')
      for (const m of p.marks) {
        let [side, sh] = COMB[m];
        const layer = COMB[m][2];
        if (style === 'early' && layer === 2) {
          if (sh === 'fatha') sh = 'd1';
          else if (sh === 'kasra') sh = 'd1';
          else if (sh === 'fathatan' || sh === 'kasratan') sh = 'd2';
          else if (sh === 'damma') {
            side = 's';
            sh = 'd1';
          } else if (sh === 'dammatan') {
            side = 's';
            sh = 'v2';
          }
        }
        out.push({ side, shape: sh, layer, ax: p.ax });
      }
    else
      for (const m of p.marks)
        if (COMB[m][2] === 1) {
          const [side, sh] = COMB[m];
          out.push({ side, shape: sh, layer: 1, ax: p.ax });
        }
  }
  out.sort((a, b) => ORDER[a.shape] - ORDER[b.shape]);
  return out;
}

const shapeCells = (rows: string[]) => {
  const c: [number, number][] = [];
  rows.forEach((r, ri) =>
    [...r].forEach((ch, x) => {
      if (ch === '#') c.push([x, rows.length - 1 - ri]);
    }),
  );
  return { w: rows[0].length, h: rows.length, c };
};

// build a glyph with marks: { w, cells:[[x,y,v]], top, bottom, form }  v: 1 letter, 2 vowel, 3 dot
// Marks above sit side by side in one lane; marks that would rise past the ascender go in a lane beside the letter.
export function buildGlyph(u: Unit, H: number, mode: MarksMode, style: VowelStyle, d?: GlyphDef): Glyph {
  const bm = bitmap(d ?? def(u.key, u.form), H);
  const all = unitMarks(u, mode, style).map(
    m => ({ ...m, s: shapeCells(S[m.shape]), v: m.layer === 2 ? 2 : 3 }) as PlacedMark,
  );
  const centre = Math.floor((bm.w - 1) / 2);
  const anchorOf = (m: PlacedMark, tbl: Partial<Record<Form, number>> | undefined) =>
    m.ax != null ? m.ax : tbl && tbl[u.form] != null ? tbl[u.form]! : centre;
  const colTop = new Array(bm.w).fill(-1),
    colBot = new Array(bm.w).fill(0);
  for (let y = 0; y < bm.h; y++)
    for (let x = 0; x < bm.w; x++)
      if (bm.data[y * bm.w + x]) {
        colTop[x] = y - bm.base;
        colBot[x] = Math.min(colBot[x], y - bm.base);
      }
  const lane = (items: PlacedMark[], ax: number) => {
    // lay items right-to-left (reading order) centred on ax
    const tw = items.reduce((a, m) => a + m.s.w, 0) + Math.max(0, items.length - 1);
    let x = ax + Math.floor(tw / 2) + 1; // exclusive right edge
    items.forEach(m => {
      x -= m.s.w;
      m.x0 = x;
      x -= 1;
    });
  };
  const above = all.filter(m => m.side === 'a'),
    below = all.filter(m => m.side === 'b'),
    side = all.filter(m => m.side === 's');
  // group above marks by anchor (lam-alef has two anchors)
  const groups = new Map<number, PlacedMark[]>();
  above.forEach(m => {
    const a = anchorOf(m, ANCHOR[u.key]);
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a)!.push(m);
  });
  groups.forEach((items, a) => {
    lane(items, a);
    let tooTall = false;
    items.forEach(m => {
      let y0 = 2;
      for (let x = m.x0! - 1; x <= m.x0! + m.s.w; x++) if (x >= 0 && x < bm.w) y0 = Math.max(y0, colTop[x] + 2);
      m.y0 = y0;
      if (y0 + m.s.h - 1 > H - 1) tooTall = true;
    });
    if (tooTall)
      items.forEach(m => {
        m.side = 's';
        side.push(m);
      });
  });
  const bGroups = new Map<number, PlacedMark[]>();
  below.forEach(m => {
    const a = anchorOf(m, ANCHOR_BELOW[u.key] || ANCHOR[u.key]);
    if (!bGroups.has(a)) bGroups.set(a, []);
    bGroups.get(a)!.push(m);
  });
  bGroups.forEach((items, a) => {
    lane(items, a);
    items.forEach(m => {
      let b = 0;
      for (let x = m.x0! - 1; x <= m.x0! + m.s.w; x++) if (x >= 0 && x < bm.w) b = Math.min(b, colBot[x]);
      m.y0 = b - 1 - m.s.h;
    });
  });
  // side lane, left of the letter, stacked upward from row 2
  let sideW = 0,
    sy = 2;
  side.forEach(m => {
    sideW = Math.max(sideW, m.s.w);
  });
  side.forEach(m => {
    m.x0 = null;
    m.y0 = sy;
    sy += m.s.h + 1;
  });
  let minX = 0,
    maxX = bm.w - 1;
  all.forEach(m => {
    if (m.side !== 's') {
      minX = Math.min(minX, m.x0!);
      maxX = Math.max(maxX, m.x0! + m.s.w - 1);
    }
  });
  const padL = Math.max(-minX, sideW ? sideW + 1 : 0),
    padR = maxX - (bm.w - 1),
    w = bm.w + padL + padR;
  const cells: [number, number, number][] = [];
  let top = 0,
    bottom = 0;
  const put = (x: number, y: number, v: number) => {
    cells.push([x, y, v]);
    top = Math.max(top, y);
    bottom = Math.min(bottom, y);
  };
  for (let y = 0; y < bm.h; y++)
    for (let x = 0; x < bm.w; x++) if (bm.data[y * bm.w + x]) put(x + padL, y - bm.base, 1);
  for (let x = 0; x < padL; x++) if (u.jn) put(x, 0, 1);
  for (let x = bm.w + padL; x < w; x++) if (u.jp) put(x, 0, 1);
  all.forEach(m => {
    const x0 = m.side === 's' ? Math.floor((sideW - m.s.w) / 2) : m.x0! + padL;
    m.s.c.forEach(([x, y]) => put(x0 + x, m.y0 + y, m.v));
  });
  return { w, cells, top, bottom, form: u.form, key: u.key };
}
