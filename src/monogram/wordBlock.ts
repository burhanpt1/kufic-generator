// Word seals as a block of justified lines (owner's review, round 4). The annealed word seal fused neighbouring
// words through shared strokes, let a dot settle beside another word's letter (ر read as ز, ي as ق) and staggered
// the words of one line. Here the words keep their order and their shapes: each line is laid out by the script with
// its words on one baseline, stretched (kashida) to the width of the widest line, and each line is lifted as close
// under the one above as clearance allows, so tall strokes rise into the gaps above them without touching. The line
// breaks and the ascender height are chosen to make the block as square as possible.
import type { LetterStyle, ScriptEngine } from '../script/types';
import type { CellGrid } from './grid';
import { G, markEnds, trim } from './grid';
import { kufi } from '../script/kufi';
import { wordLine } from './words';

/** Empty cells kept between letters of different lines, and between a dot (or vowel) and another line's ink. */
export const LINE_CLEAR = 1;
export const MARK_CLEAR = 4;
/** Words a block will break into lines by search (longer texts are split evenly by width instead). */
const MAX_LINES = 8;
/** The longest text a block is made of. The work grows with the square of the word count (about a second at 400
 *  words, several at 1,000), and a seal of more than a few dozen words is not legible anyway: beyond this there is
 *  no block (the caller reports that the text doesn't fit), at once, instead of a search that runs for minutes. */
export const MAX_WORDS = 1000;

export interface WordBlock {
  grid: CellGrid;
  /** The words on each line, top to bottom. */
  lines: string[][];
  H: number;
  /** Cells of kashida added across all lines. */
  stretched: number;
}

const isMark = (v: number) => v === 2 || v === 3;

/** Grow a mask by r cells in every direction (Chebyshev). */
function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  // a square neighbourhood is a run along the row, then a run along the column; each cell is written once per pass
  const out = new Uint8Array(w * h),
    rows = new Uint8Array(w * h);
  let any = false;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0, done = 0; x < w; x++) {
      if (!m[o + x]) continue;
      const b = Math.min(w - 1, x + r);
      for (let X = Math.max(done, x - r); X <= b; X++) rows[o + X] = 1;
      done = b + 1;
      any = true;
    }
  }
  if (!any) return out;
  for (let x = 0; x < w; x++)
    for (let y = 0, done = 0; y < h; y++) {
      if (!rows[y * w + x]) continue;
      const b = Math.min(h - 1, y + r);
      for (let Y = Math.max(done, y - r); Y <= b; Y++) out[Y * w + x] = 1;
      done = b + 1;
    }
  return out;
}

/** An alif of a new line that stands right under an alif of the line above, a little apart, joins it as one stem
 *  (owner's review: the alifs of الله over اكبر, of اله over الله, share a stem; other stems never join, they keep
 *  a clear gap instead). */
export const STEM_GAP = 3;
/** Straight vertical cells each end needs to count as a stem (a lam-alif knot's short legs don't). */
const STEM_RUN = 4;
function shareStems(out: CellGrid, above: Uint8Array, H: number, cols: Set<number>, added: number[]) {
  const W = out.w,
    up = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && above[y * W + x] === 1,
    any = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && out.data[y * W + x] !== 0,
    own = (x: number, y: number) => any(x, y) && !above[y * W + x] && out.data[y * W + x] === 1;
  for (const x of cols)
    for (let t = 1; t < H - 2; t++) {
      // the top of a thin vertical stem of the new line
      if (any(x, t - 1) || any(x - 1, t) || any(x + 1, t)) continue;
      let r = 0;
      while (own(x, t + r)) r++;
      if (r < STEM_RUN) continue;
      // empty column above it, clear on both sides, up to the foot of a stem of the line above
      let u = t - 1;
      while (u >= 0 && !any(x, u) && !any(x - 1, u) && !any(x + 1, u) && t - 1 - u < STEM_GAP) u--;
      let q = 0;
      while (up(x, u - q)) q++;
      if (u === t - 1 || q < STEM_RUN || up(x - 1, u - 1) || up(x + 1, u - 1)) continue;
      // (these cells were empty: the walk up to u passed only empty ones)
      for (let y = u + 1; y < t; y++) {
        out.data[y * W + x] = 1;
        added.push(y * W + x);
      }
    }
}

