// The drafted alternative letterforms (ThuluthStyle.alts, src/script/thuluth/alts.ts): off unless asked for, every one
// of them a letter the pen can draw, the name محمد a ligature only where it is the name, and the recommended set no
// harder to read than today's letters by the rasm confusion matrix.
import { describe, expect, it } from 'vitest';
import type { Form, SkelPt, ThuluthAlts, ThuluthStyle } from '../src/script/thuluth';
import { FAM, LAM_ALIF, ROUNDEL_PEN, TILE_PEN, isLetter, muhammadAt, nibPolys, parseVowels, sampleStroke, thuluth } from '../src/script/thuluth'; // prettier-ignore
import { ALT_FIXES, RECOMMENDED } from '../src/script/thuluth/alts';
import { confusionMatrix } from '../src/script/thuluth/checker';
import { cleanOutline } from '../src/script/thuluth/outline';
import { thuluthStyleOf } from '../src/script/registry';

const PENS: Record<string, ThuluthStyle> = { roundel: ROUNDEL_PEN, tile: TILE_PEN, line: thuluthStyleOf({ preset: 'line' }) }; // prettier-ignore
const TEXTS = [
  'بسم الله الرحمن الرحيم',
  'اللهم صل على محمد وآل محمد',
  'لا إله إلا الله',
  'كل طه ملك بارك قلب',
  'ومحمد',
];
const ALTS: ThuluthAlts[] = [
  { stems: 'a' }, { stems: 'b' }, { stems: 'c' }, { muhammad: 'a' }, { muhammad: 'b' }, { muhammad: 'c' }, { fixes: true },
  ...ALT_FIXES.map(f => ({ fixes: [f] })), RECOMMENDED, { stems: 'c', muhammad: 'b', fixes: true },
]; // prettier-ignore

describe('alternatives are off unless asked for', () => {
  for (const [pn, pen] of Object.entries(PENS))
    it(`nothing changes without them (${pn} pen)`, () => {
      const base = thuluth(pen);
      for (const alts of [undefined, {}, { stems: undefined, muhammad: undefined, fixes: false }] as ThuluthAlts[]) {
        const th = thuluth({ ...pen, alts });
        expect(th.table).toEqual(base.table);
        for (const t of TEXTS) expect(th.renderLine(t), t).toBe(base.renderLine(t));
      }
      // and the lab's own letters stay the lab's
      const lab = thuluth({ ...pen, labLetters: true });
      expect(thuluth({ ...pen, labLetters: true, alts: RECOMMENDED }).renderLine(TEXTS[0])).toBe(lab.renderLine(TEXTS[0])); // prettier-ignore
    });
  it('the pen draws as before unless told to clean its ends', () => {
    const s = sampleStroke([[0, 10, 0.2], [0, 5, 1], [0, 0, 1, 1], [-3, 0, 1]] as SkelPt[]); // prettier-ignore
    expect(nibPolys(s, 1.6, 38, 0.3, false)).toEqual(nibPolys(s, 1.6, 38, 0.3));
    expect(nibPolys(s, 1.6, 38, 0.3, true).length).toBeLessThan(nibPolys(s, 1.6, 38, 0.3).length);
  });
});

describe('every alternative is a letter the pen can draw', () => {
  const FORMS: Form[] = ['iso', 'ini', 'med', 'fin'];
  for (const alts of ALTS)
    it(JSON.stringify(alts), () => {
      for (const pen of [ROUNDEL_PEN, PENS.line]) {
        const th = thuluth({ ...pen, alts });
        for (const c of [...Object.keys(FAM), LAM_ALIF])
          for (const form of FORMS) {
            const g = th.glyphFor(c, form);
            if (!g) continue;
            expect(g.s.length, `${c} ${form}`).toBeGreaterThan(0);
            for (const sd of g.s) {
              expect(sd.pts.length, `${c} ${form}`).toBeGreaterThan(1);
              const polys = th.strokePolys({ ang: sd.ang ?? th.style.ang, s: sampleStroke(sd.pts as SkelPt[], th.style.tension) }); // prettier-ignore
              expect(polys.length, `${c} ${form}`).toBeGreaterThan(0);
              expect(polys.flat(2).every(Number.isFinite), `${c} ${form}`).toBe(true);
              expect(cleanOutline(polys).length, `${c} ${form}`).toBeGreaterThan(0);
            }
            if (g.exit != null) expect(Number.isFinite(g.exit)).toBe(true);
          }
        for (const t of [...TEXTS, parseVowels('مُحَمَّدٌ رَسُولُ اللَّهِ').bare]) {
          const b = th.buildStrokes(t);
          expect(b.strokes.flatMap(s => s.s.flatMap(q => [q.x, q.y, q.w])).every(Number.isFinite), t).toBe(true);
          expect(
            b.dots.flat().every(v => v == null || typeof v === 'string' || Number.isFinite(v)),
            t,
          ).toBe(true);
          // every letter still placed, in order
          expect(b.placed.filter(isLetter).length, t).toBe(thuluth(pen).buildStrokes(t).placed.filter(isLetter).length);
        }
      }
    });
  it('a joining stem still hands the line on at its exit, on the baseline', () => {
    for (const stems of ['a', 'b', 'c'] as const) {
      const th = thuluth({ ...ROUNDEL_PEN, alts: { stems } });
      for (const form of ['ini', 'med'] as Form[]) {
        const g = th.glyphFor('ل', form)!,
          ends = g.s.map(s => s.pts[s.pts.length - 1]);
        expect(
          ends.some(p => Math.abs(p[0] - g.exit!) < 1e-9 && p[1] === 0),
          form,
        ).toBe(true);
      }
      // all the tall stems at one height, the lam's
      const top = (c: string, f: Form) => Math.max(...th.glyphFor(c, f)!.s.flatMap(s => s.pts.map(p => p[1])));
      expect(Math.abs(top('ا', 'iso') - top('ل', 'ini'))).toBeLessThan(0.3);
    }
  });
});

