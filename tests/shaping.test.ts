import { describe, expect, it } from 'vitest';
import { shape } from '../src/shaping/shape';
import { buildGlyph } from '../src/shaping/buildGlyph';
import { setVariants } from '../src/glyphs/overrides';

const forms = (text: string) => shape(text).words.map(w => w.map(u => `${u.key}.${u.form}`));

describe('shape(): joining forms', () => {
  it('gives initial, medial and final forms in a joined word', () => {
    expect(forms('بسم')).toEqual([['BEH.ini', 'SEEN.med', 'MEEM.fin']]);
  });
  it('gives a single letter its isolated form', () => {
    expect(forms('ب')).toEqual([['BEH.iso']]);
  });
  it('breaks the join after right-joining-only letters', () => {
    // د and ر join to the previous letter only, so the next letter starts afresh
    expect(forms('مدد')).toEqual([['MEEM.ini', 'DAL.fin', 'DAL.iso']]);
    expect(forms('ورد')).toEqual([['WAW.iso', 'REH.iso', 'DAL.iso']]);
  });
  it('keeps hamza non-joining on both sides', () => {
    expect(forms('بءب')).toEqual([['BEH.iso', 'HAMZA.iso', 'BEH.iso']]);
  });
  it('splits words on whitespace and punctuation', () => {
    expect(forms('يا علي، مدد!')).toEqual([
      ['YEH.ini', 'ALEF.fin'],
      ['AIN.ini', 'LAM.med', 'YEH.fin'],
      ['MEEM.ini', 'DAL.fin', 'DAL.iso'],
    ]);
  });
  it('maps Persian and Urdu letters to their nearest group (گ has its own, kaf with a second arm)', () => {
    expect(forms('پگ')).toEqual([['BEH.ini', 'GAF.fin']]);
    expect(forms('پک')).toEqual([['BEH.ini', 'KAF.fin']]);
  });
});

describe('shape(): lam-alif', () => {
  it('fuses lam + alif into one LAMALEF unit that does not join forward', () => {
    const [w] = shape('لا').words;
    expect(w).toHaveLength(1);
    expect(w[0].key).toBe('LAMALEF');
    expect(w[0].parts.map(p => p.c)).toEqual(['ل', 'ا']);
    expect(forms('الله')).toEqual([['ALEF.iso', 'LAM.ini', 'LAM.med', 'HEH.fin']]);
    expect(forms('سلام')).toEqual([['SEEN.ini', 'LAMALEF.fin', 'MEEM.iso']]);
  });
  it('fuses any alif form', () => {
    expect(forms('لأ لإ لآ')).toEqual([['LAMALEF.iso'], ['LAMALEF.iso'], ['LAMALEF.iso']]);
  });
});

describe('shape(): harakat', () => {
  it('attaches combining marks to the preceding letter', () => {
    const [w] = shape('بِسْمِ').words;
    expect(w.map(u => u.parts[0].marks)).toEqual([['ِ'], ['ْ'], ['ِ']]);
  });
  it('drops a mark with no letter before it', () => {
    const [w] = shape('َب').words;
    expect(w[0].parts[0].marks).toEqual([]);
  });
  it('ignores Quranic annotation marks and joiners without reporting them', () => {
    const r = shape('بۖ‌ب');
    expect(r.unsupported).toEqual([]);
    expect(forms('بۖ‌ب')).toEqual([['BEH.ini', 'BEH.fin']]);
  });
});

describe('shape(): unsupported characters', () => {
  it('reports each unsupported character once and skips it', () => {
    const r = shape('بسم 123 abca');
    expect(r.unsupported).toEqual(['1', '2', '3', 'a', 'b', 'c']);
    expect(r.words).toHaveLength(1);
  });
  it('returns no words for text with no Arabic letters', () => {
    expect(shape('hello').words).toEqual([]);
    expect(shape('').words).toEqual([]);
  });
});

describe('buildGlyph(): marks', () => {
  const H = 9;
  const glyph = (text: string, mode: 'off' | 'dots' | 'all', style: 'modern' | 'early' = 'modern') => {
    setVariants({});
    return buildGlyph(shape(text).words[0][0], H, mode, style);
  };
  const vals = (g: ReturnType<typeof glyph>, v: number) => g.cells.filter(c => c[2] === v);

  it('places a dot below beh and above noon', () => {
    const beh = glyph('ب', 'dots'),
      noon = glyph('ن', 'dots');
    expect(vals(beh, 3).every(([, y]) => y < 0)).toBe(true);
    expect(vals(noon, 3).every(([, y]) => y > 0)).toBe(true);
  });
  it('draws no marks when marks are off', () => {
    const g = glyph('بِ', 'off');
    expect(vals(g, 2).length + vals(g, 3).length).toBe(0);
  });
  it('draws vowels (value 2) only in "all" mode', () => {
    expect(vals(glyph('بِ', 'dots'), 2)).toHaveLength(0);
    expect(vals(glyph('بِ', 'all'), 2).length).toBeGreaterThan(0);
  });
  it('keeps consonantal marks (hamza) in dots mode', () => {
    expect(vals(glyph('أ', 'dots'), 3).length).toBeGreaterThan(0);
  });
  it('turns a kasra into a single dot in early style', () => {
    expect(vals(glyph('بِ', 'all', 'early'), 2)).toHaveLength(1);
  });
});
