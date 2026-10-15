// Thuluth shaping (lab engine3.js, roundel.js, tarkib.js): letters to families and joining forms, the lam-alif
// ligature, vowel marks split from the letters, and words cut into their connected groups.
import type { Family, Form } from './types';

export const LAM_ALIF = 'ﻻ';
/** Letter → family. */
export const FAM: Record<string, Family> = {
  'ا': 'alif', 'أ': 'alif', 'إ': 'alif', 'آ': 'alif', 'ٱ': 'alif', 'ل': 'lam', 'ب': 'tooth', 'ت': 'tooth', 'ث': 'tooth',
  'ي': 'tooth', 'ى': 'tooth', 'ئ': 'tooth', 'س': 'sin', 'ش': 'sin', 'م': 'mim', 'ه': 'ha', 'ة': 'ha', 'ر': 'ra', 'ز': 'ra',
  'ح': 'hah', 'ج': 'hah', 'خ': 'hah', 'ن': 'nun', 'د': 'dal', 'ذ': 'dal', 'و': 'waw', 'ؤ': 'waw', 'ك': 'kaf', 'ع': 'ain',
  'غ': 'ain', 'ف': 'fa', 'ق': 'qaf', 'ص': 'sad', 'ض': 'sad', 'ط': 'ta', 'ظ': 'ta', [LAM_ALIF]: 'lamalif',
}; // prettier-ignore
/** Forms with their own family: final and isolated ya, and initial and medial nun (a tooth). */
export const FORM_FAM: Record<string, Family> = {
  'ن|ini': 'tooth', 'ن|med': 'tooth', 'ي|fin': 'ya', 'ي|iso': 'ya', 'ى|fin': 'ya', 'ى|iso': 'ya', 'ئ|fin': 'ya', 'ئ|iso': 'ya',
}; // prettier-ignore
/** Letters that never join the next one. */
export const NONJOIN = new Set([...'اأإآٱدذرزوؤة', LAM_ALIF]);
/** Dots per letter: [side (1 above, −1 below), count]. */
export const DOTS: Record<string, [number, number][]> = {
  'ف': [[1, 1]], 'ق': [[1, 2]], 'ض': [[1, 1]], 'ظ': [[1, 1]], 'غ': [[1, 1]], 'ب': [[-1, 1]], 'ت': [[1, 2]], 'ث': [[1, 3]],
  'ن': [[1, 1]], 'ي': [[-1, 2]], 'ش': [[1, 3]], 'ج': [[-1, 1]], 'خ': [[1, 1]], 'ز': [[1, 1]], 'ذ': [[1, 1]], 'ة': [[1, 2]],
}; // prettier-ignore
export const familyOf = (c: string, form: Form): Family | undefined => FORM_FAM[c + '|' + form] || FAM[c];

/** The ligature: lam followed by any alif becomes one letter. */
export const ligate = (w: string) => w.replace(/ل(?=[اأإآ])./g, LAM_ALIF);

export interface Shaped {
  c: string;
  form: Form;
}
/** Joining forms of one word. */
export function forms(word: string): Shaped[] {
  const cs = [...ligate(word)],
    out: Shaped[] = [];
  for (let i = 0; i < cs.length; i++) {
    const prevJ = i > 0 && !NONJOIN.has(cs[i - 1]) && FAM[cs[i - 1]],
      nextJ = i < cs.length - 1 && !NONJOIN.has(cs[i]) && FAM[cs[i + 1]];
    out.push({ c: cs[i], form: prevJ && nextJ ? 'med' : prevJ ? 'fin' : nextJ ? 'ini' : 'iso' });
  }
  return out;
}

// ---- vowel marks ----
export const HARAKAT: Record<string, MarkName> = {
  'َ': 'fatha', 'ِ': 'kasra', 'ُ': 'damma', 'ّ': 'shadda', 'ْ': 'sukun', 'ً': 'fathatan', 'ٍ': 'kasratan', 'ٌ': 'dammatan', 'ٰ': 'alifk',
}; // prettier-ignore
export type MarkName =
  | 'fatha' | 'kasra' | 'damma' | 'shadda' | 'sukun' | 'fathatan' | 'kasratan' | 'dammatan' | 'alifk' | 'hamza' | 'hamzaB'
  | 'madda'; // prettier-ignore
export const BELOW = new Set<MarkName>(['kasra', 'kasratan', 'hamzaB']);
/** Letters written as a seat plus a mark. */
const SEATS: Record<string, [string, MarkName]> = {
  'أ': ['ا', 'hamza'], 'إ': ['ا', 'hamzaB'], 'ؤ': ['و', 'hamza'], 'ئ': ['ى', 'hamza'], 'آ': ['ا', 'madda'],
}; // prettier-ignore
export interface WordMark {
  /** Letter position in the word, after the lam-alif ligature. */
  li: number;
  m: MarkName;
}
/** The bare text and, per word, its marks keyed by letter position. */
export function parseVowels(text: string): { bare: string; marks: WordMark[][] } {
  const words = text.trim().split(/\s+/),
    bare: string[] = [],
    marks: WordMark[][] = [];
  words.forEach(w => {
    let base = '',
      li = -1,
      prev = '';
    const ms: WordMark[] = [];
    for (let ch of w) {
      if (HARAKAT[ch]) {
        ms.push({ li, m: HARAKAT[ch] });
        continue;
      }
      let seat: MarkName | null = null;
      if (SEATS[ch]) {
        seat = SEATS[ch][1];
        ch = SEATS[ch][0];
      }
      if (seat) ms.push({ li: li + (ch === 'ا' && prev === 'ل' ? 0 : 1), m: seat });
      if (ch === 'ا' && prev === 'ل') {
        prev = ch;
        base += ch;
        continue;
      }
      li++;
      base += ch;
      prev = ch;
    }
    bare.push(base);
    marks.push(ms);
  });
  return { bare: bare.join(' '), marks };
}

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
      const allahWord = /^[اأٱ]?لله$/.test(w),
        cs = [...ligate(w)];
      let cur = '';
      cs.forEach((c, i) => {
        cur += c;
        if (NONJOIN.has(c) || !FAM[c] || i === cs.length - 1) {
          out.push({ s: cur, word: wi, allah: allahWord && cur.startsWith('ل') });
          cur = '';
        }
      });
    });
  return out;
}
