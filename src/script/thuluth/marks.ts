// Vowel marks for a line of thuluth (lab roundel.js MARK_SHAPES / ring.js lineMarks): each mark belongs to the
// letter it follows and is written with a pen a third of the letters', in free space over (or under) its letter and
// inside the band.
import type { Built, Thuluth } from './engine';
import { isLetter } from './engine';
import { sampleStroke } from './pen';
import { Alpha, toPixels } from './raster';
import type { MarkName, WordMark } from './shape';
import { BELOW } from './shape';
import type { SkelPt, Stroke } from './types';

/** Mark shapes as pen strokes, centred, in mark units. */
export const MARK_SHAPES: Record<MarkName, SkelPt[][]> = {
  fatha: [[[0.75, 0.4, 0.3], [0.2, 0.1, 1], [-0.75, -0.4, 0.4]]],
  kasra: [[[0.75, 0.4, 0.3], [0.2, 0.1, 1], [-0.75, -0.4, 0.4]]],
  damma: [[[0.15, 0.25, 0.6], [-0.15, 0.75], [-0.6, 0.5], [-0.45, 0.05], [0.05, 0.05], [0.0, -0.45, 0.8], [-0.55, -0.85, 0.2]]],
  shadda: [[[1.0, 0.15, 0.4], [0.7, 0.6], [0.4, 0.05, 1, 1], [0.05, 0.55], [-0.3, 0.05, 1, 1], [-0.6, 0.55], [-0.95, 0.25, 0.4]]],
  sukun: [[[0.3, 0.4, 0.6], [-0.25, 0.45], [-0.45, 0.0], [-0.1, -0.35], [0.35, -0.1], [0.3, 0.4, 0.6]]],
  fathatan: [[[0.75, 0.75, 0.3], [0.2, 0.45, 1], [-0.75, -0.05, 0.4]], [[0.75, -0.05, 0.3], [0.2, -0.35, 1], [-0.75, -0.85, 0.4]]],
  kasratan: [[[0.75, 0.75, 0.3], [0.2, 0.45, 1], [-0.75, -0.05, 0.4]], [[0.75, -0.05, 0.3], [0.2, -0.35, 1], [-0.75, -0.85, 0.4]]],
  dammatan: [[[0.15, 0.25, 0.6], [-0.15, 0.75], [-0.6, 0.5], [-0.45, 0.05], [0.05, 0.05], [0.0, -0.45, 0.8], [-0.55, -0.85, 0.2], [-0.2, -0.6, 0.3], [0.5, -0.2, 0.2]]],
  alifk: [[[0.2, 0.9, 0.3], [0.05, 0.4, 1], [-0.1, -0.8, 0.5]]],
  hamza: [[[0.45, 0.55, 0.4], [-0.15, 0.7], [-0.45, 0.25], [0.05, -0.05], [0.55, 0.05, 0.8], [-0.5, -0.55, 0.3]]],
  hamzaB: [[[0.45, 0.55, 0.4], [-0.15, 0.7], [-0.45, 0.25], [0.05, -0.05], [0.55, 0.05, 0.8], [-0.5, -0.55, 0.3]]],
  madda: [[[0.9, 0.0, 0.4], [0.45, 0.4], [-0.1, 0.0], [-0.55, 0.35], [-0.9, 0.15, 0.4]]],
}; // prettier-ignore
/** Mark boxes (width, height) in mark units. */
export const MARK_SIZE: Record<MarkName, [number, number]> = {
  hamza: [1.2, 1.3], hamzaB: [1.2, 1.3], madda: [1.9, 0.6], shadda: [2.1, 1.0], damma: [1.1, 1.8], dammatan: [1.4, 1.9],
  sukun: [1.0, 1.0], alifk: [0.6, 1.9], fathatan: [1.6, 1.7], kasratan: [1.6, 1.7], fatha: [1.6, 0.9], kasra: [1.6, 0.9],
}; // prettier-ignore

