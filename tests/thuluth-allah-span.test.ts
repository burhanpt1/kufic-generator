// One test for the name of God (allahSpan), where five disagreed: a line gave لله and ٱلله the ligature's lams with no
// shadda unless the text was that word alone; والله, بالله, ولله and عبدالله were plain in a line and a ligature in a
// roundel, فلله plain everywhere; a vowelled roundel set the text's own shadda on top of the ligature's; and the
// mirror's refusal took any لله, so it refused اللهب and كللها too.
import { describe, expect, it } from 'vitest';
import { kashidaJoin, thuluthScript } from '../src/script/thuluth/adapter';
import { isLetter, ROUNDEL_PEN, thuluth } from '../src/script/thuluth/engine';
import { ALLAH_HEH, ALLAH_LAM, ALLAH_LAM_INI } from '../src/script/thuluth/fixes';
import { refusesMirror, roundelPieces } from '../src/script/thuluth/roundel';
import { allahSpan, parseVowels, splitGroups } from '../src/script/thuluth/shape';
import type { LetterStyle } from '../src/script/types';

const th = thuluth(ROUNDEL_PEN);
/** Ligature lams and shaddas (the only strokes with a pen of their own) in built strokes. */
const count = (b: ReturnType<typeof th.buildStrokes>) => ({
  lams: b.placed.filter(p => isLetter(p) && (p.g === ALLAH_LAM || p.g === ALLAH_LAM_INI)).length,
  shaddas: b.strokes.filter(s => s.nib).length,
});
const NAME = { lams: 2, shaddas: 1 },
  NONE = { lams: 0, shaddas: 0 };