describe('the name محمد', () => {
  it('is found only where it is the name', () => {
    expect(muhammadAt('محمد')).toBe(0);
    expect(muhammadAt('مُحَمَّدٌ')).toBe(0);
    expect(muhammadAt('ومحمد')).toBe(1);
    for (const w of ['محمود', 'احمد', 'أحمد', 'محمدا', 'بمحمد', 'لمحمد', 'محمدي', 'حمد', 'الحمد', 'محم']) expect(muhammadAt(w), w).toBe(-1); // prettier-ignore
  });
  it('is written as a ligature by alternatives b and c, a storey high, and nowhere else', () => {
    const plain = thuluth({ ...ROUNDEL_PEN, alts: { muhammad: 'a' } }),
      mimTop = (th: ReturnType<typeof thuluth>, t: string) => {
        const p = th
          .buildStrokes(t)
          .placed.filter(isLetter)
          .find(q => q.c === 'م')!;
        return p.oy;
      };
    for (const m of ['b', 'c'] as const) {
      const th = thuluth({ ...ROUNDEL_PEN, alts: { muhammad: m } });
      expect(mimTop(th, 'محمد')).toBeGreaterThan(2);
      expect(mimTop(th, 'على محمد')).toBeGreaterThan(2);
      // its second mim and its dal stand on the line
      const ps = th.buildStrokes('محمد').placed.filter(isLetter);
      expect(ps.map(p => Math.abs(p.oy) < 1e-9)).toEqual([false, false, true, true]);
      for (const w of ['محمود', 'احمد', 'الحمد', 'بمحمد']) expect(mimTop(th, w), w).toBe(0);
      // a caller that stacks the joins itself gets the letters, not the ligature
      expect(th.buildStrokes('محمد', { stacks: { 2: { dx: 1, dy: -3 } } }).placed.filter(isLetter)[0].oy).toBe(0);
      // b leaves every other word as it is today
      if (m === 'b') expect(th.renderLine('الحمد محمود')).not.toBe(plain.renderLine('الحمد محمود'));
    }
    expect(mimTop(plain, 'محمد')).toBe(0);
    const b = thuluth({ ...ROUNDEL_PEN, alts: { muhammad: 'b' } }),
      now = thuluth(ROUNDEL_PEN);
    expect(b.table).toEqual(now.table);
    expect(b.buildStrokes('الحمد محمود').placed).toEqual(now.buildStrokes('الحمد محمود').placed);
  });
});

describe('the recommended alternatives read no worse than today', () => {
  const THRESHOLD = 0.3;
  for (const [pn, pen] of [
    ['roundel', ROUNDEL_PEN],
    ['tile', TILE_PEN],
  ] as const)
    // prettier-ignore
    it(`no pair of letter shapes under ${THRESHOLD} that is not under it today, and none of those closer (${pn} pen)`, () => {
      const key = (c: { a: string; b: string; form: string }) => `${c.a}/${c.b} ${c.form}`,
        today = new Map(confusionMatrix(thuluth(pen)).map(c => [key(c), c.d]));
      for (const c of confusionMatrix(thuluth({ ...pen, alts: RECOMMENDED }))) {
        if (c.d >= THRESHOLD) break;
        const was = today.get(key(c))!;
        expect(was, `${key(c)} at ${c.d.toFixed(3)}, was ${was.toFixed(3)}`).toBeLessThan(THRESHOLD);
        expect(c.d, key(c)).toBeGreaterThanOrEqual(was - 0.005);
      }
    });
  it('the letters the alternatives redraw keep their distance from their nearest neighbours', () => {
    // pinned on 14 November 2026 (roundel pen): what each was, and what it must stay above
    const m = confusionMatrix(thuluth({ ...ROUNDEL_PEN, alts: RECOMMENDED })),
      d = (a: string, b: string, form: Form) => m.find(c => c.form === form && ((c.a === a && c.b === b) || (c.a === b && c.b === a)))!.d; // prettier-ignore
    expect(d('م', 'ه', 'ini')).toBeGreaterThan(0.33); // 0.513 today: the round mim is nearer the heh, still clear of it
    expect(d('ف', 'م', 'ini')).toBeGreaterThan(0.38); // 0.568 today
    expect(d('م', 'ه', 'med')).toBeGreaterThan(0.4); // 0.248 today
    expect(d('ف', 'م', 'med')).toBeGreaterThan(0.4); // 0.280 today
    expect(d('ح', 'ع', 'med')).toBeGreaterThan(0.5);
    expect(d('د', 'ر', 'fin')).toBeGreaterThan(0.5);
    expect(d('ا', 'ل', 'fin')).toBeGreaterThan(0.33); // 0.600 today: the joined alif now has the lam's weight
    expect(d('ك', 'ل', 'med')).toBeGreaterThan(0.5);
    expect(d('ك', 'د', 'fin')).toBeGreaterThan(0.5);
  });
});
