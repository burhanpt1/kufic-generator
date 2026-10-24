// Finishing a roundel (lab roundel.js): the vowels placed near their letters (a quick greedy pass, or the global
// solver), an optional companion text set small in the largest space left, and everything to draw in writing order.
import type { Built, Dot, Thuluth } from '../engine';
import { isLetter } from '../engine';
import { MARK_SIZE, markStrokes } from '../marks';
import { Alpha, toPixels } from '../raster';
import type { MarkName } from '../shape';
import { BELOW, parseVowels } from '../shape';
import type { Sample, Stroke } from '../types';
import type { Roundel } from './compose';
import { fieldTest } from './fields';
import type { SolveOptions, Solved } from './solve';
import { solveMarks } from './solve';

/** The occupancy raster the greedy pass leaves behind, for the companion text. */
interface Occ {
  occ: Uint8Array;
  Wd: number;
  Hd: number;
  K: number;
  X: (x: number) => number;
  Y: (y: number) => number;
}
export interface MarkOptions {
  discScale?: number;
  markScale?: number;
}
/** Place vowel marks near their letters, in free space, with a finer pen (the greedy pass). */
export function placeMarks(
  th: Thuluth,
  r: Roundel,
  o: MarkOptions = {},
): { strokes: Stroke[]; missing: number; occ: Occ } {
  const nib = th.style.nib,
    K = 2,
    out: Stroke[] = [],
    D = r.disc,
    RD = D.r * (o.discScale || 1.12) - 1.2;
  let missing = 0;
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  r.shapes.forEach((S, i) => {
    x0 = Math.min(x0, r.st[i].x + S.x0);
    x1 = Math.max(x1, r.st[i].x + S.x1);
    y0 = Math.min(y0, r.st[i].y + S.y0);
    y1 = Math.max(y1, r.st[i].y + S.y1);
  });
  // a shaped field confines the marks to its outline (the disc is the greedy pass's own, round field otherwise)
  const FT = D.field ? fieldTest(D, o.discScale || 1.12, 1.2) : null;
  x0 = Math.min(x0, (FT?.x0 ?? D.cx - RD) - 3);
  x1 = Math.max(x1, (FT?.x1 ?? D.cx + RD) + 3);
  y0 = Math.min(y0, (FT?.y0 ?? D.cy - RD) - 3);
  y1 = Math.max(y1, (FT?.y1 ?? D.cy + RD) + 3);
  const Wd = Math.ceil((x1 - x0) * K),
    Hd = Math.ceil((y1 - y0) * K),
    X = (x: number) => (x - x0) * K,
    Y = (y: number) => (y1 - y) * K,
    A = new Alpha(Wd, Hd);
  r.shapes.forEach((S, i) =>
    S.b.strokes.forEach(
      s =>
      A.fill(toPixels(th.strokePolys({ ...s, s: s.s.map(q => ({ x: q.x + r.st[i].x, y: q.y + r.st[i].y, w: q.w })) }, 1.6), X, Y)), // prettier-ignore
    ),
  );
  const occ = A.mask(60);
  const inDisc = (mx: number, my: number, w: number, h: number) => (FT ? FT.inside(mx, my, Math.hypot(w, h) / 2) : Math.hypot(mx - D.cx, my - D.cy) + Math.hypot(w, h) / 2 < RD); // prettier-ignore
  const free = (mx: number, my: number, w: number, h: number) => {
    if (!inDisc(mx, my, w, h)) return false;
    const ax = Math.floor(X(mx - w / 2)),
      bx = Math.ceil(X(mx + w / 2)),
      ay = Math.floor(Y(my + h / 2)),
      by = Math.ceil(Y(my - h / 2));
    if (ax < 0 || ay < 0 || bx >= Wd || by >= Hd) return false;
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (occ[y * Wd + x]) return false;
    return true;
  };
  const claim = (mx: number, my: number, w: number, h: number) => {
    const ax = Math.floor(X(mx - w / 2 - 0.4)),
      bx = Math.ceil(X(mx + w / 2 + 0.4)),
      ay = Math.floor(Y(my + h / 2 + 0.4)),
      by = Math.ceil(Y(my - h / 2 - 0.4));
    for (let y = Math.max(0, ay); y <= Math.min(Hd - 1, by); y++)
      for (let x = Math.max(0, ax); x <= Math.min(Wd - 1, bx); x++) occ[y * Wd + x] = 1;
  };
  r.shapes.forEach((S, i) => {
    const g = r.groups[i],
      gs = g.sc || 1;
    if (!g.marks || !g.marks.length) return;
    // stack shadda with its vowel: shadda first, then the vowel just above or below it
    const byLetter = new Map<number, MarkName[]>();
    g.marks.forEach(m => byLetter.set(m.k, [...(byLetter.get(m.k) || []), m.m]));
    byLetter.forEach((ms, k) => {
      const p = S.b.placed.find(q => isLetter(q) && q.li === k);
      if (!p || !isLetter(p)) return;
      const pts = p.g.s.flatMap(st => st.pts.map(q => [q[0] * gs + p.ox + r.st[i].x, q[1] * gs + (p.oy || 0) + r.st[i].y])); // prettier-ignore
      const lx = pts.reduce((a, q) => a + q[0], 0) / pts.length,
        top = Math.max(...pts.map(q => q[1])),
        bot = Math.min(...pts.map(q => q[1])),
        span = (Math.max(...pts.map(q => q[0])) - Math.min(...pts.map(q => q[0]))) / 2;
      ms.sort((a, b) => (a === 'shadda' ? -1 : b === 'shadda' ? 1 : 0));
      ms.forEach(m => {
        const ms2 = (o.markScale || 1.6) * gs,
          [w0, h0] = MARK_SIZE[m] || [1.4, 1.2],
          w = w0 * ms2,
          h = h0 * ms2,
          below = BELOW.has(m),
          base = (p.oy || 0) + r.st[i].y,
          ay = below ? Math.min(bot, base) - 1.4 * gs : Math.max(top - 2.5 * gs, base + 2.2 * gs);
        // search outward from the anchor for a free spot, preferring the side the mark belongs on
        let best: [number, number] | null = null;
        for (let rad = 0; rad <= 12 * gs && !best; rad += 0.5 * gs)
          for (let a = 0; a < 24; a++) {
            const ang2 = (a / 24) * 2 * Math.PI,
              mx = lx + Math.cos(ang2) * rad,
              my = ay + Math.sin(ang2) * rad * 0.8;
            if (below ? my > ay + 1.5 : my < ay - 1.0) continue;
            // a mark sits over (or under) its letter, never level with it, where it could be misread as a letter
            if (below ? my + h / 2 > bot - 0.25 * gs : my - h / 2 < top + 0.25 * gs) continue;
            if (Math.abs(mx - lx) > span + 3.0 * gs) continue;
            if (free(mx, my, w + 0.6, h + 0.6)) {
              best = [mx, my];
              break;
            }
          }
        if (!best) {
          missing++;
          return;
        }
        claim(best[0], best[1], w, h);
        out.push(...markStrokes(m, best[0], best[1], ms2, nib * 0.75 * gs, th.style.tension));
      });
    });
  });
  return { strokes: out, missing, occ: { occ, Wd, Hd, K, X, Y } };
}

