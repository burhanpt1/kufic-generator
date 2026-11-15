// The colonnade (owner's experiment, 15 November 2026). Placing whole words gives typesetting; what looked like
// calligraphy came from a letter doing something because of where it stands. Here the tall stems of a text (alif, lam,
// the stems of the name of God) are redrawn far taller than the body of the writing, as jali thuluth panels have
// them: each rises to the circle's upper rim, so the row of uprights draws the dome, and the lines of writing stand
// low in the circle at their feet. A stem is redrawn, not scaled: its head and its foot are kept as drawn and only
// the straight shaft between them is lengthened.
//   a  stems rise from the top line only
//   b  the lines interlock: a stem that stands in a bay of the line above lets its line come up under that line,
//      and rises to the circle if it can reach it; lines slide and word spaces open to make bays
//   c  as b, and uneven bays between the uprights cost more
// `COLONNADE=1 COLONNADE_OUT=<dir> npx vitest run tests/char-stems-sheet.test.ts --maxWorkers=2` writes the sheet.
// (Finding the stems, redrawing one taller and the ink on a grid are in tests/helpers/char-first.ts, with their
// numbers; the crown and cradle shares them.)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import type { Built } from '../src/script/thuluth/engine';
import { cleanOutline } from '../src/script/thuluth/outline';
import { Alpha, toPixels } from '../src/script/thuluth/raster';
import type { Poly, Stroke } from '../src/script/thuluth/types';
import type { Cols, Profile, Pt, Stem } from './helpers/char-first';
import { CAP, CELL, NIB, TEXTS, colsOf, findStems, hull, need, profile, raise, room, settle, th } from './helpers/char-first'; // prettier-ignore

// ---- the numbers of the composition (pen units unless it says nibs) ----
const MARGIN = 0.9 * NIB, // between the ink and the circle
  CLEAR = 0.3 * NIB, // between two separate inks
  MIN_RISE = 0.15, // a stem of a lower line rises by at least this share of its height, or not at all
  MAX_SLIDE = 1.5 * NIB, // a line below the top one is slid from the middle by no more than this
  WANT = 1.7, // the uprights of the top line stand, at the median, this many times their height as written
  STEM_HALF = 0.75, // half the width a shaft takes on its way up
  HEAD_RIGHT = 0.9, // how much further the head's serif reaches to the right
  PIER = 3.6, // uprights closer than this stand as one pier (the pairs of ال, the name of God)
  MAX_GAP = 2 * NIB, // a word space is opened by no more than this
  STEP = 0.4, // the step of a slide or of an opening
  MAX_LINES = 6,
  KEEP = 5, // cuts carried from the first reckoning to the search for bays
  RAGGED = 0.7, // baselines-first: what a line that stops short of the circle's edge costs
  UNRISEN = 1, // what a text none of whose stems rise costs, against a larger circle
  VOID = 0.6, // what an empty band under the writing costs (its share of the circle's height)
  UNEVEN = 0.3; // (variant c) what uneven bays cost

const inkOf = (strokes: readonly Stroke[], b: Built, fat = 1): Poly[] => [
  ...strokes.flatMap(s => th.strokePolys(s, fat)),
  ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y, fat)),
];
const area = (ps: readonly Poly[]) =>
  Math.abs(ps.reduce((a, q) => a + q.reduce((s, [x, y], i) => s + x * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * y, 0) / 2, 0)); // prettier-ignore

/** A specimen: some ink on paper, for looking at a stretched stem large. */
function specimen(polys: readonly Poly[], width = 700) {
  const pts = polys.flat(),
    x0 = Math.min(...pts.map(p => p[0])) - 2,
    x1 = Math.max(...pts.map(p => p[0])) + 2,
    y0 = Math.min(...pts.map(p => p[1])) - 2,
    y1 = Math.max(...pts.map(p => p[1])) + 2,
    d = polys
      .map(q => 'M' + q.map(([x, y]) => `${(x - x0).toFixed(2)} ${(y1 - y).toFixed(2)}`).join('L') + 'Z')
      .join('');
  return toPNG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(x1 - x0).toFixed(2)} ${(y1 - y0).toFixed(2)}" width="${width}" height="${Math.round((width * (y1 - y0)) / (x1 - x0))}"><rect width="100%" height="100%" fill="#fffdf6"/><path d="${d}" fill="#1a1a1a" fill-rule="nonzero"/></svg>`, width); // prettier-ignore
}