/** Empty cells kept straight above a stem's top (any letter cell) under ink of the line above, unless it is an alif
 *  under an alif, which joins it. */
export const STEM_CLEAR = 2;
/** Stack line grids (all `W` wide), each as high as clearance allows under the ones above. */
function stack(lines: { g: CellGrid; base: number }[], W: number, H: number): CellGrid {
  const total = lines.reduce((a, l) => a + l.g.h + MARK_CLEAR + 1, 0);
  const out = G(W, total);
  let bottom = 0, // one past the lowest inked row so far
    base = -1, // the previous line's baseline row
    prevAlifs = new Set<number>();
  // what is placed so far, as the masks a new line is tested against: everything grown by LINE_CLEAR and by
  // MARK_CLEAR, the marks grown by MARK_CLEAR, and the STEM_CLEAR cells straight below letter ink (no letter of the
  // new line may start there). A placed cell never changes (a line only goes where nothing is, and a shared stem
  // fills empty cells), and growing a union is the union of the grown parts, so each line adds its own cells to the
  // masks instead of the masks being rebuilt from the whole block for every line.
  const nearAll = new Uint8Array(W * total),
    farAll = new Uint8Array(W * total),
    farMarks = new Uint8Array(W * total),
    under = new Uint8Array(W * total);
  const addToMasks = (ink: number[], marks: number[]) => {
    if (!ink.length && !marks.length) return;
    let ya = total,
      yb = -1;
    for (const list of [ink, marks])
      for (const k of list) {
        const y = Math.floor(k / W);
        ya = Math.min(ya, y);
        yb = Math.max(yb, y);
      }
    // the rows the new cells can reach
    const y0 = Math.max(0, ya - MARK_CLEAR),
      h = Math.min(total - 1, yb + MARK_CLEAR) - y0 + 1,
      o = y0 * W,
      all = new Uint8Array(W * h),
      mk = new Uint8Array(W * h);
    for (const k of ink) all[k - o] = 1;
    for (const k of marks) all[k - o] = mk[k - o] = 1;
    const near = dilate(all, W, h, LINE_CLEAR),
      far = dilate(all, W, h, MARK_CLEAR),
      farM = marks.length ? dilate(mk, W, h, MARK_CLEAR) : null;
    for (let k = 0; k < W * h; k++) {
      if (near[k]) nearAll[o + k] = 1;
      if (far[k]) farAll[o + k] = 1;
      if (farM && farM[k]) farMarks[o + k] = 1;
    }
    for (const k of ink) for (let d = 1; d <= STEM_CLEAR && k + d * W < under.length; d++) under[k + d * W] = 1;
  };
  for (const { g, base: gb } of lines) {
    const alifs = new Set(alifCols(g, gb, H)),
      joins = new Set([...alifs].filter(x => prevAlifs.has(x)));
    // the line's inked cells, row by row: x, y, value
    const cells: number[] = [];
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const v = g.data[y * g.w + x];
        if (v) cells.push(x, y, v);
      }
    const top = cells.length ? cells[1] : -1;
    const fits = (oy: number) => {
      for (let c = 0; c < cells.length; c += 3) {
        const x = cells[c],
          Y = cells[c + 1] + oy;
        if (Y < 0) return false;
        if (Y >= total) continue;
        const k = Y * W + x;
        if (isMark(cells[c + 2]) ? farAll[k] : nearAll[k] || farMarks[k] || (under[k] && !joins.has(x))) return false;
      }
      return true;
    };
    // start clear below everything placed, then lift while it still fits
    let oy = bottom ? bottom + MARK_CLEAR - top : -top;
    // a line never rises to the baseline of the one above (it would read before it)
    while (oy - 1 + gb > base + 1 && fits(oy - 1)) oy--;
    base = oy + gb;
    const above = bottom ? out.data.slice() : null,
      ink: number[] = [],
      marks: number[] = [];
    for (let c = 0; c < cells.length; c += 3) {
      const v = cells[c + 2],
        Y = cells[c + 1] + oy;
      if (Y < 0 || Y >= total) continue;
      const k = Y * W + cells[c];
      out.data[k] = v;
      (isMark(v) ? marks : ink).push(k);
    }
    if (above) shareStems(out, above, total, joins, ink);
    prevAlifs = alifs;
    addToMasks(ink, marks);
    for (const list of [ink, marks]) for (const k of list) bottom = Math.max(bottom, Math.floor(k / W) + 1);
  }
  return trim(out);
}

