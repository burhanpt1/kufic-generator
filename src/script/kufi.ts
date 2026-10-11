// The Kufi script engine: the existing cell-grid engine (src/glyphs, src/shaping, src/layout) behind ScriptEngine.
import { abjad as abjadBase } from '../abjad';
import { setVariants } from '../glyphs/overrides';
import { repeatSegs } from '../layout/solvers';
import { RHY, strip } from '../layout/strip';
import { markTerminals } from '../layout/terminals';
import { breakSegs, prepare, wordSegs } from '../shaping/prepare';
import { shape } from '../shaping/shape';
import type { Seg, Segs, Shaped, Word } from '../types';
import type { CellStrip, LayoutOptions, LetterStyle, ScriptEngine, Segments } from './types';

const variants = (s: LetterStyle) => ({ ra: s.ra, ayn: s.ayn, la: s.lamAlif });

const MAGHRIBI: Record<string, number> = { 'ص': 60, 'ض': 90, 'س': 300, 'ظ': 800, 'غ': 900, 'ش': 1000 }; // prettier-ignore
const ARABIC_VALUE: Record<string, number> = { 'ص': 90, 'ض': 800, 'س': 60, 'ظ': 900, 'غ': 1000, 'ش': 300 }; // prettier-ignore

export function abjadValue(text: string, opts: { taMarbuta?: 5 | 400; system?: 'mashriqi' | 'maghribi' } = {}): number {
  let v = abjadBase(text);
  const tm = opts.taMarbuta ?? 5;
  for (const c of text.normalize('NFC')) {
    if (tm !== 5 && (c === 'ة' || c === 'ۃ')) v += tm - 5;
    if (opts.system === 'maghribi' && MAGHRIBI[c] != null) v += MAGHRIBI[c] - ARABIC_VALUE[c];
  }
  return v;
}

export const kufi: ScriptEngine = {
  id: 'kufi',
  shape(text, style) {
    setVariants(variants(style));
    return shape(text);
  },
  prepare(shaped: Shaped, style) {
    setVariants(variants(style));
    const p = prepare(shaped.words, style.ascenders, style.marks, style.vowels);
    return { words: p.words, Hb: p.Hb, base: p.base, ascenders: style.ascenders };
  },
  prepareLines(lines, style) {
    setVariants(variants(style));
    const all = shape(lines.join(' ')),
      p = prepare(all.words, style.ascenders, style.marks, style.vowels);
    let wi = 0;
    return lines.map(l => {
      const n = shape(l).words.length,
        words = p.words.slice(wi, wi + n);
      wi += n;
      return { words, Hb: p.Hb, base: p.base, ascenders: style.ascenders };
    });
  },
  segments(prepared, mode, wordGap) {
    const words = prepared.words as Word[],
      s: Segs = mode === 'words' ? wordSegs(words) : breakSegs(words);
    s.wg = wordGap;
    return s;
  },
  layout(segments, prepared, width, opts: LayoutOptions): CellStrip | null {
    const { Hb, base, ascenders } = prepared;
    RHY.on = opts.rhythm;
    const st = strip(segments as Seg[], Hb, base, opts.wordGap, width, opts.wrap);
    if (!st) return null;
    const t = opts.terminals,
      minTop = t === 'tall' || t === 'tails' ? base + ascenders - 1 : t === 'all' ? base + 2 : Infinity;
    markTerminals(st, Hb, minTop, t === 'tails', base);
    return { kind: 'cells', W: st.W, Hb, base, data: st.data, tag: st.tag };
  },
  abjad: abjadValue,
  capabilities: { grid: true, seals: true, mazes: true },
};

/** Repeat a segment list (whole repeats, each tagged with its repeat index). */
export const repeat = <S extends Segments>(s: S, n: number): S => repeatSegs(s as unknown as Segs, n) as unknown as S;