/** Strokes for one mark at (x, y). */
export const markStrokes = (m: MarkName, x: number, y: number, scale: number, nib: number, tension: number): Stroke[] =>
  (MARK_SHAPES[m] || []).map(sh => ({
    ang: 70,
    nib,
    mark: true,
    s: sampleStroke(
      sh.map(([a, b, w, c]) => [x + a * scale, y + b * scale, w ?? 1, c] as SkelPt),
      tension,
    ),
  }));

/** Place the vowels of a built line in free space within [yBot, yTop] (lab lineMarks). Marks that find no room are
 *  counted in `missing`. */
export function lineMarks(
  th: Thuluth,
  bs: Built,
  marks: WordMark[][],
  yTop: number,
  yBot: number,
  markScale = 1.5,
): { strokes: Stroke[]; missing: number } {
  const nib = th.style.nib,
    K = 2,
    out: Stroke[] = [];
  let x0 = 1e9,
    x1 = -1e9,
    missing = 0;
  bs.strokes.forEach(s => s.s.forEach(q => ((x0 = Math.min(x0, q.x)), (x1 = Math.max(x1, q.x)))));
  x0 -= 2;
  x1 += 2;
  const y0 = yBot - 1,
    y1 = yTop + 1,
    Wd = Math.ceil((x1 - x0) * K),
    Hd = Math.ceil((y1 - y0) * K);
  const X = (x: number) => (x - x0) * K,
    Y = (y: number) => (y1 - y) * K,
    A = new Alpha(Wd, Hd);
  bs.strokes.forEach(s => A.fill(toPixels(th.strokePolys(s, 1.5), X, Y)));
  bs.dots.forEach(([a, b]) => A.fill(toPixels(th.dotPolysAt(a, b, 1.4), X, Y)));
  const occ = A.mask(60);
  marks.forEach((ms, wi) =>
    ms.forEach(({ li, m }) => {
      const p = bs.placed.find(q => isLetter(q) && q.wi === wi && q.li === li);
      if (!p || !isLetter(p)) return;
      const pts = p.g.s.flatMap(st => st.pts.map(q => [q[0] + p.ox, q[1] + (p.oy || 0)]));
      const lx = pts.reduce((a, q) => a + q[0], 0) / pts.length,
        top = Math.max(...pts.map(q => q[1])),
        bot = Math.min(...pts.map(q => q[1])),
        below = BELOW.has(m);
      const [w0, h0] = MARK_SIZE[m] || [1.4, 1.2],
        w = w0 * markScale,
        h = h0 * markScale;
      let spot: [number, number] | null = null;
      for (let rad = 0; rad <= 6 && !spot; rad += 0.3)
        for (let a = 0; a < 20; a++) {
          const mx = lx + Math.cos((a / 20) * 6.283) * rad,
            my = (below ? bot - h / 2 - 0.4 : top + h / 2 + 0.4) + Math.sin((a / 20) * 6.283) * rad * 0.6;
          if (below ? my + h / 2 > bot - 0.2 : my - h / 2 < Math.min(top, 3.0) + 0.2) continue;
          if (my + h / 2 > yTop || my - h / 2 < yBot) continue;
          const ax = Math.floor(X(mx - w / 2)),
            bx = Math.ceil(X(mx + w / 2)),
            ay = Math.floor(Y(my + h / 2)),
            by = Math.ceil(Y(my - h / 2));
          let ok = true;
          for (let y = ay; y <= by && ok; y++)
            for (let x = ax; x <= bx; x++)
              if (x < 0 || y < 0 || x >= Wd || y >= Hd || occ[y * Wd + x]) {
                ok = false;
                break;
              }
          if (ok) {
            spot = [mx, my];
            for (let y = ay - 1; y <= by + 1; y++)
              for (let x = ax - 1; x <= bx + 1; x++) if (x >= 0 && y >= 0 && x < Wd && y < Hd) occ[y * Wd + x] = 1;
            break;
          }
        }
      if (!spot) {
        missing++;
        return;
      }
      out.push(...markStrokes(m, spot[0], spot[1], markScale, nib * 0.34, th.style.tension));
    }),
  );
  return { strokes: out, missing };
}
