// Crown and cradle (owner's experiment, 15 November 2026). The cradle (tests/char-bowl-sheet.test.ts) draws the
// circle's lower edge with one great bowl; the colonnade (tests/char-stems-sheet.test.ts) draws its upper edge with
// stems redrawn taller. Here both at once: the bowl below, the risen stems above, the plain letters between, so that
// the writing itself draws the circle. Two arrangements:
//   crown   the cradle's lines, the stems of the top line (and of any lower line with a clear way up) risen to the
//           rim, and the cradle's weak points mended (the neck, the empty hollow, the lone top word)
//   ground  one ground line: the words that have stems stand on one line, the cradle word at its left end, their
//           stems risen to the rim; the words without stems are set above, in the bays between the stems, and the
//           words after the cradle word in its bowl
// The rules and every number are in the comments below, in the order they are applied.
// `CROWN=1 CROWN_OUT=<dir> npx vitest run tests/char-crown-cradle-sheet.test.ts --maxWorkers=2` writes the sheet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import type { Built } from '../src/script/thuluth/engine';
import { cleanOutline } from '../src/script/thuluth/outline';
import type { Poly, Sample } from '../src/script/thuluth/types';
import type { Cols, Cradle, Head, Pt, Stem } from './helpers/char-first';
import { CAP, CLEAR, FLOOR, LINE_SPACE, MARGIN, NIB, SPAN_MAX, STEP, TEXTS, TIP_LEN, bowlPen, colsOf, cradleCompose, cradleOf, findStems, hull, nearPairs, need, profile, raise, room, sheetOf, svgOf, sweep, takeOver, th } from './helpers/char-first'; // prettier-ignore

// ---- every number of the two arrangements (pen units unless it says nibs); the cradle's and the colonnade's own
// numbers are in the helper ----
const NECK = 2 * NIB, // the bowl has its full weight, and its pen has turned to the rim's, within this of its start
  CUT = 0, // the bowl is taken over where its letter last leaves the line of writing (the cradle: 5 samples later)
  GIVE = (20 * Math.PI) / 180, // a stem that would meet the rim lower than this above the level diameter stays down
  WANT = 1.7, // the stems of the top line stand, at the median, this many times their height (the colonnade's)
  MIN_RISE = 0.15, // a stem of a lower line rises by at least this share of its height, or not at all
  RAGGED = 0.7, // what a line that stops short of the circle's edge costs (the colonnade's)
  UNRISEN = 1, // what a text none of whose stems rise costs, against a larger circle (the colonnade's)
  LONE = 0.15, // what a top line of one word, less than half as wide as the widest line, costs
  LIFT = [0, 1, 2, 3.5, 5, 7, 9], // how far above its lowest place the bottom line may be lifted (the cradle's)
  MAX_LINES = 5,
  KEEP = 6, // cuts carried from the first reckoning to the drawing
  SCAN = 0.4, // the step an upper word is tried at, sideways
  SLIDES = [0, -2.4, 2.4, -4.8, 4.8, -7.2, 7.2, -9.6, 9.6], // how far the ground line may be slid from the middle
  OPEN = [0, 2.4], // how far a word space of the ground line may be opened
  VOID = 0.6, // what an empty band between the writing and the bowl costs: its share of the circle's height (the colonnade's)
  BREACH = 0.2, // what each ground word read out of order costs
  STEM_HALF = 0.75, // half the width a shaft takes on its way up (the colonnade's)
  TRIES = 5, // places an upper word is measured at before the setting is given up
  MAX_GROUND = 3, // the ground line holds no more words than this: the cradle letter is one that keeps it so
  LARGER = 1.1; // a ground-line arrangement may take a circle this much larger than the smallest that stands

/** CROWN_SAY=1: what the searches weighed, written beside the sheet (debug.txt). */
const SAY: string[] | null = process.env.CROWN_SAY ? [] : null;

// ---- a stretch of the text written as one line ----
interface Line {
  text: string;
  b: Built;
  nw: number;
  stems: Stem[];
  /** For a line that ends in the cradle word: where its bowl is taken over. */
  take?: { si: number; head: Head };
  strokeWord: number[];
  dotWord: number[];
  /** The extent of its ink as written (without the cradle's bowl). */
  x0: number;
  x1: number;
  /** For each word: the hull of its ink, the hull of it without the heads of its stems, and its ink on the grid. */
  whole: Pt[][];
  body: Pt[][];
  cols: Cols[];
  /** For each stem: the hull of what rises. */
  heads: Pt[][];
}
/** The ink of a line, word by word, with its stems drawn `extra` taller; `body`: without the heads of its stems. And
 *  the samples of the cradle stroke up to where the bowl is taken over. */
