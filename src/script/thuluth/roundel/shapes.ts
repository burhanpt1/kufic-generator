// Group shapes for stacking (lab tarkib.js): a phrase is cut into its connected letter groups, and each group is drawn
// at a few stretch lengths and stacked joins, then turned into a small typed raster (tall stems, horizontals, the
// rest) that the placement search tests for collisions.
import type { Built, Dot, Thuluth } from '../engine';
import { isLetter } from '../engine';
import { nibPolys, sampleStroke, dotPolys } from '../pen';
import { Alpha } from '../raster';
import type { MarkName } from '../shape';
import { FAM, forms } from '../shape';
import type { Poly, SkelPt } from '../types';

/** A letter group in a composition, with its vowel marks (k = letter index in the group). */
export interface RGroup {
  s: string;
  word: number;
  allah: boolean;
  /** The name of God, its small alif written in the text (the ligature draws it). */
  alif?: boolean;
  marks?: { k: number; m: MarkName }[];
  /** Scale (a smaller companion text, a conjunction). */
  sc?: number;
  /** Part of a companion text, and the start of a new word in it. */
  comp?: boolean;
  newWord?: boolean;
  /** Its own colour. */
  tint?: string;
}

export interface Shelf {
  x0: number;
  x1: number;
  y: number;
  /** Inside a great bowl. */
  cradle?: boolean;
}
/** One way of writing a group: its strokes and a typed raster (1 stem, 2 horizontal, 3 other). */
export interface GroupShape {
  b: Built;
  mask: Uint8Array;
  /** The mask grown by a margin, so groups keep apart. */
  dil: Uint8Array;
  W: number;
  H: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  ink: number;
  level: number;
  /** Centre of the ink. */
  cx: number;
  cy: number;
  hull: [number, number][];
  /** Elongations and long finals another word may sit on. */
  shelves: Shelf[];
  stemTops: [number, number][];
  cost: number;
  emph?: boolean;
  stacked?: boolean;
  /** Stacked joins in a tower (3). */
  tower?: number;
  elong?: number;
}

/** Options the stacking and the roundel share (lab o). */
export interface StackOptions {
  /** Raster resolution, pixels per pen unit. */
  K?: number;
  /** Margin (pixels) kept round each group. */
  margin?: number;
  levels?: number[];
  /** Stacked joins: how strongly to prefer them (the lab's 1.6 earns each stacked join that much; 0 = none). Unset,
   *  joins are stacked only where learned stacking, towers or stackAt ask for it: rewarded by default, stacking turned
   *  every hah and mim join into a staircase and dropped letters into the next line (31 October). */
  stackPull?: number;
  /** Stack the joins masters stack (STACK_PRIOR): any join whose next letter is stacked at least stackMin (0.2) of
   *  the time may be, pulled in proportion to that rate (against mim's); off, only joins before hah and mim. */
  learnedStack?: boolean;
  stackMin?: number;
  /** Learned stacking may also stack a final bowl (ى ي ن) under the letter before (off: the bowl stays level). */
  stackBowls?: boolean;
  /** Nesting: the final bowls of NEST_BOWLS letters become cradles for a short word. */
  nest?: boolean;
  /** Towers: three stacked joins in one group, pulled at towerPull (1) times the stacks' own pull. */
  towers?: boolean;
  towerPull?: number;
  /** Groups (by their letters) written only with a stacked join where they have one (the shin above the mim of
   *  شمير), so a word gains height about that letter. */
  stackAt?: string[];
  deep?: boolean;
  /** Final tails stretched (roundels). */
  tails?: boolean;
  /** Elongated joins as shelves for other words. */
  elongate?: boolean;
  /** The letter given an emphatic long final (a ba, say). */
  emph?: string;
  longFinal?: number;
  kashMap?: Record<number, number>;
  tail?: { sx: number; sy: number } | null;
}

/** Letters whose final bowl can hold a short word. */
export const NEST_BOWLS = new Set(['ر', 'ز', 'و', 'ن', 'ي', 'ى', 'ق', 'س', 'ش', 'ص', 'ض']);
/** Letters with a tall stem. */
const STEM_LETTERS = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ', 'ل', 'ك', 'ط', 'ظ', 'ﻻ']);

/** At most this many tower variants per group and stretch level (the first found, in join and offset order). */
const MAX_TOWERS = 12;

