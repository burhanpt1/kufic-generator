// The drafted alternative letterforms (ThuluthStyle.alts, src/script/thuluth/alts.ts): off unless asked for, every one
// of them a letter the pen can draw, the name محمد a ligature only where it is the name, and the recommended set no
// harder to read than today's letters by the rasm confusion matrix.
import { describe, expect, it } from 'vitest';
import type { Form, SkelPt, ThuluthAlts, ThuluthStyle } from '../src/script/thuluth';
import { FAM, LAM_ALIF, ROUNDEL_PEN, TILE_PEN, isLetter, muhammadAt, nibPolys, parseVowels, sampleStroke, thuluth } from '../src/script/thuluth'; // prettier-ignore
import { ALT_FIXES, CHOSEN, RECOMMENDED } from '../src/script/thuluth/alts';
import { confusionMatrix } from '../src/script/thuluth/checker';
import { cleanOutline } from '../src/script/thuluth/outline';
import { buildRoundel, inkGap, roundelPieces, STEM_CLEAR, strokeQuads } from '../src/script/thuluth/roundel';
import { thuluthStyleOf } from '../src/script/registry';
import { letterInks, stemRoom } from './helpers/stem-clearance';

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
  ...ALT_FIXES.map(f => ({ fixes: [f] })), RECOMMENDED, { stems: 'c', muhammad: 'b', fixes: true }, CHOSEN,
]; // prettier-ignore

