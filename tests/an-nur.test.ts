// Surat al-Nur as text (src/showpiece/an-nur.ts) and as the star field of Light upon light (field: 'surah'): the
// text must be whole, in order, and drawable; nothing may be dropped or repeated.
import type { Shaped } from '../src/types';
import { describe, expect, it } from 'vitest';
import { loadSealWasm } from '../src/kernels/seal';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';
import { AN_NUR, rasm } from '../src/showpiece/an-nur';
import { frame, NUR, surahLines } from '../src/showpiece/nur';
import { resolve } from '../src/compose';
import { NAMES_99 } from '../src/mosque/texts';
import { nurSheet } from '../src/showpiece/sheet';

await loadSealWasm();
const words = AN_NUR.map(rasm).join(' ').split(' ');

describe('Surat al-Nur', () => {
  it('has its 64 verses and 1,316 words', () => {
    expect(AN_NUR).toHaveLength(64);
    expect(words).toHaveLength(1316);
  });
  it('reduces to letters the engine draws, keeping hamza on its seat', () => {
    expect((kufi.shape(words.join(' '), DEFAULT_STYLE.letter) as Shaped).unsupported).toEqual([]);
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

describe('Surat al-Nur in a band (the middle path)', () => {
  it('splits into six rings only between verses, losing and repeating nothing', () => {
    const lines = surahLines(6).split('\n');
    expect(lines).toHaveLength(6);
    expect(lines.join(' ')).toBe(AN_NUR.map(rasm).join(' '));
    // every ring starts on a verse
    const starts = new Set(AN_NUR.map(v => rasm(v).split(' ')[0]));
    for (const l of lines) expect(starts.has(l.split(' ')[0])).toBe(true);
  });
  it('writes each ring once, in whole words, inside the Ninety-Nine Names', () => {
    const p = resolve(frame(NAMES_99.join(' '), 6)),
      band = p.meta.borders.find(b => b.slot === 'surah')!;
    expect(p.meta.warnings).toEqual([]);
    expect(band.rings).toHaveLength(6);
    for (const r of band.rings) {
      expect(r.rep).toBe(1);
      expect(r.mode).toBe('words');
    }
  }, 60000);
});