// ---- a stretch of the text written as one line, and what the composer needs of it ----
interface Span {
  b: Built;
  stems: Stem[];
  /** Words, and the extent of the line's ink as written. */
  nw: number;
  x0: number;
  x1: number;
  /** The word each stroke and each dot belongs to. */
  strokeWord: number[];
  dotWord: number[];
  /** For each word: its ink on the grid, the hull of all of it, and the hull of it without the heads of its stems. */
  cols: Cols[];
  low: Cols[];
  whole: Pt[][];
  body: Pt[][];
  /** For each stem: what rises (its head, down to the split, and what rides with it), as a hull and on the grid. */
  heads: Pt[][];
  headCols: Cols[];
}
function spanOf(text: string): Span {
  const b = th.buildStrokes(text, {}),
    stems = findStems(b, text),
    nw = text.trim().split(/\s+/).length,
    // each word's stretch of the line, from its letters
    ext = Array.from({ length: nw }, () => [Infinity, -Infinity]);
  for (const st of b.strokes)
    if (st.wi != null && st.wi >= 0)
      for (const q of st.s) {
        ext[st.wi][0] = Math.min(ext[st.wi][0], q.x);
        ext[st.wi][1] = Math.max(ext[st.wi][1], q.x);
      }
  const wordAt = (x: number) => {
    let k = 0;
    for (let w = 1; w < nw; w++) if (Math.abs(x - (ext[w][0] + ext[w][1]) / 2) < Math.abs(x - (ext[k][0] + ext[k][1]) / 2)) k = w; // prettier-ignore
    return k;
  };
  const strokeWord = b.strokes.map(st => st.wi != null && st.wi >= 0 ? st.wi : wordAt(st.s.reduce((t, q) => t + q.x, 0) / st.s.length)), // prettier-ignore
    dotWord = b.dotGroups.flatMap(g => new Array<number>(g.n).fill(g.wi)),
    rising = new Map<number, Stem>();
  for (const m of stems) rising.set(m.si, m);
  const riders = new Set(stems.flatMap(m => m.riders)),
    ink: Poly[][] = Array.from({ length: nw }, () => []),
    low: Poly[][] = Array.from({ length: nw }, () => []);
  b.strokes.forEach((st, si) => {
    const m = rising.get(si),
      w = strokeWord[si];
    ink[w].push(...th.strokePolys(st));
    if (m) low[w].push(...th.strokePolys({ ...st, s: st.s.slice(m.cut) }));
    else if (!riders.has(si)) low[w].push(...th.strokePolys(st));
  });
  b.dots.forEach(([x, y], k) => {
    const q = th.dotPolysAt(x, y);
    ink[dotWord[k] ?? wordAt(x)].push(...q);
    low[dotWord[k] ?? wordAt(x)].push(...q);
  });
  const xs = ink.flat(2).map(p => p[0]),
    heads = stems.map(m => [th.strokePolys({ ...b.strokes[m.si], s: b.strokes[m.si].s.slice(0, m.cut + 1) }), ...m.riders.map(r => th.strokePolys(b.strokes[r]))].flat()); // prettier-ignore
  return {
    b,
    stems,
    nw,
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    strokeWord,
    dotWord,
    cols: ink.map(colsOf),
    whole: ink.map(q => hull(q.flat())),
    body: low.map(q => hull(q.flat())),
    low: low.map(colsOf),
    heads: heads.map(q => hull(q.flat())),
    headCols: heads.map(colsOf),
  };
}

// ---- an arrangement: lines, how far each is slid from the middle, and how far each word space is opened ----
interface Cfg {
  spans: Span[];
  dev: number[];
  gaps: number[][];
}
type Variant = 'level' | 'a' | 'b' | 'c';
interface Geo {
  R: number;
  /** The circle's centre above the top line's baseline, and each line's baseline. */
  yc: number;
  base: number[];
  /** The lowest ink, from the circle's centre. */
  low: number;
  /** Where each word stands sideways, each line's ink on the grid, and the stems that stand in a bay of the line
   *  above theirs. */
  off: number[][];
  whole: Profile[];
  thread: boolean[][];
}
const snap = (v: number) => Math.round(v / CELL) * CELL;
const plain = (spans: Span[]): Cfg => ({ spans, dev: spans.map(() => 0), gaps: spans.map(sp => new Array<number>(sp.nw).fill(0)) }); // prettier-ignore
/** Where each word of each line stands, sideways: the line centred on the circle's upright axis, then slid. */
function offsets(cfg: Cfg): number[][] {
  return cfg.spans.map((sp, i) => {
    const tot = cfg.gaps[i].reduce((t, g) => t + g, 0),
      shift = snap(-(sp.x0 - tot + sp.x1) / 2 + cfg.dev[i]);
    let G = 0;
    return cfg.gaps[i].map(g => shift - (G += g));
  });
}
const median = (v: number[]) => v.slice().sort((p, q) => p - q)[Math.floor((v.length - 1) / 2)];
const NONE: ReadonlySet<string> = new Set<string>();

