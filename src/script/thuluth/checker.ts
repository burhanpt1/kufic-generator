// The rasm confusion matrix (the lab's checker.js confusionReport): every letter form drawn alone without its dots,
// scored against every other letter's form in the same position as 1 − IoU of one-pixel-dilated rasters, at the best
// shift within `reach` pen units. Low scores are shapes a reader can mistake for each other. Written pair lists catch
// the confusions someone thought of; this catches the rest (it found the short lam, the isolated ba that read as ra,
// the medial kaf that read as lam and the initial heh that matched fa).
import type { Thuluth } from './engine';
import { sampleStroke } from './pen';
import { Alpha, toPixels } from './raster';
import { FAM, FORM_FAM } from './shape';
import type { Form, GlyphDef, SkelPt, Stroke } from './types';

/** One letter of each shape family (the others share its forms and differ by their dots). */
export const RASM_LETTERS = [...'ابحدرسصطعفقكلمنهوي'];
export const FORMS: Form[] = ['ini', 'med', 'fin', 'iso'];
/** Letters that write a position with the same shape: fa and qaf begin alike, and so do the tooth letters, nun and
 *  ya. Their distance is about 0 by design. */
const SHARED = (f: Form) =>
  f === 'ini' || f === 'med'
    ? [
        ['ف', 'ق'],
        ['ب', 'ن', 'ي'],
      ]
    : [];
/** Letters that never take a position (they don't join onwards, or are written only as a ligature). */
const NOJOIN = new Set([...'ادروز']);

export interface Confusion {
  a: string;
  b: string;
  form: Form;
  /** 1 − IoU at the best shift: 0 is the same shape. */
  d: number;
}

function strokesOf(th: Thuluth, g: GlyphDef): Stroke[] {
  const st = th.style,
    k = typeof st.slant === 'number' ? st.slant : st.slant === 'left' ? -0.06 : st.slant === 'right' ? 0.14 : 0;
  return g.s.map(sd => ({
    ang: sd.ang ?? st.ang,
    s: sampleStroke((sd.lean ? sd.pts.map(([x, y, w, c]) => [x + k * y, y, w, c]) : sd.pts) as SkelPt[], st.tension),
  }));
}

/** A dilated raster of a glyph's ink, K px per pen unit, its right edge and baseline at a fixed spot. */
function raster(th: Thuluth, g: GlyphDef, K: number, pad: number) {
  const ss = strokesOf(th, g);
  let x1 = -1e9;
  ss.forEach(s => s.s.forEach(q => (x1 = Math.max(x1, q.x))));
  const W = Math.ceil((16 + 2 * pad) * K),
    H = Math.ceil((26 + 2 * pad) * K),
    A = new Alpha(W, H),
    X = (x: number) => (x - x1 + 14 + pad) * K,
    Y = (y: number) => (13 + pad - y) * K;
  ss.forEach(s => A.fill(toPixels(th.strokePolys(s), X, Y)));
  const m = A.mask(100),
    d = new Uint8Array(m.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x])
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H) d[yy * W + xx] = 1;
          }
  return { d, W, H };
}

/** 1 − the best IoU of two rasters over shifts of up to s pixels. */
function distance(a: ReturnType<typeof raster>, b: ReturnType<typeof raster>, s: number): number {
  const { W, H } = a;
  let na = 0,
    nb = 0;
  for (let i = 0; i < a.d.length; i++) {
    na += a.d[i];
    nb += b.d[i];
  }
  let best = 0;
  for (let sy = -s; sy <= s; sy++)
    for (let sx = -s; sx <= s; sx++) {
      let inter = 0;
      for (let y = Math.max(0, sy); y < Math.min(H, H + sy); y++) {
        const ra = y * W,
          rb = (y - sy) * W - sx;
        for (let x = Math.max(0, sx); x < Math.min(W, W + sx); x++) inter += a.d[ra + x] & b.d[rb + x];
      }
      const iou = inter / (na + nb - inter);
      if (iou > best) best = iou;
    }
  return 1 - best;
}

/** Every pair of distinct letter shapes in the same position, closest first. */
export function confusionMatrix(th: Thuluth, o: { K?: number; reach?: number } = {}): Confusion[] {
  const K = o.K ?? 3,
    s = Math.round((o.reach ?? 1.5) * K),
    out: Confusion[] = [];
  for (const form of FORMS) {
    const ls = RASM_LETTERS.filter(c => !((form === 'ini' || form === 'med') && NOJOIN.has(c))).filter(c => th.glyphFor(c, form)); // prettier-ignore
    const shared = SHARED(form),
      same = (a: string, b: string) => shared.some(g => g.includes(a) && g.includes(b)),
      R = new Map(ls.map(c => [c, raster(th, th.glyphFor(c, form)!, K, 1.5)]));
    for (let i = 0; i < ls.length; i++)
      for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i],
          b = ls[j];
        if (same(a, b) || th.glyphFor(a, form) === th.glyphFor(b, form)) continue;
        out.push({ a, b, form, d: distance(R.get(a)!, R.get(b)!, s) });
      }
  }
  return out.sort((p, q) => p.d - q.d);
}

/** The family a letter takes in a position (for reports). */
export const familyAt = (c: string, form: Form) => FORM_FAM[c + '|' + form] || FAM[c];