export const LEVELS = [0, 2, 4];
const STACK_OFFSETS = [{ dx: 0.9, dy: -3.4 }, { dx: 2.1, dy: -3.4 }, { dx: 1.2, dy: -4.6 }, { dx: 2.4, dy: -4.6 }]; // prettier-ignore
const DEEP_OFFSETS = [{ dx: 0.6, dy: -3.6 }, { dx: 1.6, dy: -4.8 }, { dx: 0.4, dy: -6.0 }, { dx: 1.8, dy: -6.2 }]; // prettier-ignore

/** How often masters stack a join, by the letter after it: 362 joins in 70 Calliar thuluth compositions
 *  (prototypes/thuluth-lab/refresh/data/stack-prior-next-letter.json; ya and nun counted in their final forms). */
export const STACK_PRIOR: Record<string, number> = {
  ra: 0.559, dal: 0.5, hah: 0.438, mim: 0.402, nun: 0.306, waw: 0.268, ya: 0.216, sin: 0.125, ain: 0.125, sad: 0.083,
  lam: 0.071, kaf: 0.062, fa: 0.031, ha: 0.026, alif: 0.024, tooth: 0.015,
}; // prettier-ignore
const stackFam = (f: { c: string; form: string }) =>
  f.form === 'fin' && (f.c === 'ي' || f.c === 'ى') ? 'ya' : FAM[f.c] === 'nun' && f.form === 'fin' ? 'nun' : FAM[f.c];
/** How far masters drop a stacked letter below the one before, by the pair (as a share of the alif's height; the median
 *  over the pair's joins, for pairs stacked at least twice in the 70 Calliar compositions:
 *  prototypes/thuluth-lab/refresh/data/stack-prior-pairs.json). */
export const STACK_DEPTH: Record<string, number> = {
  'lam|ra': 0.463, 'mim|hah': 0.688, 'kaf|ra': 0.364, 'kaf|ya': 0.551, 'ya|mim': 0.23, 'tooth|mim': 0.343,
  'ya|nun': 0.304, 'lam|mim': 0.322, 'fa|ra': 0.308, 'lam|ya': 0.246, 'sin|mim': 0.197, 'lam|waw': 0.52, 'hah|mim': 0.167,
}; // prettier-ignore
const pairFam = (f: { c: string; form: string }) => ('يى'.includes(f.c) ? 'ya' : stackFam(f));
/** The learned depth of stacking join i of s, in pen units (null where the pair was not seen stacked): at least the
 *  stacking threshold (0.22 of the alif), as the medians include joins written level. */
export function stackDepth(th: Thuluth, s: string, i: number): number | null {
  const fs = forms(s),
    d = STACK_DEPTH[pairFam(fs[i - 1]) + '|' + pairFam(fs[i])];
  if (d == null) return null;
  const alif = th.glyphFor('ا', 'iso'),
    H = alif ? Math.max(...alif.s.flatMap(st => st.pts.map(q => q[1]))) : 10 * th.style.body;
  return Math.max(0.25, d) * H;
}

/** The pull of stacking join i of s: 1 by the rule, or the learned rate against mim's (at most 1.4). */
export function stackWeight(s: string, i: number, o: StackOptions = {}): number {
  return o.learnedStack ? Math.min(1.4, (STACK_PRIOR[stackFam(forms(s)[i])] ?? 0) / 0.4) : 1;
}

/** Joins where the next letter may be written underneath the one before it: before hah and mim, or, learned, before
 *  any letter masters stack often enough, but not into a final bowl (ى ي ن) unless stackBowls: dropped below the letter
 *  before, the bowl hangs empty and apart (the owner set aside both salawats whose على was written so). */
export function stackable(s: string, o: StackOptions = {}): number[] {
  const fs = forms(s),
    out: number[] = [];
  for (let i = 1; i < fs.length; i++) {
    const f = fs[i],
      fam = FAM[f.c];
    if (!(f.form === 'med' || f.form === 'fin') || fs[i - 1].form === 'iso') continue;
    if (o.learnedStack && !o.stackBowls && f.form === 'fin' && 'ىين'.includes(f.c)) continue;
    if (o.learnedStack ? (STACK_PRIOR[stackFam(f)] ?? 0) >= (o.stackMin ?? 0.2) : fam === 'hah' || fam === 'mim')
      out.push(i);
  }
  return out;
}

type Stacks = Record<number, { dx: number; dy: number }> | null;

