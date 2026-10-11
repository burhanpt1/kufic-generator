// Chronograms (ta'rikh): phrases whose letters add up to a year. Ported from the lab's chronogram tab; the counting
// conventions are explicit settings (COMPOSITION_ENGINE.md §10: ة as 5 or 400 must be visible, not a default).
import { ABJAD } from '../abjad';
import type { Style } from '../model/schema';

export type AbjadOptions = Style['abjad'];
const MAGHRIBI: Record<string, number> = { 'ص': 60, 'ض': 90, 'س': 300, 'ظ': 800, 'غ': 900, 'ش': 1000 }; // prettier-ignore

/** The letter → value table for a counting system. */
export function abjadTable(o: AbjadOptions): Record<string, number> {
  const t = { ...ABJAD };
  if (o.system === 'maghribi') Object.assign(t, MAGHRIBI);
  t['ة'] = t['ۃ'] = o.taMarbuta;
  return t;
}
export const valueOf = (s: string, T: Record<string, number>) =>
  [...s.normalize('NFC')].reduce((a, c) => a + (T[c] || 0), 0);
/** Each counted letter with its value; whitespace kept as null so a breakdown can show word gaps. */
export const breakdown = (s: string, T: Record<string, number>) =>
  [...s.normalize('NFC')].filter(c => T[c] || /\s/.test(c)).map(c => (/\s/.test(c) ? null : { c, v: T[c] }));

/** Word bank categories (lab CATS). */
export const CATEGORIES: Record<string, string> = {
  'Ahl al-Bayt': 'محمد علي فاطمة الحسن الحسين زينب العباس جعفر موسى الرضا المهدي حسن حسين',
  'Divine names':
    'الله الرحمن الرحيم الملك القدوس السلام المؤمن العزيز الجبار الخالق الغفار الوهاب الرزاق الفتاح العليم اللطيف الخبير الحليم العظيم الغفور الشكور العلي الكبير الحفيظ الكريم المجيب الواسع الحكيم الودود المجيد الحق القوي الولي الحميد الحي القيوم الواحد الاحد الصمد النور الهادي الباقي',
  Prophets: 'آدم نوح ابراهيم اسماعيل اسحاق يعقوب يوسف موسى هارون داود سليمان يونس عيسى',
  Blessings: 'نور رحمة سلام بركة خير فتح نصر هدى امان صبر شكر حب ذكر سعادة فرح كرم عز مجد جمال طيب زين بهجة',
  Occasions: 'ولد ولادة مولود زواج عرس بيت دار بناء مسجد سفر حج عيد تم ختم جديد مبارك قدوم',
  'Small words': 'يا في من و قد هذا على له به لنا',
};
export const DEFAULT_CATEGORIES = ['Ahl al-Bayt', 'Blessings', 'Occasions', 'Small words'];

export interface Word {
  w: string;
  v: number;
}
/** Distinct words from the chosen categories plus the user's own, with their values (zero-valued words dropped). */
export function wordBank(categories: Iterable<string>, extra: string, T: Record<string, number>): Word[] {
  const ws = [...categories].flatMap(c => (CATEGORIES[c] ?? '').split(' ')).concat(extra.split(/\s+/));
  return [...new Set(ws.filter(Boolean))].map(w => ({ w, v: valueOf(w, T) })).filter(x => x.v > 0);
}

// Hijri year beginning during Gregorian year g, and the CE year a Hijri year begins (lab approximations).
export const ahStartCE = (h: number) => 621.5643 + 0.970229 * h;
export const ahFromCE = (g: number) => Math.floor((g + 1 - 621.5643) / 0.970229);

/** Combinations of up to k distinct bank words summing to n, fewest words first (pairs indexed by sum). */
export function combos(words: Word[], n: number, k: number, limit = 300): Word[][] {
  const out: Word[][] = [],
    bySum = new Map<number, [number, number][]>();
  for (const a of words) if (a.v === n) out.push([a]);
  if (k >= 2)
    for (let i = 0; i < words.length; i++)
      for (let j = i + 1; j < words.length; j++) {
        const s = words[i].v + words[j].v;
        if (s === n) out.push([words[i], words[j]]);
        if (s < n) {
          if (!bySum.has(s)) bySum.set(s, []);
          bySum.get(s)!.push([i, j]);
        }
      }
  if (k >= 3)
    for (let i = 0; i < words.length && out.length < limit; i++)
      for (const [a, b] of bySum.get(n - words[i].v) ?? [])
        if (a > i && out.length < limit) out.push([words[i], words[a], words[b]]);
  if (k >= 4)
    for (const [s, ps] of bySum) {
      if (out.length >= limit) break;
      const qs = bySum.get(n - s);
      if (!qs) continue;
      for (const [a, b] of ps)
        for (const [c, d] of qs) if (c > b && out.length < limit) out.push([words[a], words[b], words[c], words[d]]);
    }
  return out.slice(0, limit).sort((x, y) => x.length - y.length);
}

export interface Suggestion {
  phrase: string;
  kind: 'add' | 'swap' | 'find';
  words: Word[];
  /** For swaps: the word replaced. */
  replaced?: string;
}
/** Ways to make a phrase add up to the target: words to add (when short), then single-word swaps. */
export function complete(phrase: string, target: number, bank: Word[], T: Record<string, number>): Suggestion[] {
  const s = phrase.trim(),
    d = target - valueOf(s, T),
    out: Suggestion[] = [];
  if (!s || d === 0) return out;
  if (d > 0)
    for (const ws of combos(bank, d, 3, 150))
      out.push({ phrase: s + ' ' + ws.map(x => x.w).join(' '), kind: 'add', words: ws });
  const mine = s.split(/\s+/);
  mine.forEach((w, i) => {
    const need = valueOf(w, T) + d;
    for (const x of bank.filter(x => x.v === need && x.w !== w).slice(0, 12)) {
      const p = mine.slice();
      p[i] = x.w;
      out.push({ phrase: p.join(' '), kind: 'swap', words: [x], replaced: w });
    }
  });
  return out;
}
/** Phrases from the bank worth exactly the target, optionally around a word that must appear. */
export function find(target: number, bank: Word[], T: Record<string, number>, maxWords = 3, must = ''): Suggestion[] {
  const m = must.trim(),
    mv = m ? valueOf(m, T) : 0;
  if (mv > target) return [];
  const k = Math.max(1, maxWords - (m ? 1 : 0)),
    res =
      m && mv === target
        ? [[]]
        : combos(
            bank.filter(x => x.w !== m),
            target - mv,
            k,
          );
  return res.slice(0, 150).map(ws => ({
    phrase: [m, ...ws.map(x => x.w)].filter(Boolean).join(' '),
    kind: 'find' as const,
    words: m ? [{ w: m, v: mv }, ...ws] : ws,
  }));
}