/** The stems of a line that stand in a bay of the line above it (b and c): no ink of that line over the head, nor
 *  within CLEAR of it to either side. The stems of the name of God stand in a bay together or not at all. `loose`
 *  names stems (line:stem) that are not to be counted. */
function threaded(cfg: Cfg, off: number[][], whole: Profile[], loose: ReadonlySet<string>): boolean[][] {
  const pad = Math.ceil(CLEAR / CELL);
  return cfg.spans.map((sp, i) => {
    const ok = sp.stems.map((m, s) => {
      if (i === 0 || loose.has(`${i}:${s}`)) return false;
      const h = sp.headCols[s],
        d = Math.round(off[i][m.wi] / CELL) + h.c0;
      for (let c = -pad; c < h.lo.length + pad; c++) if (whole[i - 1].has(c + d)) return false;
      return true;
    });
    return ok.map((v, s) => v && sp.stems.every((o, j) => !(o.name && sp.stems[s].name && o.wi === sp.stems[s].wi) || ok[j])); // prettier-ignore
  });
}
/** The circle for an arrangement. The lines stand under one another by their ink: for level lines and for a at one
 *  even pitch (baselines-first); for b and c each as close under the line above as their inks allow, where a stem
 *  that stands in a bay of the line above is counted only up to its split (the lines interlock). Then the smallest
 *  circle in which the body of the writing fits. For level lines that is all. For the colonnade the top line's stems
 *  are left out of the body down to their splits, the writing sits as low in the circle as it can, and the circle is
 *  opened until the top line's uprights stand, at the median, WANT times their height as written. */
function layout(cfg: Cfg, variant: Variant, loose: ReadonlySet<string>): Geo | null {
  const { spans } = cfg,
    off = offsets(cfg),
    lock = variant === 'b' || variant === 'c',
    whole = spans.map((sp, i) => profile(sp.cols.map((c, k) => [c, off[i][k]] as const))),
    thread = lock ? threaded(cfg, off, whole, loose) : spans.map(sp => sp.stems.map(() => false)),
    pitches = spans.map((sp, i) =>
      i === 0
        ? 0
        : need(
            whole[i - 1],
            thread[i].some(v => v)
              ? profile([
                  ...sp.low.map((c, k) => [c, off[i][k]] as const),
                  ...sp.stems.flatMap((m, s) => (thread[i][s] ? [] : [[sp.headCols[s], off[i][m.wi]] as const])),
                ])
              : whole[i],
          ),
    ),
    even = Math.max(...pitches),
    base: number[] = [];
  spans.forEach((_, i) => base.push(i ? base[i - 1] - (lock ? pitches[i] : even) : 0));
  const top = spans[0],
    rises = variant !== 'level' && top.stems.length > 0,
    pts: Pt[] = [];
  spans.forEach((sp, i) =>
    sp.whole.forEach((_, k) => {
      for (const [x, y] of i === 0 && rises ? sp.body[k] : sp.whole[k]) pts.push([x + off[i][k], y + base[i]]);
    }),
  );
  const at = (R: number): number | null => {
    const Rin = R - MARGIN;
    let lo = -Infinity,
      hi = Infinity;
    for (const [x, y] of pts) {
      if (Math.abs(x) >= Rin) return null;
      const h = Math.sqrt(Rin * Rin - x * x);
      lo = Math.max(lo, y - h);
      hi = Math.min(hi, y + h);
    }
    if (lo > hi) return null;
    if (!rises) return (lo + hi) / 2;
    const free = top.stems.map((m, s) => room(top.heads[s], off[0][m.wi], -hi, m.lean, Rin));
    if (free.some(e => e < 0)) return null;
    const e = settle(top.stems, free);
    return median(top.stems.map((m, s) => 1 + e[s] / m.top)) >= WANT ? hi : null;
  };
  let R = Math.max(...pts.map(p => Math.abs(p[0]))) + MARGIN;
  while (R < 300 && at(R) == null) R *= 1.02;
  if (R >= 300) return null;
  let below = R / 1.02;
  for (let k = 0; k < 8; k++) {
    const mid = (below + R) / 2;
    if (at(mid) == null) below = mid;
    else R = mid;
  }
  const yc = at(R)!;
  return { R, yc, base, low: Math.min(...pts.map(p => p[1])) - yc, off, whole, thread };
}
/** What an arrangement costs: its radius, raised by how far its lines fall short of the circle where they sit
 *  (baselines-first, step 3), by the share of the text's stems that do not rise, by an empty band under the writing,
 *  and (variant c) by uneven bays. */
