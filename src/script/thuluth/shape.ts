// Thuluth shaping (lab engine3.js, roundel.js, tarkib.js): letters to families and joining forms, the lam-alif
// ligature, vowel marks split from the letters, and words cut into their connected groups.
import type { Family, Form } from './types';

export const LAM_ALIF = 'ﻻ';
/** Letter → family. */
export const FAM: Record<string, Family> = {
  'ا': 'alif', 'أ': 'alif', 'إ': 'alif', 'آ': 'alif', 'ٱ': 'alif', 'ل': 'lam', 'ب': 'tooth', 'ت': 'tooth', 'ث': 'tooth',
  'ي': 'tooth', 'ى': 'tooth', 'ئ': 'tooth', 'س': 'sin', 'ش': 'sin', 'م': 'mim', 'ه': 'ha', 'ة': 'ha', 'ر': 'ra', 'ز': 'ra',
  'ح': 'hah', 'ج': 'hah', 'خ': 'hah', 'ن': 'nun', 'د': 'dal', 'ذ': 'dal', 'و': 'waw', 'ؤ': 'waw', 'ك': 'kaf', 'ع': 'ain',
  'غ': 'ain', 'ف': 'fa', 'ق': 'qaf', 'ص': 'sad', 'ض': 'sad', 'ط': 'ta', 'ظ': 'ta', [LAM_ALIF]: 'lamalif', 'ء': 'hamza',
}; // prettier-ignore
/** Forms with their own family: final and isolated ya, and initial and medial nun (a tooth). */
export const FORM_FAM: Record<string, Family> = {
  'ن|ini': 'tooth', 'ن|med': 'tooth', 'ي|fin': 'ya', 'ي|iso': 'ya', 'ى|fin': 'ya', 'ى|iso': 'ya', 'ئ|fin': 'ya', 'ئ|iso': 'ya',
}; // prettier-ignore
/** Letters that never join the next one, and the one that the letter before never joins either. */
export const NONJOIN = new Set([...'اأإآٱدذرزوؤةء', LAM_ALIF]);
const ALONE = 'ء';
/** Dots per letter: [side (1 above, −1 below), count]. */
export const DOTS: Record<string, [number, number][]> = {
  'ف': [[1, 1]], 'ق': [[1, 2]], 'ض': [[1, 1]], 'ظ': [[1, 1]], 'غ': [[1, 1]], 'ب': [[-1, 1]], 'ت': [[1, 2]], 'ث': [[1, 3]],
  'ن': [[1, 1]], 'ي': [[-1, 2]], 'ش': [[1, 3]], 'ج': [[-1, 1]], 'خ': [[1, 1]], 'ز': [[1, 1]], 'ذ': [[1, 1]], 'ة': [[1, 2]],
}; // prettier-ignore
export const familyOf = (c: string, form: Form): Family | undefined => FORM_FAM[c + '|' + form] || FAM[c];

/** The ligature: lam followed by any alif becomes one letter. */
export const ligate = (w: string) => w.replace(/ل(?=[اأإآٱ])./g, LAM_ALIF);

export interface Shaped {
  c: string;
  form: Form;
}
/** Joining forms of one word. */
export function forms(word: string): Shaped[] {
  const cs = [...ligate(word)],
    out: Shaped[] = [];
  for (let i = 0; i < cs.length; i++) {
    const prevJ = i > 0 && !NONJOIN.has(cs[i - 1]) && cs[i] !== ALONE && FAM[cs[i - 1]],
      nextJ = i < cs.length - 1 && !NONJOIN.has(cs[i]) && cs[i + 1] !== ALONE && FAM[cs[i + 1]];
    out.push({ c: cs[i], form: prevJ && nextJ ? 'med' : prevJ ? 'fin' : nextJ ? 'ini' : 'iso' });
  }
  return out;
}

// ---- vowel marks ----
export const HARAKAT: Record<string, MarkName> = {
  'َ': 'fatha', 'ِ': 'kasra', 'ُ': 'damma', 'ّ': 'shadda', 'ْ': 'sukun', 'ً': 'fathatan', 'ٍ': 'kasratan', 'ٌ': 'dammatan', 'ٰ': 'alifk',
  // the Uthmani sukun and open tanwin, and the combining madda and hamza (a seat's mark typed apart from its seat)
  '\u06E1': 'sukun', '\u08F0': 'fathatan', '\u08F1': 'dammatan', '\u08F2': 'kasratan', '\u0653': 'madda', '\u0654': 'hamza', '\u0655': 'hamzaB',
}; // prettier-ignore
export type MarkName =
  | 'fatha' | 'kasra' | 'damma' | 'shadda' | 'sukun' | 'fathatan' | 'kasratan' | 'dammatan' | 'alifk' | 'hamza' | 'hamzaB'
  | 'madda'; // prettier-ignore
export const BELOW = new Set<MarkName>(['kasra', 'kasratan', 'hamzaB']);
/** Letters written as a seat plus a mark. */
const SEATS: Record<string, [string, MarkName]> = {
  'أ': ['ا', 'hamza'], 'إ': ['ا', 'hamzaB'], 'ؤ': ['و', 'hamza'], 'ئ': ['ى', 'hamza'], 'آ': ['ا', 'madda'],
}; // prettier-ignore
/** Letters of Persian and Urdu spelling, written here with the Arabic letter of the same shape. Persian ye (ی) is
 *  taken by position: with its dots before another letter (ي), without them at the end of a word (ى). */
