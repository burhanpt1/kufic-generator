// The decorative critic (lab deco.js decoMetrics, tools/noise.py; PORT-PLAN.md §5): it reads only an image, an ink mask
// and a field mask, so it judges engine output and a master's photograph alike. Its features follow M. Uğur Derman's
// rules of istif (even texture, no heavy knots, looseness at the top rather than the bottom, one body), plus span and
// fill, and the owner's "noise": unresolved contact, tiny notches where strokes nearly touch and pinholes between them.
// The weights, per genre, are fitted to the owner's pairwise ratings (fits.data.ts; npm run refit), the features
// measured on images of the rated compositions (tests/ratings) as on the engine's own roundels.
import type { Thuluth } from '../engine';
import { Alpha, toPixels } from '../raster';
import type { Roundel } from './compose';
import type { Finished, Unit } from './finish';
import { roundelParts } from './finish';
import { FITS } from './fits.data';

export interface DecoMetrics {
  /** Texture evenness: 1 − the spread of ink density blurred over about an eighth of the field. */
  uniformity: number;
  /** The share of the field that is a heavy knot (over twice the mean density). */
  knots: number;
  /** Emptiness in the top third less emptiness in the bottom third (> 0: looseness sits at the top, as it should). */
  looseTop: number;
  /** The share of the ink in the main body (ink joined within a small reach). */
  unity: number;
  /** Ink over field area, and the ink's span across the field (mean of width and height shares). */
  fill: number;
  span: number;
}

/** Decorative metrics of an ink mask in a field mask (row-major, y down). Tall-stem spacing, which never fired on
 *  roundels, is left out. */
export function decoMetrics(
  ink: Uint8Array,
  field: Uint8Array,
  W: number,
  H: number,
  o: { blur?: number; reach?: number } = {},
): DecoMetrics {
  let fx0 = W,
    fx1 = 0,
    fy0 = H,
    fy1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (field[y * W + x]) {
        fx0 = Math.min(fx0, x);
        fx1 = Math.max(fx1, x);
        fy0 = Math.min(fy0, y);
        fy1 = Math.max(fy1, y);
      }
  const rows = fy1 - fy0;
  // density at the scale of the composition's parts: a box blur over about an eighth of the field (summed-area table)
  const rad = Math.max(3, Math.round((o.blur ?? 0.125) * Math.max(fx1 - fx0, rows))),
    S = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += ink[y * W + x];
      S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row;
    }
  }
  const boxD = (x: number, y: number) => {
    const xa = Math.max(0, x - rad),
      xb = Math.min(W, x + rad),
      ya = Math.max(0, y - rad),
      yb = Math.min(H, y + rad);
    return (S[yb * (W + 1) + xb] - S[ya * (W + 1) + xb] - S[yb * (W + 1) + xa] + S[ya * (W + 1) + xa]) / ((xb - xa) * (yb - ya)); // prettier-ignore
  };
  const samples: { y: number; d: number }[] = [],
    step = Math.max(2, Math.round(rad / 2));
  for (let y = fy0 + rad; y <= fy1 - rad; y += step)
    for (let x = fx0 + rad; x <= fx1 - rad; x += step) if (field[y * W + x]) samples.push({ y, d: boxD(x, y) });
  const n = Math.max(1, samples.length),
    mean = samples.reduce((a, c) => a + c.d, 0) / n,
    sd = Math.sqrt(samples.reduce((a, c) => a + (c.d - mean) ** 2, 0) / n);
  const uniformity = Math.max(0, 1 - sd / Math.max(1e-6, mean)),
    knots = samples.filter(c => c.d > 2 * mean).length / n;
  const third = rows / 3,
    emptyIn = (a: number, b: number) => {
      const ss = samples.filter(c => c.y >= a && c.y < b);
      return ss.length ? ss.filter(c => c.d < 0.35 * mean).length / ss.length : 0;
    };
  const looseTop = emptyIn(fy0, fy0 + third) - emptyIn(fy1 - third, fy1 + 1);
  // organic unity: ink joined within a small reach is one body; the share of the ink in the largest
  const r = Math.max(2, Math.round((o.reach ?? 0.035) * Math.max(W, H))),
    near = new Uint8Array(W * H),
    lab = new Int32Array(W * H).fill(-1),
    comps: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (ink[y * W + x])
        for (let dy = -r; dy <= r; dy += r)
          for (let dx = -r; dx <= r; dx += r) {
            const xx = x + dx,
              yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1;
          }
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!near[i] || lab[i] >= 0) continue;
    lab[i] = comps.length;
    stack.push(i);
    let area = 0;
    while (stack.length) {
      const j = stack.pop()!;
      if (ink[j]) area++;
      const x = j % W,
        y = (j - x) / W;
      for (const [k, ok] of [
        [j + 1, x + 1 < W],
        [j - 1, x > 0],
        [j + W, y + 1 < H],
        [j - W, y > 0],
      ] as [number, boolean][])
        if (ok && near[k] && lab[k] < 0) {
          lab[k] = comps.length;
          stack.push(k);
        }
    }
    comps.push(area);
  }
  const total = comps.reduce((a, b) => a + b, 0),
    unity = comps.length ? Math.max(...comps) / Math.max(1, total) : 0;
  // coverage: how much of the field the ink covers, and how far it spans
  let ix0 = W,
    ix1 = 0,
    iy0 = H,
    iy1 = 0,
    area = 0,
    farea = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (field[i]) farea++;
      if (ink[i] && field[i]) {
        area++;
        ix0 = Math.min(ix0, x);
        ix1 = Math.max(ix1, x);
        iy0 = Math.min(iy0, y);
        iy1 = Math.max(iy1, y);
      }
    }
  const fill = area / Math.max(1, farea),
    span = area ? ((ix1 - ix0) / Math.max(1, fx1 - fx0) + (iy1 - iy0) / Math.max(1, fy1 - fy0)) / 2 : 0;
  return { uniformity, knots, looseTop, unity, fill, span };
}