function inked(
  l: Omit<Line, 'x0' | 'x1' | 'whole' | 'body' | 'cols' | 'heads'>,
  extra: readonly number[],
  body = false,
) {
  const raised = raise(l.b, l.stems, extra),
    riders = new Set(l.stems.flatMap(m => m.riders)),
    words: Poly[][] = Array.from({ length: l.nw }, () => []);
  let pre: Sample[] = [];
  raised.forEach((st, si) => {
    let a = 0,
      z = st.s.length - 1;
    // (a lam's stem and its bowl are one stroke: the take-over point moves down the list as the shaft is lengthened)
    if (l.take && si === l.take.si) {
      z = l.take.head.pre.length - 1 + (st.s.length - l.b.strokes[si].s.length);
      pre = st.s.slice(0, z + 1);
    }
    if (body) {
      if (riders.has(si)) return;
      const m = l.stems.find(q => q.si === si);
      if (m) a = m.cut;
    }
    words[l.strokeWord[si]].push(...th.strokePolys(a === 0 && z === st.s.length - 1 ? st : { ...st, s: st.s.slice(a, z + 1), own: undefined })); // prettier-ignore
  });
  l.b.dots.slice(0, l.b.dots.length - (l.take?.head.dots ?? 0)).forEach(([x, y], k) => words[l.dotWord[k] ?? 0].push(...th.dotPolysAt(x, y))); // prettier-ignore
  return { words, pre };
}
const lineCache = new Map<string, Line>();
function lineOf(text: string, cradle = false): Line {
  const key = (cradle ? '*' : '') + text,
    had = lineCache.get(key);
  if (had) return had;
  const b = th.buildStrokes(text, {}),
    stems = findStems(b, text),
    nw = text.trim().split(/\s+/).length,
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
    },
    strokeWord = b.strokes.map(st => st.wi != null && st.wi >= 0 ? st.wi : wordAt(st.s.reduce((t, q) => t + q.x, 0) / st.s.length)), // prettier-ignore
    dotWord = b.dotGroups.flatMap(g => new Array<number>(g.n).fill(g.wi)),
    part = { text, b, nw, stems, take: cradle ? takeOver(b, CUT) : undefined, strokeWord, dotWord },
    none = stems.map(() => 0),
    ink = inked(part, none).words,
    xs = ink.flat(2).map(p => p[0]),
    l: Line = {
      ...part,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      whole: ink.map(q => hull(q.flat())),
      body: inked(part, none, true).words.map(q => hull(q.flat())),
      cols: ink.map(colsOf),
      heads: stems.map(m => hull([th.strokePolys({ ...b.strokes[m.si], s: b.strokes[m.si].s.slice(0, m.cut + 1) }), ...m.riders.map(r => th.strokePolys(b.strokes[r]))].flat(2))), // prettier-ignore
    };
  lineCache.set(key, l);
  return l;
}
/** A line where it stands: each word's shift sideways, its baseline, and how much taller each stem is drawn. */
interface Placed {
  l: Line;
  off: number[];
  dy: number;
  extra: number[];
}
const inkAt = (p: Placed): Poly[] =>
  inked(p.l, p.extra).words.flatMap((w, k) => w.map(q => q.map(([x, y]) => [x + p.off[k], y + p.dy] as Pt)));
/** Where the stems of a line stop: each at the circle, none taller than CAP times its height as written; the stems of
 *  the name of God together or not at all (each to the rim: off the circle's axis one factor for all three would hold
 *  the name down to its outermost stem). */
function stops(stems: readonly Stem[], room: readonly number[]): number[] {
  const e = stems.map((m, k) => Math.max(0, Math.min(room[k], (CAP - 1) * m.top)));
  return stems.map((m, k) =>
    m.name && stems.some((o, j) => o.name && o.wi === m.wi && e[j] < MIN_RISE * o.top) ? 0 : e[k],
  );
}
const median = (v: number[]) => v.slice().sort((p, q) => p - q)[Math.floor((v.length - 1) / 2)];
/** How much taller stem s of a placed line can be drawn before it meets the circle; nothing, if it would meet it
 *  within GIVE of the level diameter: there the rim is the bowl's. */
