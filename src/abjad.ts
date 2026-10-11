import { MAP } from './glyphs/tables';

export const ABJAD: Record<string, number> = {
  'ا': 1, 'أ': 1, 'إ': 1, 'آ': 1, 'ٱ': 1, 'ء': 1, 'ب': 2, 'پ': 2, 'ج': 3, 'چ': 3, 'د': 4, 'ه': 5, 'ة': 5, 'ۃ': 5, 'ہ': 5, 'ھ': 5,
  'و': 6, 'ؤ': 6, 'ز': 7, 'ژ': 7, 'ح': 8, 'ط': 9, 'ي': 10, 'ى': 10, 'ئ': 10, 'ی': 10, 'ے': 10, 'ك': 20, 'ک': 20, 'گ': 20,
  'ل': 30, 'م': 40, 'ن': 50, 'ں': 50, 'س': 60, 'ع': 70, 'ف': 80, 'ص': 90, 'ق': 100, 'ر': 200, 'ڑ': 200,
  'ش': 300, 'ت': 400, 'ٹ': 400, 'ث': 500, 'خ': 600, 'ذ': 700, 'ڈ': 4, 'ض': 800, 'ظ': 900, 'غ': 1000,
}; // prettier-ignore
/** Abjad (numerical) value of a text; ة counts as 5. */
export const abjad = (text: string) => [...text.normalize('NFC')].reduce((a, c) => a + (ABJAD[c] || 0), 0);

const NORM: Record<string, string> = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ؤ': 'و', 'ئ': 'ي', 'ى': 'ي' }; // prettier-ignore
/** The phrase's distinct letters, in order of first appearance, space-separated (so they shape as isolated forms). */
export function uniqueLetters(text: string): string {
  const seen: string[] = [],
    set = new Set<string>();
  for (const c0 of text.normalize('NFC')) {
    const c = NORM[c0] || c0;
    if (MAP[c] && c !== 'ـ' && !set.has(c)) {
      set.add(c);
      seen.push(c);
    }
  }
  return seen.join(' ');
}