/** Draw a group at a stretch level (and stacked joins) and rasterise it; null when stacked letters collide. */
export function groupShape(
  th: Thuluth,
  g: RGroup,
  level: number,
  o: StackOptions,
  K: number,
  stacks: Stacks,
  sj?: number,
): GroupShape | null {
  const st = th.style,
    nib = st.nib,
    hasMarks = !!(g.marks && g.marks.length);
  const b = th.buildStrokes(g.s, {
    kashida: level,
    // the ligature draws its own shadda and small alif even in a vowelled text (its other marks were dropped)
    allah: g.allah && (!hasMarks || !!st.allah),
    allahAlif: g.alif,
    noAuto: hasMarks && !(g.allah && st.allah),
    gap: 0,
    wordGap: 0,
    stacks,
    kashMap: o.kashMap,
    longFinal: o.longFinal,
    tail: o.tail,
  });
  if (g.sc && g.sc !== 1) {
    const sc = g.sc;
    b.strokes.forEach(s => {
      s.s = s.s.map(q => ({ x: q.x * sc, y: q.y * sc, w: q.w }));
      s.nib = (s.nib || nib) * sc;
    });
    b.dots = b.dots.map(([x, y]) => [x * sc, y * sc, sc] as Dot);
    b.dotGroups.forEach(d => {
      d.x *= sc;
      d.y *= sc;
      d.x0 *= sc;
      d.x1 *= sc;
      d.top *= sc;
      d.bot *= sc;
      d.sc = sc;
    });
    b.placed.forEach(p => {
      if (isLetter(p)) {
        p.ox *= sc;
        p.oy = (p.oy || 0) * sc;
        p.sc = sc;
      }
    });
  }
  if (stacks) {
    // the letters lifted above must not collide with the ones written beneath
    const pts = (upper: boolean) =>
      b.placed
        .filter(p => isLetter(p) && (upper ? p.li >= sj! : p.li < sj!))
        .flatMap(p => (isLetter(p) ? p.g.s.flatMap(sd => sampleStroke(sd.pts.map(q => [q[0] + p.ox, q[1] + (p.oy || 0), 1, q[3]] as SkelPt), st.tension, 6)) : [])); // prettier-ignore
    const A = pts(false),
      B2 = pts(true),
      // every stacked join's ends (the lab exempted only the first, so a second or third stack always collided)
      ends = b.placed.flatMap(p => ('conn' in p ? [p.from, p.to] : []));
    const farFromJoin = (q: { x: number; y: number }) => ends.every(([ex, ey]) => Math.hypot(q.x - ex, q.y - ey) > 1.4);
    for (const a of A) {
      if (!farFromJoin(a)) continue;
      for (const c of B2) {
        if (!farFromJoin(c)) continue;
        if (Math.hypot(a.x - c.x, a.y - c.y) < nib * 1.15) return null;
      }
    }
  }
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  b.strokes.forEach(s => s.s.forEach(q => ((x0 = Math.min(x0, q.x)), (x1 = Math.max(x1, q.x)), (y0 = Math.min(y0, q.y)), (y1 = Math.max(y1, q.y))))); // prettier-ignore
  b.dots.forEach(
    ([x, y]) => ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y))),
  );
  x0 -= nib;
  x1 += nib;
  y0 -= nib;
  y1 += nib;
  const W = Math.ceil((x1 - x0) * K) + 2,
    H = Math.ceil((y1 - y0) * K) + 2;
  const X = (x: number) => (x - x0) * K + 1,
    Y = (y: number) => (y1 - y) * K + 1,
    px = (q: Poly): Poly => q.map(([x, y]) => [Math.round(X(x) * 10) / 10, Math.round(Y(y) * 10) / 10]);
  // three layers: tall stems, horizontals (within 22° of level), the rest; each quad its own fill. A stem is an upright
  // stretch of a tall letter (alif, lam, kaf, ta, za), known from the stroke's owners, whatever its pen angle (the
  // learned alif is written at the line's angle, not the stems' 38°), or any upright stroke at 38°
  const tall = new Set(
    b.placed
      .filter(isLetter)
      .filter(p => STEM_LETTERS.has(p.c))
      .map(p => p.li),
  );
  const layers = [new Alpha(W, H), new Alpha(W, H), new Alpha(W, H)];
  b.strokes.forEach(s => {
    const qs = nibPolys(s.s, s.nib || nib, s.ang, st.floor),
      per = qs.length > s.s.length - 1 ? 2 : 1;
    qs.forEach((q, qj) => {
      const qi = Math.floor(qj / per),
        p = s.s[qi],
        p2 = s.s[qi + 1],
        a = Math.abs(Math.atan2(p2.y - p.y, p2.x - p.x)),
        horiz = a < 0.38 || a > Math.PI - 0.38,
        upright = Math.abs(a - Math.PI / 2) < 0.45;
      layers[upright && (s.ang === 38 || tall.has(s.own?.[qi] ?? -1)) ? 0 : horiz ? 1 : 2].fill([px(q)]);
    });
  });
  b.dots.forEach(([x, y, s2]) => layers[2].fill(dotPolys(x, y, nib * (s2 || 1), st.ang, st.floor).map(px)));
  const mask = new Uint8Array(W * H),
    dil = new Uint8Array(W * H);
  let ink = 0;
  // type per pixel: other wins over stem, which wins over horizontal
  for (let i = 0; i < W * H; i++) {
    const s1 = layers[0].a[i] > 100,
      hz = layers[1].a[i] > 100,
      ot = layers[2].a[i] > 100,
      t = ot ? 3 : s1 ? 1 : hz ? 2 : 0;
    if (t) {
      mask[i] = t;
      ink++;
    }
  }
  const r = o.margin || 1; // keeps groups from touching (wider round an emphasised letter)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = mask[y * W + x];
      if (!t) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const X2 = x + dx,
            Y2 = y + dy;
          if (X2 >= 0 && Y2 >= 0 && X2 < W && Y2 < H) {
            const k2 = Y2 * W + X2;
            if (dil[k2] !== 3) dil[k2] = dil[k2] ? (t === 3 || dil[k2] === 3 ? 3 : Math.min(dil[k2], t)) : t;
          }
        }
    }
  let sx = 0,
    sy = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (mask[y * W + x]) {
        sx += x;
        sy += y;
      }
  const cx = x0 + (sx / Math.max(1, ink) - 1) / K,
    cy = y1 - (sy / Math.max(1, ink) - 1) / K;
  const hull: [number, number][] = [];
  b.strokes.forEach(s => s.s.forEach((q, i) => i % 4 === 0 && hull.push([q.x, q.y])));
  b.dots.forEach(([x, y]) => hull.push([x, y]));
  const stemTops = b.strokes
    .filter(s => s.ang === 38)
    .map(s => {
      let t = s.s[0];
      s.s.forEach(q => q.y > t.y && (t = q));
      return [t.x, t.y] as [number, number];
    });
  const shelves: Shelf[] = b.placed
    .filter((p): p is Extract<typeof p, { kash: true }> => 'kash' in p && p.len >= 5)
    .map(p => ({ x0: p.ox - p.len, x1: p.ox, y: p.oy || 0 }));
  const letters = b.placed.filter(isLetter),
    last = letters[letters.length - 1];
  if (last) {
    // a great final bowl is a cradle: another word can sit inside its curve. With nesting, so is any bowl that can hold
    // a short word (Derman's kâse of ra, nun and waw, the çanak of ya, and the nun-like bowls of qaf, sin and sad)
    const ps = last.g.s.flatMap(sd => sd.pts.map(q => [q[0] + last.ox, q[1] + (last.oy || 0)])),
      ys = ps.map(q => q[1]);
    if (
      Math.min(...ys) - (last.oy || 0) <
      (o.nest && NEST_BOWLS.has(last.c) && last.form !== 'med' && last.form !== 'ini' ? -1.8 : -3.2)
    ) {
      const xs = ps.map(q => q[0]);
      shelves.push({ x0: Math.min(...xs) + 1.2, x1: Math.max(...xs) - 1.2, y: Math.min(...ys) + 1.1, cradle: true });
    }
    if (o.longFinal) {
      const xs = last.g.s.flatMap(sd => sd.pts.map(q => q[0] + last.ox));
      shelves.push({ x0: Math.min(...xs) + 0.8, x1: Math.max(...xs) - 0.6, y: (last.oy || 0) + 0.3 });
    }
    if (o.tail && o.tail.sx >= 2) {
      // a wide final bowl is a shelf too
      const sx2 = o.tail.sx,
        xs = last.g.s.flatMap(sd => sd.pts.map(q => q[0] * (q[0] < -0.5 ? sx2 : 1) + last.ox));
      shelves.push({ x0: Math.min(...xs) + 0.8, x1: Math.max(...xs) - 0.6, y: (last.oy || 0) + 0.3 });
    }
  }
  return { b, mask, dil, W, H, x0, x1, y0, y1, ink, level, cx, cy, hull, shelves, stemTops, cost: 0 };
}

