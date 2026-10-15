// Monograms and seals (lab symCompose, blockCompose, spiralCompose, tughraCompose, sealCompose, monoMetrics).
// All randomness comes from the seed in the parameters (Park–Miller).
import { glyphEpoch } from '../glyphs/overrides';
import { runSeal } from '../kernels/seal';
import { compose as classicCompose } from '../layout/compose';
import type { SquareRing } from '../types';
import type { LetterStyle, ScriptEngine } from '../script/types';
import type { CellGrid } from './grid';
import {
  G,
  dotFill,
  flipX,
  flipY,
  frameIt,
  gAt,
  gPut,
  isL,
  markEnds,
  rot180,
  rot90,
  square,
  trim,
  trimAt,
} from './grid';
import type { LetterShape } from './words';
import { letterShape, wordGrid } from './words';
import { wordBlock } from './wordBlock';
import { strokeGraph } from '../geometry/strokegraph';

export type MonoMethod =
  'mirror' | 'below' | 'quad' | 'pair' | 'pinwheel' | 'pinwheelIn' | 'block' | 'spiral' | 'tughra' | 'seal';
export interface MonoParams {
  /** Ascender height of the letters. */
  H: number;
  stretch: number;
  overlap: number;
  nest: boolean;
  lines: number;
  lineGap: number;
  alternate: boolean;
  spiralRings: number;
  corners: boolean;
  core: 'none' | 'squares' | 'seal';
  spineH: number;
  flags: number;
  loops: number;
  loopW: number;
  armLen: number;
  arms: number;
  stretchy: boolean;
  joins: boolean;
  sym: 'none' | 'mirror' | 'turn';
  box: number;
  share: number;
  fourfold: boolean;
  dots: boolean;
  frame: 'none' | 'square' | 'double';
  /** Tughra: loops and arms as true curves wrapping the spines (over and under) instead of grid lines. */
  curved: boolean;
  seed: number;
  /** Try this many seeds (alternating joins, like the lab's automatic centre monogram) and keep the best. */
  tries: number;
  /** Seals: offer letters grown 3 rows taller by repeating a body row (lab port §6). Off by default: across eight
   *  texts at ascenders 7 and 9 it shared more cells but scored no better on average (lower at 9). */
  reshape: boolean;
  /** Seals: search energy per solid 2×2 block of ink (letters that collided); 0 = no penalty. */
  blocks: number;
  /** Seals: whole words as a square block of justified lines (wordBlock.ts) instead of the text's distinct
   *  letters interlocked (owner's review: a letter-set seal can't be read). */
  words: boolean;
}
export const MONO_DEFAULTS: MonoParams = {
  H: 9, stretch: 4, overlap: 2, nest: true, lines: 0, lineGap: 1, alternate: false, spiralRings: 3, corners: false, core: 'none',
  spineH: 15, flags: 1, loops: 1, loopW: 0.5, armLen: 10, arms: 1, stretchy: true, joins: false, sym: 'none', box: 0.7, share: 2,
  fourfold: false, dots: false, frame: 'none', seed: 4243, tries: 1, curved: false, reshape: false, blocks: 40, words: true,
}; // prettier-ignore