function cost(spans: Span[], g: Geo, risen: number, uneven: number, level = false): number {
  const Rin = g.R - MARGIN,
    total = spans.reduce((t, sp) => t + sp.stems.length, 0);
  let short = 0;
  spans.forEach((sp, i) => {
    const y0 = g.base[i] - g.yc,
      half = Math.sqrt(Math.max(0, Rin * Rin - Math.max(y0 * y0, (y0 + 5) * (y0 + 5))));
    short += half > 0 ? Math.max(0, 1 - (sp.x1 - sp.x0) / (2 * half)) ** 2 : 1;
  });
  return g.R * (1 + (RAGGED * short) / spans.length) * (level ? 1 : (1 + UNRISEN * (total ? 1 - risen / total : 0)) * (1 + UNEVEN * uneven) * (1 + (VOID * (g.low + Rin)) / (2 * Rin))); // prettier-ignore
}

interface Risen {
  /** How much taller each stem of each line is drawn. */
  extra: number[][];
  risen: number;
  /** How uneven the bays between the piers of uprights are (deviation over mean), the circle's sides counted. */
  uneven: number;
}
/** 4. Which stems rise in an arrangement, and by how much. The top line's all rise. With b and c a stem of a lower
 *  line rises if it can reach the circle within CAP, by at least MIN_RISE of its height, through a bay: no ink of
 *  the lines above within CLEAR of its way up, and no upright of another line closer than a head's width. `ban`
 *  names stems (line:stem) that are not to rise. */
function rise(cfg: Cfg, g: Geo, variant: Variant, ban: ReadonlySet<string>): Risen {
  const { spans } = cfg,
    { off, whole } = g,
    Rin = g.R - MARGIN,
    extra = spans.map(sp => sp.stems.map(() => 0));
  if (variant === 'level') return { extra, risen: 0, uneven: 0 };
  /** The uprights so far: line, and where each would stand at the height of the circle's centre. */
  const up: [number, number][] = [];
  const stand = (i: number, m: Stem) => m.x + off[i][m.wi] - m.lean * (m.y + g.base[i] - g.yc);
  /** Whether stem m of line i, drawn e taller, passes the lines above it and the uprights of other lines. */
  const passes = (i: number, m: Stem, e: number) => {
    const xs = m.x + off[i][m.wi],
      ys = m.y + g.base[i] - g.yc,
      was = g.base[i] - g.yc + m.top,
      now = was + e;
    if (up.some(([j, x]) => j !== i && Math.abs(x - stand(i, m)) < 2 * STEM_HALF + CLEAR + HEAD_RIGHT)) return false;
    for (let j = 0; j < i; j++)
      for (const [c, [lo, hi]] of whole[j]) {
        const xc = (c + 0.5) * CELL;
        if (Math.abs(xc - xs) > 8) continue;
        const top = g.base[j] - g.yc + (hi + 1) * CELL + CLEAR,
          yl = Math.max(g.base[j] - g.yc + lo * CELL - CLEAR, was - 1),
          yh = Math.min(top, now + CLEAR);
        if (yl > yh) continue;
        const xa = xs + m.lean * (yh - ys) - STEM_HALF - CLEAR,
          xb = xs + m.lean * (yl - ys) + STEM_HALF + CLEAR + (top > now - 4 ? HEAD_RIGHT : 0);
        if (xc + CELL / 2 >= xa && xc - CELL / 2 <= xb) return false;
      }
    return true;
  };
  for (let i = 0; i < spans.length && (i === 0 || variant !== 'a'); i++) {
    const sp = spans[i],
      free = sp.stems.map((m, s) => ban.has(`${i}:${s}`) ? -1 : room(sp.heads[s], off[i][m.wi], g.base[i] - g.yc, m.lean, Rin)); // prettier-ignore
    if (i === 0) {
      settle(sp.stems, free).forEach((e, s) => {
        extra[0][s] = e;
        if (e > 0) up.push([0, stand(0, sp.stems[s])]);
      });
      continue;
    }
    // a lower line: the name of God first and as one, then stem by stem; and beside a name that cannot rise
    // nothing rises (no upright stands over the name of God on its own line)
    const groups = new Map<string, number[]>();
    sp.stems.forEach((m, s) => {
      const key = m.name ? `w${m.wi}` : `s${s}`;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    });
    let held = false;
    for (const ss of [...groups.values()].sort((p, q) => q.length - p.length)) {
      const name = sp.stems[ss[0]].name,
        f = Math.min(...ss.map(s => 1 + free[s] / sp.stems[s].top)),
        e = ss.map(s => (name ? (f - 1) * sp.stems[s].top : free[s]));
      if (!held && f >= 1 + MIN_RISE && f <= CAP && ss.every((s, k) => passes(i, sp.stems[s], e[k])))
        ss.forEach((s, k) => {
          extra[i][s] = e[k];
          up.push([i, stand(i, sp.stems[s])]);
        });
      else if (name) held = true;
    }
  }
  // the bays between piers of uprights, and between the outermost piers and the circle's sides
  const xs = [-Rin, ...up.map(u => u[1]).sort((p, q) => p - q), Rin],
    bays: number[] = [];
  for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > PIER) bays.push(xs[k] - xs[k - 1]);
  const mean = bays.reduce((t, v) => t + v, 0) / (bays.length || 1),
    uneven = bays.length > 1 ? Math.sqrt(bays.reduce((t, v) => t + (v - mean) ** 2, 0) / bays.length) / mean : 0;
  return { extra, risen: up.length, uneven };
}
/** 4b, 4c. Slide the lines below the top one and open the word spaces, until nothing lowers the cost: one slide or
 *  one opening at a time, and a line's slide together with one opening in the line above it (which is what sets a
 *  stem in a bay). A little is charged for every opening and slide, so that none is made for nothing. */