export interface Companion {
  strokes: Stroke[];
  dots: Dot[];
  sc: number;
}
/** The companion text: set smaller, in the largest free space inside the disc. */
export function placeCompanion(th: Thuluth, r: Roundel, text: string, occ: Occ, o: MarkOptions = {}): Companion | null {
  if (!text || !text.trim()) return null;
  const nib = th.style.nib,
    D = r.disc,
    RD = D.r * (o.discScale || 1.12) - 1.0,
    FC = D.field ? fieldTest(D, o.discScale || 1.12, 1.0) : null,
    { Wd, Hd, X, Y, K } = occ,
    oc = occ.occ;
  const pv = parseVowels(text),
    bs: Built = th.buildStrokes(pv.bare, { noAuto: false });
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  bs.strokes.forEach(s =>
    s.s.forEach(q => {
      x0 = Math.min(x0, q.x);
      x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y);
      y1 = Math.max(y1, q.y);
    }),
  );
  let best: { sc: number; gx: number; gy: number; cx: number; cy: number } | null = null;
  for (const sc of [0.46, 0.4, 0.35, 0.3, 0.26, 0.22, 0.19]) {
    const pts: [number, number][] = [];
    bs.strokes.forEach(s => s.s.forEach((q, i) => i % 2 === 0 && pts.push([(q.x - (x0 + x1) / 2) * sc, (q.y - (y0 + y1) / 2) * sc]))); // prettier-ignore
    const pad = nib * sc * 0.9 + 0.5,
      cand: [number, number, number][] = [];
    for (let gy = D.cy - RD; gy <= D.cy + RD; gy += 0.4)
      for (let gx = D.cx - RD; gx <= D.cx + RD; gx += 0.4) {
        let ok = true;
        for (const [px, py] of pts) {
          const mx = gx + px,
            my = gy + py;
          if (FC ? !FC.inside(mx, my, pad) : Math.hypot(mx - D.cx, my - D.cy) > RD - pad) {
            ok = false;
            break;
          }
          const ix = Math.round(X(mx)),
            iy = Math.round(Y(my)),
            rr = Math.ceil(pad * K);
          for (let dy = -rr; dy <= rr && ok; dy += 2)
            for (let dx = -rr; dx <= rr; dx += 2) {
              const xx = ix + dx,
                yy = iy + dy;
              if (xx < 0 || yy < 0 || xx >= Wd || yy >= Hd || oc[yy * Wd + xx]) {
                ok = false;
                break;
              }
            }
          if (!ok) break;
        }
        if (ok) cand.push([gx, gy, -(gy - D.cy) * 0.3 - Math.hypot(gx - D.cx, gy - D.cy) * 0.1]);
      }
    if (cand.length) {
      cand.sort((a, b) => b[2] - a[2]);
      best = { sc, gx: cand[0][0], gy: cand[0][1], cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
      break;
    }
  }
  if (!best) return null;
  const B = best,
    T2 = (q: { x: number; y: number; w?: number }): Sample => ({ x: B.gx + (q.x - B.cx) * B.sc, y: B.gy + (q.y - B.cy) * B.sc, w: q.w ?? 1 }); // prettier-ignore
  const strokes: Stroke[] = bs.strokes.map(s => ({ ...s, nib: (s.nib || nib) * B.sc, s: s.s.map(T2) }));
  // the companion's own vowel marks, placed near their letters in the space that is left
  strokes.forEach(s =>
    s.s.forEach(q => {
      const ix = Math.round(X(q.x)),
        iy = Math.round(Y(q.y));
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = ix + dx,
            yy = iy + dy;
          if (xx >= 0 && yy >= 0 && xx < Wd && yy < Hd) oc[yy * Wd + xx] = 1;
        }
    }),
  );
  const sc = B.sc,
    ms2 = 1.6 * sc;
  pv.marks.forEach((ms, wi) =>
    ms.forEach(({ li, m }) => {
      const p = bs.placed.find(q => isLetter(q) && q.wi === wi && q.li === li);
      if (!p || !isLetter(p)) return;
      const pts = p.g.s.flatMap(st => st.pts.map(q => T2({ x: q[0] + p.ox, y: q[1] + (p.oy || 0) })));
      const lx = pts.reduce((a, q) => a + q.x, 0) / pts.length,
        top = Math.max(...pts.map(q => q.y)),
        bot = Math.min(...pts.map(q => q.y)),
        below = BELOW.has(m);
      const [w0, h0] = MARK_SIZE[m] || [1.4, 1.2],
        w = w0 * ms2,
        h = h0 * ms2;
      const ay = below ? bot - h * 0.8 : Math.max(top - 2.0 * sc, B.gy + 1.6 * sc);
      let spot: [number, number] | null = null;
      for (let rad = 0; rad <= 4 * sc + 1 && !spot; rad += 0.25)
        for (let a = 0; a < 12; a++) {
          const mx = lx + Math.cos((a / 12) * 6.283) * rad,
            my = ay + Math.sin((a / 12) * 6.283) * rad * 0.7;
          const ax = Math.floor(X(mx - w / 2)),
            bx = Math.ceil(X(mx + w / 2)),
            ay2 = Math.floor(Y(my + h / 2)),
            by = Math.ceil(Y(my - h / 2));
          let ok = FC ? FC.inside(mx, my) : Math.hypot(mx - D.cx, my - D.cy) < RD;
          for (let y = ay2; y <= by && ok; y++)
            for (let x = ax; x <= bx; x++)
              if (x < 0 || y < 0 || x >= Wd || y >= Hd || oc[y * Wd + x]) {
                ok = false;
                break;
              }
          if (ok) {
            spot = [mx, my];
            break;
          }
        }
      if (spot) strokes.push(...markStrokes(m, spot[0], spot[1], ms2, nib * 0.34 * sc, th.style.tension));
    }),
  );
  return { strokes, dots: bs.dots.map(([a, b]) => { const q = T2({ x: a, y: b }); return [q.x, q.y, B.sc] as Dot; }), sc: B.sc }; // prettier-ignore
}