/** The ways of writing one group: stretch levels, stacked joins, tails, elongations, an emphatic long final. */
export function groupVariants(th: Thuluth, g: RGroup, o: StackOptions, K: number): GroupShape[] {
  const BODY = th.style.body,
    out: GroupShape[] = [];
  if (o.emph && !g.sc) {
    const cs = [...g.s],
      fs = forms(g.s),
      j = cs.length - 1;
    if (j >= 1 && cs[j] === o.emph && fs[j].form === 'fin') {
      [
        { dx: -1.2, dy: -1.6 },
        { dx: -2.2, dy: -2.2 },
        { dx: -1.6, dy: -2.9 },
      ].forEach(off =>
        [1.0, 1.25].forEach(lf => {
          const stk = { [j]: { dx: (off.dx * BODY) / 1.25, dy: (off.dy * BODY) / 1.25 } },
            v = groupShape(th, g, 0, { ...o, longFinal: lf, margin: 2 }, K, stk, j);
          if (v) {
            v.cost = -3.2;
            v.emph = true;
            v.stacked = true;
            out.push(v);
          }
        }),
      );
      [1.0, 1.25].forEach(lf => {
        const flat = groupShape(th, g, 0, { ...o, longFinal: lf, margin: 2 }, K, null);
        if (flat) {
          flat.cost = -1.6;
          flat.emph = true;
          out.push(flat);
        }
      });
    }
  }
  const n = [...g.s].length,
    levels = g.sc ? [0, 2] : n > 1 ? (o.levels ?? LEVELS) : [0],
    joins = g.sc ? [] : stackable(g.s, o);
  const tails = o.tails && n >= 1 && !g.sc ? [{ sx: 1.4, sy: 1.3 }, { sx: 1.8, sy: 1.6 }] : []; // prettier-ignore
  tails.forEach(tl => {
    const v = groupShape(th, g, 0, { ...o, tail: tl }, K, null);
    if (v) {
      v.cost = 0.4;
      out.push(v);
    }
  });
  if (o.elongate && !g.sc && n > 1) {
    const fs = forms(g.s);
    for (let j = 1; j < fs.length; j++) {
      if (fs[j].form !== 'med' && fs[j].form !== 'fin') continue;
      [6, 9, 13].forEach(L => {
        const v = groupShape(th, g, 0, { ...o, kashMap: { [j]: L } }, K, null);
        if (v) {
          v.cost = 0.08 * L;
          v.elong = L;
          out.push(v);
        }
      });
    }
  }
  levels.forEach(L => {
    const v = groupShape(th, g, L, o, K, null);
    if (v) {
      v.cost = 0.3 * L;
      out.push(v);
    }
    const pull = o.stackPull ?? (o.learnedStack || o.towers || o.stackAt?.length ? 1.6 : 0);
    if (pull === 0) return;
    const pairOffs = o.deep ? DEEP_OFFSETS : STACK_OFFSETS.slice(0, 2);
    if (joins.length >= 2)
      for (let a = 0; a < joins.length; a++)
        for (let c = a + 1; c < joins.length; c++)
          for (const oa of pairOffs)
            for (const oc of pairOffs) {
              if (!o.deep && (oa !== pairOffs[0] || oc !== pairOffs[1])) continue;
              const stk = {
                [joins[a]]: { dx: (oa.dx * BODY) / 1.25, dy: (oa.dy * BODY) / 1.25 },
                [joins[c]]: { dx: (oc.dx * BODY) / 1.25, dy: (oc.dy * BODY) / 1.25 },
              };
              const v3 = groupShape(th, g, L, o, K, stk, joins[c]);
              if (v3 && groupShapeOk(th, g, L, o, stk, joins[a])) {
                v3.cost = 0.3 * L - 0.9 * (stackWeight(g.s, joins[a], o) + stackWeight(g.s, joins[c], o)) * pull; // prettier-ignore
                v3.stacked = true;
                out.push(v3);
              }
            }
    joins.forEach(j => {
      const scaled = (o.deep ? STACK_OFFSETS.concat(DEEP_OFFSETS) : STACK_OFFSETS).map(off => ({ dx: (off.dx * BODY) / 1.25, dy: (off.dy * BODY) / 1.25, learned: false })), // prettier-ignore
        depth = o.learnedStack ? stackDepth(th, g.s, j) : null;
      // learned: the depth masters use for this pair, at the two usual reaches, a little preferred
      if (depth) [0.9, 2.1].forEach(dx => scaled.push({ dx: (dx * BODY) / 1.25, dy: -depth, learned: true }));
      scaled.forEach(off => {
        const v2 = groupShape(th, g, L, o, K, { [j]: { dx: off.dx, dy: off.dy } }, j);
        if (v2) {
          v2.cost = 0.3 * L - stackWeight(g.s, j, o) * pull - (off.learned ? 0.4 : 0);
          v2.stacked = true;
          out.push(v2);
        }
      });
    });
    // towers: three stacked joins in one group, on long connected runs (محمد, الحمد, العالمين)
    if (o.towers && joins.length >= 3) {
      let towers = 0;
      const J = joins.slice(0, 6),
        // every offset: in this letter set the last of three stacks only clears at a deep one
        TO = [...STACK_OFFSETS, ...DEEP_OFFSETS],
        off = (q: { dx: number; dy: number }) => ({ dx: (q.dx * BODY) / 1.25, dy: (q.dy * BODY) / 1.25 });
      for (let a = 0; a < J.length; a++)
        for (let c = a + 1; c < J.length; c++)
          for (let e = c + 1; e < J.length; e++)
            for (const oa of TO)
              for (const oc of TO)
                for (const oe of TO) {
                  if (towers >= MAX_TOWERS) continue;
                  const stk = { [J[a]]: off(oa), [J[c]]: off(oc), [J[e]]: off(oe) };
                  if (!groupShapeOk(th, g, L, o, stk, J[a]) || !groupShapeOk(th, g, L, o, stk, J[c])) continue;
                  const v4 = groupShape(th, g, L, o, K, stk, J[e]);
                  if (!v4) continue;
                  v4.cost = 0.3 * L - (o.towerPull ?? 1.0) * (stackWeight(g.s, J[a], o) + stackWeight(g.s, J[c], o) + stackWeight(g.s, J[e], o)) * pull; // prettier-ignore
                  v4.stacked = true;
                  v4.tower = 3;
                  towers++;
                  out.push(v4);
                }
    }
  });
  return out;
}

