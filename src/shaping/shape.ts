import { COMB, IGNORE } from '../glyphs/marks';
import { MAP, NJ, RJ } from '../glyphs/tables';
import type { Letter, Shaped, Unit } from '../types';

const ZWNJ = '‌',
  ZWJ = '‍';
/** Whitespace and punctuation between words (not drawn, not reported). */
const SEP = /[\s،,.؛;:!?؟"'()«»﴾﴿-]/;
/** Arabic presentation forms (A: U+FB50–FDFF, B: U+FE70–FEFF): positional forms and ligatures of ordinary letters. */
const PRESENTATION = /[ﭐ-﷿ﹰ-﻾]/g;

/** Text as the shaper reads it: presentation forms as their ordinary letters (ﻻ is ل + ا, ﷲ is الله), then NFC. Only
 *  the presentation ranges are compatibility-decomposed; a spacing form of a mark (a space and the mark) keeps the
 *  mark alone, so it lands on the letter before it instead of starting a word. */
export const normalise = (text: string): string =>
  text.replace(PRESENTATION, c => c.normalize('NFKC').replace(/^ /, '')).normalize('NFC');

/** A letter of a word, with the joiners typed around it. */
interface Raw extends Letter {
  /** ZWJ right before / right after: the letter takes its joining form on that side, with or without a neighbour. */
  zp?: boolean;
  zn?: boolean;
  /** ZWNJ right after: no join to the next letter (and no word gap). */
  cut?: boolean;
}

/** Text -> words of units with joining form (ini/med/fin/iso); lam + alif becomes one LAMALEF unit. A character
 *  that is not a letter, a mark or a separator ends the word, as a separator does, and is reported as unsupported. */
export function shape(text: string): Shaped {
  const unsupported = new Set<string>(),
    words: Unit[][] = [];
  let letters: Raw[] = [],
    zwj = false; // a ZWJ since the last letter
  const flush = () => {
    zwj = false;
    if (!letters.length) return;
    const drafts: (Omit<Unit, 'form' | 'jp' | 'jn'> & { zp?: boolean; zn?: boolean })[] = [];
    for (let i = 0; i < letters.length; i++) {
      const { zp, zn, cut, ...L } = letters[i];
      if (MAP[L.c] === 'LAM' && !cut && !zn && i + 1 < letters.length && MAP[letters[i + 1].c] === 'ALEF') {
        const { c, marks } = letters[i + 1];
        drafts.push({
          key: 'LAMALEF',
          canPrev: true,
          canNext: false,
          parts: [
            { ...L, ax: 2 },
            { c, marks, ax: 0 },
          ],
          zp,
        });
        i++;
      } else
        drafts.push({
          key: MAP[L.c],
          canPrev: !NJ.has(L.c),
          canNext: !NJ.has(L.c) && !RJ.has(L.c) && !cut,
          parts: [{ ...L, ax: null }],
          zp,
          zn,
        });
    }
    words.push(
      drafts.map(({ zp, zn, ...u }, i): Unit => {
        const p = drafts[i - 1],
          n = drafts[i + 1],
          jp = !!(p && p.canNext && u.canPrev),
          jn = !!(n && u.canNext && n.canPrev),
          // a ZWJ gives the joining form on its side even with nothing joined there; jp and jn stay the real joins
          fp = jp || (!!zp && u.canPrev),
          fn = jn || (!!zn && u.canNext);
        return { ...u, jp, jn, form: fp ? (fn ? 'med' : 'fin') : fn ? 'ini' : 'iso' };
      }),
    );
    letters = [];
  };
  for (const c of normalise(text)) {
    const last = letters[letters.length - 1];
    if (MAP[c]) {
      letters.push(zwj ? { c, marks: [], zp: true } : { c, marks: [] });
      zwj = false;
    } else if (COMB[c]) {
      if (last) last.marks.push(c);
    } else if (c === ZWNJ) {
      if (last) last.cut = true;
      zwj = false;
    } else if (c === ZWJ) {
      if (last && !last.cut) last.zn = true;
      zwj = true;
    } else if (IGNORE.test(c)) {
      /* skipped */
    } else {
      if (!SEP.test(c) && c.trim()) unsupported.add(c);
      flush();
    }
  }
  flush();
  return { words, unsupported: [...unsupported] };
}
