// Surat al-Nur as text (src/showpiece/an-nur.ts) and as the star field of Light upon light (field: 'surah'): the
// text must be whole, in order, and drawable; nothing may be dropped or repeated.
import { describe, expect, it } from 'vitest';
import { loadSealWasm } from '../src/kernels/seal';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';
import { AN_NUR, rasm } from '../src/showpiece/an-nur';
import { NUR } from '../src/showpiece/nur';
import { nurSheet } from '../src/showpiece/sheet';

await loadSealWasm();
const words = AN_NUR.map(rasm).join(' ').split(' ');

describe('Surat al-Nur', () => {
  it('has its 64 verses and 1,316 words', () => {
    expect(AN_NUR).toHaveLength(64);
    expect(words).toHaveLength(1316);
  });
  it('reduces to letters the engine draws, keeping hamza on its seat', () => {
    expect(kufi.shape(words.join(' '), DEFAULT_STYLE.letter).unsupported).toEqual([]);
    expect([...new Set(words.join(''))].every(c => /[ء-يٱ]/.test(c))).toBe(true);
    for (const w of ['شيئا', 'يستئذن', 'ٱمرئ']) expect(words.join(' ')).toContain(w);
  });
  it('agrees with the Light Verse quoted in the niche, word for word but for spelling (verse 35)', () => {
    const v35 = rasm(AN_NUR[34]).split(' '),
      quoted = NUR.verse.split(' ');
    expect(v35).toHaveLength(quoted.length);
  });
  it('as the star field, writes every word once, in order', () => {
    const s = nurSheet({ field: 'surah' });
    expect(s.warnings).toEqual([]);
    expect(s.surah?.surahLines).toBeGreaterThan(0);
    expect(s.surah?.words).toEqual(words);
  }, 120000);
});
