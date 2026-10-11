// Dots, hamza and harakat: mark shapes (rows top -> bottom) and which letters / combining chars produce them.

export const S: Record<string, string[]> = {
  d1: ['#'],
  d2: ['#.#'],
  d3a: ['.#.', '#.#'],
  d3b: ['#.#', '.#.'],
  tah: ['#..', '###'],
  fatha: ['##'],
  kasra: ['##'],
  damma: ['##', '##', '.#'],
  sukun: ['###', '#.#', '###'],
  shadda: ['#.#.#', '#####'],
  fathatan: ['##', '..', '##'],
  kasratan: ['##', '..', '##'],
  dammatan: ['##.##', '##.##', '.#..#'],
  salef: ['#', '#', '#'],
  hamza: ['##', '#.', '##'],
  madda: ['##.', '.##'],
  wasla: ['##', '.#'],
  v2: ['#', '.', '#'],
};
/** 'side:shape' with side a = above, b = below; a trailing * means only in initial and medial forms. */
export const DOTS: Record<string, string> = {
  'ب': 'b:d1', 'ت': 'a:d2', 'ث': 'a:d3a', 'پ': 'b:d3b', 'ٹ': 'a:tah', 'ن': 'a:d1', 'ي': 'b:d2', 'ی': 'b:d2*', 'ې': 'b:v2*',
  'ج': 'b:d1', 'خ': 'a:d1', 'چ': 'b:d3b', 'ذ': 'a:d1', 'ڈ': 'a:tah', 'ز': 'a:d1', 'ڑ': 'a:tah', 'ژ': 'a:d3a',
  'ش': 'a:d3a', 'ض': 'a:d1', 'ظ': 'a:d1', 'غ': 'a:d1', 'ف': 'a:d1', 'ڤ': 'a:d3a', 'ق': 'a:d2', 'ة': 'a:d2', 'ۃ': 'a:d2',
}; // prettier-ignore
export const HAMZA_ON: Record<string, string> = {
  'أ': 'a:hamza', 'ؤ': 'a:hamza', 'ئ': 'a:hamza', 'إ': 'b:hamza', 'آ': 'a:madda', 'ٱ': 'a:wasla',
}; // prettier-ignore
/** Combining marks: [side, shape, layer]. layer: 1 = consonantal (ink), 2 = vocalic (mark colour). */
export const COMB: Record<string, [string, string, number]> = {
  'َ': ['a', 'fatha', 2], 'ُ': ['a', 'damma', 2], 'ِ': ['b', 'kasra', 2],
  'ً': ['a', 'fathatan', 2], 'ٌ': ['a', 'dammatan', 2], 'ٍ': ['b', 'kasratan', 2],
  'ّ': ['a', 'shadda', 2], 'ْ': ['a', 'sukun', 2], 'ٰ': ['a', 'salef', 2],
  'ٓ': ['a', 'madda', 1], 'ٔ': ['a', 'hamza', 1], 'ٕ': ['b', 'hamza', 1],
}; // prettier-ignore
/** Stacking order: dots nearest the letter, then hamza/madda/wasla, shadda, vowels. */
export const ORDER: Record<string, number> = {
  d1: 0, d2: 0, d3a: 0, d3b: 0, tah: 0, v2: 0, hamza: 1, madda: 1, wasla: 1, shadda: 2,
  fatha: 3, damma: 3, sukun: 3, fathatan: 3, dammatan: 3, salef: 3, kasra: 3, kasratan: 3,
}; // prettier-ignore
/** Quranic annotation marks and joiners, skipped silently. */
export const IGNORE = /[ؐ-ؚٖ-ٟۖ-ۭ‌‍]/;
