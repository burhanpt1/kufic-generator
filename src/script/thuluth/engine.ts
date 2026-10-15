// The thuluth line engine (lab engine3.js setLine / buildStrokes / drawSVG), with the lab's globals as an explicit
// style: `thuluth(style)` returns an engine bound to that style, with its own glyph cache and no other state.
import { GREAT, HEH_FIN, LETTERS, TOOTH_FIN_LONG } from './letters.data';
import { LETTER_FIXES } from './fixes';
import { dotPolys, nibPolys, polyPath, sampleStroke } from './pen';
import { DOTS, FAM, FORM_FAM, familyOf, forms } from './shape';
import type { Family, Form, GlyphDef, Poly, SkelPt, Stroke, StrokeDef, ThuluthStyle } from './types';

export const DEFAULT_THULUTH: ThuluthStyle = {
  body: 1.25,
  nib: 1.3,
  ang: 70,
  floor: 0,
  loopGap: 0.9,
  tension: 0.5,
  heh: 'round',
  slant: 'left',
};
/** The lab's two calibrated pens: the painted roundel (heavy, 6:1 contrast) and the glazed tile band (2.5:1). */
export const ROUNDEL_PEN: ThuluthStyle = {
  ...DEFAULT_THULUTH,
  body: 1.45,
  nib: 1.6,
  ang: 69,
  floor: 0.3,
  loopGap: 1.8,
};
export const TILE_PEN: ThuluthStyle = { ...DEFAULT_THULUTH, body: 1.25, nib: 0.95, ang: 69, floor: 0.43, loopGap: 0.9 };

/** A letter as placed on the line. */
export interface PlacedLetter {
  g: GlyphDef;
  ox: number;
  oy: number;
  c: string;
  form: Form;
  /** Letter index in its word, and the word's index. */
  li: number;
  wi: number;
  /** Scale of the group this letter belongs to (roundels shrink a conjunction, say). */
  sc?: number;
}
export type Placed =
  | PlacedLetter
  | { kash: true; ox: number; oy: number; len: number }
  | { conn: true; from: [number, number]; to: [number, number] };
export const isLetter = (p: Placed): p is PlacedLetter => 'g' in p;

export interface DotGroup {
  x: number;
  y: number;
  n: number;
  side: number;
  li: number;
  wi: number;
  x0: number;
  x1: number;
  top: number;
  bot: number;
  sc?: number;
}
export interface LineOptions {
  kashida?: number;
  /** Space between unjoined pieces of a word, and between words (pen units). */
  gap?: number;
  wordGap?: number;
  /** Kashida per join: letter index → length. */
  kashMap?: Record<number, number>;
  /** Stacked joins: letter index → offset of the next letter (written under the one before). */
  stacks?: Record<number, { dx: number; dy: number }> | null;
  /** Draw a final tooth letter as the long sweep, this many times longer. */
  longFinal?: number;
  /** Stretch a final letter's tail. */
  tail?: { sx: number; sy: number } | null;
  /** How far a kashida sags below the baseline. */
  sag?: number;
  /** Treat as the name of God (shadda and dagger alif); noAuto turns the automatic detection off. */
  allah?: boolean;
  noAuto?: boolean;
}
/** A dot: position, then (in compositions) its scale, the nib's rotation and a tint. */
export type Dot = [x: number, y: number, sc?: number, rot?: number, tint?: string];
export interface Built {
  strokes: Stroke[];
  dots: Dot[];
  placed: Placed[];
  dotGroups: DotGroup[];
}

const LOOPY: Family[] = ['fa', 'qaf', 'sad', 'mim', 'ain', 'ha', 'ta'];
const TAILED: Family[] = ['nun', 'ra', 'ya', 'waw', 'mim', 'sad', 'qaf', 'ain', 'lam', 'fa', 'tooth'];
const scaleGlyph = (g: GlyphDef, k: number): GlyphDef => ({
  dotX: g.dotX == null ? null : g.dotX * k,
  exit: g.exit == null ? null : g.exit * k,
  s: g.s.map(st => ({ ...st, pts: st.pts.map(([x, y, w, c]) => [x * k, y * k, w, c] as SkelPt) })),
});
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export type Thuluth = ReturnType<typeof thuluth>;