/** Even splits of `n` words into lines by natural width, for every line count up to `maxL` at once: the split whose
 *  widest line is narrowest. The function returned gives the first word of each of L lines (null if no split). */
function splitEvenly(widths: (i: number, j: number) => number, n: number, maxL: number) {
  // best[k][j]: narrowest possible widest line for words 0..j-1 in k lines; cut[k][j]: start of the last line
  // (a row doesn't depend on how many lines are wanted in the end, so one table serves every line count)
  const best = Array.from({ length: maxL + 1 }, () => new Float64Array(n + 1).fill(Infinity)),
    cut = Array.from({ length: maxL + 1 }, () => new Int32Array(n + 1).fill(-1));
  best[0][0] = 0;
  for (let k = 1; k <= maxL; k++) {
    const prev = best[k - 1],
      cur = best[k],
      ck = cut[k];
    for (let j = k; j <= n; j++) {
      let b = Infinity,
        c = -1;
      for (let i = k - 1; i < j; i++) {
        const v = Math.max(prev[i], widths(i, j));
        if (v < b) {
          b = v;
          c = i;
        }
      }
      cur[j] = b;
      ck[j] = c;
    }
  }
  return (L: number): number[] | null => {
    if (!isFinite(best[L][n])) return null;
    const starts: number[] = [];
    for (let k = L, j = n; k > 0; k--) {
      starts.unshift(cut[k][j]);
      j = cut[k][j];
    }
    return starts;
  };
}

/** The natural width of the line of words i..j-1 (Infinity when none of them can be drawn).
 *
 *  The Kufi engine shapes each word by itself and sets a natural line as its words side by side with the word gap
 *  between them (shape.ts splits the text into words, prepare.ts sizes each glyph from its own word, strip() adds up
 *  minW and gaps), so a span is exactly as wide as its drawn words and the gaps between them: per-word widths and
 *  two prefix sums answer every span, where laying out each span of an n-word text was O(n³) work. A word the engine
 *  draws nothing for (no letter it knows) adds neither width nor a gap, as in the joined text. Any other engine, and
 *  a fractional gap (whose sum could round differently), is measured by laying the span out. */
function spanWidths(
  script: ScriptEngine,
  words: string[],
  wordGap: number,
  lineGrid: (text: string, extra: number) => LineGrid | null,
): (i: number, j: number) => number {
  if (script !== kufi || !Number.isInteger(wordGap))
    return (i, j) => lineGrid(words.slice(i, j).join(' '), 0)?.g.w ?? Infinity;
  const n = words.length,
    sum = new Float64Array(n + 1),
    drawn = new Int32Array(n + 1);
  for (let k = 0; k < n; k++) {
    const g = lineGrid(words[k], 0);
    sum[k + 1] = sum[k] + (g ? g.g.w : 0);
    drawn[k + 1] = drawn[k] + (g ? 1 : 0);
  }
  return (i, j) => {
    const c = drawn[j] - drawn[i];
    return c ? sum[j] - sum[i] + wordGap * (c - 1) : Infinity;
  };
}