describe('alternatives are off unless asked for', () => {
  for (const [pn, pen] of Object.entries(PENS))
    it(`the stems and the name are off unless named, the audit's corrections on unless refused (${pn} pen)`, () => {
      // the default carries the corrections (owner, 14 November 2026) and nothing else
      const base = thuluth(pen);
      for (const alts of [{}, { fixes: true }, { stems: undefined, muhammad: undefined }] as ThuluthAlts[]) {
        const th = thuluth({ ...pen, alts });
        expect(th.table).toEqual(base.table);
        for (const t of TEXTS) expect(th.renderLine(t), t).toBe(base.renderLine(t));
      }
      // refused, the letters are those of before the audit: a corrected form differs, the rest do not
      const plain = thuluth({ ...pen, alts: { fixes: false } });
      expect(plain.glyphFor('ك', 'med')).not.toEqual(base.glyphFor('ك', 'med'));
      expect(plain.glyphFor('ب', 'med')).toEqual(base.glyphFor('ب', 'med'));
      expect(plain.renderLine('بسم')).toBe(base.renderLine('بسم'));
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
      // all the tall stems at one height, the lam's (c: the alif a little under it, never over)
      const top = (c: string, f: Form) => Math.max(...th.glyphFor(c, f)!.s.flatMap(s => s.pts.map(p => p[1])));
      expect(top('ل', 'ini') - top('ا', 'iso')).toBeLessThan(stems === 'c' ? 0.6 : 0.3);
      expect(top('ل', 'ini') - top('ا', 'iso')).toBeGreaterThan(stems === 'c' ? 0.1 : -0.3);
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

describe('the recommended and the chosen alternatives read no worse than today', () => {
  const THRESHOLD = 0.3;
  for (const [sn, set] of [
    ['recommended', RECOMMENDED],
    ['chosen', CHOSEN],
  ] as const)
    // prettier-ignore
    for (const [pn, pen] of [
    ['roundel', ROUNDEL_PEN],
    ['tile', TILE_PEN],
  ] as const)
    // prettier-ignore
    it(`no pair of letter shapes under ${THRESHOLD} that is not under it today, and none of those closer (${sn} set, ${pn} pen)`, () => {
      const key = (c: { a: string; b: string; form: string }) => `${c.a}/${c.b} ${c.form}`,
        today = new Map(confusionMatrix(thuluth(pen)).map(c => [key(c), c.d]));
      for (const c of confusionMatrix(thuluth({ ...pen, alts: set }))) {
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

describe('the chosen set (stems c): room round the tall stems', () => {
  // The heads of c stand out to the right of their shafts, and its alif is as heavy as its lam: the owner found the
  // alif set tight. Pinned on 14 November 2026: the least room (ink to ink, in nibs) between a stem's upper part and
  // the stem beside it, on a line, at each pen. (Measured: roundel / line / band.)
  const PAIRS: [text: string, stem: number, other: number, least: number][] = [
    ['ال', 0, 1, 1.2], // 1.35 / 1.78 / 1.54: the alif's full head and the lam's lesser one
    ['الل', 1, 2, 0.8], // 0.86 / 1.78 / 1.27 (0.32 / 0.75 / 0.57 as first drafted): two joined lams
    ['قال', 1, 2, 1.1], // 1.21 / 1.55 / 1.36
    ['الا', 0, 1, 0.9], // 0.99 / 1.21 / 1.09: an alif before a lam-alif
    ['طلا', 0, 1, 1.0], // 1.06 / 1.72 / 1.36 (0.60 at the roundel pen as first drafted)
    ['ملك', 1, 2, 0.55], // 0.59 / 1.14 / 0.82 (0.30 as first drafted): the kaf's shoulder towards the lam
    ['إياك', 2, 3, 0.8], // 0.83 / 1.04 / 0.91
    ['الصمد', 1, 2, 0.4], // 0.43 / 1.04 / 0.66 (0.16 / 0.78 / 0.39): the sad's loop beside the lam
  ];
  for (const pen of ['roundel', 'line', 'band'] as const)
    it(`on a line, ${pen} pen`, () => {
      const th = thuluth({ ...thuluthStyleOf({ preset: pen }), alts: CHOSEN });
      for (const [text, stem, other, least] of PAIRS) {
        const inks = letterInks(th, [{ b: th.buildStrokes(text) }]),
          a = inks.find(e => e.li === stem)!,
          b = inks.find(e => e.li === other)!,
          gap = inkGap(a.quads.filter(q => q.y0 > a.base + 3.4), b.quads) / th.style.nib; // prettier-ignore
        expect(gap, `${text}: ${a.c} and ${b.c}`).toBeGreaterThanOrEqual(least);
        // and no stem's upper part touches anything in these words
        for (const r of stemRoom(inks)) expect(r.gap, `${text}: ${r.stem.c}`).toBeGreaterThan(0);
      }
    });
  it('c draws its head for the pen that writes it, and a lesser one on a lam after a stem', () => {
    const reach = (th: ReturnType<typeof thuluth>, text: string, li: number) => {
      const e = letterInks(th, [{ b: th.buildStrokes(text) }]).find(q => q.li === li)!,
        shaft = e.quads.filter(q => q.y0 > e.base + 4 && q.y1 < e.base + 6);
      // how far the head stands out to the right of the shaft, in nibs
      return (Math.max(...e.quads.map(q => q.x1)) - Math.max(...shaft.map(q => q.x1))) / th.style.nib;
    };
    const at = (pen: 'roundel' | 'line' | 'band') => thuluth({ ...thuluthStyleOf({ preset: pen }), alts: CHOSEN }),
      big = reach(at('roundel'), 'ا', 0);
    expect(big).toBeGreaterThan(0.3);
    for (const pen of ['line', 'band'] as const) expect(Math.abs(reach(at(pen), 'ا', 0) - big)).toBeLessThan(0.12);
    expect(reach(at('roundel'), 'ال', 1)).toBeLessThan(big * 0.85);
    expect(reach(at('roundel'), 'لا', 0)).toBeGreaterThan(reach(at('roundel'), 'الا', 1));
    // a and b draw every stem alike
    const a = thuluth({ ...ROUNDEL_PEN, alts: { stems: 'a' } });
    expect(a.buildStrokes('ال').placed.filter(isLetter)[1].g).toBe(a.glyphFor('ل', 'iso'));
  });
  it('in a roundel a piece keeps its space from a stem it faces, with innerGap and without', () => {
    const th = thuluth({ ...ROUNDEL_PEN, alts: CHOSEN }),
      now = thuluth(ROUNDEL_PEN),
      least = (t: ReturnType<typeof thuluth>, text: string, how: object) => {
        const r = buildRoundel(t, { text, compose: { elongate: true, cross: true, kern: true, tries: 2, iters: 3000, ...how }, frame: {} })!.r, // prettier-ignore
          quads = r.shapes.map((S, g) => strokeQuads(t, S.b.strokes, r.st[g].x, r.st[g].y));
        let d = Infinity;
        r.groups.forEach((g, i) => {
          const p = r.groups[i - 1];
          // an alif (or lam-alif) and the piece after it in its word
          if (p && p.word === g.word && /[اﻻ]$/.test(p.s)) d = Math.min(d, inkGap(quads[i - 1], quads[i]));
        });
        return d / t.style.nib;
      };
    for (const text of ['بسم الله الرحمن الرحيم', 'قل هو الله أحد الله الصمد'])
      for (const how of [
        { lanes: {} },
        { ruled: true },
        { lanes: {}, wordGap: 2.4, innerGap: 0.7 },
        { ruled: true, wordGap: 1.6, innerGap: 0.7 },
      ])
        // prettier-ignore
        expect(least(th, text, how), `${text} ${JSON.stringify(how)}`).toBeGreaterThanOrEqual(STEM_CLEAR - 0.02);
    // (today's letters, kerned, touch there: the lam's hairline lead-in on the alif's shaft)
    expect(least(now, 'بسم الله الرحمن الرحيم', { lanes: {} })).toBeLessThan(0.2);
  }, 240_000);
});

describe('the chosen set in a roundel: the name محمد and the kashida', () => {
  const th = thuluth({ ...ROUNDEL_PEN, alts: CHOSEN }),
    now = thuluth(ROUNDEL_PEN),
    variants = (t: ReturnType<typeof thuluth>, text: string, s: string) => {
      const p = roundelPieces(t, text, { elongate: true, kern: true, lanes: {} })!;
      return p.shapes[p.groups.findIndex(g => g.s === s)];
    };
  it('every way of writing the name is its ligature, so two of them in one composition are alike', () => {
    const vs = variants(th, 'اللهم صل على محمد وآل محمد', 'محمد');
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) {
      expect(v.stacked ?? false).toBe(false);
      expect(v.elong ?? 0).toBe(0);
      expect(v.b.placed.filter(isLetter)[0].oy).toBeGreaterThan(2);
      expect(v.b.placed.some(p => 'kash' in p)).toBe(false);
    }
    // today's letters are stacked and drawn out as before
    expect(variants(now, 'اللهم صل على محمد وآل محمد', 'محمد').some(v => v.stacked)).toBe(true);
    // and a word that only holds the name's letters is no ligature
    expect(variants(th, 'الحمد لله', 'لحمد').some(v => v.stacked)).toBe(true);
  });
  it('no kashida between a lam and a ra', () => {
    for (const v of variants(th, 'بسم الله الرحمن الرحيم', 'لر')) {
      expect(v.elong ?? 0).toBe(0);
      expect(v.b.placed.some(p => 'kash' in p)).toBe(false);
    }
    expect(variants(now, 'بسم الله الرحمن الرحيم', 'لر').some(v => v.elong)).toBe(true);
    expect(th.buildStrokes('الرحيم', { kashida: 4 }).placed.filter(p => 'kash' in p).length).toBe(2);
    expect(now.buildStrokes('الرحيم', { kashida: 4 }).placed.filter(p => 'kash' in p).length).toBe(3);
    // other joins stretch as before
    expect(variants(th, 'بسم الله الرحمن الرحيم', 'بسم').some(v => v.elong)).toBe(true);
  });
});