const ALIKE: Record<string, string> = { ک: 'ك', ھ: 'ه', ہ: 'ه' };
const YEH_FARSI = 'ی';
/** Left out without a word, as they add nothing a reader would miss: tatweel, combining marks with no shape here,
 *  Quranic annotation signs and format controls. */
const SILENT = /\p{M}|\p{Cf}|\u0640|[\u06DD-\u06DE\u06E5-\u06E6\u06E9]/u;
const isLetterChar = (ch: string) => ch === YEH_FARSI || !!(FAM[ALIKE[ch] ?? ch] || SEATS[ch]);

export interface WordMark {
  /** Letter position in the word, after the lam-alif ligature. */
  li: number;
  m: MarkName;
}
/** The bare text and, per word, its marks keyed by letter position. The text is normalised on the way: every letter
 *  of `bare` is one the script writes (so nothing cuts a join or leaves a hole in the line), look-alike letters of
 *  other spellings become ours, tatweel and marks with no shape are left out, and what could not be written at all
 *  (digits, punctuation, letters of other scripts) is listed in `dropped`. A word with no letters left is no word. */
export function parseVowels(text: string): { bare: string; marks: WordMark[][]; dropped: string[] } {
  const words = text.trim().split(/\s+/),
    bare: string[] = [],
    marks: WordMark[][] = [],
    dropped = new Set<string>();
  words.forEach(w => {
    let base = '',
      li = -1,
      prev = '';
    const ms: WordMark[] = [],
      chars = [...w];
    for (let i = 0; i < chars.length; i++) {
      let ch = chars[i];
      if (HARAKAT[ch]) {
        ms.push({ li, m: HARAKAT[ch] });
        continue;
      }
      if (ch === YEH_FARSI) ch = chars.slice(i + 1).some(isLetterChar) ? 'ي' : 'ى';
      ch = ALIKE[ch] ?? ch;
      if (!FAM[ch] && !SEATS[ch]) {
        if (!SILENT.test(ch)) dropped.add(ch);
        continue;
      }
      let seat: MarkName | null = null;
      if (SEATS[ch]) {
        seat = SEATS[ch][1];
        ch = SEATS[ch][0];
      }
      const lamAlif = (ch === 'ا' || ch === 'ٱ') && prev === 'ل';
      if (seat) ms.push({ li: li + (lamAlif ? 0 : 1), m: seat });
      if (lamAlif) {
        prev = ch;
        base += ch;
        continue;
      }
      li++;
      base += ch;
      prev = ch;
    }
    if (!base) return;
    bare.push(base);
    marks.push(ms);
  });
  return { bare: bare.join(' '), marks, dropped: [...dropped] };
}
/** The characters of a text that the script cannot write, and leaves out (parseVowels). */
export const unsupportedChars = (text: string): string[] => parseVowels(text).dropped;

/** Where the name of God stands in a word: its first lam (a letter position, as marks have them), with the second lam
 *  and the heh following; `final` when the heh ends the word (اللهم has a medial heh). */
export interface AllahSpan {
  lam: number;
  final: boolean;
}
// الله, with its alif in any form or (لله) without it; after و ف and ب ت ك (والله, بالله, فبالله, ولله, فلله); as
// اللهم; and closing a name written as one word (عبدالله, نصرالله). The heh must end the word (or the mim of اللهم),
// and لله with no alif takes only و or ف before it, so اللهب, اللهو, كللها and ظلله are not it.
const ALLAH = /^((?:\p{L}{2,}|[وف]?[بتك]?)[اٱ]|[أآ]|[وف]?)لله(م?)$/u;
/** The name of God in a word (with or without its vowels), or null: the one test for it, shared by the ligature, its
 *  shadda, the roundel's groups, kashida and the mirror's refusal. */
export function allahSpan(word: string): AllahSpan | null {
  const m = ALLAH.exec(word.replace(/[\p{Mn}ـ]/gu, ''));
  return m && { lam: [...m[1]].length, final: !m[2] };
}

/** Whether the pen lifts after letter i of a word's letters (lam-alif ligated): the end of a connected group. */
export const endsGroup = (cs: readonly string[], i: number) =>
  NONJOIN.has(cs[i]) || !FAM[cs[i]] || i === cs.length - 1 || cs[i + 1] === ALONE;

/** A connected letter group: what the pen writes without lifting. */
export interface Group {
  s: string;
  word: number;
  /** The name of God (its lam group gets the shadda and dagger alif). */
  allah: boolean;
}
export function splitGroups(text: string): Group[] {
  const out: Group[] = [];
  text
    .trim()
    .split(/\s+/)
    .forEach((w, wi) => {
      const name = allahSpan(w),
        cs = [...ligate(w)];
      let cur = '',
        start = 0;
      cs.forEach((c, i) => {
        cur += c;
        if (endsGroup(cs, i)) {
          // the group that holds the name's lams
          out.push({ s: cur, word: wi, allah: !!name && name.lam >= start && name.lam <= i });
          cur = '';
          start = i + 1;
        }
      });
    });
  return out;
}