/** Columns where a line has a full stem: letter ink straight from just under the ascender top down to the baseline
 *  (alif, lam; not the legs of a lam-alif knot). */
function tallCols(g: CellGrid, base: number, H: number): number[] {
  const out: number[] = [];
  if (base - H + 2 < 0) return out;
  for (let x = 0; x < g.w; x++) {
    let ok = true;
    for (let y = base - H + 2; y <= base && ok; y++) if (g.data[y * g.w + x] !== 1) ok = false;
    if (ok) out.push(x);
  }
  return out;
}
/** Columns where a line has an alif: a full stem joined to nothing on its left, with nothing beside its lower body
 *  (lam, kaf and ط stems join or carry strokes there). */
function alifCols(g: CellGrid, base: number, H: number): number[] {
  const at = (x: number, y: number) => (x < 0 || x >= g.w || y < 0 ? 0 : g.data[y * g.w + x]);
  return tallCols(g, base, H).filter(
    x => !at(x - 1, base) && !at(x - 1, base - 1) && !at(x + 1, base - 1) && !at(x + 1, base - 2),
  );
}
type LineGrid = { g: CellGrid; base: number };
/** Word gaps a line laid out word by word may use beyond the natural one, and kashida per word. */
const GAP_MORE = 2,
  ALIGN = 4;
/** Kashida a word may take for alignment: a quarter of its width, so it never pulls apart (رب in the Hamd). */
const wordExtra = (w: number) => Math.ceil(w / 4);
/** A line `W` wide built word by word, each word's kashida and each gap chosen so that as many of its alifs as
 *  possible stand right under alifs of the line above (owner's review, seals round 7: the alifs of اله and الله in
 *  the Shahada share one stem). Within that, kashida and gaps spread as evenly as they can. */
/** A word as alignLine may set it: `e` cells of kashida, its grid, and the columns of its alifs. */
type WordOpt = { e: number; lg: LineGrid; tall: number[] };
/** The widths a word may take in alignLine, narrowest first (the same for every line and block width). */
function wordOpts(w: string, word: (w: string, e: number) => LineGrid | null, H: number): WordOpt[] {
  const o: WordOpt[] = [];
  const w0 = word(w, 0)?.g.w ?? 0;
  for (let e = 0; e <= wordExtra(w0); e++) {
    const lg = word(w, e);
    if (lg && lg.g.w === (o[0]?.lg.g.w ?? lg.g.w - e) + e) o.push({ e, lg, tall: alifCols(lg.g, lg.base, H) });
  }
  return o;
}
function alignLine(
  ws: string[],
  W: number,
  above: Set<number>,
  optsOf: (w: string) => WordOpt[],
  wordGap: number,
): { line: LineGrid; aligned: number; stretched: number } | null {
  const opts: WordOpt[][] = ws.map(optsOf);
  if (opts.some(o => !o.length)) return null;
  // the words chosen so far, last first (a chain shared between states instead of a copy per state)
  type Pick = { o: WordOpt; left: number; prev: Pick | null };
  type St = { score: number; aligned: number; pick: Pick | null };
  // states by the left edge of the last word placed, words placed from the right
  let states = new Map<number, St>([[W, { score: 0, aligned: 0, pick: null }]]);
  ws.forEach((_, i) => {
    const next = new Map<number, St>();
    for (const [edge, st] of states)
      for (let gp = i ? wordGap : 0; gp <= (i ? wordGap + GAP_MORE : 0); gp++)
        for (const o of opts[i]) {
          const left = edge - gp - o.lg.g.w;
          if (left < 0) continue;
          let hit = 0;
          for (const c of o.tall) if (above.has(left + c)) hit++;
          const score = st.score + ALIGN * hit - (o.e * o.e) / opts[i][0].lg.g.w - 0.5 * (gp - (i ? wordGap : 0)) ** 2,
            cur = next.get(left);
          if (!cur || score > cur.score)
            next.set(left, { score, aligned: st.aligned + hit, pick: { o, left, prev: st.pick } });
        }
    states = next;
  });
  const end = states.get(0);
  if (!end) return null;
  const picks: Pick[] = [];
  for (let p = end.pick; p; p = p.prev) picks.unshift(p);
  let up = -Infinity,
    down = -Infinity;
  for (const p of picks) {
    up = Math.max(up, p.o.lg.base);
    down = Math.max(down, p.o.lg.g.h - 1 - p.o.lg.base);
  }
  const g = G(W, up + 1 + down);
  for (const { o, left } of picks) {
    const dy = up - o.lg.base;
    for (let y = 0; y < o.lg.g.h; y++)
      for (let x = 0; x < o.lg.g.w; x++) {
        const v = o.lg.g.data[y * o.lg.g.w + x];
        if (v) g.data[(y + dy) * W + left + x] = v;
      }
  }
  return {
    line: { g, base: up },
    aligned: end.aligned,
    stretched: picks.reduce((a, p) => a + p.o.e, 0),
  };
}