/** The rated set's means and spreads of notches and pinholes (data/ratings/debris.json, columns 1 and 2). */
const NOISE_MU = [2.956928, 4.561053],
  NOISE_SD = [3.507794, 5.871337];
/** Pixel offsets of a disc of radius 2. */
const DISC2: [number, number][] = [];
for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) DISC2.push([x, y]);

/** Noise (tools/noise.py), for a mask about 480 pixels across: notches (pixels a closing with a disc of radius 2 adds,
 *  per hundred of ink) and pinholes (enclosed holes under 40 pixels, per ten thousand of ink), each standardised
 *  against the rated set and summed. Lower is quieter; the rated set spans about −1.3 to +2. Only ink in the field
 *  counts. */
export function noiseOf(ink: Uint8Array, field: Uint8Array, W: number, H: number): number {
  const m = new Uint8Array(W * H);
  let A = 1;
  for (let i = 0; i < W * H; i++)
    if (ink[i] && field[i]) {
      m[i] = 1;
      A++;
    }
  // closing: dilate, then erode (outside the image counts as empty, as in scipy)
  const dil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x])
        for (const [dx, dy] of DISC2) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) dil[yy * W + xx] = 1;
        }
  let notch = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (m[i] || !dil[i]) continue;
      let all = true;
      for (const [dx, dy] of DISC2) {
        const xx = x + dx,
          yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || !dil[yy * W + xx]) {
          all = false;
          break;
        }
      }
      if (all) notch++;
    }
  // holes: background not reached from the border (4-connected), counted as 4-connected pieces under 40 pixels
  const seen = new Uint8Array(W * H),
    stack: number[] = [];
  const flood = (start: number) => {
    let size = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const j = stack.pop()!;
      size++;
      const x = j % W,
        y = (j - x) / W;
      if (x + 1 < W && !m[j + 1] && !seen[j + 1]) {
        seen[j + 1] = 1;
        stack.push(j + 1);
      }
      if (x > 0 && !m[j - 1] && !seen[j - 1]) {
        seen[j - 1] = 1;
        stack.push(j - 1);
      }
      if (y + 1 < H && !m[j + W] && !seen[j + W]) {
        seen[j + W] = 1;
        stack.push(j + W);
      }
      if (y > 0 && !m[j - W] && !seen[j - W]) {
        seen[j - W] = 1;
        stack.push(j - W);
      }
    }
    return size;
  };
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (!m[y * W + x] && !seen[y * W + x]) flood(y * W + x);
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (!m[y * W + x] && !seen[y * W + x]) flood(y * W + x);
  let pin = 0;
  for (let i = 0; i < W * H; i++) if (!m[i] && !seen[i] && flood(i) < 40) pin++;
  const notches = (notch / A) * 100,
    pinholes = pin / (A / 10000);
  return (notches - NOISE_MU[0]) / NOISE_SD[0] + (pinholes - NOISE_MU[1]) / NOISE_SD[1];
}

/** The features the taste was fitted on. */
export interface DecoFeatures {
  texture: number;
  knots: number;
  looseTop: number;
  unity: number;
  span: number;
  fill: number;
  noise: number;
}
/** The genres judged apart (PLAN-2 §1): dense compositions of several words, single names, mirrored work. The
 *  critic's texture rules describe dense istif; a single-name roundel built on one gesture, or a mirrored design, is
 *  another genre, with its own fit. */