export interface MonoStats {
  legibility?: number;
  sharing?: number;
  shared?: number;
  joined?: number;
  dangling?: number;
  letters?: string[];
  engine?: 'wasm' | 'js';
  stretched?: number;
  forms?: number;
  sym?: string;
  lines?: number;
  rings?: number;
  spines?: number;
}
export interface MonoResult {
  grid: CellGrid;
  stats: MonoStats | null;
  /** Vector strokes drawn with the grid (cell units, y down, in the grid's own coordinates). */
  curves?: [number, number][][];
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const letterOf = (base: LetterStyle, H: number): LetterStyle => ({ ...base, ascenders: H, marks: 'dots' });

// ---- symmetric compositions of one word ----
function symCompose(
  method: MonoMethod,
  p: MonoParams,
  text: string,
  script: ScriptEngine,
  letter: LetterStyle,
): MonoResult | null {
  const wg = wordGrid(script, text, letterOf(letter, p.H), p.stretch);
  if (!wg) return null;
  const A = wg.g,
    w = A.w,
    h = A.h,
    b = wg.base;
  let out: CellGrid;
  if (method === 'mirror') {
    const k = Math.min(w - 1, p.overlap);
    out = G(2 * w - k, h);
    gPut(out, flipX(A), 0, 0);
    gPut(out, A, w - k, 0);
  } else if (method === 'below' || method === 'pair') {
    const B = method === 'below' ? flipY(A) : rot180(A),
      bB = h - 1 - b,
      yB = b - bB + Math.max(0, p.overlap - 2);
    out = G(w, Math.max(h, yB + h));
    gPut(out, A, 0, 0);
    gPut(out, B, 0, yB);
  } else if (method === 'quad') {
    const k = Math.min(w - 1, p.overlap);
    const top = G(2 * w - k, h);
    gPut(top, flipX(A), 0, 0);
    gPut(top, A, w - k, 0);
    const bot = flipY(top);
    out = G(top.w, 2 * h - 1);
    gPut(out, top, 0, 0);
    gPut(out, bot, 0, b - (h - 1 - b));
    out = trim(out);
  } else {
    // pinwheels
    const S0 = method === 'pinwheelIn' ? rot180(A) : A,
      gc = p.overlap - 2,
      L = w + h + gc;
    if (L < h * 2) return null;
    out = G(L, L);
    const o = out;
    const ring = (S1: CellGrid, off: number, Lk: number) => {
      const P = G(L, L);
      gPut(P, S1, off + Lk - S1.w, off + Lk - S1.h);
      let q = P;
      for (let r = 0; r < 4; r++) {
        gPut(o, q, 0, 0);
        q = rot90(q);
      }
    };
    ring(S0, 0, L);
    if (p.nest) {
      const nat = wordGrid(script, text, letterOf(letter, p.H), 0)!.g.w;
      for (let k = 1; k < 6; k++) {
        const off = k * (h + 1),
          Lk = L - 2 * off,
          wk = Lk - h - gc;
        if (wk < nat || Lk < 2 * h) break;
        const wg2 = wordGrid(script, text, letterOf(letter, p.H), wk - nat);
        if (!wg2) break;
        ring(method === 'pinwheelIn' ? rot180(wg2.g) : wg2.g, off, Lk);
      }
    }
  }
  return { grid: markEnds(trim(out, 1)), stats: null };
}

// ---- interlocked seal: simulated annealing over letter positions, variants, forms and symmetry ----
const NONJOIN_NEXT = new Set([...'اأإآٱدذرزوؤةء']);
const SEAL_NORM: Record<string, string> = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ؤ': 'و', 'ئ': 'ي', 'ى': 'ي', 'ة': 'ه' }; // prettier-ignore

export function sealCompose(p: MonoParams, text: string, script: ScriptEngine, letter: LetterStyle): MonoResult | null {
  const uniq = [...new Set([...text.normalize('NFC')].map(c => SEAL_NORM[c] || c).filter(c => /[ء-يٱ-ۓ]/.test(c)))];
  const Hs = [p.H, Math.min(15, p.H + 3)],
    Xs = p.stretchy ? [0, 3, 6] : [0];
  const formsOf = (c: string): LetterShape['form'][] =>
    !p.joins || c === 'ء' ? ['iso'] : NONJOIN_NEXT.has(c) ? ['iso', 'fin'] : ['iso', 'ini', 'med', 'fin'];
  // word seals: justified lines of whole words (wordBlock.ts), no search
  if (p.words) {
    const words = text
        .normalize('NFC')
        .split(/\s+/)
        .filter(w => /[ء-يٱ-ۓ]/.test(w)),
      b = wordBlock(script, words, letter, Hs);
    if (!b) return null;
    return {
      grid: b.grid,
      stats: {
        legibility: 1,
        sharing: 0,
        letters: words,
        lines: b.lines.length,
        stretched: b.stretched,
        sym: 'none',
      },
    };
  }
  const V = uniq
    .map(c => {
      const vs: LetterShape[] = [],
        seen = new Set<string>();
      formsOf(c).forEach(f =>
        Hs.forEach(H =>
          Xs.forEach(x =>
            // taller by repeating a body row: 0 or 3 rows (lab port §6)
            (p.reshape === false ? [0] : [0, 3]).forEach(vx => {
              const s = letterShape(script, c, letterOf(letter, H), x, f, vx),
                k = f + s?.w + 'x' + s?.h + (vx ? 'v' : '');
              if (s && !seen.has(k)) {
                seen.add(k);
                vs.push(s);
              }
            }),
          ),
        ),
      );
      return vs;
    })
    .filter(vs => vs.length);
  if (!V.length) return null;
  const sym = p.sym || 'none',
    copies = sym === 'none' ? 1 : 2,
    n = V.length;
  const ink0 = V.reduce((a, vs) => a + vs[0].cells.length, 0) * copies;
  const N =
    Math.max(...V.flat().map(l => Math.max(l.w, l.h))) * (copies > 1 ? 2 : 1) +
    Math.ceil(Math.sqrt(ink0 / 0.3) * p.box);
  let sd = p.seed;
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const vi = V.map(() => 0),
    pos = V.map(vs => [Math.floor(R() * (N - vs[0].w)), Math.floor(R() * (N - vs[0].h))]);
  const LCs = V.map(vs => vs.map(l => l.cells.map(([x, y, v]) => [x, y, v === 1 && l.share.has(x + ',' + y) ? 1 : 0])));
  const iters = (5000 + 450 * n * copies) * 2;
  // pack letters, variants, cells and joins for the kernel
  const Lf: number[] = [],
    Vf: number[] = [],
    Cf: number[] = [],
    Jf: number[] = [];
  V.forEach((vs, i) => {
    Lf.push(vs.length, Vf.length / 7);
    vs.forEach((l, k) => {
      Vf.push(l.w, l.h, Math.round(l.cost * 1000), Cf.length / 3, l.cells.length, Jf.length / 3, l.joins.length);
      LCs[i][k].forEach(c => Cf.push(c[0], c[1], c[2]));
      l.joins.forEach(([x, y, dir]) => Jf.push(x, y, dir));
    });
  });
  const res = runSeal({
    L: Lf, V: Vf, C: Cf, J: Jf, P: pos.flatMap(([x, y], i) => [x, y, vi[i]]), n, N, copies,
    sym: sym === 'none' ? 0 : sym === 'mirror' ? 1 : 2, iters, seed: (p.seed % 2147483646) + 1, shareMilli: Math.round(p.share * 1000), ink0: Math.round(ink0), blockMilli: Math.round(p.blocks * 1000),
  }); // prettier-ignore
  if (!res) return null;
  pos.forEach((q, i) => {
    q[0] = res.P[i * 3];
    q[1] = res.P[i * 3 + 1];
    vi[i] = res.P[i * 3 + 2];
  });
  const cur = (i: number) => V[i][vi[i]];
  const tf = (x: number, y: number, t: number) =>
    t === 0 ? [x, y] : sym === 'mirror' ? [N - 1 - x, y] : [N - 1 - x, N - 1 - y];
  let g = G(N, N);
  for (let t = 0; t < copies; t++)
    V.forEach((_, i) =>
      cur(i).cells.forEach(([x, y, v]) => {
        const [X, Y] = tf(x + pos[i][0], y + pos[i][1], t),
          j = Y * N + X;
        if (!g.data[j] || v === 1) g.data[j] = v;
      }),
    );
  g = square(trim(g));
  if (p.fourfold && sym === 'none') {
    const s = g.w,
      gp = 1,
      out = G(2 * s + gp, 2 * s + gp);
    let q = g;
    [
      [s + gp, 0],
      [s + gp, s + gp],
      [0, s + gp],
      [0, 0],
    ].forEach(([ox, oy]) => {
      gPut(out, q, ox, oy);
      q = rot90(q);
    });
    g = out;
  }
  const S = res.S,
    hurt = S.slice(8);
  const legible = V.map((_, i) => clamp(1 - hurt[i] / Math.max(4, cur(i).cells.length * 0.5 * copies)));
  return {
    grid: markEnds(trim(g, 1)),
    stats: {
      legibility: legible.reduce((a, b) => a + b, 0) / legible.length,
      shared: S[0],
      joined: S[3],
      dangling: S[4],
      sharing: clamp((S[0] + 2 * S[3]) / (n * copies * 2.5)),
      letters: V.map(vs => vs[0].c),
      engine: res.engine,
      stretched: V.filter((_, i) => cur(i).extra || cur(i).vext || cur(i).H > p.H).length,
      forms: V.filter((_, i) => cur(i).form !== 'iso').length,
      sym,
    },
  };
}

// ---- tughra: tall shared spines, flags crossing them, loops to one side and long arms to the other ----
function tughraCompose(p: MonoParams, text: string, script: ScriptEngine, letter: LetterStyle): MonoResult | null {
  const wg = wordGrid(script, text, letterOf(letter, p.spineH), p.stretch);
  if (!wg) return null;
  const A = wg.g,
    b = wg.base;
  let top = A.h;
  for (let y = 0; y < A.h && top === A.h; y++)
    for (let x = 0; x < A.w; x++)
      if (isL(A, x, y)) {
        top = y;
        break;
      }
  const spines: number[] = [];
  for (let x = 0; x < A.w; x++) if (isL(A, x, top) && !isL(A, x - 1, top) && !isL(A, x + 1, top)) spines.push(x);
  const loopW = p.loops ? Math.max(9, Math.round(A.w * p.loopW)) : 0,
    loopH = Math.max(7, Math.round((b - top) * 0.55));
  const armLen = p.armLen,
    X0 = loopW ? loopW + 1 : 0,
    W = X0 + A.w + armLen + 2,
    out = G(W, A.h + 2);
  gPut(out, A, X0, 0);
  const set = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < out.w && y < out.h) out.data[y * out.w + x] = 1;
  };
  const hline = (x0: number, x1: number, y: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y);
  };
  const vline = (x: number, y0: number, y1: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) set(x, y);
  };
  const chosen = spines.slice(-Math.max(1, Math.min(spines.length, 3)));
  if (p.curved) return curvedTughra(p, A, out, X0, top, b, spines, chosen, loopW, armLen);
  for (let f = 0; f < p.flags; f++) {
    const y = top + Math.round((b - top) * (0.22 + 0.2 * f)),
      x0 = X0 + chosen[0],
      x1 = X0 + A.w - 1 + Math.round(armLen * (0.5 + 0.25 * f));
    hline(x0, x1, y);
    vline(x1, y, y + 2);
  }
  for (let k = 0; k < p.loops; k++) {
    const i = k * 2,
      xl = i,
      xr = loopW - 1 - i,
      yt = b - loopH + 1 + i,
      yb = b;
    if (xr - xl < 3 || yb - yt < 3) break;
    hline(xl, xr, yt);
    vline(xl, yt, yb);
    vline(xr, yt, yb);
    hline(xl, xr, yb);
  }
  if (loopW) {
    let xEnd = X0;
    while (xEnd < out.w && !isL(out, xEnd, b)) xEnd++;
    hline(loopW - 1, xEnd, b);
  }
  let xr = X0 + A.w - 1;
  while (xr > X0 && !isL(out, xr, b)) xr--;
  hline(xr, xr + armLen, b);
  vline(xr + armLen, b - 3, b);
  if (p.arms > 1) {
    const y2 = b - 3,
      xs = X0 + (chosen[chosen.length - 1] ?? A.w - 1);
    hline(xs, xr + armLen - 2, y2);
    vline(xr + armLen - 2, y2 - 3, y2);
  }
  return { grid: markEnds(trim(out, 1)), stats: { spines: spines.length } };
}