function search(cfg: Cfg, variant: Variant): Cfg {
  const cur: Cfg = { spans: cfg.spans, dev: cfg.dev.slice(), gaps: cfg.gaps.map(q => q.slice()) },
    score = () => {
      const g = layout(cur, variant, NONE);
      if (!g) return Infinity;
      const r = rise(cur, g, variant, NONE);
      return cost(cur.spans, g, r.risen, variant === 'c' ? r.uneven : 0) * (1 + (0.004 * (cur.gaps.flat().reduce((t, v) => t + v, 0) + cur.dev.reduce((t, v) => t + Math.abs(v), 0))) / NIB); // prettier-ignore
    };
  let best = score();
  const slides: number[] = [],
    opens: number[] = [];
  for (let v = -Math.floor(MAX_SLIDE / STEP) * STEP; v <= MAX_SLIDE + 1e-9; v += STEP)
    slides.push(Math.round(v * 10) / 10);
  for (let v = 0; v <= MAX_GAP + 1e-9; v += STEP) opens.push(Math.round(v * 10) / 10);
  /** Try every value of one setting, and keep the best. */
  const tryAll = (values: number[], set: (v: number) => void, now: number, inner?: () => void) => {
    let keep = now,
      gained = false;
    for (const v of values) {
      set(v);
      if (inner) inner();
      const s = score();
      if (s < best - 1e-9) {
        best = s;
        keep = v;
        gained = true;
      }
    }
    set(keep);
    return gained;
  };
  for (let pass = 0; pass < 3; pass++) {
    let gained = false;
    for (let i = 0; i < cur.spans.length; i++) {
      if (i) gained = tryAll(slides, v => (cur.dev[i] = v), cur.dev[i]) || gained;
      for (let k = 1; k < cur.spans[i].nw; k++)
        gained = tryAll(opens, v => (cur.gaps[i][k] = v), cur.gaps[i][k]) || gained;
      // a slide of this line with an opening in the line above
      if (i)
        for (let k = 1; k < cur.spans[i - 1].nw; k++) {
          const was = cur.dev[i],
            had = cur.gaps[i - 1][k];
          let keep: [number, number] = [was, had];
          for (const d of slides)
            for (const v of opens) {
              cur.dev[i] = d;
              cur.gaps[i - 1][k] = v;
              const s = score();
              if (s < best - 1e-9) {
                best = s;
                keep = [d, v];
                gained = true;
              }
            }
          [cur.dev[i], cur.gaps[i - 1][k]] = keep;
        }
    }
    if (!gained) break;
  }
  return cur;
}