/** A line narrower than the block may sit anywhere in its margin: the shift that puts most of its alifs under (or
 *  over) alifs of the neighbouring line, the smallest such shift from where it is. */
function slide(lg: LineGrid, target: Set<number>, H: number): { line: LineGrid; hits: number } {
  const g = lg.g,
    cols = alifCols(g, lg.base, H);
  let x0 = g.w,
    x1 = -1;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++)
      if (g.data[y * g.w + x]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
  let best = { d: 0, hits: cols.filter(c => target.has(c)).length };
  for (let d = -x0; d <= g.w - 1 - x1; d++) {
    const hits = cols.filter(c => target.has(c + d)).length;
    if (hits > best.hits || (hits === best.hits && hits > 0 && Math.abs(d) < Math.abs(best.d))) best = { d, hits };
  }
  if (!best.d) return { line: lg, hits: best.hits };
  const out = G(g.w, g.h);
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) if (g.data[y * g.w + x]) out.data[y * g.w + x + best.d] = g.data[y * g.w + x];
  return { line: { g: out, base: lg.base }, hits: best.hits };
}

/** The squarest block of justified lines for these words, at either ascender height. */
export function wordBlock(
  script: ScriptEngine,
  words: string[],
  letter: LetterStyle,
  Hs: number[],
  wordGap = 2,
): WordBlock | null {
  if (!words.length || words.length > MAX_WORDS) return null;
  let best: { b: WordBlock; score: number } | null = null;
  for (const H of Hs) {
    const lt: LetterStyle = { ...letter, ascenders: H, marks: 'dots' },
      // each text is shaped and set at its natural width once, then laid out at each width asked for, once
      cache = new Map<string, { line: ReturnType<typeof wordLine>; at: Map<number, LineGrid | null> }>(),
      lineGrid = (text: string, extra: number) => {
        let c = cache.get(text);
        if (!c) cache.set(text, (c = { line: wordLine(script, text, lt, wordGap), at: new Map() }));
        let g = c.at.get(extra);
        if (g === undefined) c.at.set(extra, (g = c.line ? c.line(extra) : null));
        return g;
      },
      text = (i: number, j: number) => words.slice(i, j).join(' '),
      optsCache = new Map<string, WordOpt[]>(),
      optsOf = (w: string) => {
        let o = optsCache.get(w);
        if (!o) optsCache.set(w, (o = wordOpts(w, lineGrid, H)));
        return o;
      },
      widths = spanWidths(script, words, wordGap, lineGrid),
      maxL = Math.min(words.length, MAX_LINES),
      split = splitEvenly(widths, words.length, maxL);
    for (let L = 1; L <= maxL; L++) {
      const starts = split(L);
      if (!starts) continue;
      const spans = starts.map((s, k) => [s, starts[k + 1] ?? words.length]),
        nat = spans.map(([i, j]) => widths(i, j)),
        W0 = Math.max(...nat);
      // justify to the widest line, or wider while the block is taller than it is wide
      for (let W = W0; W <= W0 + Math.ceil(W0 / 2); W += 2) {
        const used: number[] = [];
        const grids = spans.map(([i, j], k) => {
          // a short line stretches by at most half its width and is centred, so a lone short word doesn't pull
          // apart across the block (يا over لطيف, رب over زدني); a lone word over a line of several barely stretches at
          // all, since kashidas inside it read as gaps (نور over على نور)
          const lone = j - i === 1 && spans.some(([a, b]) => b - a > 1),
            cap = lone ? Math.max(1, Math.floor(nat[k] / 6)) : Math.max(3, Math.ceil(nat[k] / 2)),
            extra = Math.min(W - nat[k], cap),
            g = (extra && lineGrid(text(i, j), extra)) || lineGrid(text(i, j), 0)!;
          used[k] = g.g.w - nat[k];
          if (g.g.w === W) return g;
          // short of the width: centre it
          const c = G(W, g.g.h),
            ox = Math.floor((W - g.g.w) / 2);
          for (let y = 0; y < g.g.h; y++)
            for (let x = 0; x < g.g.w; x++) c.data[y * W + x + ox] = g.g.data[y * g.g.w + x];
          return { g: c, base: g.base };
        });
        // lines narrower than the block slide within their margin to stand alifs under alifs, top down
        for (let k = 1; k < grids.length; k++)
          if (used[k] + nat[k] < W)
            grids[k] = slide(grids[k], new Set(alifCols(grids[k - 1].g, grids[k - 1].base, H)), H).line;
        for (let k = grids.length - 2; k >= 0; k--)
          if (used[k] + nat[k] < W) {
            const below = new Set(alifCols(grids[k + 1].g, grids[k + 1].base, H)),
              s = slide(grids[k], below, H);
            if (s.hits) grids[k] = s.line;
          }
        // lower lines: rebuilt word by word where that puts more of their stems under stems of the line above
        for (let k = 1; k < grids.length; k++) {
          const above = new Set(alifCols(grids[k - 1].g, grids[k - 1].base, H)),
            have = alifCols(grids[k].g, grids[k].base, H).filter(c => above.has(c)).length,
            [i, j] = spans[k],
            a = alignLine(words.slice(i, j), W, above, optsOf, wordGap);
          if (a && a.aligned > have) {
            used[k] = a.stretched;
            grids[k] = a.line;
          }
        }
        // then upper lines over the line below, where the lower one had no slack to move (keeping what they share
        // with the line above them)
        for (let k = grids.length - 2; k >= 0; k--) {
          const below = new Set(alifCols(grids[k + 1].g, grids[k + 1].base, H)),
            prev = k ? new Set(alifCols(grids[k - 1].g, grids[k - 1].base, H)) : null,
            mine = (lg: LineGrid) => alifCols(lg.g, lg.base, H),
            have = mine(grids[k]).filter(c => below.has(c)).length,
            kept = prev ? mine(grids[k]).filter(c => prev.has(c)).length : 0,
            [i, j] = spans[k],
            a = alignLine(words.slice(i, j), W, below, optsOf, wordGap);
          if (a && a.aligned > have && (!prev || mine(a.line).filter(c => prev.has(c)).length >= kept)) {
            used[k] = a.stretched;
            grids[k] = a.line;
          }
        }
        const grid = stack(grids, W, H),
          sq = Math.abs(grid.w - grid.h) / Math.max(grid.w, grid.h),
          // square first; then little kashida, and the shorter ascenders when it's close
          stretched = used.reduce((a, b) => a + b, 0),
          score = sq + (0.25 * stretched) / (W * L) + (H > Hs[0] ? 0.03 : 0);
        if (!best || score < best.score - 1e-9)
          best = { b: { grid, lines: spans.map(([i, j]) => words.slice(i, j)), H, stretched }, score };
        if (grid.w >= grid.h) break;
      }
    }
  }
  if (!best) return null;
  best.b.grid = markEnds(trim(best.b.grid, 1));
  return best.b;
}