function free(p: Placed, s: number, Rt: number) {
  const m = p.l.stems[s],
    e = room(p.l.heads[s], p.off[m.wi], p.dy, m.lean, Rt);
  return e > 0 && p.dy + m.base + m.top + e < Rt * Math.sin(GIVE) ? 0 : e;
}

/** How far to the right the last word of a placed line reaches. */
const rightOf = (p: Placed) => Math.max(...p.l.whole[p.l.nw - 1].map(q => q[0])) + p.off[p.l.nw - 1];

// ---- the bowl, with its neck mended ----
interface Bowl {
  /** The whole stroke, from its letter's head, with the letter's dots; and the part that is checked as a piece of
   *  its own (from two nibs past where it leaves its letter). */
  ink: Poly[];
  loose: Poly[];
  phi0: number;
  phiEnd: number;
}
/** The great bowl of a placed line's last letter (the cradle's, from the helper). `hold`: how far to the right the
 *  line it holds reaches, when it is to end just past it; otherwise it ends as high on the right as it lands on the
 *  left. `neck`: 0 draws it as the cradle first did. */
function bowlOf(p: Placed, R: number, hold: number | null, neck = NECK): Bowl | null {
  const { head } = p.l.take!,
    dx = p.off[p.l.nw - 1],
    rho = R - MARGIN - FLOOR / 2 - 0.05,
    pre = inked(p.l, p.extra).pre,
    bowl = sweep(
      [-(head.C[0] + dx), head.C[1] + p.dy],
      [-head.u[0], head.u[1]],
      head.pre[head.pre.length - 1].w,
      rho,
      phi0 => hold != null ? Math.min(-Math.asin(Math.min(0.95, Math.max(0, hold + 2 * NIB) / rho)), phi0 - (TIP_LEN * 1.7) / rho) : -Math.min(SPAN_MAX, Math.max(phi0, 0.5)), // prettier-ignore
      neck || undefined,
    );
  if (!bowl) return null;
  const pen = bowlPen(head, bowl.s),
    s = [...pre.map(q => ({ ...q, x: q.x + dx, y: q.y + p.dy })), ...pen],
    // the letter's dots: in the bowl where it begins, along the floor
    rd = rho - FLOOR / 2 - 1.25 * NIB,
    dots = Array.from({ length: head.dots }, (_, i) => {
      const phi = bowl.phi0 - (2.2 * NIB + i * 1.2 * NIB) / rd;
      return th.dotPolysAt(-rd * Math.sin(phi), -rd * Math.cos(phi), 1, -phi);
    }).flat();
  return {
    ink: [...th.strokePolys({ ang: head.ang, s }), ...dots],
    loose: [...th.strokePolys({ ang: head.ang, s: pen.slice(Math.ceil((2 * NIB) / STEP)) }), ...dots],
    phi0: bowl.phi0,
    phiEnd: bowl.phiEnd,
  };
}

interface Laid {
  R: number;
  polys: Poly[];
  lines: string[];
  cradle: Cradle | null;
  /** The bowl's angle of rim (degrees), the stems of the text, and how many times its height each risen stem is. */
  arc: number;
  stems: number;
  factors: number[];
  cost: number;
  note: string;
}
const within = (pts: readonly Pt[], dx: number, dy: number, r: number) =>
  pts.every(([x, y]) => (x + dx) ** 2 + (y + dy) ** 2 <= r * r);
/** How low a line can sit with all its ink inside a circle of radius r (Infinity: it is too wide). */
function lowest(l: Line, off: readonly number[], r: number) {
  let h = -Infinity;
  l.whole.forEach((q, k) => {
    for (const [x, y] of q)
      h = Math.max(h, Math.abs(x + off[k]) < r ? -Math.sqrt(r * r - (x + off[k]) ** 2) - y : Infinity);
  });
  return h;
}
const centred = (l: Line) => new Array<number>(l.nw).fill(-(l.x0 + l.x1) / 2);
const profOf = (l: Line, off: readonly number[]) => profile(l.cols.map((c, k) => [c, off[k]] as const));
/** How far a line falls short of the circle where it sits (the colonnade's measure). */
function short(l: Line, dy: number, Rt: number) {
  const half = Math.sqrt(Math.max(0, Rt * Rt - Math.max(dy * dy, (dy + 5) * (dy + 5))));
  return half > 0 ? Math.max(0, 1 - (l.x1 - l.x0) / (2 * half)) ** 2 : 1;
}