type Curve = [number, number][];
type V2 = [number, number];
/** A free end of the letters' stroke graph: its cell centre and the outward direction of the stroke there. */
export interface StrokeEnd {
  p: V2;
  d: V2;
}
/** Free stroke ends of a letter grid (y down), from the centreline graph the curved renderer draws. */
export function strokeEnds(g: CellGrid): StrokeEnd[] {
  const ink = (x: number, y: number) => isL(g, x, y),
    deg = (x: number, y: number) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => ink(x + dx, y + dy)).length,
    ends: StrokeEnd[] = [];
  for (const ch of strokeGraph(g.w, g.h, ink).chains) {
    if (ch.closed || ch.pts.length < 2) continue;
    for (const [e, q] of [
      [ch.pts[0], ch.pts[1]],
      [ch.pts[ch.pts.length - 1], ch.pts[ch.pts.length - 2]],
    ]) {
      if (deg(e[0], e[1]) !== 1) continue;
      const dx = e[0] - q[0],
        dy = e[1] - q[1],
        l = Math.hypot(dx, dy);
      ends.push({ p: [e[0] + 0.5, e[1] + 0.5], d: [dx / l, dy / l] });
    }
  }
  return ends;
}
/** A cubic Bézier sampled; consecutive cubics that share end tangents join smoothly. */
const cubic = (a: V2, b: V2, c: V2, e: V2, n = 24): Curve =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      u = 1 - t;
    return [
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1],
    ] as V2;
  });