/** Do stacked letters keep apart (the collision test alone, at the coarsest raster)? */
function groupShapeOk(th: Thuluth, g: RGroup, level: number, o: StackOptions, stacks: Stacks, sj: number): boolean {
  // the lab's check-only call returned true when nothing collided (and never built the raster)
  return groupShapeCollides(th, g, level, o, stacks, sj) === false;
}
function groupShapeCollides(th: Thuluth, g: RGroup, level: number, o: StackOptions, stacks: Stacks, sj: number) {
  const nib = th.style.nib;
  const b = th.buildStrokes(g.s, { kashida: level, allah: g.allah && (!(g.marks && g.marks.length) || !!th.style.allah), allahAlif: g.alif, noAuto: !!(g.marks && g.marks.length) && !(g.allah && th.style.allah), gap: 0, wordGap: 0, stacks, kashMap: o.kashMap, longFinal: o.longFinal, tail: o.tail }); // prettier-ignore
  const pts = (upper: boolean) =>
    b.placed
      .filter(p => isLetter(p) && (upper ? p.li >= sj : p.li < sj))
      .flatMap(p => (isLetter(p) ? p.g.s.flatMap(sd => sampleStroke(sd.pts.map(q => [q[0] + p.ox, q[1] + (p.oy || 0), 1, q[3]] as SkelPt), th.style.tension, 6)) : [])); // prettier-ignore
  const A = pts(false),
    B2 = pts(true),
    ends = b.placed.flatMap(p => ('conn' in p ? [p.from, p.to] : []));
  const far = (q: { x: number; y: number }) => ends.every(([ex, ey]) => Math.hypot(q.x - ex, q.y - ey) > 1.4);
  for (const a of A) {
    if (!far(a)) continue;
    for (const c of B2) if (far(c) && Math.hypot(a.x - c.x, a.y - c.y) < nib * 1.15) return true;
  }
  return false;
}