// ---- 1 and 2. crown and cradle ----
// 1. The cradle letter is the cradle's (helper: cradleOf). Its word ends a line. The words after it are one line, in
//    its bowl. When no word follows it (2b), no full cradle is drawn: the cradle word's line is the bottom line, it
//    sits as low as its ink clears the floor, and the bowl ends two nibs past its own word, a returning tail.
// 2. Every cut of the words before it into lines is reckoned. The lines stand one under another at one even pitch,
//    the least at which their inks keep LINE_SPACE (the colonnade's baselines-first), each centred; the bottom line
//    as low as its ink clears the bowl's floor.
// 3. The circle is the smallest in which the writing fits with the top line's stems left out down to their splits,
//    and those stems, risen to the rim (none taller than CAP times its height; the stems of the name of God together
//    or not at all), stand at the median WANT times their height.
// 4. The cheapest cut is taken: the radius, raised by lines that stop short of the circle (RAGGED), by the share of
//    the text's stems that do not rise (UNRISEN), and by a lone short word as the top line (LONE: 2c).
// 5. Drawn: the bowl with its neck mended (2a: taken over at CUT, full within NECK); then each stem of a lower line
//    rises to the rim if it reaches it within CAP and by at least MIN_RISE, and no two inks then come within CLEAR
//    (measured by raster); the name's stems together or not at all. No stem rises to meet the rim within GIVE of the
//    level diameter: there the rim is the bowl's.
function crown(text: string, o: { neck?: number; cut?: string[] } = {}): Laid | null {
  const words = text.split(' '),
    n = words.length,
    cr = cradleOf(text);
  if (!cr) return null;
  const ci = cr.wi,
    after = ci < n - 1 ? words.slice(ci + 1).join(' ') : null,
    cuts: string[][] = [];
  const walk = (start: number, cut: string[]) => {
    if (start > ci) return void cuts.push(after ? [...cut, after] : cut.slice());
    if (cut.length === MAX_LINES - (after ? 1 : 0)) return;
    for (let end = start + 1; end <= ci + 1; end++) walk(end, [...cut, words.slice(start, end).join(' ')]);
  };
  walk(0, []);
  if (o.cut) cuts.splice(0, cuts.length, o.cut);
  /** One cut in a circle of radius R: null if it does not stand. `drawn`: with the bowl and the lower stems, and
   *  measured. */
  const at = (cut: string[], R: number, lift: number, drawn: boolean): Laid | null => {
    const m = cut.length - 1,
      kc = after ? m - 1 : m,
      ls = cut.map((t, i) => lineOf(t, i === kc)),
      offs = ls.map(centred),
      profs = ls.map((l, i) => profOf(l, offs[i])),
      pitch = Math.max(0, ...ls.slice(1).map((_, i) => need(profs[i], profs[i + 1]))),
      Rt = R - MARGIN,
      hb = lowest(ls[m], offs[m], Rt - FLOOR - CLEAR) + lift;
    if (hb === Infinity) return null;
    const ps: Placed[] = ls.map((l, i) => ({ l, off: offs[i], dy: hb + (m - i) * pitch, extra: l.stems.map(() => 0) })),
      top = ps[0],
      crowned = top.l.stems.length > 0;
    for (const [i, p] of ps.entries())
      if (!(i === 0 && crowned ? p.l.body : p.l.whole).every((q, k) => within(q, p.off[k], p.dy, Rt))) return null;
    if (crowned) {
      const f = top.l.stems.map((_, s) => free(top, s, Rt));
      if (f.some(e => e < 0)) return null;
      top.extra = stops(top.l.stems, f);
      if (median(top.l.stems.map((q, s) => 1 + top.extra[s] / q.top)) < WANT) return null;
    }
    let bowl: Bowl | null = null;
    if (drawn) {
      bowl = bowlOf(ps[kc], R, after ? null : rightOf(ps[m]), o.neck);
      if (!bowl) return null;
      const inks = () => [...ps.map(inkAt), bowl!.loose];
      if (nearPairs(inks(), R, CLEAR).length) return null;
      // the stems of the lower lines, the name of God first and as one
      for (let i = 1; i <= m; i++) {
        const p = ps[i],
          groups = new Map<string, number[]>();
        p.l.stems.forEach((q, s) => groups.set(q.name ? `w${q.wi}` : `s${s}`, [...(groups.get(q.name ? `w${q.wi}` : `s${s}`) ?? []), s])); // prettier-ignore
        for (const ss of [...groups.values()].sort((a, b) => b.length - a.length)) {
          const fr = ss.map(s => free(p, s, Rt));
          if (fr.some((e, k) => e < MIN_RISE * p.l.stems[ss[k]].top || e > (CAP - 1) * p.l.stems[ss[k]].top)) continue;
          const was = p.extra.slice();
          ss.forEach((s, k) => (p.extra[s] = fr[k]));
          // (the bowl is drawn again: a lam's stem and its bowl are one stroke)
          const again: Bowl | null = i === kc ? bowlOf(p, R, after ? null : rightOf(ps[m]), o.neck) : bowl;
          if (!again || nearPairs([...ps.map(inkAt), again.loose], R, CLEAR).length) p.extra = was;
          else bowl = again;
        }
      }
    }
    const total = ps.reduce((t, p) => t + p.l.stems.length, 0),
      factors = ps.flatMap(p => p.l.stems.map((q, s) => 1 + p.extra[s] / q.top)).filter(f => f > 1.001),
      widest = Math.max(...ls.map(l => l.x1 - l.x0)),
      lone = m > 0 && ls[0].nw === 1 && ls[0].x1 - ls[0].x0 < widest / 2,
      cost = R * (1 + (RAGGED * ps.reduce((t, p) => t + short(p.l, p.dy, Rt), 0)) / ps.length) * (1 + UNRISEN * (total ? 1 - factors.length / total : 0)) * (1 + (lone ? LONE : 0)); // prettier-ignore
    return {
      R,
      polys: drawn ? [...ps.map(inkAt).flatMap(k => cleanOutline(k)), ...cleanOutline(bowl!.ink)] : [],
      lines: cut,
      cradle: cr,
      arc: bowl ? ((bowl.phi0 - bowl.phiEnd) * 180) / Math.PI : 0,
      stems: total,
      factors,
      cost,
      note: after ? 'the bowl holds the line after its word' : "the bowl holds its own word's line",
    };
  };
  const smallest = (cut: string[], drawn: boolean): Laid | null => {
    for (let R = 10; R < 150; R *= 1.02)
      for (const lift of drawn ? LIFT : [0]) {
        const l = at(cut, R, lift, drawn);
        if (l) return l;
      }
    return null;
  };
  const first = cuts.map(cut => ({ cut, l: smallest(cut, false) })).filter(c => c.l).sort((p, q) => p.l!.cost - q.l!.cost); // prettier-ignore
  if (SAY)
    SAY.push(
      first
        .slice(0, 12)
        .map(c => `${c.l!.cost.toFixed(1)} R${c.l!.R.toFixed(1)} ${c.cut.join(' / ')}`)
        .join('\n'),
    );
  let best: Laid | null = null;
  for (const { cut } of first.slice(0, KEEP)) {
    const l = smallest(cut, true);
    if (l && (!best || l.cost < best.cost)) best = l;
  }
  return best;
}