const add = (a: V2, b: V2, k = 1): V2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const join = (...parts: Curve[]) => parts.reduce((acc, c) => (acc.length ? [...acc, ...c.slice(1)] : c), [] as Curve);

/** The tughra with true curves that grow out of the letters' own strokes: the arm continues the final letter's tail,
 *  each flag rises from a stem top and turns to run across the spines, and each loop leaves the word's free right
 *  end, swings round over the word and comes back into the baseline along it. Every join is tangent-continuous. */
function curvedTughra(
  p: MonoParams,
  A: CellGrid,
  out: CellGrid,
  X0: number,
  top: number,
  b: number,
  _spines: number[],
  _chosen: number[],
  _loopW: number,
  armLen: number,
): MonoResult {
  void A;
  void X0;
  const ends = strokeEnds(out),
    base = b + 0.5,
    curves: Curve[] = [];
  const lowEnds = ends.filter(e => Math.abs(e.p[1] - base) <= 2.5);
  // arm: the final (leftmost) letter's tail, heading left
  const tail = lowEnds.filter(e => e.d[0] < -0.7).sort((u, v) => u.p[0] - v.p[0])[0];
  // the word's free right end, heading right, for the loops
  const head = lowEnds.filter(e => e.d[0] > 0.7).sort((u, v) => v.p[0] - u.p[0])[0];
  const h = Math.max(4, b - top),
    xr = head ? head.p[0] : out.w - 0.5,
    xl = tail ? tail.p[0] : 0.5;
  if (tail) {
    const L = armLen + 4,
      d = tail.d;
    curves.push(
      cubic(
        tail.p,
        add(tail.p, d, L * 0.45),
        add(add(tail.p, d, L * 0.95), [0, -L * 0.2]),
        add(add(tail.p, d, L * 1.1), [0, -L * 0.75]),
      ),
    );
  }
  // flags: stem tops (heading up), rightmost first, each rising a little higher before turning right
  const tops = ends
    .filter(e => e.d[1] < -0.9 && e.p[1] <= top + 2)
    .sort((u, v) => v.p[0] - u.p[0])
    .slice(0, Math.max(0, p.flags));
  tops.forEach((T, f) => {
    const r = 2.5 + 2.2 * f,
      bend = cubic(T.p, add(T.p, [0, -r * 0.55]), add(T.p, [r * 0.45, -r]), add(T.p, [r, -r])),
      y = T.p[1] - r,
      x1 = out.w + armLen * (0.4 + 0.2 * f),
      run: Curve = [
        [T.p[0] + r, y],
        [x1, y],
      ],
      hook = cubic([x1, y], [x1 + 1.6, y], [x1 + 2.6, y + 0.9], [x1 + 2.6, y + 2.6], 12);
    curves.push(join(bend, run, hook));
  });
  // loops: out of the right end, up and over the word, down on the left and back into the baseline heading right
  if (head && tail && xr - xl > 2)
    for (let k = 0; k < Math.max(1, p.loops); k++) {
      const H = h * (1.3 + 0.35 * k),
        w = 4 + 3 * k,
        c = 0.55,
        E = head.p,
        R: V2 = [xr + w, base - H * 0.5],
        T: V2 = [(xl + xr) / 2, base - H],
        Lp: V2 = [xl - w, base - H * 0.5],
        F: V2 = [xl + 1.5, base],
        rx = (xr - xl) / 2 + w;
      curves.push(
        join(
          cubic(E, add(E, [w * c * 1.6, 0]), add(R, [0, H * 0.5 * c]), R),
          cubic(R, add(R, [0, -H * 0.5 * c]), add(T, [rx * c, 0]), T),
          cubic(T, add(T, [-rx * c, 0]), add(Lp, [0, -H * 0.5 * c]), Lp),
          cubic(Lp, add(Lp, [0, H * 0.5 * c]), add(F, [-w * c * 1.6, 0]), F),
        ),
      );
    }
  // trim the cells, then grow the grid to hold the curves too
  const t = trimAt(out, 1);
  let cs = curves.map(cv => cv.map(([x, y]) => [x + t.dx, y + t.dy] as V2));
  const xs = cs.flat().map(q => q[0]),
    ys = cs.flat().map(q => q[1]),
    ox = cs.length ? Math.max(0, Math.ceil(1 - Math.min(...xs))) : 0,
    oy = cs.length ? Math.max(0, Math.ceil(1 - Math.min(...ys))) : 0,
    W = cs.length ? Math.max(t.g.w + ox, Math.ceil(Math.max(...xs) + ox + 1)) : t.g.w,
    H = cs.length ? Math.max(t.g.h + oy, Math.ceil(Math.max(...ys) + oy + 1)) : t.g.h,
    g = G(W, H);
  gPut(g, t.g, ox, oy);
  cs = cs.map(cv => cv.map(([x, y]) => [x + ox, y + oy] as V2));
  return { grid: markEnds(g), stats: { spines: _spines.length }, curves: cs };
}