interface Drawn {
  ink: Poly[];
  line: number;
  word: number;
}
/** The ink of an arrangement, word by word (in the circle's own coordinates), with the stems drawn as risen. */
function draw(cfg: Cfg, g: Geo, extra: number[][]): Drawn[] {
  const off = offsets(cfg),
    out: Drawn[] = [];
  cfg.spans.forEach((sp, i) => {
    const strokes = raise(sp.b, sp.stems, extra[i]),
      words: Poly[][] = Array.from({ length: sp.nw }, () => []),
      put = (w: number, q: Poly[]) => words[w].push(...q.map(r => r.map(([x, y]) => [x + off[i][w], y + g.base[i] - g.yc] as Pt))); // prettier-ignore
    strokes.forEach((st, si) => put(sp.strokeWord[si], th.strokePolys(st)));
    sp.b.dots.forEach(([x, y], k) => put(sp.dotWord[k] ?? 0, th.dotPolysAt(x, y)));
    words.forEach((ink, word) => out.push({ ink, line: i, word }));
  });
  return out;
}
/** 5. Measured on a raster, as the curved experiment's `lay` does: the pairs of words whose inks come within CLEAR
 *  of each other. */
function touching(words: readonly Drawn[], R: number): [number, number][] {
  const K = 5,
    W = Math.ceil(2 * R * K) + 2,
    label = new Int16Array(W * W),
    r = CLEAR * K,
    near: [number, number][] = [],
    pairs = new Set<number>();
  for (let dy = 0; dy <= r; dy++) for (let dx = -Math.floor(r); dx <= r; dx++) if ((dy > 0 || dx > 0) && dx * dx + dy * dy <= r * r) near.push([dx, dy]); // prettier-ignore
  words.forEach((w, k) => {
    const A = new Alpha(W, W);
    A.fill(toPixels(w.ink, x => (x + R) * K + 1, y => (R - y) * K + 1)); // prettier-ignore
    for (let i = 0; i < label.length; i++)
      if (A.a[i] > 127) {
        if (label[i] && label[i] !== k + 1) pairs.add(label[i] * 1000 + k + 1);
        label[i] = k + 1;
      }
  });
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const a = label[y * W + x];
      if (!a) continue;
      for (const [dx, dy] of near) {
        const b = x + dx >= 0 && x + dx < W && y + dy < W ? label[(y + dy) * W + x + dx] : 0;
        if (b && b !== a) pairs.add(Math.min(a, b) * 1000 + Math.max(a, b));
      }
    }
  return [...pairs].map(p => [Math.floor(p / 1000) - 1, (p % 1000) - 1]);
}

interface Laid {
  R: number;
  polys: Poly[];
  /** The words on each line, the stems of the text, and how many times its height as written each risen stem is. */
  lines: string[];
  pitch: number[];
  stems: number;
  /** Stems that stand in a bay of the line above theirs. */
  inBays: number;
  factors: number[];
  uneven: number;
  cost: number;
  /** How far the word spaces were opened and the lines slid, in all. */
  opened: number;
  slid: number;
}
/** 5. One text, one variant: every cut into lines reckoned as written, the best few searched for bays, each drawn
 *  and measured (a stem whose word comes within CLEAR of another's is let down again), and the cheapest kept. */