// ---- 3. one ground line ----
// 1. Of the words up to the cradle word, those that have a tall stem, and the cradle word itself, are the ground
//    line, written as one line in their order; the others are upper words. The cradle letter is the cradle's best
//    whose ground line holds no more than MAX_GROUND words (a longer line needs a circle so large that its stems
//    cannot reach the rim).
// 2. The words after the cradle word are in its bowl, on one line or on two, the lowest on the floor; the ground
//    line stands just over them (or on the floor, if there are none), and all its stems rise to the rim (CAP, GIVE,
//    the name's together or not at all).
// 3. Each upper word, in the order of the text, is tried at every place sideways (SCAN), resting on what is under it
//    at LINE_SPACE; never over a stem, so in a bay or beside the line. Its place is the one where the fewest ground
//    words are read out of order (the reading rule: the bowl's words last; before them the ground line from right
//    to left, and an upper word just before the ground word it stands over), then the lowest; measured by raster,
//    and lifted a little or moved on if it comes too near.
// 4. The ground line may be slid (SLIDES) and its word spaces opened (OPEN) to make a bay; the circle is the smallest
//    in which all this stands, or one up to LARGER times that if it costs less: the radius, raised by the share of
//    stems that do not reach the rim (UNRISEN), by each ground word read out of order (BREACH) and by an empty band
//    between the writing and the bowl (VOID).
function ground(text: string): Laid | null {
  const words = text.split(' '),
    n = words.length,
    stemmed = words.map(w => lineOf(w).stems.length > 0),
    cr = cradleOf(text, wi => stemmed.slice(0, wi).filter(v => v).length + 1 > MAX_GROUND);
  if (!cr) return null;
  const ci = cr.wi,
    onGround = words.map((_, k) => k === ci || (k < ci && stemmed[k])),
    gi = words.map((_, k) => k).filter(k => onGround[k]),
    ui = words.map((_, k) => k).filter(k => k < ci && !onGround[k]),
    g = lineOf(gi.map(k => words[k]).join(' '), true),
    uppers = ui.map(k => lineOf(words[k])),
    // the words after the cradle word, in its bowl: on one line, or on two
    afters: Line[][] = [];
  if (ci === n - 1) afters.push([]);
  for (let k = ci + 2; k <= n; k++) afters.push([[ci + 1, k], [k, n]].filter(([a, b]) => b > a).map(([a, b]) => lineOf(words.slice(a, b).join(' ')))); // prettier-ignore
  afters.reverse();
  /** One setting in a circle of radius R. */
  const at = (R: number, slide: number, gaps: number[], lift: number, aft: Line[]): Laid | null => {
    const Rt = R - MARGIN,
      tot = gaps.reduce((t, v) => t + v, 0);
    let G = 0;
    const off = gaps.map(v => -(g.x0 - tot + g.x1) / 2 + slide - (G += v)),
      pas: Placed[] = aft.map(l => ({ l, off: centred(l), dy: 0, extra: l.stems.map(() => 0) })),
      m = pas.length - 1;
    let hg: number;
    if (pas.length) {
      pas[m].dy = lowest(pas[m].l, pas[m].off, Rt - FLOOR - CLEAR) + lift;
      for (let i = m - 1; i >= 0; i--) pas[i].dy = pas[i + 1].dy + need(profOf(pas[i].l, pas[i].off), profOf(pas[i + 1].l, pas[i + 1].off)); // prettier-ignore
      hg = pas[0].dy + need(profOf(g, off), profOf(pas[0].l, pas[0].off));
    } else hg = lowest(g, off, Rt - FLOOR - CLEAR) + lift;
    if (!(hg < Infinity)) return null;
    const pg: Placed = { l: g, off, dy: hg, extra: g.stems.map(() => 0) };
    if (!g.body.every((q, k) => within(q, off[k], hg, Rt))) return null;
    if (!pas.every(p => p.l.whole.every(q => within(q, p.off[0], p.dy, Rt)))) return null;
    const f = g.stems.map((_, s) => free(pg, s, Rt));
    if (f.some(e => e < 0)) return null;
    pg.extra = stops(g.stems, f);
    const reached = g.stems.filter((_, s) => pg.extra[s] > 0 && pg.extra[s] >= f[s] - 0.01).length,
      bowl = bowlOf(pg, R, pas.length ? null : rightOf(pg));
    if (!bowl) return null;
    // the upper words, each resting on the ground line as risen and on the upper words before it
    const ink = inked(g, pg.extra).words.flatMap((w, k) => w.map(q => q.map(([x, y]) => [x + off[k], y] as Pt))),
      under: [Cols, number][] = [[colsOf(ink), 0]],
      ups: Placed[] = [],
      // where each ground word stands
      mid = g.whole.map((q, k) => (Math.min(...q.map(p => p[0])) + Math.max(...q.map(p => p[0]))) / 2 + off[k]);
    let breaches = 0;
    const fixed = [inkAt(pg), ...pas.map(inkAt)];
    for (const [j, u] of uppers.entries()) {
      const below = profile(under),
        wide = (u.x1 - u.x0) / 2,
        // the ground words before it in the text
        before = gi.filter(k => k < ui[j]).length,
        places: { x: number; y: number; br: number }[] = [];
      for (let x = -Rt + wide; x <= Rt - wide; x += SCAN) {
        const dx = x - (u.x0 + u.x1) / 2,
          y = hg + need(profOf(u, [dx]), below);
        if (!within(u.whole[0], dx, y, Rt)) continue;
        // no upper word stands over a stem
        if (g.stems.some(q => Math.abs(q.x + off[q.wi] - x) < wide + STEM_HALF)) continue;
        // the ground word it stands over: the nearest
        let over = 0;
        mid.forEach((v, k) => {
          if (Math.abs(v - x) < Math.abs(mid[over] - x)) over = k;
        });
        places.push({ x: dx, y, br: over < before ? before - over : over - before });
      }
      places.sort((p, q) => p.br - q.br || p.y - q.y);
      // measured: the first place that keeps LINE_SPACE from the writing and CLEAR from the bowl, lifted a little
      // if it must be
      let put: Placed | null = null,
        br = 0,
        failed = Infinity,
        tries = 0;
      for (const c of places) {
        if (Math.abs(c.x - failed) < NIB) continue;
        if (++tries > TRIES) break;
        for (let up = 0; up <= 2 * NIB && !put; up += 0.5) {
          const q: Placed = { l: u, off: [c.x], dy: c.y + up, extra: [] },
            ink = inkAt(q),
            k = fixed.length + ups.length;
          if (!within(u.whole[0], c.x, c.y + up, Rt)) break;
          if (nearPairs([...fixed, ...ups.map(inkAt), ink], R, LINE_SPACE).some(pr => pr.includes(k))) continue;
          if (nearPairs([bowl.loose, ink], R, CLEAR).length) continue;
          put = q;
          br = c.br;
        }
        if (put) break;
        failed = c.x;
      }
      if (!put) return null;
      breaches += br;
      ups.push(put);
      // (in the ground line's own frame)
      under.push([colsOf(inkAt(put).map(q => q.map(([x, y]) => [x, y - hg] as Pt))), 0]);
    }
    const pieces = [...fixed, ...ups.map(inkAt), bowl.loose];
    if (nearPairs(pieces, R, CLEAR).length) return null;
    const factors = g.stems.map((q, s) => 1 + pg.extra[s] / q.top).filter(v => v > 1.001),
      total = g.stems.length + aft.reduce((t, l) => t + l.stems.length, 0),
      // the empty band between the lowest ink and the bowl's floor, as a share of the circle's height
      hollow = (Math.min(...fixed.flat(2).map(q => q[1])) + Rt - FLOOR) / (2 * Rt),
      moved = (tot + Math.abs(slide)) / NIB,
      cost =
        R *
        (1 + UNRISEN * (total ? 1 - reached / total : 0)) *
        (1 + BREACH * breaches) *
        (1 + VOID * hollow) *
        (1 + 0.004 * moved);
    return {
      R,
      polys: [...pieces.slice(0, -1).flatMap(k => cleanOutline(k)), ...cleanOutline(bowl.ink)],
      lines: [...ui.map(k => `(${words[k]})`), g.text, ...aft.map(l => l.text)],
      cradle: cr,
      arc: ((bowl.phi0 - bowl.phiEnd) * 180) / Math.PI,
      stems: total,
      factors,
      cost,
      note: `${reached} of ${g.stems.length} ground stems reach the rim; ${breaches} ground word${breaches === 1 ? '' : 's'} read out of order; spaces opened ${(tot / NIB).toFixed(1)} nibs, line slid ${(slide / NIB).toFixed(1)} nibs`,
    };
  };
  // every opening of the word spaces
  const opens: number[][] = [[0]];
  for (let k = 1; k < g.nw; k++) opens.splice(0, opens.length, ...opens.flatMap(q => OPEN.map(v => [...q, v])));
  let best: Laid | null = null;
  for (let R = 10; R < 150 && !(best && R > best.R * LARGER); R *= 1.02)
    for (const slide of SLIDES)
      for (const gaps of opens)
        for (const aft of afters)
          for (const lift of [0, 2, 5]) {
            const l = at(R, slide, gaps, lift, aft);
            if (!l) continue;
            if (SAY)
              SAY.push(
                `${l.cost.toFixed(1)} R${R.toFixed(1)} slide ${slide} gaps ${gaps.join(',')} lift ${lift}: ${l.note}`,
              );
            if (!best || l.cost < best.cost) best = l;
            break;
          }
  return best;
}

