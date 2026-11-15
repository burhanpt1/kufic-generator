// Thuluth behind the ScriptEngine interface (HANDOVER §7): lines come back as VectorStrips, straight-line polygons
// in strip cells (1 pen unit = 1 cell), y up from the band's outer edge, baseline at row `base`, the first word at
// the right. Justification is thuluth's own: kashida (one long elongation per word, preferring joins after tooth
// letters), then the word gaps. Lines narrower than their natural width need stacking, which is a composition, not a
// line, so layout returns null for them.
import { CAPABILITIES } from '../capabilities';
import { abjadValue } from '../kufi';
import type { LetterStyle, Prepared, ScriptEngine, Segment, Segments, VectorStrip } from '../types';
import type { Built, Thuluth } from './engine';
import { DEFAULT_THULUTH, thuluth } from './engine';
import { lineMarks } from './marks';
import { cleanOutline } from './outline';
import type { WordMark } from './shape';
import { allahSpan, endsGroup, FAM, forms, ligate, NONJOIN, parseVowels, STEM_LETTERS } from './shape';
import type { Sides } from './spacing';
import { sidesOf, slideRooms, STEM_SPACE } from './spacing';
import type { Family, Poly, ThuluthStyle } from './types';

/** Room kept above the tallest ink for vowels, and below the lowest for marks under it (pen units). */
const MARK_ROOM_UP = 2.6,
  MARK_ROOM_DOWN = 1.6;
/** Longest kashida one word takes (pen units), and the share of a line's slack kashida may take. */
const KASH_MAX = 10,
  KASH_SHARE = 0.6;
/** Thuluth words hold more air than Kufi's filled cells, so a word gap is this much wider than the slot asks for. */
export const WORD_SPACE = 1.6;
/** Joins worth elongating: after tooth letters first (the classical place), then letters with a flat exit. */
const KASH_PREF: Partial<Record<Family, number>> = { tooth: 3, sin: 3, sad: 2, ta: 2, kaf: 2, fa: 2, qaf: 2, hah: 2, ain: 2, lam: 1, ha: 1, mim: 1 }; // prettier-ignore

/** A piece of a line the solvers may move as a whole: a word, or (breaks mode) a connected group. */
export interface ThuluthSegment extends Segment {
  text: string;
  marks: WordMark[];
  /** Natural ink width in cells (minW is its ceiling). */
  w: number;
  /** The join that takes this piece's kashida (lab kashMap index), if any. */
  kashJoin: number | null;
  /** For a piece of a word (breaks mode): whether it holds the name of God, which only the whole word tells. */
  allah?: boolean;
  /** The text writes the name's small alif, which the ligature then draws. */
  allahAlif?: boolean;
  /** With ink spacing (style.pieceGap, wordSpace). For a piece of a word: the piece before it ends in a tall stem
   *  (LineOptions.afterStem). For a whole word: its pieces, which the line sets by their ink. */
  afterStem?: boolean;
  parts?: ThuluthSegment[];
}
interface ThuluthWord {
  text: string;
  marks: WordMark[];
  allah?: boolean;
}
export interface ThuluthPrepared extends Prepared {
  words: ThuluthWord[];
  /** Ink extents of the letters (pen units from the baseline), and whether the text has vowels. */
  ascent: number;
  descent: number;
  vowels: boolean;
  /** Characters of the line that the script cannot write, and left out. */
  unsupported: string[];
}

const polysBox = (polys: Poly[]) => {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const q of polys)
    for (const [x, y] of q) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return { x0, x1, y0, y1 };
};

/** The best join of a piece of text to elongate (its lab kashMap key), or null. `allah`: for a piece of a word,
 *  whether it holds the name of God (LineOptions.allah). */
export function kashidaJoin(text: string, allah?: boolean): number | null {
  // the name of God is never stretched (and its shadda and dagger alif hang on its letters): no join from its first
  // lam on
  const name = allah === false ? null : allahSpan(text),
    fs = forms(text);
  let best: number | null = null,
    score = 0;
  for (let i = 0; i + 1 < fs.length; i++) {
    const a = fs[i],
      b = fs[i + 1];
    if (NONJOIN.has(a.c) || (a.form !== 'ini' && a.form !== 'med') || (b.form !== 'med' && b.form !== 'fin')) continue;
    if (name && i >= name.lam && i <= name.lam + 2) continue;
    const s = KASH_PREF[FAM[a.c]] ?? 0;
    if (s && s >= score) {
      score = s;
      best = i + 1; // the later join wins a tie: the elongation sits towards the word's end
    }
  }
  return best;
}

