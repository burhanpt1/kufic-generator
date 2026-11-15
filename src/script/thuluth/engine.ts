// The thuluth line engine (lab engine3.js setLine / buildStrokes / drawSVG), with the lab's globals as an explicit
// style: `thuluth(style)` returns an engine bound to that style, with its own glyph cache and no other state.
import { GREAT, HEH_FIN, LETTERS, TOOTH_FIN_LONG } from './letters.data';
import { allahForms, altForms, ledForms, nameForms } from './alts';
import { HAMZA, LETTER_FIXES } from './fixes';
import { dotPolys, nibPolys, polyPath, sampleSpans, sampleStroke } from './pen';
import type { AllahSpan } from './shape';
import type { Shaped } from './shape';
import type { Sides } from './spacing';
import { sidesOf, slideRooms, STEM_SPACE } from './spacing';
import { allahSpan, DOTS, FAM, FORM_FAM, familyOf, forms, muhammadAt, STEM_LETTERS } from './shape';
import type { Family, Form, GlyphDef, Poly, SkelPt, Stroke, StrokeDef, ThuluthStyle } from './types';

export const DEFAULT_THULUTH: ThuluthStyle = {
  // the name of God as one ligature (owner, 30 October)
  allah: { alif: false },
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
  /** The name of God is found word by word (allahSpan). A caller that sets a piece of a word, and knows whether the
   *  word is the name, says so: true, the text holds it; false, it does not, whatever its letters. */
  allah?: boolean;
  /** With the ligature (style.allah): draw its small alif, as a vowelled text that writes it asks. */
  allahAlif?: boolean;
  /** Leave out the name's own shadda and small alif (a vowelled text sets its marks itself). */
  noAuto?: boolean;
  /** For a piece of a word: the piece before it ends in a tall stem (an alif before the lam of ال), so a stem that
   *  opens this one is the second of a run (alts.stems c gives it the lesser head). */
  afterStem?: boolean;
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
/** Where the name of God stands in each word of a text (null for a word without it). */
function nameSpans(text: string, o: LineOptions): (AllahSpan | null)[] {
  return text
    .trim()
    .split(/\s+/)
    .map(w => {
      if (o.allah === false) return null;
      const sp = allahSpan(w);
      if (sp || !o.allah) return sp;
      // said to be the name: wherever its two lams and heh stand
      const cs = forms(w).map(f => f.c),
        at = cs.findIndex((c, i) => c === 'ل' && cs[i + 1] === 'ل' && cs[i + 2] === 'ه');
      return at < 0 ? null : { lam: at, final: at + 3 === cs.length };
    });
}

export type Thuluth = ReturnType<typeof thuluth>;

export function thuluth(style: ThuluthStyle = DEFAULT_THULUTH) {
  // the lab's letters exactly: without the later fixes, and so without the ligature of the name of God
  const st: ThuluthStyle = style.labLetters ? { ...style, allah: undefined } : style,
    cache = new Map<string, GlyphDef | null>();
  const leanK = typeof st.slant === 'number' ? st.slant : st.slant === 'left' ? -0.06 : st.slant === 'right' ? 0.14 : 0;
  const lean = (pts: readonly SkelPt[]) => pts.map(([x, y, w, c]) => [x + leanK * y, y, w, c] as SkelPt);

  /** The letter table with this style's choices: the heh design and the great roundel gestures. */
  const table = (() => {
    const t = { ...LETTERS } as Record<Family, Partial<Record<Form, GlyphDef>>>;
    if (!st.labLetters)
      for (const [fam, fs] of Object.entries(LETTER_FIXES) as [Family, Partial<Record<Form, GlyphDef>>][])
        t[fam] = { ...t[fam], ...fs };
    // the hamza on the line, which the lab's table has no letter for (so no lab reference holds one)
    t.hamza = { iso: HAMZA };
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
    // the audit's corrections (on unless a style says `fixes: false`) and any drafted alternatives, over everything
    // else
    if (!st.labLetters) {
      const over = altForms({ fixes: true, ...st.alts }, t, st.nib, st.body) as Partial<Record<Family, Partial<Record<Form, GlyphDef>>>>; // prettier-ignore
      for (const fam of Object.keys(over) as Family[]) t[fam] = { ...t[fam], ...over[fam] };
    }
    return t;
  })();
  const ALTS = st.labLetters ? undefined : st.alts,
    NAME = allahForms(ALTS, st.nib),
    MUHAMMAD = nameForms(ALTS),
    // alts.stems c: a lam after another stem carries the lesser head, and two joined stems stand a little further
    // apart, so that their heads keep the room their shafts have
    LED = ledForms(ALTS, table, st.nib),
    STEM_JOIN = LED ? 0.45 * (st.nib / 1.6) : 0;
  /** Where a word is written as the ligature of the name محمد (the position of its first mim), or -1. */
  const nameAt = (word: string) => (MUHAMMAD ? muhammadAt(word) : -1);
  /** Whether the join into letter j of a word may be drawn out. With the drafted stems, not the join from a lam into
   *  a ra or zay: that ra hangs from the lam's foot, and a kashida there is a long flat stroke no hand writes. */
  const stretches = (fs: readonly Shaped[], j: number) =>
    !(ALTS?.stems && j > 0 && fs[j - 1].c === 'ل' && (fs[j].c === 'ر' || fs[j].c === 'ز'));

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

  /** A drawing scaled by the body, made once (so that a piece written again is known for the same). */
  const bodies = new WeakMap<GlyphDef, GlyphDef>();
  function bodied(g: GlyphDef): GlyphDef {
    let b = bodies.get(g);
    if (!b) bodies.set(g, (b = scaleGlyph(g, st.body)));
    return b;
  }

  /** Set a line: letters joined, words right to left (x decreasing), kashida where asked. */
  function setLine(text: string, o: LineOptions = {}): Placed[] {
    const nib = st.nib,
      kashida = o.kashida ?? 0,
      gap = o.gap ?? 0.9,
      wordGap = o.wordGap ?? 1.6;
    const words = text.trim().split(/\s+/),
      names = st.allah ? nameSpans(text, o) : [],
      placed: Placed[] = [],
      // where each piece (a connected group) begins in `placed`
      starts: number[] = [];
    let x = 0,
      y = 0;
    words.forEach((w, wi) => {
      if (wi) x -= wordGap;
      const fs = forms(w);
      let joined = false;
      y = 0;
      // the name of God as one ligature: its lams and its final heh in their own forms (`allah` is the second lam)
      const name = names[wi],
        allah = name ? name.lam + 1 : -1;
      // the name محمد as a ligature (a drafted alternative): its first mim and its hah in their own forms, a storey
      // above the line the rest stands on. Not when the caller stacks the word's joins itself.
      const mu = !(o.stacks && Object.keys(o.stacks).length) ? nameAt(w) : -1,
        rise = mu >= 0 ? MUHAMMAD!.drop * st.body : 0;
      fs.forEach((f, i) => {
        let g = glyphFor(f.c, f.form);
        if (mu >= 0 && i >= mu) g = bodied(MUHAMMAD!.letters[i - mu]);
        if (LED && (i ? STEM_LETTERS.has(fs[i - 1].c) : wi === 0 && o.afterStem)) g = LED[FAM[f.c]]?.[f.form] ?? g;
        if (allah >= 0 && i === allah - 1) g = NAME.ini;
        if (allah >= 0 && i === allah) g = NAME.lam;
        if (allah >= 0 && i === allah + 1 && name!.final) g = bodied(NAME.heh);
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
          y = i === mu ? rise : 0;
          const xs = g.s.flatMap(s => s.pts.map(p => p[0]));
          ox = x - (Math.max(...xs) + nib * 0.5);
          starts.push(placed.length);
        }
        placed.push({ g, ox, oy: y, c: f.c, form: f.form, li: i, wi });
        if (g.exit != null) {
          x = ox + g.exit;
          joined = true;
          // the hah of محمد ends a storey down
          if (mu >= 0 && i === mu + 1) y -= rise;
          const stk = o.stacks && o.stacks[i + 1];
          if (stk && i < fs.length - 1) {
            // a stacked join: the next letter is written below and to the right, and the pen comes down to it
            placed.push({ conn: true, from: [x, y], to: [x + stk.dx, y + stk.dy] });
            x += stk.dx;
            y += stk.dy;
          } else if (i < fs.length - 1) {
            let kl = o.kashMap && o.kashMap[i + 1] != null ? o.kashMap[i + 1] : kashida;
            // the ligature keeps its own spacing: its lams are never drawn apart
            if (allah >= 0 && i >= allah - 1) kl = 0;
            // (nor are the letters of the name محمد, written as its ligature)
            if (mu >= 0 && i >= mu) kl = 0;
            if (!stretches(fs, i + 1)) kl = 0;
            // (and a lam from the tall loop of a sad that follows it)
            if (STEM_JOIN && allah < 0 && STEM_LETTERS.has(f.c) && (STEM_LETTERS.has(fs[i + 1].c) || FAM[fs[i + 1].c] === 'sad')) kl = Math.max(kl, STEM_JOIN); // prettier-ignore
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
    if (SPACED && starts.length > 1) spaceLine(placed, starts, o);
    return placed;
  }

  // ---- ink spacing (style.pieceGap, wordSpace; spacing.ts) ----
  const SPACED = st.pieceGap != null || st.wordSpace != null,
    glyphIds = new WeakMap<GlyphDef, number>(),
    pieceSides = new Map<string, Sides>(),
    roomOf = slideRooms();
  let glyphCount = 0;
  /** A piece's ink (its letters as the pen draws them, and its dots) seen from its sides, with x counted from its
   *  first letter's place: measured once for each piece as written (its letters' drawings, its kashidas). */
  function sidesOfPiece(piece: readonly Placed[], o: LineOptions): Sides {
    const at = (piece[0] as PlacedLetter).ox,
      f = (v: number) => Math.round((v - at) * 1e4) / 1e4;
    let key = `${o.sag ?? ''}|${o.tail ? o.tail.sx + ',' + o.tail.sy : ''}`;
    for (const p of piece) {
      if ('kash' in p) key += `|k${f(p.ox)},${p.oy},${p.len}`;
      else if ('conn' in p) key += `|c${f(p.from[0])},${p.from[1]},${f(p.to[0])},${p.to[1]}`;
      else {
        let id = glyphIds.get(p.g);
        if (id == null) glyphIds.set(p.g, (id = glyphCount++));
        key += `|${id},${p.c}${p.form},${f(p.ox)},${p.oy}`;
      }
    }
    let s = pieceSides.get(key);
    if (!s) {
      s = sidesOf(
        [
          ...penStrokes(piece, o).flatMap(k => strokePolys(k)),
          ...dotsOf(piece).dots.flatMap(([x, y]) => dotPolysAt(x, y)),
        ],
        -at,
      );
      if (pieceSides.size > 4000) pieceSides.clear();
      pieceSides.set(key, s);
    }
    return s;
  }
  /** Set the pieces of a line by their ink. In a word, each piece in turn slides along the baseline until the
   *  clearance asked is left between it and every earlier piece of the word (pieceGap; STEM_SPACE times that between
   *  two stems that face each other). The word then slides, as it stands, until wordSpace is left between it and the
   *  two words before it. Where a clearance is not set, the piece (the word) keeps the place its box gave it. */
  function spaceLine(placed: Placed[], starts: readonly number[], o: LineOptions) {
    const nib = st.nib,
      cIn = st.pieceGap != null ? st.pieceGap * nib : null,
      cWord = st.wordSpace != null ? st.wordSpace * nib : null;
    let lastGlyph = -1;
    placed.forEach((p, pi) => {
      if (isLetter(p)) lastGlyph = pi;
    });
    const pieces = starts.map((from, k) => {
      const to = starts[k + 1] ?? placed.length,
        piece = placed.slice(from, to),
        first = piece[0] as PlacedLetter,
        last = piece.filter(isLetter).pop()!;
      let left = Infinity;
      for (const p of piece) if (isLetter(p)) for (const sd of p.g.s) for (const q of sd.pts) left = Math.min(left, p.ox + q[0]); // prettier-ignore
      // (the stretched tail is the last letter's alone)
      return { from, to, wi: first.wi, at: first.ox, left, t: 0, stems: [STEM_LETTERS.has(first.c), STEM_LETTERS.has(last.c)], sides: sidesOfPiece(piece, lastGlyph >= from && lastGlyph < to ? o : { ...o, tail: null }) }; // prettier-ignore
    });
    for (let a = 0, e: number; a < pieces.length; a = e) {
      e = a + 1;
      while (e < pieces.length && pieces[e].wi === pieces[a].wi) e++;
      // the word's pieces against each other
      for (let j = a + 1; j < e; j++) {
        const B = pieces[j];
        let t = Infinity;
        if (cIn != null)
          for (let i = j - 1; i >= a; i--) {
            const A = pieces[i],
              c = i === j - 1 && A.stems[1] && B.stems[0] ? cIn * STEM_SPACE : cIn;
            t = Math.min(t, A.at + A.t + roomOf(A.sides, B.sides, c) - B.at);
          }
        // (nothing asked, or a piece that faces nothing at any height: as its box set it)
        B.t = t === Infinity ? pieces[j - 1].t : t;
      }
      if (!a) continue;
      // then the word, as it stands, against the two words before it
      let t = Infinity;
      if (cWord != null)
        for (let j = a; j < e; j++)
          for (let i = a - 1; i >= 0 && pieces[i].wi >= pieces[a].wi - 2; i--)
            t = Math.min(t, pieces[i].at + pieces[i].t + roomOf(pieces[i].sides, pieces[j].sides, cWord) - pieces[j].at - pieces[j].t); // prettier-ignore
      if (t === Infinity) {
        // as its box set it: after everything of the word before it
        const P = pieces[a - 1];
        for (let i = a - 1; i >= 0 && pieces[i].wi === P.wi; i--)
          t = Math.min(t, pieces[i].left + pieces[i].t - P.left);
      }
      for (let j = a; j < e; j++) pieces[j].t += t;
    }
    for (const B of pieces) {
      if (!B.t) continue;
      for (let i = B.from; i < B.to; i++) {
        const p = placed[i];
        if ('conn' in p) placed[i] = { conn: true, from: [p.from[0] + B.t, p.from[1]], to: [p.to[0] + B.t, p.to[1]] };
        else p.ox += B.t;
      }
    }
  }

  /** Pen strokes for placed letters: joins run as one continuous stroke (the pen never lifts within a group). */
  function penStrokes(placed: readonly Placed[], o: LineOptions): Stroke[] {
    const ang = st.ang,
      strokes: Stroke[] = [];
    type Raw = { ang: number; pts: [number, number, number, number?][]; own: number[]; wi: number };
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
        if (open) {
          open.own[open.own.length - 1] = -1;
          open.pts.push(...k);
          open.own.push(...k.map(() => -1));
        } else {
          open = { ang, pts: [[p.ox, p.oy, 1], ...k], own: [-1, ...k.map(() => -1)], wi: -1 };
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
        if (open) {
          open.own[open.own.length - 1] = -1;
          open.pts.push(...k);
          open.own.push(...k.map(() => -1));
        } else {
          open = { ang, pts: [[ax, ay, 1], ...k], own: [-1, ...k.map(() => -1)], wi: -1 };
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
        const mine = pts.map(() => p.li);
        if (si === 0 && connects && open && near(pts[0], [p.ox, oy]) && (sd.ang ?? ang) === open.ang) {
          // the span from the shared point onward is this letter's
          open.own[open.own.length - 1] = p.li;
          open.pts.push(...pts.slice(1));
          open.own.push(...mine.slice(1));
          open.wi = p.wi;
          target = open;
        } else if (si === 0 && connects && open && near(pts[0], [p.ox, oy])) {
          // a letter written at its own pen angle (the heh's) hands over here: the pen turns where this letter begins
          const last = open.pts[open.pts.length - 1];
          target = { ang: sd.ang ?? ang, pts: [[last[0], last[1], last[2]], ...pts.slice(1)], own: mine, wi: p.wi };
          raws.push(target);
        } else {
          target = { ang: sd.ang ?? ang, pts, own: mine, wi: p.wi };
          raws.push(target);
        }
        if (exitPt && near(target.pts[target.pts.length - 1], exitPt)) nextOpen = target;
      });
      open = nextOpen;
    });
    raws.forEach(r => {
      const spans = sampleSpans(r.pts);
      strokes.push({ ang: r.ang, s: sampleStroke(r.pts, st.tension), raw: r.pts.map(q => [q[0], q[1]]), own: spans.map(k => r.own[k]), wi: r.wi }); // prettier-ignore
    });
    return strokes;
  }
  /** Pen strokes for a line, with its dots and the signs of the name of God. */
  function buildStrokes(text: string, o: LineOptions = {}): Built {
    const nib = st.nib,
      ang = st.ang,
      placed = setLine(text, o),
      strokes = penStrokes(placed, o);
    // the name of God: shadda and a small upright alif above the second lam
    // (the lab's own letters keep the lab's rule for a line, as its references were drawn: only a text that is the
    // name alone, or that writes it الله, has these marks)
    const labOff = !!st.labLetters && !(o.allah || /^ٱ?[اأ]?لله$/.test(text.trim()) || /(^|\s)الله(\s|$)/.test(text));
    if (!o.noAuto && !labOff)
      nameSpans(text, o).forEach((name, wi) => {
        const i = name ? placed.findIndex(p => isLetter(p) && p.wi === wi && p.li === name.lam) : -1;
        if (i < 0) return;
        // the letters after its first lam (a kashida between them is not a letter)
        const next = placed.slice(i + 1).filter(isLetter),
          q = st.allah ? next[0] : placed[i + 1],
          r = st.allah ? next[1] : placed[i + 2];
        if (q && isLetter(q) && q.c === 'ل' && r && isLetter(r) && r.c === 'ه') {
          const sm = 0.55,
            sh: SkelPt[] = [[0.95, 0.15], [0.65, 0.65], [0.35, 0.05, 1, 1], [0.05, 0.6], [-0.3, 0.05, 1, 1], [-0.6, 0.6], [-0.9, 0.3, 0.6]]; // prettier-ignore
          const shadda = (x: number, y: number) =>
            strokes.push({ ang, nib: nib * 0.5, s: sampleStroke(sh.map(([a2, b2, w, c]) => [x + a2 * sm * 2, y + b2 * sm * 2, w ?? 1, c] as SkelPt), st.tension) }); // prettier-ignore
          const smallAlif = (x: number, y0: number, y1: number) =>
            // the marks pen for the small alif (marks.ts ALIF_ANG, ALIF_PEN)
            strokes.push({ ang: 38, nib: nib * 0.5, s: sampleStroke([[x + 0.3, y1, 0.3], [x + 0.15, y1 - (y1 - y0) * 0.27, 0.9], [x, y0, 0.8]], st.tension) }); // prettier-ignore
          if (st.allah) {
            // the ligature: the shadda sits on the second lam's stem, its top level with the alif's; the small alif,
            // if drawn, stands over the heh's arch
            const alif = glyphFor('ا', 'iso')!,
              alifTop = Math.max(...alif.s.flatMap(s2 => s2.pts.map(pt => pt[1]))),
              lamTop = Math.max(...q.g.s.flatMap(s2 => s2.pts.map(pt => pt[1]))),
              x = q.ox + leanK * lamTop,
              y = alifTop - sm * 2 * 0.65 + nib * 0.25 + (q.oy || 0);
            shadda(x, y);
            if (st.allah.alif || o.allahAlif) {
              const hx = r.g.s.flatMap(s2 => s2.pts.map(pt => pt[0])),
                hy = r.g.s.flatMap(s2 => s2.pts.map(pt => pt[1])),
                top = Math.max(...hy) + nib * 0.6;
              smallAlif(r.ox + (Math.min(...hx) + Math.max(...hx)) / 2, top + (r.oy || 0), Math.max(alifTop, top + 1.6) + (r.oy || 0)); // prettier-ignore
            }
          } else {
            // the lab's: both on the second lam's stem
            const x = q.ox - 0.9,
              y = 6.2 + (q.oy || 0);
            shadda(x, y);
            strokes.push({ ang: 38, nib: nib * 0.55, s: sampleStroke([[x + 0.35, y + 3.0, 0.3], [x + 0.2, y + 2.6, 0.9], [x + 0.05, y + 1.5, 0.8]], st.tension) }); // prettier-ignore
          }
        }
      });
    const d = dotsOf(placed);
    return { strokes, dots: d.dots, placed, dotGroups: d.dotGroups };
  }
  /** The dots of placed letters, centred over or under each letter's body. */
  function dotsOf(placed: readonly Placed[]): Pick<Built, 'dots' | 'dotGroups'> {
    const nib = st.nib,
      dots: Dot[] = [],
      dotGroups: DotGroup[] = [];
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
    return { dots, dotGroups };
  }

  /** The ink of a stroke and of a dot, as polygons in pen units. */
  // the drafted stems and the drafted name are drawn with clean stroke ends (pen.ts); the audit's corrections alone
  // leave every other letter's ends as they were
  const CLEAN_ENDS = !!(st.alts?.stems || st.alts?.muhammad) && !st.labLetters;
  const strokePolys = (s: Stroke, nibScale = 1) =>
    nibPolys(s.s, (s.nib || st.nib) * nibScale, s.ang, st.floor, CLEAN_ENDS);
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

  return { style: st, table, glyphFor, setLine, buildStrokes, strokePolys, dotPolysAt, drawSVG, renderLine, nameAt, stretches }; // prettier-ignore
}

/** All the ink of built strokes and dots, as polygons. */
export function inkPolys(th: Thuluth, b: Pick<Built, 'strokes' | 'dots'>): Poly[] {
  return [...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))];
}