// ---- stacked block: the text in justified lines filling a square ----
function blockCompose(p: MonoParams, text: string, script: ScriptEngine, letter: LetterStyle): MonoResult | null {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const L = letterOf(letter, p.H),
    nat = wordGrid(script, text, L, 0);
  if (!nat) return null;
  const hb = nat.g.h;
  let best: { sc: number; lines: string[]; W: number; k: number } | null = null;
  for (let k = 1; k <= 8; k++) {
    const pool: string[] = [];
    while (pool.length < k) pool.push(...words);
    const per = Math.ceil(pool.length / k),
      lines: string[] = [];
    for (let i = 0; i < k; i++) {
      const ws = pool.slice(i * per, (i + 1) * per);
      if (ws.length) lines.push(ws.join(' '));
    }
    while (lines.length < k) lines.push(words.join(' '));
    const grids = lines.map(l => wordGrid(script, l, L, 0)).filter(Boolean);
    if (grids.length < k) continue;
    const W = Math.max(...grids.map(g => g!.g.w)),
      H = k * hb + (k - 1) * p.lineGap;
    const sc = Math.abs(W - H) / Math.max(W, H) + (k + p.lines) * 0.002;
    if (!best || sc < best.sc) best = { sc, lines, W, k };
  }
  if (!best) return null;
  const W = best.W + p.stretch;
  const rows = best.lines.map((l, i) => {
    const g = wordGrid(script, l, L, 0)!,
      gg = wordGrid(script, l, L, Math.max(0, W - g.g.w))!.g;
    return p.alternate && i % 2 ? rot180(gg) : gg;
  });
  const H = rows.reduce((a, g) => a + g.h, 0) + (rows.length - 1) * p.lineGap,
    out = G(W, H);
  let y = 0;
  rows.forEach(g => {
    gPut(out, g, W - g.w, y);
    y += g.h + p.lineGap;
  });
  return { grid: markEnds(trim(out, 1)), stats: { lines: rows.length } };
}

