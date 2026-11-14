// Shared by the output-identity tests of the performance work (word-block seals, flow fill, line fill): a seeded
// generator of inputs and a digest of results. Each test pins the digest of a compact set of cases; with
// IDENTITY_OUT=<dir> it also runs a broad fuzz and writes one digest per case there, to compare two implementations
// (run before and after a change, then diff the files).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const pick = <T>(R: () => number, xs: readonly T[]): T => xs[Math.floor(R() * xs.length)];

/** Every number in full (JSON round-trips doubles exactly), typed arrays as plain arrays. */
export const digest = (v: unknown): string =>
  createHash('sha256')
    .update(
      JSON.stringify(v, (_, x: unknown) =>
        ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x instanceof Set ? [...x] : x,
      ) ?? 'undefined',
    )
    .digest('hex');

export const FUZZ_OUT = process.env.IDENTITY_OUT;
/** Write the broad fuzz's digests (case label -> digest), one per line. */
export function writeDigests(name: string, rows: [string, string][]) {
  if (!FUZZ_OUT) return;
  mkdirSync(FUZZ_OUT, { recursive: true });
  writeFileSync(join(FUZZ_OUT, name + '.txt'), rows.map(r => r.join('\t')).join('\n') + '\n');
}

/** Words of every kind: short, long, with dots, vocalised, with lam-alif, hamza forms, punctuation, a tatweel, and
 *  characters the engine doesn't draw. */
export const VOCAB = [
  'يا', 'علي', 'مدد', 'محمد', 'بسم', 'الله', 'الرحمن', 'الرحيم', 'لا', 'اله', 'الا', 'الحمد', 'لله', 'رب', 'العالمين',
  'اكبر', 'ولي', 'نور', 'على', 'فاطمة', 'الحسن', 'الحسين', 'هو', 'الحي', 'القيوم', 'تأخذه', 'سنة', 'ولا', 'نوم', 'له',
  'ما', 'في', 'السماوات', 'وما', 'الأرض', 'من', 'ذا', 'الذي', 'يشفع', 'عنده', 'بإذنه', 'يعلم', 'بين', 'أيديهم', 'خلفهم',
  'يحيطون', 'بشيء', 'علمه', 'بما', 'شاء', 'وسع', 'كرسيه', 'يئوده', 'حفظهما', 'وهو', 'العلي', 'العظيم', 'زدني', 'علما',
  'لطيف', 'صل', 'وآل', 'اللهم', 'انما', 'يريد', 'ليذهب', 'عنكم', 'الرجس', 'اهل', 'البيت', 'ويطهركم', 'تطهيرا', 'ق', 'ن',
  'و', 'ا', 'ء', 'طه', 'يس', 'ص', 'كهيعص', 'خدا', 'حافظ', 'العلم', 'ظل', 'غفور', 'شكور', 'ضحى', 'ثم', 'جزاء', 'مؤمن',
  'بِسْمِ', 'ٱللَّهِ', 'ٱلرَّحْمَٰنِ', 'ٱلرَّحِيمِ', 'مُحَمَّدٌ', 'عَلِيٌّ', 'نُورٌ', 'قُلْ', 'هُوَ', 'أَحَدٌ',
  'الله،', 'علي-ولي', 'نور.', '(محمد)', 'ـ', 'پاک', 'گل', 'چشم', 'ڤ', 'aب', 'سـلام', 'لالا', 'لأ', 'لإله', 'الآ',
] as const; // prettier-ignore
export const words = (R: () => number, n: number): string[] => Array.from({ length: n }, () => pick(R, VOCAB));
