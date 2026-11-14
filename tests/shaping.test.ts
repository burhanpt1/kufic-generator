import { describe, expect, it } from 'vitest';
import { shape } from '../src/shaping/shape';
import { buildGlyph } from '../src/shaping/buildGlyph';
import { setVariants } from '../src/glyphs/overrides';
import { abjad, uniqueLetters } from '../src/abjad';

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
  it('ignores Quranic annotation marks without reporting them', () => {
    const r = shape('ب\u06D6ب');
    expect(r.unsupported).toEqual([]);
    expect(forms('ب\u06D6ب')).toEqual([['BEH.ini', 'BEH.fin']]);
  });
});

describe('shape(): joiners', () => {
  const ZWNJ = '\u200C',
    ZWJ = '\u200D';
  it('ZWNJ breaks the join without starting a new word, and is not reported', () => {
    const r = shape(`ب${ZWNJ}ب`);
    expect(r.unsupported).toEqual([]);
    expect(forms(`ب${ZWNJ}ب`)).toEqual([['BEH.iso', 'BEH.iso']]);
    // Persian می‌خواهم: one word, the ی final before the joiner and the خ starting afresh
    expect(forms(`می${ZWNJ}خواهم`)).toEqual([
      ['MEEM.ini', 'YEH.fin', 'HAH.ini', 'WAW.fin', 'ALEF.iso', 'HEH.ini', 'MEEM.fin'],
    ]);
    const [w] = shape(`می${ZWNJ}خواهم`).words;
    expect(w[1].jn).toBe(false);
    expect(w[2].jp).toBe(false);
  });
  it('ZWNJ between lam and alif keeps them apart', () => {
    expect(forms(`ل${ZWNJ}ا`)).toEqual([['LAM.iso', 'ALEF.iso']]);
  });
  it('ZWJ keeps letters joined, and gives a joining form where nothing is joined', () => {
    expect(forms(`ب${ZWJ}ب`)).toEqual([['BEH.ini', 'BEH.fin']]);
    expect(forms(`ه${ZWJ}`)).toEqual([['HEH.ini']]);
    expect(forms(`${ZWJ}ه`)).toEqual([['HEH.fin']]);
    expect(forms(`${ZWJ}ب${ZWJ}`)).toEqual([['BEH.med']]);
    // a right-joining letter still cannot join forward, but the letter after the joiner takes its joined form
    expect(forms(`د${ZWJ}ب`)).toEqual([['DAL.iso', 'BEH.fin']]);
    // the forced form joins nothing: jp and jn stay the real joins
    const [[u]] = shape(`ه${ZWJ}`).words;
    expect([u.jp, u.jn]).toEqual([false, false]);
    expect(shape(`ه${ZWJ}`).unsupported).toEqual([]);
  });
  it('ZWJ between lam and alif joins them without the ligature', () => {
    expect(forms(`ل${ZWJ}ا`)).toEqual([['LAM.ini', 'ALEF.fin']]);
  });
});

describe('shape(): unsupported characters', () => {
  it('reports each unsupported character once and skips it', () => {
    const r = shape('بسم 123 abca');
    expect(r.unsupported).toEqual(['1', '2', '3', 'a', 'b', 'c']);
    expect(r.words).toHaveLength(1);
  });
  it('breaks the word at an unsupported character instead of joining across it', () => {
    expect(forms('علي/محمد')).toEqual([
      ['AIN.ini', 'LAM.med', 'YEH.fin'],
      ['MEEM.ini', 'HAH.med', 'MEEM.med', 'DAL.fin'],
    ]);
    expect(shape('علي/محمد').unsupported).toEqual(['/']);
    expect(forms('ب1ب')).toEqual([['BEH.iso'], ['BEH.iso']]);
    // a mark after the unsupported character has no letter to sit on
    expect(shape('ب1َب').words.map(w => w[0].parts[0].marks)).toEqual([[], []]);
  });
  it('treats ornate parentheses as separators', () => {
    const r = shape('﴿بسم﴾');
    expect(r.unsupported).toEqual([]);
    expect(forms('﴿بسم﴾')).toEqual([['BEH.ini', 'SEEN.med', 'MEEM.fin']]);
  });
  it('returns no words for text with no Arabic letters', () => {
    expect(shape('hello').words).toEqual([]);
    expect(shape('').words).toEqual([]);
  });
});

describe('shape(): composed letters and presentation forms', () => {
  it('reads the letters NFC composes with hamza above (ۂ ۓ ۀ) and ە', () => {
    for (const t of ['\u06C1\u0654', '\u06D2\u0654', '\u06D5\u0654', '\u06D5', '\u06C2', '\u06D3', '\u06C0'])
      expect(shape(t).unsupported, t).toEqual([]);
    expect(forms('\u06C1\u0654')).toEqual([['HEH.iso']]);
    expect(forms('\u06D2\u0654')).toEqual([['YEH.iso']]);
    expect(forms('\u06D5\u0654')).toEqual([['HEH.iso']]);
    // ۂ joins both ways like ہ; ۓ, ە and ۀ only to the letter before
    expect(forms('ب\u06C2ب')).toEqual([['BEH.ini', 'HEH.med', 'BEH.fin']]);
    expect(forms('ب\u06D3ب')).toEqual([['BEH.ini', 'YEH.fin', 'BEH.iso']]);
    expect(forms('ب\u06D5ب')).toEqual([['BEH.ini', 'HEH.fin', 'BEH.iso']]);
    expect(forms('ب\u06C0ب')).toEqual([['BEH.ini', 'HEH.fin', 'BEH.iso']]);
  });
  it('draws their hamza like the hamza of ئ', () => {
    setVariants({});
    const hamza = (t: string) => buildGlyph(shape(t).words[0][0], 9, 'dots', 'modern').cells.filter(c => c[2] === 3);
    for (const t of ['\u06C2', '\u06D3', '\u06C0']) expect(hamza(t).length, t).toBeGreaterThan(0);
    expect(hamza('\u06C1')).toEqual([]);
  });
  it('reads presentation forms as their letters', () => {
    expect(forms('\uFEFB')).toEqual(forms('لا'));
    expect(forms('\uFDF2')).toEqual(forms('الله'));
    expect(forms('\uFE91\uFEB4\uFEE2')).toEqual(forms('بسم'));
    expect(forms('\uFB56')).toEqual(forms('پ'));
    expect(forms('\uFDFA')).toEqual(forms('صلى الله عليه وسلم'));
    for (const t of ['\uFEFB', '\uFDF2', '\uFE91\uFEB4\uFEE2', '\uFDFA', '\uFBB0'])
      expect(shape(t).unsupported, t).toEqual([]);
  });
  it('puts a spacing form of a mark on the letter before it, without a word break', () => {
    // U+FE76 is a space and a fatha, U+FE7C a space and a shadda
    const r = shape('ب\uFE76ب\uFE7C');
    expect(r.unsupported).toEqual([]);
    expect(r.words).toHaveLength(1);
    expect(r.words[0].map(u => u.parts[0].marks)).toEqual([['\u064E'], ['\u0651']]);
  });
  it('counts presentation forms in the abjad value and the unique letters', () => {
    expect(abjad('\uFDF2')).toBe(abjad('الله'));
    expect(abjad('\u06C2\u06D3')).toBe(15);
    expect(uniqueLetters('\uFEFB')).toBe('ل ا');
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
