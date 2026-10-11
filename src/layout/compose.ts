import { abjad, uniqueLetters } from '../abjad';
import { bitmap } from '../glyphs/bitmap';
import { def, setVariants } from '../glyphs/overrides';
import type { Prepared } from '../shaping/prepare';
import { breakSegs, prepare, wordSegs } from '../shaping/prepare';
import { shape } from '../shaping/shape';
import type {
  Centre,
  CircleRing,
  ComposeInfo,
  ComposeOptions,
  ComposeResult,
  Form,
  Grid,
  LetterOptions,
  Seg,
  Segs,
  SquareRing,
  Word,
} from '../types';
import { geomCircle, geomSquare } from './geometry';
import { makeGrid, placeSide, rotate, stripToGrid } from './grid';
import type { Partition } from './solvers';
import { fitFlow, fitPerRing, greedyOK, partition, repeatSegs } from './solvers';
import { RHY, strip } from './strip';
import { markTerminals } from './terminals';

type SquareGeom = NonNullable<ReturnType<typeof geomSquare>>;
type CircleGeom = NonNullable<ReturnType<typeof geomCircle>>;

export function compose(opts: ComposeOptions): ComposeResult {
  const {
    text,
    layout,
    H,
    wordGap: wg,
    rotation = 0,
    center,
    rings: nr0,
    marks = 'off',
    vowels = 'modern',
    repeat = true,
    terminals = 'none',
  } = opts;
  const gap = opts.gap || 1,
    taper = opts.taper || 0,
    cf = opts.centre || 0;
  setVariants(opts);
  RHY.on = !!opts.rhythm;
  const lines = text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);
  const all = lines.join(' ');
  const sh0 = shape(all);
  const info: ComposeInfo = {
    unsupported: sh0.unsupported,
    rings: 0,
    empty: !sh0.words.length,
    gap,
    abjad: abjad(all),
    lines: lines.length,
  };
  if (!sh0.words.length) return { kind: 'empty', info };
  // shared band height across every line so rings match
  const prepAll = prepare(sh0.words, H, marks, vowels),
    Hb = prepAll.Hb,
    base = prepAll.base;
  info.band = Hb;
  const minTopFor = (bs: number) =>
    terminals === 'asc' || terminals === 'tails' ? bs + H - 1 : terminals === 'all' ? bs + 2 : Infinity;
  const S = (segs: Seg[], U: number | null, wrap: boolean, hb = Hb, bs = base) =>
    markTerminals(
      strip(segs, hb, bs, wg, U, wrap) || strip(segs, hb, bs, wg, null)!,
      hb,
      minTopFor(bs),
      terminals === 'tails',
      bs,
    );
  // pad words to the shared band height (lines prepared separately may be shorter)
  const fit = (words: Word[]) =>
    words.map(w => ({
      ...w,
      glyphs: w.glyphs.map(g => {
        const h = g.data.length / g.w;
        if (h === Hb) return g;
        const pb = prepLineBase!;
        const d = new Uint8Array(g.w * Hb);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < g.w; x++) d[(y + base - pb.base) * g.w + x] = g.data[y * g.w + x];
        return { ...g, data: d };
      }),
    }));
  let prepLineBase: Prepared | null = null;
  const lineWords = lines.map(l => {
    const sh = shape(l).words;
    const p = prepare(sh, H, marks, vowels);
    prepLineBase = p;
    return fit(p.words);
  });

  if (layout === 'line') {
    const words = lineWords.flat();
    const st = S(wordSegs(words), null, false);
    info.size = st.W;
    return { kind: 'grid', grid: stripToGrid(st, Hb), bands: [{ kind: 'line' }], info };
  }

  const circle = layout === 'circle';
  const nr = lines.length > 1 ? lines.length : nr0;
  const cb = !circle && opts.cornerBlocks ? Hb + 1 : 0;
  const geomOf = (L: number) =>
    circle ? geomCircle(L, nr, Hb, gap, taper, cf) : geomSquare(L, nr, Hb, gap, taper, cf, cb);
  const cache = new Map<number, ReturnType<typeof geomOf>>();
  const geom = (L: number) => {
    if (!cache.has(L)) cache.set(L, geomOf(L));
    return cache.get(L);
  };
  const per = circle ? 1 : 4;
  let sol: { L: number; groups: Seg[][]; rep: number } | Partition | null;
  if (lines.length > 1) {
    // whole words per side where possible: repeat short lines so there is at least one word per side
    const ringSegs = lineWords.map(w => {
      let s: Segs = wordSegs(w);
      s.wg = wg;
      if (s.length < per) s = repeatSegs(s, Math.ceil(per / s.length));
      s.wg = wg;
      return s;
    });
    const pr = fitPerRing(
      ringSegs,
      L => {
        const g = geom(L);
        return g && g.rings.map(r => Array(per).fill(r.U));
      },
      Hb + 4,
      repeat,
    );
    sol = pr && { ...pr, groups: pr.groups.flat() };
  } else {
    const segs: Segs = breakSegs(lineWords[0]);
    segs.wg = wg;
    sol = fitFlow(
      segs,
      L => {
        const g = geom(L);
        return g && g.rings.flatMap(r => Array(per).fill(r.U));
      },
      Hb + 4,
      repeat,
    );
  }
  if (!sol) {
    info.empty = true;
    info.tooBig = true;
    return { kind: 'empty', info };
  }
  const L = sol.L!,
    G = geom(L)!;
  info.rings = nr;
  info.size = circle ? 2 * L : L;
  info.rep = sol.rep;
  const ringsOut: (SquareRing | CircleRing)[] = [];
  if (circle) {
    (G as CircleGeom).rings.forEach((r, k) => {
      const st = S(sol.groups[k], r.U, true);
      ringsOut.push({ data: st.data, tag: st.tag, W: r.U, N: r.N, Hb, Rout: r.Rl, scale: r.s, ring: k + 1 });
    });
  } else {
    (G as SquareGeom).rings.forEach((r, k) => {
      const g = makeGrid(r.Ll, r.Ll);
      for (let side = 0; side < 4; side++)
        placeSide(g, S(sol.groups[k * 4 + side], r.U, false), r.U, Hb, 0, r.Ll, side, k);
      const corners = cb
        ? [
            [0, 0],
            [r.Ll - Hb, 0],
            [0, r.Ll - Hb],
            [r.Ll - Hb, r.Ll - Hb],
          ].map(([x, y]) => ({ x, y, s: Hb }))
        : [];
      ringsOut.push({ grid: rotation ? rotate(g, rotation) : g, off: r.o, scale: r.s, ring: k + 1, corners, Hb });
    });
  }
  // centre
  const centre: Centre = circle
    ? { type: center, r: (G as CircleGeom).free }
    : { type: center, o: (G as SquareGeom).centre.o, C: (G as SquareGeom).centre.C };
  if (center === 'letters') {
    const ul = uniqueLetters(all),
      sh = shape(ul).words;
    if (sh.length) {
      const p = prepare(sh, H, marks === 'off' ? 'off' : 'dots', vowels),
        segs: Segs = wordSegs(p.words);
      segs.wg = wg;
      const one = segs.reduce((a2, s2) => a2 + s2.minW, 0) + wg * segs.length;
      if (circle) {
        const Gc = G as CircleGeom;
        const free = Gc.free - gap * Gc.rings[nr - 1].s;
        if (free > 2) {
          let Ro = Math.ceil(Math.max((one + 1) / (2 * Math.PI) + p.Hb / 2, p.Hb * 1.6 + 1)),
            sc = 1;
          if (Ro <= free) Ro = Math.floor(free);
          else sc = free / Ro;
          const N = Math.round(2 * Math.PI * (Ro - p.Hb / 2)),
            rep = Math.max(1, Math.floor((N - 1 + wg) / one));
          const st = S(
            repeatSegs(segs, rep).map(x => ({ ...x, rep: 0 })),
            N - 1,
            true,
            p.Hb,
            p.base,
          );
          centre.emblem = { data: st.data, tag: st.tag, W: N - 1, N, Hb: p.Hb, Rout: Ro, scale: sc, ring: 0 };
          centre.r = (Ro - p.Hb - gap) * sc;
        }
      } else {
        const C = (G as SquareGeom).centre.C,
          capC = (LL: number) => [LL - p.Hb - 1, LL - p.Hb - 1, LL - p.Hb - 1, LL - p.Hb - 1];
        const bs: Segs = breakSegs(p.words);
        bs.wg = wg;
        let Le = p.Hb + 4;
        while (Le < 2000 && !greedyOK(bs, capC(Le))) Le++;
        let part: Partition | null = null;
        for (; Le < 2000 && !(part = partition(bs.length >= 4 ? bs : repeatSegs(bs, 4), capC(Le))); Le++);
        if (part) {
          if (Le < C) {
            for (let rep = 2; rep <= 12; rep++) {
              const q = partition(repeatSegs(bs, rep), capC(Math.floor(C)));
              if (q) part = q;
              else break;
            }
            Le = Math.floor(C);
          }
          const eg = makeGrid(Le, Le);
          part.groups.forEach((sg, side) =>
            placeSide(
              eg,
              S(
                sg.map(x => ({ ...x, rep: 0 })),
                Le - p.Hb - 1,
                false,
                p.Hb,
                p.base,
              ),
              Le - p.Hb - 1,
              p.Hb,
              0,
              Le,
              side,
              0,
            ),
          );
          centre.emblem = { grid: rotation ? rotate(eg, rotation) : eg, scale: Math.min(1, C / Le), Hb: p.Hb };
        }
      }
    }
  }
  // band geometry and rules in screen cells
  const bands: Record<string, number>[] = [],
    rules: Record<string, number>[] = [];
  if (circle) {
    const Gc = G as CircleGeom;
    Gc.rings.forEach(r => {
      bands.push({ r0: r.Ro - Hb * r.s, r1: r.Ro, s: r.s });
      rules.push({ r: r.Ro + (gap * r.s) / 2, w: gap * r.s });
    });
    const last = Gc.rings[nr - 1];
    rules.push({ r: last.Ro - Hb * last.s - (gap * last.s) / 2, w: gap * last.s });
  } else {
    const Gs = G as SquareGeom;
    Gs.rings.forEach(r => {
      bands.push({ o: r.o, hb: Hb * r.s, s: r.s });
      rules.push({ o: r.o - (gap * r.s) / 2, w: gap * r.s });
    });
    const last = Gs.rings[nr - 1];
    rules.push({ o: last.o + Hb * last.s + (gap * last.s) / 2, w: gap * last.s });
  }
  return {
    kind: circle ? 'circle' : 'square',
    size: circle ? 2 * L : L,
    R: circle ? L : null,
    rotation,
    rings: ringsOut,
    centre,
    bands,
    rules,
    info,
  };
}

