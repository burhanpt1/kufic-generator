// Thuluth behind the ScriptEngine interface (HANDOVER §7): lines come back as VectorStrips, straight-line polygons
// in strip cells (1 pen unit = 1 cell), y up from the band's outer edge, baseline at row `base`, the first word at
// the right. Justification is thuluth's own: kashida (one long elongation per word, preferring joins after tooth
// letters), then the word gaps. Lines narrower than their natural width need stacking, which is a composition, not a
// line, so layout returns null for them.
import { abjadValue } from '../kufi';
import type { LetterStyle, Prepared, ScriptEngine, Segment, Segments, VectorStrip } from '../types';
import type { Built, Thuluth } from './engine';
import { DEFAULT_THULUTH, thuluth } from './engine';
import { lineMarks } from './marks';
import type { WordMark } from './shape';
import { FAM, forms, ligate, NONJOIN, parseVowels } from './shape';
import type { Family, Poly, ThuluthStyle } from './types';

/** Room kept above the tallest ink for vowels, and below the lowest for marks under it (pen units). */
const MARK_ROOM_UP = 2.6,
  MARK_ROOM_DOWN = 1.6;
/** Longest kashida one word takes (pen units), and the share of a line's slack kashida may take. */
const KASH_MAX = 10,
  KASH_SHARE = 0.6;
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
}
interface ThuluthWord {
  text: string;
  marks: WordMark[];
}
export interface ThuluthPrepared extends Prepared {
  words: ThuluthWord[];
  /** Ink extents of the letters (pen units from the baseline), and whether the text has vowels. */
  ascent: number;
  descent: number;
  vowels: boolean;
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

/** The best join of a piece of text to elongate (its lab kashMap key), or null. */
export function kashidaJoin(text: string): number | null {
  // the name of God is never stretched (and its shadda and dagger alif hang on its letters)
  if (/^[اأٱ]?لله$/.test(text)) return null;
  const fs = forms(text);
  let best: number | null = null,
    score = 0;
  for (let i = 0; i + 1 < fs.length; i++) {
    const a = fs[i],
      b = fs[i + 1];
    if (NONJOIN.has(a.c) || (a.form !== 'ini' && a.form !== 'med') || (b.form !== 'med' && b.form !== 'fin')) continue;
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
    out: ThuluthWord[] = [];
  let cur = '',
    start = 0;
  cs.forEach((c, i) => {
    cur += c;
    if (NONJOIN.has(c) || !FAM[c] || i === cs.length - 1) {
      const n = [...cur].length,
        s0 = start;
      // the group's text keeps the ligature's letters (لا), so its marks keep their positions
      out.push({ text: cur.replace(/ﻻ/g, 'لا'), marks: w.marks.filter(m => m.li >= s0 && m.li < s0 + n).map(m => ({ li: m.li - s0, m: m.m })) }); // prettier-ignore
      start += n;
      cur = '';
    }
  });
  return out;
}

export function thuluthScript(style: ThuluthStyle = DEFAULT_THULUTH): ScriptEngine & { th: Thuluth } {
  const th = thuluth(style),
    built = new Map<string, Built>();
  const build = (text: string, kash: number | null, L: number): Built => {
    const k = `${text}|${kash}|${L}`;
    let b = built.get(k);
    if (!b) {
      b = th.buildStrokes(text, kash != null && L > 0 ? { kashMap: { [kash]: L } } : {});
      if (built.size > 4000) built.clear();
      built.set(k, b);
    }
    return b;
  };
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
    }));
  }

  return {
    id: 'thuluth',
    th,
    shape: text => ({ text }),
    prepare: (shaped, letter) => prepareLines([(shaped as { text: string }).text], letter)[0],
    prepareLines,
    segments(prepared, mode, wordGap) {
      const pieces = (prepared as ThuluthPrepared).words.flatMap(w => {
        const parts = mode === 'words' ? [w] : groupsOf(w);
        return parts.map((p, i) => ({ ...p, endsWord: i === parts.length - 1 }));
      });
      const segs: Segments<ThuluthSegment> = pieces.map(p => {
        const box = inkOf(build(p.text, null, 0)),
          w = box.x1 - box.x0;
        return {
          text: p.text,
          marks: p.marks,
          w,
          minW: Math.ceil(w),
          endsWord: p.endsWord,
          kashJoin: kashidaJoin(p.text),
        };
      });
      segs.wg = wordGap;
      return segs;
    },
    layout(segments, prepared, width, opts): VectorStrip | null {
      const P = prepared as ThuluthPrepared,
        segs = segments as Segments<ThuluthSegment>,
        n = segs.length,
        wg = segs.wg ?? opts.wordGap;
      if (!n) return null;
      const gapAfter = (i: number) => (i < n - 1 || opts.wrap ? (segs[i].endsWord ? wg : 1) : 0);
      let natural = 0;
      segs.forEach((s, i) => (natural += s.w + gapAfter(i)));
      const W = width ?? Math.ceil(natural);
      if (natural > W + 1e-6) return null;
      // the word gaps (wrapping round a circle, the closing gap too); never the breaks inside a word, which would
      // pull its pieces apart
      const wordGaps = segs.map((s, i) => (gapAfter(i) > 0 && s.endsWord ? 1 : 0) as number),
        nWord = wordGaps.reduce((a, b) => a + b, 0);
      // kashida first: an equal share for every piece with a join to stretch, within limits; with no word gap to
      // take the rest, kashida takes all it can
      const slack = W - natural,
        stretchy = segs.filter(s => s.kashJoin != null).length,
        L = stretchy ? Math.min(KASH_MAX, ((nWord ? KASH_SHARE : 1) * slack) / stretchy) : 0,
        use = L >= 0.5 ? Math.floor(L * 4) / 4 : 0;
      const pieces = segs.map(s => {
        const b = build(s.text, s.kashJoin, s.kashJoin != null ? use : 0),
          box = inkOf(b);
        return { s, b, box, w: box.x1 - box.x0 };
      });
      // then the word gaps; what no gap can take centres the line
      let used = 0;
      pieces.forEach((p, i) => (used += p.w + gapAfter(i)));
      const rest = Math.max(0, W - used),
        per = nWord ? rest / nWord : 0;
      let x = W - (opts.wrap ? (gapAfter(n - 1) + (wordGaps[n - 1] ? per : 0)) / 2 : nWord ? 0 : rest / 2);
      const paths: VectorStrip['paths'] = [];
      const fmt = (v: number) => (Math.round(v * 100) / 100).toString();
      const pathOf = (polys: Poly[], dx: number) =>
        polys.map(q => 'M' + q.map(([px, py]) => fmt(px + dx) + ' ' + fmt(py + P.base)).join('L') + 'Z').join('');
      pieces.forEach((p, i) => {
        const dx = x - p.box.x1,
          tag = (p.s.rep ?? 0) + 1;
        paths.push({ d: pathOf([...p.b.strokes.flatMap(s => th.strokePolys(s)), ...p.b.dots.flatMap(([a, b]) => th.dotPolysAt(a, b))], dx), role: 'letter', tag }); // prettier-ignore
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
      return { kind: 'vector', W, Hb: P.Hb, base: P.base, paths };
    },
    abjad: abjadValue,
    capabilities: { grid: false, seals: false, mazes: false },
  };
}

export { parsePolys } from '../vector';