describe('allahSpan', () => {
  it('finds the name with its alif in any form, without it, after prefixes, as اللهم and closing a name', () => {
    const at = (w: string) => allahSpan(w)?.lam;
    expect(['الله', 'ألله', 'ٱلله', 'آلله'].map(at)).toEqual([1, 1, 1, 1]);
    expect(at('لله')).toBe(0);
    expect(['والله', 'فالله', 'بالله', 'تالله', 'كالله', 'بٱلله'].map(at)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(['وبالله', 'فبالله'].map(at)).toEqual([3, 3]);
    expect(['ولله', 'فلله'].map(at)).toEqual([1, 1]);
    expect(['عبدالله', 'نصرالله'].map(at)).toEqual([4, 4]);
    expect(allahSpan('اللهم')).toEqual({ lam: 1, final: false });
    expect(allahSpan('الله')).toEqual({ lam: 1, final: true });
  });
  it('reads through vowels and tatweel', () => {
    expect(allahSpan('اللَّهِ')).toEqual({ lam: 1, final: true });
    expect(allahSpan('ٱللَّٰهِ')).toEqual({ lam: 1, final: true });
    expect(allahSpan('بِاللَّهِ')).toEqual({ lam: 2, final: true });
    expect(allahSpan('لِلَّهِ')).toEqual({ lam: 0, final: true });
    expect(allahSpan('اللـه')).toEqual({ lam: 1, final: true });
  });
  it('is not taken in by words that only share its letters', () => {
    for (const w of ['اللهب', 'اللهو', 'كللها', 'دلله', 'ظلله', 'بلله', 'كلله', 'اله', 'جلاله', 'الليل', 'لهم', 'علي'])
      expect(allahSpan(w), w).toBeNull();
  });
});

describe('the name of God, drawn the same wherever it stands', () => {
  it('has its ligature and its shadda in a line of several words', () => {
    for (const t of ['الحمد لله', 'بسم ٱلله', 'بسم الله الرحمن الرحيم', 'لا حول ولا قوة الا بالله', 'ان شاء الله'])
      expect(count(th.buildStrokes(t)), t).toEqual(NAME);
    expect(count(th.buildStrokes('سبحان الله والحمد لله'))).toEqual({ lams: 4, shaddas: 2 });
  });
  it('is the same in a line and in a roundel, with a prefix or closing a name', () => {
    for (const w of ['والله', 'بالله', 'ولله', 'فلله', 'عبدالله', 'اللهم', 'الله', 'لله']) {
      expect(count(th.buildStrokes(w)), w).toEqual(NAME);
      const p = roundelPieces(th, w, {})!,
        gi = p.groups.findIndex(g => g.allah);
      expect(p.groups.filter(g => g.allah).length, w).toBe(1);
      p.groups.forEach((_, i) => expect(count(p.shapes[i][0].b), w).toEqual(i === gi ? NAME : NONE));
    }
  });
  it('keeps the heh of the ligature for the end of the word', () => {
    const heh = (t: string) =>
      th
        .buildStrokes(t)
        .placed.filter(isLetter)
        .find(p => p.c === 'ه')!;
    // the glyph is scaled by the body, so it is known by its strokes
    const isAllahHeh = (t: string) => heh(t).g.s.length === ALLAH_HEH.s.length && heh(t).g.exit === null;
    expect(isAllahHeh('الله')).toBe(true);
    expect(heh('اللهم').form).toBe('med');
    expect(heh('اللهم').g.exit).not.toBeNull();
  });
  it('leaves words that share its letters alone, in a line, in a roundel and in a piece of a word', () => {
    for (const w of ['اللهب', 'كللها', 'دلله']) {
      expect(count(th.buildStrokes(w)), w).toEqual(NONE);
      const p = roundelPieces(th, w, {})!;
      expect(p.groups.some(g => g.allah)).toBe(false);
      p.shapes.forEach(vs => expect(count(vs[0].b), w).toEqual(NONE));
    }
    // the group لله of دلله is not the name, though its letters are the name's
    expect(count(th.buildStrokes('لله', { allah: false }))).toEqual(NONE);
    expect(splitGroups('دلله').map(g => g.allah)).toEqual([false, false]);
  });
  it('marks the group that holds its lams', () => {
    expect(splitGroups('الله').map(g => [g.s, g.allah])).toEqual([['ا', false], ['لله', true]]); // prettier-ignore
    expect(splitGroups('بسم الله').map(g => g.allah)).toEqual([false, false, true]);
    expect(splitGroups('فلله').map(g => [g.s, g.allah])).toEqual([['فلله', true]]);
    expect(splitGroups('اللهم').map(g => [g.s, g.allah])).toEqual([['ا', false], ['للهم', true]]); // prettier-ignore
  });
  it('draws its own shadda in a vowelled roundel, whatever stands before it', () => {
    for (const t of ['وَاللَّهِ', 'بِاللَّهِ', 'لِلَّهِ', 'فَلِلَّهِ', 'عَبْدُاللَّهِ']) {
      const p = roundelPieces(th, t, {})!,
        gi = p.groups.findIndex(g => g.allah),
        g = p.groups[gi];
      expect(gi, t).toBeGreaterThanOrEqual(0);
      // the second lam's marks are the ligature's: none of the text's are left on it
      const lam2 = allahSpan(g.s)!.lam + 1;
      expect(
        g.marks!.some(m => m.k === lam2),
        t,
      ).toBe(false);
      expect(
        g.marks!.some(m => m.m === 'shadda'),
        t,
      ).toBe(false);
      expect(count(p.shapes[gi][0].b), t).toEqual(NAME);
    }
  });
  it('draws the small alif a vowelled text writes, in a roundel and in a line', () => {
    const p = roundelPieces(th, 'بِاللَّٰهِ', {})!,
      g = p.groups.find(q => q.allah)!;
    expect(g.alif).toBe(true);
    const sc = thuluthScript(ROUNDEL_PEN),
      letter: LetterStyle = { ascenders: 7, ra: 'desc', ayn: 'open', lamAlif: 'plain', marks: 'all', vowels: 'modern' },
      segs = (t: string) => sc.segments(sc.prepare(sc.shape(t, letter), letter), 'words', 2) as unknown as { marks: { li: number; m: string }[]; allahAlif?: boolean }[]; // prettier-ignore
    const [a] = segs('بِاللَّٰهِ'),
      [b] = segs('بِاللَّهِ');
    expect(a.allahAlif).toBe(true);
    expect(b.allahAlif).toBeUndefined();
    // the shadda (and the fatha or small alif with it) is the ligature's own: the text's are not set on top of it
    expect(a.marks.map(m => m.m)).toEqual(['kasra', 'kasra']);
    expect(b.marks.map(m => m.m)).toEqual(['kasra', 'kasra']);
  });
  it('keeps the lab’s rule with the lab’s letters, as its references were drawn', () => {
    const lab = thuluth({ ...ROUNDEL_PEN, labLetters: true }),
      marks = (t: string) => lab.buildStrokes(t).strokes.filter(s => s.nib).length;
    expect(marks('الله')).toBe(2);
    expect(marks('بسم الله')).toBe(2);
    expect(marks('الحمد لله')).toBe(0);
  });
});

describe('the name of God and the rules that ask for it', () => {
  it('is never stretched, whatever stands before it', () => {
    for (const w of ['الله', 'لله', 'والله', 'ولله', 'اللهم']) expect(kashidaJoin(w), w).toBeNull();
    // a prefix may be drawn out, the name itself not
    expect(kashidaJoin('فلله')).toBe(1);
    expect(kashidaJoin('بالله')).toBe(1);
    expect(kashidaJoin('دلله')).not.toBeNull();
    expect(kashidaJoin('لله', false)).not.toBeNull();
  });
  it('is not mirrored, and only it', () => {
    for (const t of ['الله', 'الحمد لله', 'بِاللَّهِ', 'والله اعلم', 'عبدالله', 'اللهم صل', 'ما شاء ٱلله'])
      expect(refusesMirror(t), t).toBe(true);
    for (const t of ['اللهب', 'كللها', 'تبت يدا ابي لهب', 'علي', 'محمد']) expect(refusesMirror(t), t).toBe(false);
  });
  it('is told to a piece of a word by the word', () => {
    const sc = thuluthScript(ROUNDEL_PEN),
      letter: LetterStyle = { ascenders: 7, ra: 'desc', ayn: 'open', lamAlif: 'plain', marks: 'off', vowels: 'modern' },
      pieces = (t: string) => sc.segments(sc.prepare(sc.shape(t, letter), letter), 'breaks', 2) as unknown as { text: string; allah?: boolean; w: number }[]; // prettier-ignore
    expect(pieces('والله').map(p => [p.text, p.allah])).toEqual([['و', false], ['ا', false], ['لله', true]]); // prettier-ignore
    expect(pieces('دلله').map(p => [p.text, p.allah])).toEqual([['د', false], ['لله', false]]); // prettier-ignore
    // the ligature is wider than the same letters written plainly
    expect(pieces('والله')[2].w).toBeGreaterThan(pieces('دلله')[1].w + 1);
  });
  it('reads the vowels of a text as before', () => {
    expect(parseVowels('بِسْمِ اللَّهِ').bare).toBe('بسم الله');
  });
});