/** Split a word's marks between its connected groups (letter positions after the lam-alif ligature). */
function groupsOf(w: ThuluthWord): ThuluthWord[] {
  const cs = [...ligate(w.text)],
    name = allahSpan(w.text),
    out: ThuluthWord[] = [];
  let cur = '',
    start = 0;
  cs.forEach((c, i) => {
    cur += c;
    if (endsGroup(cs, i)) {
      const n = [...cur].length,
        s0 = start;
      // the group's text keeps the ligature's letters (لا), so its marks keep their positions
      out.push({ text: cur.replace(/ﻻ/g, 'لا'), marks: w.marks.filter(m => m.li >= s0 && m.li < s0 + n).map(m => ({ li: m.li - s0, m: m.m })), allah: !!name && name.lam >= s0 && name.lam < s0 + n }); // prettier-ignore
      start += n;
      cur = '';
    }
  });
  return out;
}

export function thuluthScript(style: ThuluthStyle = DEFAULT_THULUTH): ScriptEngine & { th: Thuluth } {
  const th = thuluth(style),
    built = new Map<string, Built>();
  const build = (
    text: string,
    kash: number | null,
    L: number,
    allah?: boolean,
    allahAlif?: boolean,
    afterStem?: boolean,
  ): Built => {
    const k = `${text}|${kash}|${L}|${allah ?? ''}|${allahAlif ? 1 : ''}${afterStem ? '|s' : ''}`;
    let b = built.get(k);
    if (!b) {
      b = th.buildStrokes(text, {
        ...(kash != null && L > 0 ? { kashMap: { [kash]: L } } : {}),
        allah,
        allahAlif,
        ...(afterStem ? { afterStem } : {}),
      });
      if (built.size > 4000) built.clear();
      built.set(k, b);
    }
    return b;
  };
  // a piece's ink as outlines (the union of its quads), computed once per built piece
  const outlines = new WeakMap<Built, Poly[]>();
  const inkOutline = (b: Built) => {
    let o = outlines.get(b);
    if (!o) {
      o = cleanOutline([
        ...b.strokes.flatMap(s => th.strokePolys(s)),
        ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y)),
      ]);
      outlines.set(b, o);
    }
    return o;
  };
  // ---- ink spacing (style.pieceGap, wordSpace; spacing.ts) ----
  // The pieces of a line (the connected groups of its words) are each written apart and set by their ink: the
  // clearances are the least space between two inks, and what a line has to spare still goes to kashida and then to
  // the word gaps. A piece's vowels are placed first, round the piece alone as they always were, and count as its
  // ink with its dots: the next piece runs in over a tail or under a head only as far as they leave room, and no
  // mark is left without a place. The solvers go on counting a break inside a word as 1 and a word gap as `wg`, so
  // a piece's width (minW) and `wg` are given as bounds that the line set by ink never passes, and a text that fits
  // still fits whole.
  const nib = th.style.nib,
    cIn = th.style.pieceGap != null ? th.style.pieceGap * nib : null,
    cWord = th.style.wordSpace != null ? th.style.wordSpace * nib : null,
    SPACED = cIn != null || cWord != null,
    wgOf = (wordGap: number) => Math.max(wordGap * WORD_SPACE, cWord ?? 0),
    roomOf = slideRooms();
  interface Piece {
    s: ThuluthSegment;
    b: Built;
    /** Its vowels' ink, and all its ink (letters, dots, vowels) seen from its sides, with its extent along the line
     *  and its length. */
    vowels: Poly[];
    box: { x0: number; x1: number };
    w: number;
    sides: Sides;
    stems: [first: boolean, last: boolean];
  }
  const pieceInk = new WeakMap<Built, Map<string, Pick<Piece, 'vowels' | 'box' | 'w' | 'sides'>>>();
  const pieceOf = (s: ThuluthSegment, use: number, P: ThuluthPrepared): Piece => {
    const b = build(s.text, s.kashJoin, s.kashJoin != null ? use : 0, s.allah, s.allahAlif, s.afterStem),
      key = s.marks.length ? `${P.Hb}|${P.base}|${s.marks.map(m => m.li + m.m).join(',')}` : '',
      cs = [...ligate(s.text)];
    let kept = pieceInk.get(b);
    if (!kept) pieceInk.set(b, (kept = new Map()));
    let ink = kept.get(key);
    if (!ink) {
      const vowels = s.marks.length ? lineMarks(th, b, [s.marks], P.Hb - P.base, -P.base).strokes.flatMap(k => th.strokePolys(k)) : [], // prettier-ignore
        sides = sidesOf([...b.strokes.flatMap(k => th.strokePolys(k)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y)), ...vowels]); // prettier-ignore
      ink = { vowels, sides, box: { x0: sides.x0, x1: sides.x1 }, w: sides.x1 - sides.x0 };
      kept.set(key, ink);
    }
    return { s, b, ...ink, stems: [STEM_LETTERS.has(cs[0]), STEM_LETTERS.has(cs[cs.length - 1])] };
  };
  const piecesAt = (parts: readonly ThuluthSegment[], use: number, P: ThuluthPrepared) => parts.map(s => pieceOf(s, use, P)); // prettier-ignore
  /** A word's pieces as segments. */
  const partsOf = (w: ThuluthWord, P: ThuluthPrepared): ThuluthSegment[] => {
    const gs = groupsOf(w);
    return gs.map((p, i) => {
      // (the ligature of the name of God draws the second lam's marks itself: segments())
      const name = th.style.allah && p.allah !== false ? allahSpan(p.text) : null,
        own = name ? p.marks.filter(m => m.li === name.lam + 1) : [],
        allahAlif = own.some(m => m.m === 'alifk'),
        afterStem = i > 0 && STEM_LETTERS.has([...ligate(gs[i - 1].text)].pop()!),
        endsWord = i === gs.length - 1,
        seg: ThuluthSegment = {
          text: p.text,
          marks: own.length ? p.marks.filter(m => !own.includes(m)) : p.marks,
          w: 0,
          minW: 0,
          endsWord,
          kashJoin: kashidaJoin(p.text, p.allah),
          ...(p.allah == null ? {} : { allah: p.allah }),
          ...(allahAlif ? { allahAlif } : {}),
          ...(afterStem ? { afterStem } : {}),
        };
      // its length with its vowels, which stand where they would round the piece alone
      seg.w = pieceOf(seg, 0, P).w;
      // (a break inside a word may be wider than the 1 the solvers count, by this much at most)
      seg.minW = Math.ceil(seg.w + (cIn != null && !endsWord ? Math.max(0, cIn * STEM_SPACE - 1) : 0));
      return seg;
    });
  };
  /** Where each piece of a line stands by its ink: the right edge of its box, the first piece's at 0 (so every other
   *  is negative), and how long the line is. In a word (the pieces of one that are on this line), each piece in turn
   *  slides in until pieceGap is left between it and every earlier piece of the word (twice that between two stems
   *  that face each other); the word then slides in, as it stands, until wordSpace is left between it and the pieces
   *  before it. A clearance that is not set leaves the piece where its box puts it: 1 after the piece before it in a
   *  word, a word gap after everything before it. So a word is never longer than its pieces with what was asked
   *  between them, nor further from the line before it than the space asked. */
  function setByInk(pieces: readonly Piece[], wg: number): { right: number[]; extent: number } {
    const right: number[] = [];
    let L = 0;
    for (let a = 0, e: number; a < pieces.length; a = e) {
      e = a + 1;
      while (e < pieces.length && !pieces[e - 1].s.endsWord) e++;
      right.push(0);
      for (let j = a + 1; j < e; j++) {
        const B = pieces[j];
        let r = Infinity;
        if (cIn != null)
          for (let i = j - 1; i >= a; i--) {
            const A = pieces[i],
              c = i === j - 1 && A.stems[1] && B.stems[0] ? cIn * STEM_SPACE : cIn;
            r = Math.min(r, right[i] - A.box.x1 + roomOf(A.sides, B.sides, c) + B.box.x1);
          }
        right.push(r === Infinity ? right[j - 1] - pieces[j - 1].w - 1 : r);
      }
      if (!a) {
        for (let j = a; j < e; j++) L = Math.min(L, right[j] - pieces[j].w);
        continue;
      }
      let t = Infinity;
      if (cWord != null)
        for (let j = a; j < e; j++)
          for (let i = a - 1; i >= 0 && i >= a - 8; i--)
            t = Math.min(t, right[i] - pieces[i].box.x1 + roomOf(pieces[i].sides, pieces[j].sides, cWord) + pieces[j].box.x1 - right[j]); // prettier-ignore
      // (nothing asked, or nothing it faces at any height: a word gap after everything before it)
      if (t === Infinity) t = L - wg;
      for (let j = a; j < e; j++) L = Math.min(L, (right[j] += t) - pieces[j].w);
    }
    return { right, extent: -L };
  }
  const inkOf = (b: Built) => polysBox([...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))]); // prettier-ignore

  function prepareLines(lines: string[], letter: LetterStyle): ThuluthPrepared[] {
    const parsed = lines.map(l => parseVowels(l)),
      showVowels = letter.marks === 'all';
    let up = 0,
      down = 0,
      vowels = false,
      stem = 0;
    for (const p of parsed) {
      if (!p.bare.trim()) continue;
      const box = inkOf(build(p.bare, null, 0));
      up = Math.max(up, box.y1);
      down = Math.min(down, box.y0);
      if (showVowels && p.marks.some(m => m.length)) vowels = true;
      for (const s of build(p.bare, null, 0).strokes) if (s.ang === 38) stem = Math.max(stem, ...s.s.map(q => q.y));
    }
    const top = up + (vowels ? MARK_ROOM_UP : 0),
      bottom = down - (vowels ? MARK_ROOM_DOWN : 0),
      base = Math.ceil(-bottom),
      Hb = base + Math.ceil(top);
    return parsed.map(p => ({
      words: p.bare
        .split(/\s+/)
        .filter(Boolean)
        .map((text, i) => ({ text, marks: showVowels ? p.marks[i] : [] })),
      Hb,
      base,
      ascenders: Math.ceil(Math.max(stem, up - 1)),
      ascent: up,
      descent: -down,
      vowels,
      unsupported: p.dropped,
    }));
  }

  return {
    id: 'thuluth',
    th,
    shape: text => ({ text }),
    unsupported: text => parseVowels(text).dropped,
    prepare: (shaped, letter) => prepareLines([(shaped as { text: string }).text], letter)[0],
    prepareLines,
    segments(prepared, mode, wordGap) {
      const P = prepared as ThuluthPrepared;
      if (SPACED) {
        const segs: Segments<ThuluthSegment> = P.words.flatMap(w => {
          const parts = partsOf(w, P);
          if (mode !== 'words') return parts;
          // a whole word: as long as its pieces set by their ink, with the one kashida it would have as a word
          const join = kashidaJoin(w.text);
          let at = 0;
          for (const p of parts) {
            const n = [...ligate(p.text)].length;
            p.kashJoin = join != null && join > at && join < at + n ? join - at : null;
            at += n;
          }
          const wd = setByInk(piecesAt(parts, 0, P), 0).extent;
          return [{ text: w.text, marks: [], w: wd, minW: Math.ceil(wd), endsWord: true, kashJoin: join, parts }];
        });
        segs.wg = wgOf(wordGap);
        return segs;
      }
      const pieces = P.words.flatMap(w => {
        const parts = mode === 'words' ? [w] : groupsOf(w);
        return parts.map((p, i) => ({ ...p, endsWord: i === parts.length - 1 }));
      });
      const segs: Segments<ThuluthSegment> = pieces.map(p => {
        // the ligature of the name of God draws the second lam's marks itself, as in a roundel: its shadda, and the
        // small alif when the text writes it
        const name = th.style.allah && p.allah !== false ? allahSpan(p.text) : null,
          own = name ? p.marks.filter(m => m.li === name.lam + 1) : [],
          allahAlif = own.some(m => m.m === 'alifk'),
          box = inkOf(build(p.text, null, 0, p.allah, allahAlif)),
          w = box.x1 - box.x0;
        return {
          text: p.text,
          marks: own.length ? p.marks.filter(m => !own.includes(m)) : p.marks,
          w,
          minW: Math.ceil(w),
          endsWord: p.endsWord,
          kashJoin: kashidaJoin(p.text, p.allah),
          ...(p.allah == null ? {} : { allah: p.allah }),
          ...(allahAlif ? { allahAlif } : {}),
        };
      });
      segs.wg = wordGap * WORD_SPACE;
      return segs;
    },
    layout(segments, prepared, width, opts): VectorStrip | null {
      const P = prepared as ThuluthPrepared,
        segs = segments as Segments<ThuluthSegment>,
        n = segs.length,
        wg = segs.wg ?? (SPACED ? wgOf(opts.wordGap) : opts.wordGap * WORD_SPACE); // groups from the solvers are plain arrays
      if (!n) return null;
      if (SPACED) return layoutByInk(segs, P, width, opts.wrap, wg);
      // the solvers measure a line without the gap that closes a ring; round a circle that gap takes what room is
      // left, up to a full word gap
      let inner = 0;
      segs.forEach((s, i) => (inner += s.w + (i < n - 1 ? (s.endsWord ? wg : 1) : 0)));
      const W = width ?? Math.ceil(inner + (opts.wrap ? wg : 0));
      if (inner > W + 1e-6) return null;
      const closing = opts.wrap ? Math.min(wg, W - inner) : 0,
        gapAfter = (i: number) => (i < n - 1 ? (segs[i].endsWord ? wg : 1) : closing);
      const natural = inner + closing;
      // the word gaps (wrapping round a circle, the closing gap too); never the breaks inside a word, which would
      // pull its pieces apart
      const wordGaps = segs.map((s, i) => ((i < n - 1 || opts.wrap) && s.endsWord ? 1 : 0) as number),
        nWord = wordGaps.reduce((a, b) => a + b, 0);
      // kashida first: an equal share for every piece with a join to stretch, within limits; with no word gap to
      // take the rest, kashida takes all it can
      const slack = W - natural,
        stretchy = segs.filter(s => s.kashJoin != null).length,
        L = stretchy ? Math.min(KASH_MAX, ((nWord ? KASH_SHARE : 1) * slack) / stretchy) : 0,
        use = L >= 0.5 ? Math.floor(L * 4) / 4 : 0;
      const pieces = segs.map(s => {
        const b = build(s.text, s.kashJoin, s.kashJoin != null ? use : 0, s.allah, s.allahAlif),
          box = inkOf(b);
        return { s, b, box, w: box.x1 - box.x0 };
      });
      // then the word gaps; what no gap can take centres the line
      let used = 0;
      pieces.forEach((p, i) => (used += p.w + gapAfter(i)));
      const rest = Math.max(0, W - used),
        per = nWord ? rest / nWord : 0;
      let x = W - (opts.wrap ? (gapAfter(n - 1) + (wordGaps[n - 1] ? per : 0)) / 2 : nWord ? 0 : rest / 2);
      const paths: VectorStrip['paths'] = [],
        lines: NonNullable<VectorStrip['lines']> = [];
      const lineOf = (strokes: Built['strokes'], dx: number) =>
        strokes.map(s => 'M' + s.s.map(q => fmt(q.x + dx) + ' ' + fmt(q.y + P.base)).join('L')).join('');
      const fmt = (v: number) => (Math.round(v * 100) / 100).toString();
      const pathOf = (polys: Poly[], dx: number) =>
        polys.map(q => 'M' + q.map(([px, py]) => fmt(px + dx) + ' ' + fmt(py + P.base)).join('L') + 'Z').join('');
      pieces.forEach((p, i) => {
        const dx = x - p.box.x1,
          tag = (p.s.rep ?? 0) + 1;
        paths.push({ d: pathOf(inkOutline(p.b), dx), role: 'letter', tag });
        lines.push({ d: lineOf(p.b.strokes, dx), role: 'letter' });
        // dots as a short stroke across the nib, the way the pen writes them
        const da = ((th.style.ang + 90) * Math.PI) / 180,
          dl = th.style.nib * 0.47;
        if (p.b.dots.length)
          lines.push({ d: p.b.dots.map(([a, b]) => `M${fmt(a - Math.cos(da) * dl + dx)} ${fmt(b - Math.sin(da) * dl + P.base)}L${fmt(a + Math.cos(da) * dl + dx)} ${fmt(b + Math.sin(da) * dl + P.base)}`).join(''), role: 'mark' }); // prettier-ignore
        if (p.s.marks.length) {
          const m = lineMarks(th, p.b, [p.s.marks], P.Hb - P.base, -P.base);
          if (m.strokes.length)
            paths.push({
              d: pathOf(
                m.strokes.flatMap(s => th.strokePolys(s)),
                dx,
              ),
              role: 'vowel',
              tag,
            });
        }
        x -= p.w + gapAfter(i) + (wordGaps[i] ? per : 0);
      });
      return { kind: 'vector', W, Hb: P.Hb, base: P.base, paths, lines };
    },
    abjad: abjadValue,
    capabilities: CAPABILITIES.thuluth,
  };

  /** layout() with ink spacing: the same justification (kashida, then the word gaps, what no gap can take centring
   *  the line), over pieces set by their ink. */
  function layoutByInk(
    segs: Segments<ThuluthSegment>,
    P: ThuluthPrepared,
    width: number | null,
    wrap: boolean,
    wg: number,
  ): VectorStrip | null {
    // a whole word is set as its pieces
    const flat = segs.flatMap(s => s.parts?.map((p, k) => ({ ...p, endsWord: k === s.parts!.length - 1 && s.endsWord, rep: s.rep })) ?? [s]), // prettier-ignore
      n = flat.length;
    let pieces = piecesAt(flat, 0, P),
      set = setByInk(pieces, wg);
    const inner = set.extent,
      W = width ?? Math.ceil(inner + (wrap ? wg : 0));
    if (inner > W + 1e-6) return null;
    // round a circle the gap that closes the ring takes what room is left, up to a full word gap
    const closing = wrap ? Math.min(wg, W - inner) : 0,
      wordGaps = flat.map((s, i) => ((i < n - 1 || wrap) && s.endsWord ? 1 : 0) as number),
      nWord = wordGaps.reduce((a, b) => a + b, 0),
      slack = W - inner - closing,
      stretchy = flat.filter(s => s.kashJoin != null).length,
      L = stretchy ? Math.min(KASH_MAX, ((nWord ? KASH_SHARE : 1) * slack) / stretchy) : 0;
    // kashida, as long as the line still holds it: a piece drawn out does not always sit against its neighbours as
    // the plain one did
    for (let use = L >= 0.5 ? Math.floor(L * 4) / 4 : 0; use > 0; use -= 0.25) {
      const ps = piecesAt(flat, use, P),
        st = setByInk(ps, wg);
      if (st.extent + closing <= W + 1e-6) {
        pieces = ps;
        set = st;
        break;
      }
    }
    const rest = Math.max(0, W - set.extent - closing),
      per = nWord ? rest / nWord : 0,
      x0 = W - (wrap ? (closing + (wordGaps[n - 1] ? per : 0)) / 2 : nWord ? 0 : rest / 2);
    const paths: VectorStrip['paths'] = [],
      lines: NonNullable<VectorStrip['lines']> = [],
      fmt = (v: number) => (Math.round(v * 100) / 100).toString(),
      lineOf = (strokes: Built['strokes'], dx: number) =>
        strokes.map(s => 'M' + s.s.map(q => fmt(q.x + dx) + ' ' + fmt(q.y + P.base)).join('L')).join(''),
      pathOf = (polys: Poly[], dx: number) =>
        polys.map(q => 'M' + q.map(([px, py]) => fmt(px + dx) + ' ' + fmt(py + P.base)).join('L') + 'Z').join(''),
      da = ((th.style.ang + 90) * Math.PI) / 180,
      dl = th.style.nib * 0.47;
    let gaps = 0;
    pieces.forEach((p, i) => {
      const dx = x0 + set.right[i] - gaps * per - p.box.x1,
        tag = (p.s.rep ?? 0) + 1;
      gaps += wordGaps[i];
      paths.push({ d: pathOf(inkOutline(p.b), dx), role: 'letter', tag });
      lines.push({ d: lineOf(p.b.strokes, dx), role: 'letter' });
      if (p.b.dots.length)
        lines.push({ d: p.b.dots.map(([a, b]) => `M${fmt(a - Math.cos(da) * dl + dx)} ${fmt(b - Math.sin(da) * dl + P.base)}L${fmt(a + Math.cos(da) * dl + dx)} ${fmt(b + Math.sin(da) * dl + P.base)}`).join(''), role: 'mark' }); // prettier-ignore
      if (p.vowels.length) paths.push({ d: pathOf(p.vowels, dx), role: 'vowel', tag });
    });
    return { kind: 'vector', W, Hb: P.Hb, base: P.base, paths, lines };
  }
}

export { parsePolys } from '../vector';