/** One thing to draw: a stroke, or a dot. */
export interface Unit {
  s?: Sample[];
  ang?: number;
  nib?: number;
  tint?: string;
  mark?: boolean;
  orn?: boolean;
  dot?: Dot;
  /** The group a letter stroke belongs to (its place in reading order), and the letter of each sample. */
  gi?: number;
  own?: number[];
}
/** Everything to draw, in writing order: the letters, their dots and marks, then the companion. */
export function roundelParts(
  r: Roundel,
  o: { solved?: Solved | null; marks?: Stroke[]; companion?: Companion | null } = {},
): Unit[] {
  const units: Unit[] = [];
  r.shapes.forEach((S, i) => {
    const { x, y } = r.st[i],
      tint = r.groups[i]?.tint;
    S.b.strokes.forEach(s => units.push({ ...s, tint, gi: i, s: s.s.map(q => ({ x: q.x + x, y: q.y + y, w: q.w })) }));
    if (!o.solved) S.b.dots.forEach(([a, b, sc]) => units.push({ dot: [a + x, b + y, sc || 1, 0] }));
  });
  if (o.solved) o.solved.dots.forEach(d => units.push({ dot: d, tint: d[4] }));
  (o.solved ? o.solved.strokes : o.marks || []).forEach(s => units.push(s));
  if (o.companion) {
    o.companion.strokes.forEach(s => units.push(s));
    o.companion.dots.forEach(d => units.push({ dot: [d[0], d[1], d[2] || 1, 0] }));
  }
  return units;
}

export interface FinishOptions extends SolveOptions {
  /** false: the greedy pass only. */
  solver?: boolean;
}
export interface Finished {
  marks: Stroke[];
  solved: Solved | null;
  companion: Companion | null;
  discScale: number;
  missing: number;
}
/** Marks (and a companion) placed in the smallest frame that holds them all. */
export function finishRoundel(th: Thuluth, r: Roundel, companion: string, o: FinishOptions = {}): Finished {
  let best: Finished | null = null;
  for (const ds of [1.06, 1.14, 1.24, 1.36, 1.5, 1.64]) {
    const pm = placeMarks(th, r, { ...o, discScale: ds });
    const comp = companion ? placeCompanion(th, r, companion, pm.occ, { ...o, discScale: ds }) : null;
    const solved = o.solver !== false ? solveMarks(th, r, { ...o, discScale: ds, extraInk: comp }) : null; // marks are solved around the placed companion
    const res: Finished = { marks: pm.strokes, solved, companion: comp, discScale: ds, missing: (solved ? 0 : pm.missing) + (companion && !comp ? 1 : 0) }; // prettier-ignore
    if (!best || res.missing < best.missing) best = res;
    if (!res.missing) break;
  }
  return best!;
}