describe('crown and cradle', () => {
  it('lengthens the stem of a lam whose bowl is taken over, and keeps the take-over point', () => {
    const l = lineOf('وآل', true),
      lam = l.stems.findIndex(m => m.si === l.take!.si);
    expect(lam).toBeGreaterThanOrEqual(0);
    const extra = l.stems.map((_, s) => (s === lam ? 8 : 0)),
      was = inked(
        l,
        l.stems.map(() => 0),
      ).pre,
      now = inked(l, extra).pre;
    expect(now.length).toBeGreaterThan(was.length);
    expect(now[now.length - 1]).toEqual(was[was.length - 1]);
    expect(now[0].y).toBeCloseTo(was[0].y + 8, 9);
  });
  it('tells the ground words from the upper words', () => {
    const split = (t: string) => {
      const ci = cradleOf(t)!.wi;
      return t.split(' ').slice(0, ci).filter(w => !lineOf(w).stems.length).join(' '); // prettier-ignore
    };
    expect(TEXTS.slice(0, 3).map(([, t]) => split(t))).toEqual(['محمد', 'بسم', 'محمد']);
  });
  it.runIf(!!process.env.CROWN)(
    'writes the sheet',
    () => {
      const out = process.env.CROWN_OUT ?? join(import.meta.dirname, '../docs/crown');
      mkdirSync(out, { recursive: true });
      const report: string[] = [],
        only = process.env.CROWN_ONLY?.split(','),
        rowsWanted = process.env.CROWN_ROWS?.split(',') ?? ['level', 'cradle', 'crown', 'ground'],
        texts = TEXTS.filter(([id]) => !only || only.includes(id)),
        f2 = (v: number) => v.toFixed(2),
        say = (
          tag: string,
          id: string,
          l: ({ R: number; lines: string[]; cradle: Cradle | null } & Partial<Laid>) | null,
        ) => {
          // prettier-ignore
          if (!l) return void report.push(`${tag} ${id}: no arrangement`);
          const f = (l.factors ?? []).slice().sort((p, q) => p - q);
          report.push(
            `${tag} ${id}: radius ${l.R.toFixed(1)} (${(l.R / NIB).toFixed(1)} nibs); lines: ${l.lines.join(' / ')}` +
              (l.cradle ? `; cradle: the final ${l.cradle.c} of ${text(id).split(' ')[l.cradle.wi]}` : '') +
              (l.arc ? `, ${l.arc.toFixed(0)} degrees of rim` : '') +
              (l.stems != null
                ? `; stems ${l.stems}, risen ${f.length}${f.length ? ` by x${f2(f[0])} to x${f2(f[f.length - 1])} (median x${f2(median(f))}): ${f.map(f2).join(' ')}` : ''}`
                : '') +
              (l.note ? `; ${l.note}` : '') +
              (l.cost ? `; cost ${l.cost.toFixed(1)}` : ''),
          );
        },
        text = (id: string) => TEXTS.find(q => q[0] === id)![1],
        make: Record<
          string,
          (t: string) => ({ R: number; polys: Poly[]; lines: string[]; cradle: Cradle | null } & Partial<Laid>) | null
        > = {
          // prettier-ignore
          level: t => cradleCompose(t, { cradle: false }),
          cradle: t => cradleCompose(t),
          crown: t =>
            crown(t, {
              cut: process.env.CROWN_CUT?.split('/'),
              neck: process.env.CROWN_NECK ? +process.env.CROWN_NECK : undefined,
            }),
          ground: t => (t.split(' ').length <= 6 ? ground(t) : null),
        },
        rows = rowsWanted.map(tag =>
          texts.map(([id, t]) => {
            const l = make[tag](t);
            say(tag, id, l);
            if (l) writeFileSync(join(out, `${tag}-${id}.png`), toPNG(svgOf(l), 900));
            return l;
          }),
        );
      writeFileSync(join(out, 'crown-sheet.png'), toPNG(sheetOf(rows), texts.length * 480));
      writeFileSync(join(out, 'numbers.txt'), report.join('\n') + '\n');
      if (SAY) writeFileSync(join(out, 'debug.txt'), SAY.join('\n') + '\n');
      expect(report.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
