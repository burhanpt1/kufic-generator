// Legibility rules for thuluth (HANDOVER §9): each is a mistake caught by eye in the lab, kept as a rule the engine must
// keep. Letters are compared as rasters of their ink (no dots), so a redesign that drifts towards its neighbour fails.
import { describe, expect, it } from 'vitest';
import type { Form, SkelPt, Stroke, Thuluth } from '../src/script/thuluth';
import {
  Alpha,
  ROUNDEL_PEN,
  TILE_PEN,
  isLetter,
  lineMarks,
  parseVowels,
  sampleStroke,
  thuluth,
  toPixels,
} from '../src/script/thuluth';
import { buildRoundel, findCounters } from '../src/script/thuluth/roundel';

const PENS = { roundel: ROUNDEL_PEN, tile: TILE_PEN };
const strokesOf = (th: Thuluth, c: string, form: Form): Stroke[] =>
  th
    .glyphFor(c, form)!
    .s.map(s => ({ ang: s.ang ?? th.style.ang, s: sampleStroke(s.pts as SkelPt[], th.style.tension) }));

/** Ink of strokes on a K px/unit raster, the right edge at x = 28 units (letters align where the pen starts). */
function inkMask(th: Thuluth, strokes: Stroke[], K = 4) {
  let x1 = -1e9;
  strokes.forEach(s => s.s.forEach(q => (x1 = Math.max(x1, q.x))));
  const A = new Alpha(30 * K, 26 * K),
    X = (x: number) => (x - x1 + 28) * K,
    Y = (y: number) => (14 - y) * K;
  strokes.forEach(s => A.fill(toPixels(th.strokePolys(s), X, Y)));
  return A.mask(100);
}
function iou(a: Uint8Array, b: Uint8Array) {
  let i = 0,
    u = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] && b[k]) i++;
    if (a[k] || b[k]) u++;
  }
  return i / u;
}

/** Dots per letter, from Arabic orthography (independent of the engine's table). */
const DOTS: Record<string, number> = { ب: 1, ت: 2, ث: 3, ج: 1, خ: 1, ذ: 1, ز: 1, ش: 3, ض: 1, ظ: 1, غ: 1, ف: 1, ق: 2, ن: 1, ي: 2, ة: 2 }; // prettier-ignore
const WORDS = ['زينب', 'قصي', 'بسم الله الرحمن الرحيم', 'ثبت', 'شجرة', 'ضيف', 'ظفر', 'غذاء', 'خبز', 'نجتني', 'فتى', 'مسئول', 'تثبيت', 'زيتونة']; // prettier-ignore

describe('dots', () => {
  for (const [pn, pen] of Object.entries(PENS))
    it(`every letter has its dots (${pn} pen)`, () => {
      const th = thuluth(pen);
      for (const text of WORDS) {
        const b = th.buildStrokes(text),
          letters = b.placed.filter(isLetter);
        const words = text.split(' ');
        for (const p of letters) {
          const want = DOTS[[...words[p.wi].replace(/لا/g, 'ﻻ')][p.li]] ?? 0,
            got = b.dotGroups.filter(d => d.wi === p.wi && d.li === p.li).reduce((a, d) => a + d.n, 0);
          expect(got, `${text}: ${p.c} (${p.form})`).toBe(want);
        }
        const total = [...text.replace(/\s/g, '')].reduce((a, c) => a + (DOTS[c] ?? 0), 0);
        expect(b.dots, text).toHaveLength(total);
      }
      expect(thuluth(pen).buildStrokes('زينب').dots).toHaveLength(5);
    });
});

describe('marks stay off the letters', () => {
  for (const [pn, pen] of Object.entries(PENS))
    it(`vowels in a line (${pn} pen)`, () => {
      const th = thuluth(pen);
      for (const text of [
        'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُمْ',
        'زَيْنَب وَقُصَيّ',
      ]) {
        const pv = parseVowels(text),
          bs = th.buildStrokes(pv.bare),
          { strokes, missing } = lineMarks(th, bs, pv.marks, 16, -6);
        expect(missing, text).toBe(0);
        let x0 = 1e9,
          x1 = -1e9;
        bs.strokes.forEach(s => s.s.forEach(q => ((x0 = Math.min(x0, q.x)), (x1 = Math.max(x1, q.x)))));
        const K = 4,
          W = Math.ceil((x1 - x0 + 8) * K),
          H = 26 * K,
          X = (x: number) => (x - x0 + 4) * K,
          Y = (y: number) => (18 - y) * K;
        const ink = new Alpha(W, H),
          mk = new Alpha(W, H);
        bs.strokes.forEach(s => ink.fill(toPixels(th.strokePolys(s), X, Y)));
        bs.dots.forEach(([x, y]) => ink.fill(toPixels(th.dotPolysAt(x, y), X, Y)));
        strokes.forEach(s => mk.fill(toPixels(th.strokePolys(s), X, Y)));
        const a = ink.mask(100),
          m = mk.mask(100);
        let on = 0,
          all = 0;
        for (let i = 0; i < m.length; i++)
          if (m[i]) {
            all++;
            if (a[i]) on++;
          }
        expect(all, text).toBeGreaterThan(0);
        expect(on / all, text).toBeLessThan(0.02);
      }
    });
  it('dots and vowels in a roundel', () => {
    const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true, yaWide: 2.6, yaDeep: 1.3 } }),
      { r, f } = buildRoundel(th, {
        text: 'زَيْنَب وَقُصَيّ',
        compose: { tries: 2, oval: 1.45, cross: true, elongate: true },
      })!;
    expect(f.missing).toBe(0);
    for (const it of f.solved!.items)
      for (const jt of f.solved!.items) {
        if (it === jt) continue;
        const ox = Math.min(it.x + it.w / 2, jt.x + jt.w / 2) - Math.max(it.x - it.w / 2, jt.x - jt.w / 2),
          oy = Math.min(it.y + it.h / 2, jt.y + jt.h / 2) - Math.max(it.y - it.h / 2, jt.y - jt.h / 2);
        expect(Math.min(ox, oy), 'marks overlap').toBeLessThan(0.3);
      }
    expect(r.groups.length).toBeGreaterThan(1);
  });
});