/** Every letter group in its four forms (iso, ini, med, fin from right to left), in two panels, as one grid. */
export function alphabet(H: number, opts: LetterOptions = {}): Grid {
  setVariants(opts);
  const order = [
    'ALEF', 'BEH', 'HAH', 'DAL', 'REH', 'SEEN', 'SAD', 'TAH', 'AIN', 'FEH',
    'QAF', 'KAF', 'LAM', 'MEEM', 'NOON', 'HEH', 'WAW', 'YEH', 'LAMALEF', 'HAMZA',
  ]; // prettier-ignore
  const rows = order.map(k => (['iso', 'ini', 'med', 'fin'] as Form[]).map(f => bitmap(def(k, f), H)));
  const cellW = Math.max(...rows.flat().map(b => b.w)),
    colW = cellW + 3,
    rowH = H + 4,
    cols = 4,
    per = Math.ceil(order.length / 2);
  const g = makeGrid((colW * cols + 3) * 2, rowH * per + 1);
  rows.forEach((forms, i) => {
    const panel = i < per ? 1 : 0,
      ri = i % per;
    forms.forEach((b, fi) => {
      const ox = panel * (colW * cols + 3) + (cols - 1 - fi) * colW + 1 + (cellW - b.w),
        oy = ri * rowH + 1 + H - 1 + b.base;
      for (let y = 0; y < b.h; y++)
        for (let x = 0; x < b.w; x++) if (b.data[y * b.w + x]) g.data[(oy - y) * g.w + ox + x] = 1;
    });
  });
  return g;
}
