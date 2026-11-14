// What thuluth shaping does with a text as people type or paste it. Anything that was neither a letter of the table
// nor one of nine harakat was kept as a "letter" with no glyph, which cut the join and left a hole two units wide:
// the Uthmani sukun (ٱلۡحَمۡدُ), tatweel (محـمد broke in two), Persian ی and ک (علی lost its last letter), the alif
// wasla after a lam (no lam-alif), and the hamza on the line (شيء drew as شي).
import { describe, expect, it } from 'vitest';
import { thuluthScript } from '../src/script/thuluth/adapter';
import { isLetter, ROUNDEL_PEN, thuluth } from '../src/script/thuluth/engine';
import { roundelPieces } from '../src/script/thuluth/roundel';
import { forms, LAM_ALIF, ligate, parseVowels, splitGroups, unsupportedChars } from '../src/script/thuluth/shape';

const th = thuluth(ROUNDEL_PEN);
/** Every letter of the shaped text has a glyph (none is a hole in the line). */
const whole = (text: string) => {
  const { bare } = parseVowels(text);
  return bare.split(' ').every(w => forms(w).every(f => !!th.glyphFor(f.c, f.form)));
};

describe('normalising a text for thuluth', () => {
  it('reads the Uthmani sukun as a sukun', () => {
    const v = parseVowels('ٱلۡحَمۡدُ');
    expect(v.bare).toBe('ٱلحمد');
    expect(v.marks[0]).toEqual([{ li: 1, m: 'sukun' }, { li: 2, m: 'fatha' }, { li: 3, m: 'sukun' }, { li: 4, m: 'damma' }]); // prettier-ignore
    expect(v.dropped).toEqual([]);
    expect(splitGroups(v.bare).map(g => g.s)).toEqual(['ٱ', 'لحمد']);
  });
  it('reads a combining madda or hamza as its seat’s mark', () => {
    expect(parseVowels('آل').marks[0]).toEqual([{ li: 0, m: 'madda' }]);
    expect(parseVowels('أحد').marks[0]).toEqual([{ li: 0, m: 'hamza' }]);
  });
  it('leaves out tatweel, marks with no shape and format controls, without a word', () => {
    for (const t of ['محـمد', 'محــــمد', 'محۚمد', 'مح‍مد', '‏محمد']) {
      const v = parseVowels(t);
      expect(v.bare, t).toBe('محمد');
      expect(v.dropped, t).toEqual([]);
    }
    expect(splitGroups(parseVowels('محـمد').bare).map(g => g.s)).toEqual(['محمد']);
    // a mark after the tatweel still belongs to the letter before
    expect(parseVowels('مُـحمد').marks[0]).toEqual([{ li: 0, m: 'damma' }]);
  });
  it('writes Persian ye and kaf (and Urdu heh) with the Arabic letters of the same shape', () => {
    // ye: dotted before another letter, dotless at the end of a word
    expect(parseVowels('علی').bare).toBe('على');
    expect(parseVowels('یاسین').bare).toBe('ياسين');
    expect(parseVowels('عليِّ').bare).toBe('علي');
    expect(parseVowels('کریم').bare).toBe('كريم');
    expect(parseVowels('ملک').bare).toBe('ملك');
    expect(parseVowels('ہمہ').bare).toBe('همه');
    for (const t of ['علی', 'کریم', 'یاسین']) {
      expect(whole(t), t).toBe(true);
      expect(unsupportedChars(t)).toEqual([]);
    }
    expect(forms(parseVowels('علی').bare).map(f => f.form)).toEqual(['ini', 'med', 'fin']);
  });
  it('makes a lam-alif of a lam and an alif wasla', () => {
    expect(ligate('لٱ')).toBe(LAM_ALIF);
    const v = parseVowels('لَٱنفَضُّوا');
    expect([...ligate(v.bare)][0]).toBe(LAM_ALIF);
    // marks keep their letters: the fatha of the fa is on the third letter (lam-alif, nun, fa)
    expect(v.marks[0]).toEqual([{ li: 0, m: 'fatha' }, { li: 2, m: 'fatha' }, { li: 3, m: 'damma' }, { li: 3, m: 'shadda' }]); // prettier-ignore
  });
  it('lists what it cannot write, and leaves no hole for it', () => {
    const v = parseVowels('محمد 2024، پرویز (علي) abc');
    expect(v.bare).toBe('محمد رويز علي');
    expect(v.dropped).toEqual(['2', '0', '4', '،', 'پ', '(', ')', 'a', 'b', 'c']);
    // a word with no letters left is no word, and the marks stay with their words
    expect(v.marks.length).toBe(3);
    expect(parseVowels('١٢٣').bare).toBe('');
    expect(parseVowels('').marks).toEqual([]);
    expect(whole('محمد 2024، پرویز (علي) abc')).toBe(true);
    expect(roundelPieces(th, '123', {})).toBeNull();
  });
  it('reports it through the script engine, and with each prepared line', () => {
    const sc = thuluthScript(ROUNDEL_PEN),
      letter = { ascenders: 7, ra: 'desc', ayn: 'open', lamAlif: 'plain', marks: 'off', vowels: 'modern' } as const;
    expect(sc.unsupported!('گل 7')).toEqual(['گ', '7']);
    expect(sc.unsupported!('بسم الله الرحمن الرحيم')).toEqual([]);
    const P = sc.prepareLines(['محمد 7', 'علي'], letter) as unknown as { unsupported: string[]; words: unknown[] }[];
    expect(P.map(p => p.unsupported)).toEqual([['7'], []]);
    expect(P[0].words.length).toBe(1);
  });
});