export type Genre = 'dense' | 'single' | 'mirror';
export const genreOf = (text: string, mirrored = false): Genre =>
  mirrored ? 'mirror' : text.trim().split(/\s+/).length > 1 ? 'dense' : 'single';
/** The order of the features in a fit. */
export const FEATURES: (keyof DecoFeatures)[] = ['texture', 'knots', 'looseTop', 'unity', 'span', 'fill', 'noise'];

/** Rasterise drawing units at about `px` pixels across a box, keeping only the letters and dots (`letters`) or all;
 *  `mirror` adds the mirror image about the vertical line x = mirror. */
export function rasterUnits(
  th: Thuluth,
  units: readonly Unit[],
  box: { x0: number; x1: number; y0: number; y1: number },
  px = 480,
  only: 'letters' | 'all' = 'all',
  mirror?: number,
): { ink: Uint8Array; W: number; H: number; K: number } {
  const nib = th.style.nib,
    K = px / Math.max(box.x1 - box.x0, box.y1 - box.y0),
    W = Math.ceil((box.x1 - box.x0) * K),
    H = Math.ceil((box.y1 - box.y0) * K),
    A = new Alpha(W, H);
  const draw = (fx: (x: number) => number) => {
    const X = (x: number) => (fx(x) - box.x0) * K,
      Y = (y: number) => (box.y1 - y) * K;
    for (const u of units) {
      if (u.dot) A.fill(toPixels(th.dotPolysAt(u.dot[0], u.dot[1], u.dot[2] ?? 1, u.dot[3] || 0), X, Y));
      else if (u.s && (only === 'all' || (u.nib || nib) > nib * 0.6))
        A.fill(toPixels(th.strokePolys({ ang: u.ang!, nib: u.nib, s: u.s }), X, Y));
    }
  };
  draw(x => x);
  if (mirror != null) draw(x => 2 * mirror - x);
  return { ink: A.mask(100), W, H, K };
}

/** The critic's features of a finished roundel, measured on everything drawn inside its frame as the rated images
 *  were. */
export function roundelFeatures(th: Thuluth, r: Roundel, f: Finished, px = 480): DecoFeatures {
  const units = roundelParts(r, { solved: f.solved, marks: f.marks, companion: f.companion }),
    d = r.disc,
    OV = d.oval || 1;
  let R = d.r * (f.discScale ?? 1.12);
  units.forEach(u => u.s?.forEach(q => (R = Math.max(R, Math.hypot((q.x - d.cx) / OV, q.y - d.cy) + th.style.nib * 0.7)))); // prettier-ignore
  return featuresIn(th, units, { cx: d.cx, cy: d.cy, rx: R * OV, ry: R }, px);
}

/** The critic's features of units in an elliptical field (centre, half-axes), optionally mirrored about x = mirror. */
export function featuresIn(
  th: Thuluth,
  units: readonly Unit[],
  e: { cx: number; cy: number; rx: number; ry: number },
  px = 480,
  mirror?: number,
): DecoFeatures {
  // the field fills the raster, and everything drawn counts: the fits were made on images of finished roundels, field
  // cropped to 480 pixels across (tests/ratings/masks)
  const h = Math.max(e.rx, e.ry),
    box = { x0: e.cx - h, x1: e.cx + h, y0: e.cy - h, y1: e.cy + h },
    all = rasterUnits(th, units, box, px, 'all', mirror),
    { W, H, K } = all,
    field = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ux = box.x0 + (x + 0.5) / K,
        uy = box.y1 - (y + 0.5) / K;
      if (((ux - e.cx) / e.rx) ** 2 + ((uy - e.cy) / e.ry) ** 2 < 1) field[y * W + x] = 1;
    }
  const m = decoMetrics(all.ink, field, W, H);
  return {
    texture: m.uniformity,
    knots: m.knots,
    looseTop: m.looseTop,
    unity: m.unity,
    span: m.span,
    fill: m.fill,
    noise: noiseOf(all.ink, field, W, H),
  };
}

/** The fitted taste of one roundel in its genre: its features standardised by the rated set's own means and spreads,
 *  weighted by the fit to the owner's votes (fits.data.ts, from npm run refit). Higher is better; 0 is the rated set's
 *  average. */
export function tasteScore(f: DecoFeatures, genre: Genre = 'dense'): number {
  const fit = FITS[genre];
  return fit.features.reduce((a, k, j) => a + (fit.w[j] * (f[k] - fit.mean[j])) / fit.sd[j], 0);
}
/** The fitted taste of each of a set of candidates, in one genre. */
export const tasteScores = (fs: readonly DecoFeatures[], genre: Genre = 'dense'): number[] =>
  fs.map(f => tasteScore(f, genre));