function compose(text: string, variant: Variant): Laid | null {
  const words = text.split(' '),
    n = words.length,
    cache = new Map<number, Span>(),
    span = (a: number, b: number) => cache.get(a * 100 + b) ?? (cache.set(a * 100 + b, spanOf(words.slice(a, b).join(' '))), cache.get(a * 100 + b)!), // prettier-ignore
    level = variant === 'level',
    cuts: { cut: [number, number][]; cost: number }[] = [];
  const walk = (start: number, cut: [number, number][]) => {
    if (start === n) {
      // reckoned as written: every line centred and no space opened
      const cfg = plain(cut.map(([a, b]) => span(a, b))),
        g = layout(cfg, variant, NONE);
      if (g) cuts.push({ cut: cut.slice(), cost: cost(cfg.spans, g, rise(cfg, g, variant, NONE).risen, 0, level) });
      return;
    }
    if (cut.length === MAX_LINES) return;
    for (let end = start + 1; end <= n; end++) {
      cut.push([start, end]);
      walk(end, cut);
      cut.pop();
    }
  };
  walk(0, []);
  cuts.sort((p, q) => p.cost - q.cost || p.cut.length - q.cut.length);
  let best: Laid | null = null;
  for (const { cut } of cuts.slice(0, level ? 2 : KEEP)) {
    const spans = cut.map(([a, b]) => span(a, b)),
      cfg = variant === 'b' || variant === 'c' ? search(plain(spans), variant) : plain(spans),
      ban = new Set<string>(),
      loose = new Set<string>();
    let g: Geo | null = null,
      r: Risen | null = null,
      drawn: Drawn[] = [],
      clear = false;
    for (let round = 0; round < 16 && !clear; round++) {
      g = layout(cfg, variant, loose);
      if (!g) break;
      r = rise(cfg, g, variant, ban);
      drawn = draw(cfg, g, r.extra);
      const hit = touching(drawn, g.R),
        before = ban.size + loose.size;
      clear = !hit.length;
      // the lower word of each pair: its risen stems are let down again; or else, if its stems stand in bays of the
      // line above, they are taken out of them (and the line moves down); a pair with neither cannot be mended
      for (const [u, v] of hit) {
        const w = drawn[u].line >= drawn[v].line ? drawn[u] : drawn[v],
          mine = spans[w.line].stems.map((m, s) => (m.wi === w.word ? s : -1)).filter(s => s >= 0),
          up = mine.filter(s => r!.extra[w.line][s] > 0);
        for (const s of up) ban.add(`${w.line}:${s}`);
        if (!up.length) for (const s of mine) if (g.thread[w.line][s]) loose.add(`${w.line}:${s}`);
      }
      if (!clear && ban.size + loose.size === before) break;
    }
    if (!g || !r || !clear) continue;
    if (Math.max(...drawn.flatMap(d => d.ink.flat().map(([x, y]) => Math.hypot(x, y)))) > g.R - MARGIN + 0.05) continue;
    const c = cost(spans, g, r.risen, variant === 'c' ? r.uneven : 0, level),
      extra = r.extra;
    if (best && best.cost <= c) continue;
    best = {
      R: g.R,
      polys: drawn.flatMap(d => cleanOutline(d.ink)),
      lines: cut.map(([a, b]) => words.slice(a, b).join(' ')),
      pitch: g.base.slice(1).map((y, i) => g!.base[i] - y),
      stems: spans.reduce((t, sp) => t + sp.stems.length, 0),
      inBays: g.thread.flat().filter(v => v).length,
      factors: spans.flatMap((sp, i) => sp.stems.map((m, s) => 1 + extra[i][s] / m.top)).filter(f => f > 1.001),
      uneven: r.uneven,
      cost: c,
      opened: cfg.gaps.flat().reduce((t, v) => t + v, 0),
      slid: cfg.dev.reduce((t, v) => t + Math.abs(v), 0),
    };
  }
  return best;
}
/** The drawing: black on a light disc (as the curved experiment's svgOf), as a group to set in a sheet or alone. */
function disc(l: Laid, size: number, x = 0, y = 0) {
  const R = l.R,
    k = size / (2 * (R + 2)),
    d = l.polys.map(q => 'M' + q.map(([px, py]) => `${(px + R + 2).toFixed(2)} ${(R + 2 - py).toFixed(2)}`).join('L') + 'Z').join(''); // prettier-ignore
  return `<g transform="translate(${x} ${y}) scale(${k.toFixed(5)})"><rect width="${2 * (R + 2)}" height="${2 * (R + 2)}" fill="#f3efe4"/><circle cx="${R + 2}" cy="${R + 2}" r="${R}" fill="#fffdf6" stroke="#b9a76a" stroke-width="${(R * 0.03).toFixed(2)}"/><path d="${d}" fill="#1a1a1a" fill-rule="nonzero"/></g>`; // prettier-ignore
}
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f3efe4"/>${body}</svg>`;

