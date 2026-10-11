import { COMB, IGNORE } from '../glyphs/marks';
import { MAP, NJ, RJ } from '../glyphs/tables';
import type { Letter, Shaped, Unit } from '../types';

/** Text -> words of units with joining form (ini/med/fin/iso); lam + alif becomes one LAMALEF unit. */
export function shape(text: string): Shaped {
  const unsupported = new Set<string>(),
    words: Unit[][] = [];
  for (const raw of text.normalize('NFC').split(/[\s،,.؛;:!?؟"'()«»-]+/)) {
    const letters: Letter[] = []; // {c, marks:[]}
    for (const c of raw) {
      if (MAP[c]) letters.push({ c, marks: [] });
      else if (COMB[c]) {
        if (letters.length) letters[letters.length - 1].marks.push(c);
      } else if (IGNORE.test(c)) {
        /* skipped */
      } else if (c.trim()) unsupported.add(c);
    }
    if (!letters.length) continue;
    const units: Unit[] = [];
    for (let i = 0; i < letters.length; i++) {
      const L = letters[i];
      if (MAP[L.c] === 'LAM' && i + 1 < letters.length && MAP[letters[i + 1].c] === 'ALEF') {
        const A = letters[i + 1];
        units.push({
          key: 'LAMALEF',
          canPrev: true,
          canNext: false,
          parts: [
            { ...L, ax: 2 },
            { ...A, ax: 0 },
          ],
        } as Unit);
        i++;
      } else
        units.push({
          key: MAP[L.c],
          canPrev: !NJ.has(L.c),
          canNext: !NJ.has(L.c) && !RJ.has(L.c),
          parts: [{ ...L, ax: null }],
        } as Unit);
    }
    units.forEach((u, i) => {
      const p = units[i - 1],
        n = units[i + 1];
      u.jp = !!(p && p.canNext && u.canPrev);
      u.jn = !!(n && u.canNext && n.canPrev);
      u.form = u.jp ? (u.jn ? 'med' : 'fin') : u.jn ? 'ini' : 'iso';
    });
    words.push(units);
  }
  return { words, unsupported: [...unsupported] };
}