export function thuluth(style: ThuluthStyle = DEFAULT_THULUTH) {
  const st = style,
    cache = new Map<string, GlyphDef | null>();
  const leanK = typeof st.slant === 'number' ? st.slant : st.slant === 'left' ? -0.06 : st.slant === 'right' ? 0.14 : 0;
  const lean = (pts: readonly SkelPt[]) => pts.map(([x, y, w, c]) => [x + leanK * y, y, w, c] as SkelPt);

  /** The letter table with this style's choices: the heh design and the great roundel gestures. */
  const table = (() => {
    const t = { ...LETTERS } as Record<Family, Partial<Record<Form, GlyphDef>>>;
    if (!st.labLetters)
      for (const [fam, fs] of Object.entries(LETTER_FIXES) as [Family, Partial<Record<Form, GlyphDef>>][])
        t[fam] = { ...t[fam], ...fs };
    t.ha = { ...t.ha, fin: HEH_FIN[st.heh] || HEH_FIN.round };
    const gr = st.great;
    if (gr?.nun) t.nun = { ...t.nun, fin: clone(GREAT.nunFin) };
    if (gr?.hah) t.hah = { ...t.hah, ini: clone(GREAT.hahIni) };
    if (gr?.ya) {
      // the great bowl as a returning ya, wide and low as the master's sits in its disc; its marks where it begins
      const g = clone(GREAT.nunFin) as { s: { pts: number[][] }[]; exit: number | null; dotX?: number | null },
        sx = gr.yaWide || 1.7,
        sy = gr.yaDeep || 0.6;
      g.s.forEach(s => s.pts.forEach(p => ((p[0] *= sx), (p[1] *= sy))));
      g.dotX = -0.9;
      t.ya = { ...t.ya, fin: g as unknown as GlyphDef };
    }
    return t;
  })();

  function glyphRaw(c: string, form: Form): GlyphDef | null {
    const fam = FORM_FAM[c + '|' + form] || FAM[c],
      f = fam && table[fam];
    if (!f) return null;
    const alt = form === 'fin' ? 'iso' : form === 'med' ? 'ini' : form === 'ini' ? 'med' : 'fin';
    return f[form] || f[alt] || f.iso || f.ini || f.fin || f.med || null;
  }
  /** A letter form, scaled by the body (the stems keep their height). */
  function glyphFor(c: string, form: Form): GlyphDef | null {
    const k = c + form;
    if (!cache.has(k)) {
      const g = glyphRaw(c, form);
      cache.set(k, g && !['alif', 'lam', 'lamalif'].includes(FAM[c]) ? scaleGlyph(g, st.body) : g);
    }
    return cache.get(k)!;
  }

  /** Set a line: letters joined, words right to left (x decreasing), kashida where asked. */
  function setLine(text: string, o: LineOptions = {}): Placed[] {
    const nib = st.nib,
      kashida = o.kashida ?? 0,
      gap = o.gap ?? 0.9,
      wordGap = o.wordGap ?? 1.6;
    const words = text.trim().split(/\s+/),
      placed: Placed[] = [];
    let x = 0,
      y = 0;
    words.forEach((w, wi) => {
      if (wi) x -= wordGap;
      const fs = forms(w);
      let joined = false;
      y = 0;
      fs.forEach((f, i) => {
        let g = glyphFor(f.c, f.form);
        if (!g) {
          x -= 2;
          joined = false;
          return;
        }
        if (o.longFinal && i === fs.length - 1 && FAM[f.c] === 'tooth' && f.form === 'fin') {
          const gl = scaleGlyph(TOOTH_FIN_LONG, st.body),
            lf = o.longFinal;
          g = { ...gl, dotX: gl.dotX! * lf, s: gl.s.map(s => ({ ...s, pts: s.pts.map(([x2, y2, w2, c]) => [x2 * lf, y2, w2, c] as SkelPt) })) }; // prettier-ignore
        }
        const connects = f.form === 'med' || f.form === 'fin';
        let ox: number;
        if (connects && joined) ox = x;
        else {
          // a new group starts after a gap: its right edge at the cursor
          y = 0;
          const xs = g.s.flatMap(s => s.pts.map(p => p[0]));
          ox = x - (Math.max(...xs) + nib * 0.5);
        }
        placed.push({ g, ox, oy: y, c: f.c, form: f.form, li: i, wi });
        if (g.exit != null) {
          x = ox + g.exit;
          joined = true;
          const stk = o.stacks && o.stacks[i + 1];
          if (stk && i < fs.length - 1) {
            // a stacked join: the next letter is written below and to the right, and the pen comes down to it
            placed.push({ conn: true, from: [x, y], to: [x + stk.dx, y + stk.dy] });
            x += stk.dx;
            y += stk.dy;
          } else if (i < fs.length - 1) {
            let kl = o.kashMap && o.kashMap[i + 1] != null ? o.kashMap[i + 1] : kashida;
            // two joined loop letters need a stretch of baseline between them, or their loops run together
            if (LOOPY.includes(FAM[f.c]) && LOOPY.includes(FAM[fs[i + 1].c])) kl = Math.max(kl, st.loopGap * st.body);
            if (kl > 0) {
              placed.push({ kash: true, ox: x, oy: y, len: kl });
              x -= kl;
            }
          }
        } else {
          const xs = g.s.flatMap(s => s.pts.map(p => p[0]));
          x = ox + Math.min(...xs) - nib * 0.5 - gap;
          joined = false;
        }
      });
    });
    return placed;
  }

  /** Pen strokes for a line: joins run as one continuous stroke (the pen never lifts within a group). */
  function buildStrokes(text: string, o: LineOptions = {}): Built {
    const nib = st.nib,
      ang = st.ang,
      placed = setLine(text, o),
      strokes: Stroke[] = [],
      dots: Dot[] = [];
    type Raw = { ang: number; pts: [number, number, number, number?][] };
    const raws: Raw[] = [];
    let open: Raw | null = null;
    const near = (a: readonly (number | undefined)[], b: readonly (number | undefined)[]) =>
      Math.abs(a[0]! - b[0]!) < 0.06 && Math.abs(a[1]! - b[1]!) < 0.06;
    let lastGlyph = -1;
    placed.forEach((p, pi) => {
      if (isLetter(p)) lastGlyph = pi;
    });
    placed.forEach((p, pi) => {
      if ('kash' in p) {
        const k: [number, number, number][] = [
          [p.ox - p.len * 0.5, p.oy - (o.sag ?? 0.3) * Math.min(1, p.len / 3), 1],
          [p.ox - p.len, p.oy, 1],
        ];
        if (open) open.pts.push(...k);
        else {
          open = { ang, pts: [[p.ox, p.oy, 1], ...k] };
          raws.push(open);
        }
        return;
      }
      if ('conn' in p) {
        const [ax, ay] = p.from,
          [bx, by] = p.to;
        const k: [number, number, number][] =
          bx < ax - 0.5
            ? [0.2, 0.4, 0.6, 0.8, 1].map(t => [ax + (bx - ax) * t, ay + (by - ay) * (3 * t * t - 2 * t * t * t), 1])
            : [
                [ax - 0.45, ay - 0.35, 1],
                [ax + (bx - ax) * 0.45 - 0.2, ay + (by - ay) * 0.55, 0.9],
                [bx - 0.15, by + 0.25, 1],
                [bx, by, 1],
              ];
        if (open) open.pts.push(...k);
        else {
          open = { ang, pts: [[ax, ay, 1], ...k] };
          raws.push(open);
        }
        return;
      }
      const oy = p.oy || 0,
        exitPt = p.g.exit != null ? [p.ox + p.g.exit, oy] : null,
        connects = p.form === 'med' || p.form === 'fin';
      let nextOpen: Raw | null = null;
      p.g.s.forEach((sd: StrokeDef, si) => {
        const tl = o.tail && pi === lastGlyph && TAILED.includes(familyOf(p.c, p.form)!) ? o.tail : null;
        const tq = (q: SkelPt): SkelPt =>
          tl ? [q[0] * (q[0] < -0.5 ? tl.sx : 1), q[1] < 0 ? q[1] * tl.sy : q[1], q[2], q[3]] : q;
        let pts: [number, number, number, number?][] = sd.pts.map(q0 => {
          const q = tq(q0);
          return [q[0] + p.ox, q[1] + oy, q[2] ?? 1, q[3]];
        });
        if (sd.lean)
          pts = lean(sd.pts.map(q => [q[0], q[1], q[2] ?? 1, q[3]] as SkelPt)).map(q => [
            q[0] + p.ox,
            q[1] + oy,
            q[2]!,
            q[3],
          ]);
        let target: Raw;
        if (si === 0 && connects && open && near(pts[0], [p.ox, oy])) {
          open.pts.push(...pts.slice(1));
          target = open;
        } else {
          target = { ang: sd.ang ?? ang, pts };
          raws.push(target);
        }
        if (exitPt && near(target.pts[target.pts.length - 1], exitPt)) nextOpen = target;
      });
      open = nextOpen;
    });
    raws.forEach(r =>
      strokes.push({ ang: r.ang, s: sampleStroke(r.pts, st.tension), raw: r.pts.map(q => [q[0], q[1]]) }),
    );
    // the name of God: shadda and a small upright alif above the second lam
    if (!o.noAuto && (o.allah || /^ٱ?[اأ]?لله$/.test(text.trim()) || /(^|\s)الله(\s|$)/.test(text)))
      placed.forEach((p, i) => {
        const q = placed[i + 1],
          r = placed[i + 2];
        if (
          isLetter(p) &&
          p.c === 'ل' &&
          p.form === 'ini' &&
          q &&
          isLetter(q) &&
          q.c === 'ل' &&
          r &&
          isLetter(r) &&
          r.c === 'ه'
        ) {
          const x = q.ox - 0.9,
            y = 6.2 + (q.oy || 0),
            sm = 0.55;
          const sh: SkelPt[] = [[0.95, 0.15], [0.65, 0.65], [0.35, 0.05, 1, 1], [0.05, 0.6], [-0.3, 0.05, 1, 1], [-0.6, 0.6], [-0.9, 0.3, 0.6]]; // prettier-ignore
          strokes.push({ ang, nib: nib * 0.5, s: sampleStroke(sh.map(([a2, b2, w, c]) => [x + a2 * sm * 2, y + b2 * sm * 2, w ?? 1, c] as SkelPt), st.tension) }); // prettier-ignore
          strokes.push({ ang: 38, nib: nib * 0.55, s: sampleStroke([[x + 0.35, y + 3.0, 0.3], [x + 0.2, y + 2.6, 0.9], [x + 0.05, y + 1.5, 0.8]], st.tension) }); // prettier-ignore
        }
      });
    const dotGroups: DotGroup[] = [];
    placed.forEach(p => {
      if (!isLetter(p)) return;
      const dd = DOTS[p.c],
        oy = p.oy || 0;
      if (dd)
        dd.forEach(([side, n]) => {
          // dots centred over or under the letter body
          const xs = p.g.s.flatMap(s => s.pts.map(q => q[0])),
            cx = p.ox + (p.g.dotX != null ? p.g.dotX : p.g.exit != null ? p.g.exit / 2 : (Math.min(...xs) + Math.max(...xs)) / 2); // prettier-ignore
          const ys = p.g.s.flatMap(s => s.pts.map(q => q[1])),
            top = Math.max(...ys),
            bot = Math.min(...ys);
          const by = oy + (side > 0 ? Math.max(top, 1.6) + nib * 1.3 : Math.min(bot, 0) - nib * 1.5);
          for (let k = 0; k < n; k++) {
            const dx = (k - (n - 1) / 2) * nib * 1.15,
              dy = n === 3 && k === 1 ? nib * 1.0 * side : 0;
            dots.push([cx + dx, by + dy]);
          }
          dotGroups.push({ x: cx, y: by + (n === 3 ? nib * 0.5 * side : 0), n, side, li: p.li, wi: p.wi, x0: p.ox + Math.min(...xs), x1: p.ox + Math.max(...xs), top: oy + top, bot: oy + bot }); // prettier-ignore
        });
    });
    return { strokes, dots, placed, dotGroups };
  }

  /** The ink of a stroke and of a dot, as polygons in pen units. */
  const strokePolys = (s: Stroke, nibScale = 1) => nibPolys(s.s, (s.nib || st.nib) * nibScale, s.ang, st.floor);
  const dotPolysAt = (x: number, y: number, scale = 1, rot = 0) =>
    dotPolys(x, y, st.nib * scale, st.ang, st.floor, rot);

  /** The lab's specimen renderer: strokes and dots on paper, with padding (drawSVG). */
  function drawSVG(strokes: Stroke[], dots: Dot[], o: { U?: number; ink?: string; paper?: string; pad?: number } = {}) {
    const U = o.U ?? 14,
      ink = o.ink ?? '#1b1b1b',
      paper = o.paper ?? '#f4efe3',
      pad = o.pad ?? 3;
    let x0 = 1e9,
      x1 = -1e9,
      y0 = 1e9,
      y1 = -1e9;
    strokes.forEach(s => s.s.forEach(q => ((x0 = Math.min(x0, q.x)), (x1 = Math.max(x1, q.x)), (y0 = Math.min(y0, q.y)), (y1 = Math.max(y1, q.y))))); // prettier-ignore
    dots.forEach(
      ([x, y]) => ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y))),
    );
    x0 -= pad;
    x1 += pad;
    y0 -= pad;
    y1 += pad;
    const W = (x1 - x0) * U,
      H = (y1 - y0) * U,
      X = (x: number) => (x - x0) * U,
      Y = (y: number) => (y1 - y) * U;
    let body = '';
    strokes.forEach(s => (body += `<path d="${polyPath(strokePolys(s), X, Y)}"/>`));
    dots.forEach(([x, y]) => (body += `<path d="${polyPath(dotPolysAt(x, y), X, Y)}"/>`));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}"><rect width="100%" height="100%" fill="${paper}"/><g fill="${ink}" fill-rule="nonzero">${body}</g></svg>`; // prettier-ignore
  }
  const renderLine = (text: string, o: LineOptions & { U?: number; pad?: number } = {}) => {
    const b = buildStrokes(text, o);
    return drawSVG(b.strokes, b.dots, o);
  };

  return { style: st, table, glyphFor, setLine, buildStrokes, strokePolys, dotPolysAt, drawSVG, renderLine };
}

/** All the ink of built strokes and dots, as polygons. */
export function inkPolys(th: Thuluth, b: Pick<Built, 'strokes' | 'dots'>): Poly[] {
  return [...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))];
}