describe('the colonnade', () => {
  it('finds the tall stems of the four texts', () => {
    const count = (t: string) => findStems(th.buildStrokes(t, {}), t).length;
    // the name of God three; each ال two; a lam or an alif one (the kafs of these texts have no upright)
    expect(TEXTS.map(([, t]) => count(t))).toEqual([1, 7, 7, 18]);
  });
  it('redraws a stem taller and keeps its head and its foot', () => {
    const b = th.buildStrokes('الله', {}),
      stems = findStems(b, 'الله'),
      extra = stems.map(m => m.top),
      tall = raise(b, stems, extra);
    expect(stems.length).toBe(3);
    stems.forEach((m, k) => {
      const was = b.strokes[m.si].s,
        now = tall[m.si].s,
        added = now.length - was.length;
      // the head, sample for sample, moved whole along the stem; the foot where it was
      was.slice(0, m.cut + 1).forEach((q, i) => {
        expect(now[i].x).toBeCloseTo(q.x + m.lean * extra[k], 9);
        expect(now[i].y).toBeCloseTo(q.y + extra[k], 9);
        expect(now[i].w).toBe(q.w);
      });
      expect(now.slice(m.cut + 1 + added)).toEqual(was.slice(m.cut + 1));
      // and the shaft between them straight, at the pen's full weight
      for (const q of now.slice(m.cut + 1, m.cut + 1 + added)) expect(q.w).toBeGreaterThan(0.97);
    });
    expect(area(cleanOutline(inkOf(tall, b)))).toBeGreaterThan(area(cleanOutline(inkOf(b.strokes, b))));
    // the shadda rides with the second lam
    expect(stems.filter(m => m.riders.length === 1).length).toBe(1);
  });
  it.runIf(!!process.env.COLONNADE_PROBE)('draws a stretched alif and a stretched name', () => {
    const out = process.env.COLONNADE_OUT ?? join(import.meta.dirname, '../docs/colonnade');
    mkdirSync(out, { recursive: true });
    for (const [id, text] of [
      ['alif', 'ا'],
      ['allah', 'الله'],
      ['kaf', 'ملك'],
    ] as const) {
      const b = th.buildStrokes(text, {}),
        stems = findStems(b, text),
        // twice as tall, the name by one factor as the composer raises it
        tall = inkOf(raise(b, stems, stems.map(m => m.top)), b).map(q => q.map(([x, y]) => [x - 20, y] as Pt)); // prettier-ignore
      writeFileSync(join(out, `probe-${id}.png`), specimen(cleanOutline([...inkOf(b.strokes, b), ...tall])));
    }
  });
  it.runIf(!!process.env.COLONNADE)(
    'writes the sheet',
    () => {
      const out = process.env.COLONNADE_OUT ?? join(import.meta.dirname, '../docs/colonnade');
      mkdirSync(out, { recursive: true });
      const report: string[] = [],
        cells: string[] = [],
        variants = (process.env.COLONNADE_VARIANTS?.split(',') ?? ['level', 'a', 'b', 'c']) as Variant[],
        only = process.env.COLONNADE_ONLY?.split(',');
      variants.forEach((variant, row) =>
        TEXTS.forEach(([id, text], col) => {
          if (only && !only.includes(id)) return;
          const l = compose(text, variant);
          if (!l) return void report.push(`${variant} ${id}: no arrangement`);
          const f = l.factors.slice().sort((p, q) => p - q);
          report.push(
            `${variant} ${id}: radius ${l.R.toFixed(1)} (${(l.R / NIB).toFixed(1)} nibs); ${l.lines.length} lines [${l.lines.join(' / ')}]${l.pitch.length ? ` at ${l.pitch.map(v => v.toFixed(1)).join(', ')}` : ''}; stems ${l.stems}, in bays ${l.inBays}, risen ${f.length}` +
              (f.length ? `, by x${f[0].toFixed(2)} to x${f[f.length - 1].toFixed(2)} (median x${median(f).toFixed(2)})` : '') +
              (variant === 'b' || variant === 'c' ? `; bays uneven ${l.uneven.toFixed(2)}, spaces opened ${(l.opened / NIB).toFixed(1)} nibs, lines slid ${(l.slid / NIB).toFixed(1)} nibs` : ''), // prettier-ignore
          );
          writeFileSync(join(out, `${variant}-${id}.png`), toPNG(svg(900, 900, disc(l, 900)), 900));
          cells.push(disc(l, 440, 10 + col * 450, 10 + row * 450));
        }),
      );
      writeFileSync(
        join(out, 'colonnade-sheet.png'),
        toPNG(svg(1810, 10 + 450 * variants.length, cells.join('')), 1810),
      );
      writeFileSync(join(out, 'numbers.txt'), report.join('\n') + '\n');
      expect(report.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
