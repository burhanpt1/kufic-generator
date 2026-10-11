// Words and letters as cell grids, from the script engine's line layout (lab wordGrid and letterShape).
import { glyphEpoch } from '../glyphs/overrides';
import type { LetterStyle, ScriptEngine } from '../script/types';
import type { CellStrip } from '../script/types';
import type { CellGrid } from './grid';
import { G, gAt, trim } from './grid';

/** Strip (y up) -> grid (y down), stem endings as plain strokes. */
function stripGrid(st: CellStrip): CellGrid {
  const g = G(st.W, st.Hb);
  for (let y = 0; y < st.Hb; y++)
    for (let x = 0; x < st.W; x++) {
      const v = st.data[y * st.W + x];
      if (v) g.data[(st.Hb - 1 - y) * st.W + x] = v === 4 ? 1 : v;
    }
  return g;
}

/** A text as one justified line, `extra` cells wider than natural, with its baseline row (lab wordGrid). */
export function wordGrid(
  script: ScriptEngine,
  text: string,
  letter: LetterStyle,
  extra: number,
  wordGap = 2,
): { g: CellGrid; base: number } | null {
  const sh = script.shape(text, letter);
  if (!sh.words.length) return null;
  const p = script.prepare(sh, letter),
    segs = script.segments(p, 'words', wordGap),
    opts = { wrap: false, rhythm: false, wordGap, terminals: 'none' as const };
  const nat = script.layout(segs, p, null, opts);
  if (!nat || nat.kind !== 'cells') return null;
  const st = extra ? script.layout(segs, p, nat.W + extra, opts) : nat;
  if (!st || st.kind !== 'cells') return null;
  const out = stripGrid(st);
  // baseline: the lowest row that holds a long horizontal run
  let base = out.h - 1,
    best = -1;
  for (let y = 0; y < out.h; y++) {
    let run = 0,
      mx = 0;
    for (let x = 0; x < out.w; x++) {
      if (out.data[y * out.w + x] === 1) {
        run++;
        mx = Math.max(mx, run);
      } else run = 0;
    }
    if (mx >= best) {
      best = mx;
      base = y;
    }
  }
  return { g: out, base };
}

export interface LetterShape {
  c: string;
  w: number;
  h: number;
  /** [x, y, value] */
  cells: [number, number, number][];
  /** Cells that may be shared with another letter (inside a long straight stroke). */
  share: Set<string>;
  /** Join stubs: [x, y, direction]; the cell beyond must belong to another letter. */
  joins: [number, number, number][];
  form: 'iso' | 'ini' | 'med' | 'fin';
  extra: number;
  H: number;
  cost: number;
}

const shapeCache = new Map<string, LetterShape | null>();
/** One letter in a given form, ascender height and stretch, as cells (lab letterShape). */
export function letterShape(
  script: ScriptEngine,
  c: string,
  letter: LetterStyle,
  extra = 0,
  form: LetterShape['form'] = 'iso',
): LetterShape | null {
  const text = form === 'ini' ? c + 'ـ' : form === 'med' ? 'ـ' + c + 'ـ' : form === 'fin' ? 'ـ' + c : c;
  const key = script.id + text + JSON.stringify(letter) + extra + ':' + glyphEpoch();
  if (shapeCache.has(key)) return shapeCache.get(key)!;
  const wg = wordGrid(script, text, { ...letter, marks: 'dots' }, extra, 1);
  if (!wg) return null;
  const g = trim(wg.g),
    cells: [number, number, number][] = [],
    share = new Set<string>();
  const L = (x: number, y: number) => gAt(g, x, y) === 1 || gAt(g, x, y) === 4;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const v = gAt(g, x, y);
      if (!v) continue;
      cells.push([x, y, v === 4 ? 1 : v]);
      const run = (dx: number, dy: number) => {
        let a = 0,
          b = 0;
        while (L(x - dx * (a + 1), y - dy * (a + 1))) a++;
        while (L(x + dx * (b + 1), y + dy * (b + 1))) b++;
        return a >= 1 && b >= 1 && a + b + 1 >= 4;
      };
      if (L(x, y) && (run(1, 0) || run(0, 1))) share.add(x + ',' + y);
    }
  // join points: where the baseline stub leaves the shape (left = joins the next letter, right = joins the previous)
  const joins: [number, number, number][] = [];
  const edgeRow = (x: number) => {
    for (let y = g.h - 1; y >= 0; y--) if (L(x, y) && L(x + (x === 0 ? 1 : -1), y)) return y;
    return -1;
  };
  if (form === 'ini' || form === 'med') {
    const y = edgeRow(0);
    if (y >= 0) joins.push([0, y, -1]);
  }
  if (form === 'fin' || form === 'med') {
    const y = edgeRow(g.w - 1);
    if (y >= 0) joins.push([g.w - 1, y, 1]);
  }
  if (form !== 'iso' && !joins.length) {
    shapeCache.set(key, null);
    return null;
  }
  const out: LetterShape = {
    c,
    w: g.w,
    h: g.h,
    cells,
    share,
    joins,
    form,
    extra,
    H: letter.ascenders,
    cost: extra + (letter.ascenders - 7) * 0.6 + (form === 'iso' ? 0 : 0.5),
  };
  shapeCache.set(key, out);
  return out;
}