describe('the hamza on the line', () => {
  it('is a letter of its own that joins nothing on either side', () => {
    expect(forms('شيء').map(f => [f.c, f.form])).toEqual([['ش', 'ini'], ['ي', 'fin'], ['ء', 'iso']]); // prettier-ignore
    expect(forms('ماء').map(f => f.form)).toEqual(['ini', 'fin', 'iso']);
    expect(forms('ءامن').map(f => f.form)).toEqual(['iso', 'iso', 'ini', 'fin']);
    expect(splitGroups('شيء').map(g => g.s)).toEqual(['شي', 'ء']);
    expect(splitGroups('جزء').map(g => g.s)).toEqual(['جز', 'ء']);
    expect(unsupportedChars('شيء')).toEqual([]);
  });
  it('is drawn: شيء has a letter more than شي, small and on the line', () => {
    const a = th.buildStrokes('شيء').placed.filter(isLetter),
      b = th.buildStrokes('شي').placed.filter(isLetter);
    expect(a.length).toBe(b.length + 1);
    const h = a[a.length - 1],
      ys = h.g.s.flatMap(s => s.pts.map(q => q[1])),
      xs = h.g.s.flatMap(s => s.pts.map(q => q[0]));
    expect(h.c).toBe('ء');
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(5);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5);
    // to the left of the ya before it, and no hole between them
    const ya = a[a.length - 2],
      yaLeft = ya.ox + Math.min(...ya.g.s.flatMap(s => s.pts.map(q => q[0])));
    expect(h.ox + Math.max(...xs)).toBeLessThan(yaLeft);
    expect(yaLeft - (h.ox + Math.max(...xs))).toBeLessThan(th.style.nib + 1);
    // also with the lab's letters, which had none
    expect(thuluth({ ...ROUNDEL_PEN, labLetters: true }).glyphFor('ء', 'iso')).not.toBeNull();
  });
  it('is a group of its own in a roundel', () => {
    const p = roundelPieces(th, 'شيء', {})!;
    expect(p.groups.map(g => g.s)).toEqual(['شي', 'ء']);
    expect(p.shapes.every(vs => vs.length > 0)).toBe(true);
  });
});

describe('texts that shaped well before', () => {
  it('are read as they were', () => {
    const v = parseVowels('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
    expect(v.bare).toBe('بسم الله الرحمن الرحيم');
    expect(v.dropped).toEqual([]);
    expect(parseVowels('لا إله إلا الله').bare).toBe('لا اله الا الله');
    expect(parseVowels('لا إله إلا الله').marks).toEqual([[], [{ li: 0, m: 'hamzaB' }], [{ li: 0, m: 'hamzaB' }], []]); // prettier-ignore
    expect(parseVowels('مؤمن سئل آمن').bare).toBe('مومن سىل امن');
  });
});