// ---- square spiral: the phrase winding inward in rings until it reaches the centre ----
function spiralCompose(p: MonoParams, text: string, script: ScriptEngine, letter: LetterStyle): MonoResult | null {
  for (let rings = p.spiralRings; rings >= 1; rings--) {
    const res = classicCompose({
      text, layout: 'rings', H: p.H, wordGap: 2, rings, rotation: 0, center: 'none', marks: 'dots', vowels: 'modern', repeat: true,
      ra: letter.ra, ayn: letter.ayn, la: letter.lamAlif, meem: letter.meem, sad: letter.sad, terminals: 'none', gap: 1, cornerBlocks: p.corners, taper: 0, centre: 0, rhythm: true,
    }); // prettier-ignore
    if (res.kind !== 'square') continue;
    const out = G(res.size, res.size);
    (res.rings as SquareRing[]).forEach(r => {
      const g = { w: r.grid.w, h: r.grid.h, data: r.grid.data.map(v => (v === 4 ? 1 : v)) };
      gPut(out, g, Math.round(r.off), Math.round(r.off));
    });
    const o = Math.round(res.centre.o!),
      C = Math.floor(res.centre.C!);
    if (p.core === 'squares')
      for (let i = 0; 2 * i < C; i += 2) {
        const a = o + i,
          b = o + C - 1 - i;
        for (let t2 = a; t2 <= b; t2++) {
          out.data[a * out.w + t2] = out.data[b * out.w + t2] = 1;
          out.data[t2 * out.w + a] = out.data[t2 * out.w + b] = 1;
        }
      }
    else if (p.core === 'seal' && C > 6) {
      const s = sealCompose({ ...p, fourfold: false, frame: 'none', stretchy: false }, text, script, letter);
      if (s && s.grid.w <= C) gPut(out, s.grid, o + Math.floor((C - s.grid.w) / 2), o + Math.floor((C - s.grid.h) / 2));
    }
    return { grid: markEnds(trim(out, 1)), stats: { rings } };
  }
  return null;
}