/** Pairs a reader confuses when the letters drift (HANDOVER §9), and the letter that tells each apart. */
const PAIRS: [string, string, [string, Form], [string, Form]][] = [
  ['الحمد', 'العمد', ['ح', 'med'], ['ع', 'med']],
  ['قلب', 'غلب', ['ق', 'ini'], ['غ', 'ini']],
  ['فصل', 'خصل', ['ف', 'ini'], ['خ', 'ini']],
  ['محمد', 'محمر', ['د', 'fin'], ['ر', 'fin']],
  ['بارك', 'بارد', ['ك', 'iso'], ['د', 'iso']],
  ['ملك', 'ملد', ['ك', 'fin'], ['د', 'fin']],
  ['بارك', 'بارل', ['ك', 'iso'], ['ل', 'iso']],
  ['ملك', 'ملل', ['ك', 'fin'], ['ل', 'fin']],
  ['ورد', 'وود', ['ر', 'iso'], ['و', 'iso']],
];
describe('confusable letters stay apart', () => {
  for (const [pn, pen] of Object.entries(PENS))
    for (const [w1, w2, a, b] of PAIRS)
      it(`${w1} / ${w2} (${pn} pen)`, () => {
        const th = thuluth(pen);
        expect(iou(inkMask(th, strokesOf(th, ...a)), inkMask(th, strokesOf(th, ...b)))).toBeLessThan(0.3);
        // and the words differ where those letters stand
        const pa = th
            .buildStrokes(w1)
            .placed.filter(isLetter)
            .map(p => p.g),
          pb = th
            .buildStrokes(w2)
            .placed.filter(isLetter)
            .map(p => p.g);
        expect(pa.some((g, i) => g !== pb[i])).toBe(true);
      });
});

const counters = (th: Thuluth, c: string, form: Form) => findCounters(th, strokesOf(th, c, form), { max: 1e9 }).length;
describe('counters', () => {
  // the loop letters that show an open counter at the roundel pen today; mim, waw, initial heh and initial ta have
  // solid heads at this weight, as jali often writes them
  const OPEN: [string, Form][] = [
    ['ف', 'ini'], ['ف', 'med'], ['ف', 'fin'], ['ق', 'ini'], ['ق', 'med'], ['ق', 'fin'], ['ق', 'iso'], ['ص', 'ini'],
    ['ص', 'med'], ['ص', 'fin'], ['ص', 'iso'], ['ط', 'med'], ['ط', 'fin'], ['ط', 'iso'], ['م', 'fin'], ['م', 'iso'],
    ['ه', 'fin'], ['ه', 'iso'], ['ة', 'fin'], ['ح', 'fin'], ['ح', 'iso'], ['ع', 'fin'],
  ]; // prettier-ignore
  it('loop letters keep open counters at the roundel pen', () => {
    const th = thuluth(ROUNDEL_PEN);
    for (const [c, form] of OPEN) expect(counters(th, c, form), `${c} ${form}`).toBeGreaterThanOrEqual(1);
  });
  it('no small closed loop where a bowl or a tail leaves a letter (the ta marbuta look-alike)', () => {
    for (const pen of [
      ROUNDEL_PEN,
      TILE_PEN,
      { ...ROUNDEL_PEN, great: { ya: true, nun: true, yaWide: 2.6, yaDeep: 1.3 } },
    ]) {
      const th = thuluth(pen);
      for (const c of 'نيىلسبرزدك')
        for (const form of ['fin', 'iso'] as Form[]) expect(counters(th, c, form), `${c} ${form}`).toBe(0);
    }
  });
  it('the great bowl of a cartouche stays open', () => {
    const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true, yaWide: 2.6, yaDeep: 1.3 } }),
      { r } = buildRoundel(th, {
        text: 'قصي',
        compose: { tries: 1, oval: 1.45 },
        bowl: { autoOval: true, clear: 5.6 },
      })!;
    const ink = r.shapes.flatMap((S, i) => S.b.strokes.map(s => ({ ...s, s: s.s.map(q => ({ x: q.x + r.st[i].x, y: q.y + r.st[i].y, w: q.w })) }))); // prettier-ignore
    // qaf's head and sad's loop, and nothing where the bowl leaves the ya
    expect(findCounters(th, ink).length).toBeLessThanOrEqual(2);
  });
});

describe('the lab letters stay available', () => {
  it('labLetters gives the lab kaf; the default gives the rebuilt one', () => {
    const lab = thuluth({ ...ROUNDEL_PEN, labLetters: true }),
      now = thuluth(ROUNDEL_PEN);
    expect(lab.glyphFor('ك', 'iso')!.s).toHaveLength(2);
    expect(now.glyphFor('ك', 'iso')!.s).toHaveLength(4);
    expect(lab.renderLine('محمد رسول الله')).toBe(now.renderLine('محمد رسول الله'));
  });
});
