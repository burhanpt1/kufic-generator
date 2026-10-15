import type { BandGlyph, MarksMode, Seg, Unit, VowelStyle, Word } from '../types';
import { altDef } from '../glyphs/overrides';
import { buildGlyph } from './buildGlyph';
import { V } from '../glyphs/overrides';

/** Letters whose initial and medial forms are a bare tooth. */
const TEETH = new Set(['BEH', 'NOON', 'YEH']);
/** Letters with a small closed loop that justification may not widen when loops are rigid (a wide م reads as ص). */
const LOOPS = new Set(['MEEM', 'WAW', 'FEH', 'QAF', 'HEH']);
const TAILS = new Set(['BEH', 'NOON', 'YEH', 'HAH', 'SEEN', 'SAD', 'AIN', 'FEH', 'QAF', 'KAF', 'GAF', 'MEEM']);

export interface Prepared {
  words: Word[];
  Hb: number;
  base: number;
}

// Composites glyphs to a shared band height Hb and finds their stretchable and tall-stem columns.
// Stretchable columns: a word-final tail (baseline only) or a letter body (every stroke in the column is horizontal).
export function prepare(shaped: Unit[][], H: number, mode: MarksMode, style: VowelStyle, alts = false): Prepared {
  const built = shaped.map(units => units.map(u => buildGlyph(u, H, mode, style)));
  // a tooth letter (ب ت ث ن ي …) joined to a tall letter: its dots sit in the hollow between its tooth and that
  // letter's stem (owner's review: dots go in the hollow the letter makes). One more cell of join toward the stem
  // makes the hollow wide enough for a spaced pair to sit centred; a column that only held a dot goes, so the word
  // keeps its width. The following letter's stem counts first, then the preceding one's. strip() centres the dots.
  const tall = (g: (typeof built)[number][number] | undefined) => !!g?.cells.some(([, y, v]) => v === 1 && y >= H - 1);
  built.forEach((gs, wi) =>
    gs.forEach((g, gi) => {
      const u = shaped[wi][gi];
      if (!TEETH.has(u.key) || (u.form !== 'ini' && u.form !== 'med') || !g.cells.some(([, , v]) => v !== 1)) return;
      const next = u.jn && tall(gs[gi + 1]),
        prev = !next && u.jp && tall(gs[gi - 1]);
      if (!next && !prev) return;
      let w = g.w + 1,
        cells: [number, number, number][] = next
          ? // join on the left; the dots stay put, so they move toward the stem
            [[0, 0, 1], ...g.cells.map(([x, y, v]) => [v === 1 ? x + 1 : x, y, v] as [number, number, number])]
          : // join on the right; the dots move one cell right, toward the stem
            [[g.w, 0, 1], ...g.cells.map(([x, y, v]) => [v === 1 ? x : x + 1, y, v] as [number, number, number])];
      const edge = next ? w - 1 : 0;
      if (!cells.some(([x, , v]) => x === edge && v === 1)) {
        w--;
        cells = next
          ? cells.filter(([x]) => x < w)
          : cells.filter(([x]) => x > 0).map(([x, y, v]) => [x - 1, y, v] as [number, number, number]);
      }
      gs[gi] = { ...g, w, cells };
    }),
  );
  // long alternates (opt-in) share the band, so they count toward its height
  const altBuilt = alts
    ? shaped.map(units =>
        units.map(u => {
          const d = altDef(u.key, u.form);
          return d ? buildGlyph(u, H, mode, style, d) : null;
        }),
      )
    : null;
  let up = H - 1,
    down = 0;
  [...built.flat(), ...(altBuilt?.flat() ?? [])].forEach(g => {
    if (!g) return;
    up = Math.max(up, g.top);
    down = Math.max(down, -g.bottom);
  });
  const Hb = up + 1 + down;
  const comp = (g: (typeof built)[number][number]): BandGlyph => {
    const data = new Uint8Array(g.w * Hb);
    g.cells.forEach(([x, y, v]) => {
      data[(y + down) * g.w + x] = v;
    });
    const at = (x: number, y: number) => (x < 0 || x >= g.w ? 0 : data[y * g.w + x]);
    const tailC: number[] = [],
      bodyC: number[] = [];
    for (let x = 1; x < g.w - 1; x++) {
      let n = 0,
        ok = true,
        marks = false;
      for (let y = 0; y < Hb; y++) {
        const v = at(x, y);
        if (!v) continue;
        if (v !== 1 && v !== 4) {
          marks = true;
          continue;
        }
        n++;
        if (!(at(x - 1, y) === 1 && at(x + 1, y) === 1)) ok = false;
      }
      if (!ok || marks || !n) continue;
      if (n === 1 && at(x, down) === 1) {
        if ((g.form === 'fin' || g.form === 'iso') && TAILS.has(g.key)) tailC.push(x);
      } else if (n >= 2 && !(V.loops === 'rigid' && LOOPS.has(g.key))) bodyC.push(x);
    }
    const str: { c: number; w: number }[] = [];
    if (tailC.length) str.push({ c: tailC[Math.floor(tailC.length / 2)], w: 3 });
    if (bodyC.length) str.push({ c: bodyC[Math.floor(bodyC.length / 2)], w: 2.5 });
    str.sort((a, b) => a.c - b.c);
    const tall: number[] = [];
    const tr = down + H - 1;
    if (tr < Hb) for (let x = 0; x < g.w; x++) if (data[tr * g.w + x] === 1) tall.push(x);
    const b: BandGlyph = { w: g.w, data, form: g.form, str, tall };
    if (TEETH.has(g.key) && (g.form === 'ini' || g.form === 'med')) b.cup = true;
    return b;
  };
  const words = built.map((gs, wi) => ({
    glyphs: gs.map((g, gi) => {
      const b = comp(g),
        a = altBuilt?.[wi][gi];
      if (a && a.w > g.w) b.alt = comp(a);
      return b;
    }),
    seps: shaped[wi].slice(0, -1).map(u => (u.jn ? 'join' : 'gap') as 'join' | 'gap'),
  }));
  return { words, Hb, base: down };
}

export const segW = (s: Word) => s.glyphs.reduce((a, g) => a + g.w, 0) + s.seps.length;
/** One segment per word. */
export function wordSegs(words: Word[]): Seg[] {
  return words.map(w => ({ ...w, endsWord: true, minW: segW(w) }));
}
/** Segments split at every in-word break (after right-joining-only letters) as well as between words. */
export function breakSegs(words: Word[]): Seg[] {
  const out: Seg[] = [];
  words.forEach(w => {
    let cur = { glyphs: [w.glyphs[0]], seps: [] } as unknown as Seg;
    w.seps.forEach((s, i) => {
      if (s === 'gap') {
        cur.endsWord = false;
        out.push(cur);
        cur = { glyphs: [], seps: [] } as unknown as Seg;
      } else cur.seps.push('join');
      cur.glyphs.push(w.glyphs[i + 1]);
    });
    cur.endsWord = true;
    out.push(cur);
  });
  out.forEach(s => (s.minW = segW(s)));
  return out;
}