export interface MonoMetrics {
  legibility: number;
  compact: number;
  squareness: number;
  symmetry: number;
  sharing?: number;
  total: number;
}
export function monoMetrics(g: CellGrid, stats: MonoStats | null): MonoMetrics {
  let ink = 0;
  for (const v of g.data) if (v) ink++;
  const compact = clamp(ink / (g.w * g.h) / 0.32),
    squareness = clamp(1 - Math.abs(g.w - g.h) / Math.max(g.w, g.h));
  let sym = 0,
    tot = 0;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      if (!g.data[y * g.w + x]) continue;
      tot++;
      if (g.data[g.w - 1 - x + (g.h - 1 - y) * g.w] || g.data[y * g.w + (g.w - 1 - x)]) sym++;
    }
  // solid 2×2 blocks never occur in clean single-stroke Kufic: they mean letters have collided
  let blobs = 0;
  for (let y = 0; y < g.h - 1; y++)
    for (let x = 0; x < g.w - 1; x++)
      if (gAt(g, x, y) && gAt(g, x + 1, y) && gAt(g, x, y + 1) && gAt(g, x + 1, y + 1)) blobs++;
  const m: MonoMetrics = {
    legibility: Math.min(stats?.legibility ?? 1, clamp(1 - blobs * 0.1)),
    compact,
    squareness,
    symmetry: tot ? sym / tot : 0,
    total: 0,
  };
  if (stats && stats.sharing != null) {
    m.sharing = stats.sharing;
    m.total = 0.38 * m.legibility + 0.24 * m.compact + 0.14 * m.squareness + 0.08 * m.symmetry + 0.16 * m.sharing;
  } else m.total = 0.4 * m.legibility + 0.25 * m.compact + 0.15 * m.squareness + 0.2 * m.symmetry;
  return m;
}

const memo = new Map<string, ReturnType<typeof build>>();
export const clearMonogramCache = () => memo.clear();
/** Build a monogram by any method (lab monoBuild, without the drawing). Memoised: the seal search is costly and
 *  resolving retries sizes. */
export function buildMonogram(
  method: MonoMethod,
  params: Partial<MonoParams>,
  text: string,
  script: ScriptEngine,
  letter: LetterStyle,
) {
  const k = JSON.stringify([method, params, text, letter, script.id, glyphEpoch()]);
  if (memo.has(k)) return memo.get(k)!;
  // word seals are laid out, not searched: one try is all there is
  const words = method === 'seal' && (params.words ?? MONO_DEFAULTS.words),
    tries = words ? 1 : Math.max(1, Math.min(8, Math.round(params.tries ?? 1))),
    seed = params.seed ?? MONO_DEFAULTS.seed;
  let r: ReturnType<typeof build> = null;
  for (let t = 0; t < tries; t++) {
    const p =
      tries > 1 ? { ...params, seed: seed + t * 7919, joins: t % 2 === 1 ? !params.joins : !!params.joins } : params;
    const c = build(method, p, text, script, letter);
    if (c && (!r || c.metrics.total > r.metrics.total)) r = c;
  }
  memo.set(k, r);
  if (memo.size > 64) memo.delete(memo.keys().next().value!);
  return r;
}
function build(
  method: MonoMethod,
  params: Partial<MonoParams>,
  text: string,
  script: ScriptEngine,
  letter: LetterStyle,
) {
  const p = { ...MONO_DEFAULTS, ...params };
  const r =
    method === 'seal'
      ? sealCompose(p, text, script, letter)
      : method === 'block'
        ? blockCompose(p, text, script, letter)
        : method === 'spiral'
          ? spiralCompose(p, text, script, letter)
          : method === 'tughra'
            ? tughraCompose(p, text, script, letter)
            : symCompose(method, p, text, script, letter);
  if (!r) return null;
  // decorative dots in enclosed gaps; never in word seals, where a loose dot reads as a letter's (ر as ز)
  if (p.dots && ((method === 'seal' && !p.words) || method === 'pinwheel' || method === 'pinwheelIn'))
    r.grid = dotFill(r.grid);
  const metrics = monoMetrics(r.grid, r.stats),
    // word seals are laid out square; a near-square one (two long words) still takes the frame
    square = method === 'seal' && p.words ? 0.75 : 0.8,
    grid = metrics.squareness > square && !r.curves ? frameIt(r.grid, p.frame) : r.grid;
  return { grid, metrics, stats: r.stats, curves: r.curves };
}
