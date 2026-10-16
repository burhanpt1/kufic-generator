// The thuluth core (src/script/thuluth): the lab's line engine, pen, letter set and a pure rasteriser in place of the
// canvas, checked against the lab's own output.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THULUTH, ROUNDEL_PEN, TILE_PEN, isLetter, thuluth } from '../src/script/thuluth/engine';
import { LETTERS } from '../src/script/thuluth/letters.data';
import { dotPolys, nibPolys, sampleStroke } from '../src/script/thuluth/pen';
import { Alpha, toPixels } from '../src/script/thuluth/raster';
import { DOTS, forms, parseVowels, splitGroups } from '../src/script/thuluth/shape';
import type { Poly } from '../src/script/thuluth/types';

const dir = join(import.meta.dirname, 'golden-thuluth-lab');
// the lab's specimen texts (tools/render_reference.py), neutral words and names
const SPEC = [
  'زينب وقصي',
  'بسم الله الرحمن الرحيم',
  'محمد رسول الله',
  'الحمد لله',
  'قصي',
  'صبر',
  'سبحان الله',
  'حافظوا على',
  'مودة ورحمة',
];

describe('thuluth line engine', () => {
  // the lab's own letters: the later fixes (fixes.ts) are meant to differ from it
  it('reproduces every lab line reference exactly, at the roundel pen and the tile pen', () => {
    for (const [pen, style] of [
      ['roundel', ROUNDEL_PEN],
      ['tile', TILE_PEN],
    ] as const) {
      const th = thuluth({ ...style, labLetters: true });
      SPEC.forEach((t, i) => {
        const id = `line-${String(i).padStart(2, '0')}-${pen}`;
        expect(th.renderLine(t, { U: 10, pad: 2 }), id).toBe(readFileSync(join(dir, `${id}.svg`), 'utf8'));
      });
    }
  });
  it('is deterministic and keeps no state between engines', () => {
    const a = thuluth(ROUNDEL_PEN).renderLine(SPEC[0]),
      t = thuluth(TILE_PEN);
    t.renderLine(SPEC[1]);
    expect(thuluth(ROUNDEL_PEN).renderLine(SPEC[0])).toBe(a);
    expect(thuluth(ROUNDEL_PEN).renderLine(SPEC[0])).toBe(a);
  });
  it('gives every letter its dots: زينب has 1 + 2 + 1 + 1', () => {
    const th = thuluth(ROUNDEL_PEN);
    expect(th.buildStrokes('زينب').dots).toHaveLength(5);
    for (const w of ['قصي', 'فاطمة', 'خديجة', 'شجرة', 'ثابت', 'ظفر', 'غيث', 'ضياء', 'بنت']) {
      const want = [...w].reduce((a, c) => a + (DOTS[c] ?? []).reduce((x, [, n]) => x + n, 0), 0);
      expect(th.buildStrokes(w).dots, w).toHaveLength(want);
    }
  });
  it('stretches joins with kashida and keeps loop letters apart', () => {
    const th = thuluth(DEFAULT_THULUTH),
      width = (o: object) => {
        const xs = th.buildStrokes('صبر', o).strokes.flatMap(s => s.s.map(q => q.x));
        return Math.max(...xs) - Math.min(...xs);
      };
    expect(width({ kashida: 3 })).toBeGreaterThan(width({}) + 2.5);
    // two joined loop letters (fa, sad) always get a stretch of baseline
    expect(th.setLine('فص').some(p => 'kash' in p)).toBe(true);
  });
  it('uses the great roundel gestures only when asked', () => {
    const plain = thuluth(ROUNDEL_PEN),
      great = thuluth({ ...ROUNDEL_PEN, great: { ya: true, yaWide: 2.6, yaDeep: 1.3 } });
    const depth = (th: typeof plain) => Math.min(...th.buildStrokes('قصي').strokes.flatMap(s => s.s.map(q => q.y)));
    expect(depth(great)).toBeLessThan(depth(plain) - 2);
  });
});

describe('thuluth letter set', () => {
  it('holds the lab set (master fits over learned over hand) with each form’s source', () => {
    const src = Object.values(LETTERS).flatMap(f => Object.values(f).map(g => g.src));
    expect(new Set(src)).toEqual(new Set(['hand', 'learned', 'master']));
    expect(LETTERS.waw.fin?.src).toBe('master');
    expect(LETTERS.ain.ini?.src).toBe('master');
    expect(LETTERS.mim.med?.src).toBe('master');
    expect(LETTERS.sad.med?.src).toBe('master');
    expect(LETTERS.tooth.ini?.src).toBe('learned');
    expect(LETTERS.kaf.fin?.src).toBe('hand');
  });
  it('shapes joining forms, the lam-alif ligature, vowels and connected groups', () => {
    expect(forms('محمد').map(f => f.form)).toEqual(['ini', 'med', 'med', 'fin']);
    expect(forms('الله').map(f => f.c)).toEqual(['ا', 'ل', 'ل', 'ه']);
    expect(forms('سلام').map(f => f.c)).toEqual(['س', 'ﻻ', 'م']);
    const v = parseVowels('زَيْنَب وَقُصَيّ');
    expect(v.bare).toBe('زينب وقصي');
    expect(v.marks[1]).toEqual([
      { li: 0, m: 'fatha' },
      { li: 1, m: 'damma' },
      { li: 2, m: 'fatha' },
      { li: 3, m: 'shadda' },
    ]);
    expect(splitGroups('زينب وقصي').map(g => g.s)).toEqual(['ز', 'ينب', 'و', 'قصي']);
    expect(splitGroups('الحمد لله').find(g => g.s.startsWith('لل'))?.allah).toBe(true);
  });
});

describe('thuluth pen', () => {
  it('passes the skeleton points and breaks curves at corners', () => {
    const s = sampleStroke([[0, 0], [2, 1, 1, 1], [4, 0]], 0.5, 4); // prettier-ignore
    expect(s[0]).toEqual({ x: 0, y: 0, w: 1 });
    expect(s.some(q => q.x === 2 && q.y === 1)).toBe(true);
    expect(s[s.length - 1]).toEqual({ x: 4, y: 0, w: 1 });
  });
  it('sweeps one quad per segment, two with a minimum-thickness floor', () => {
    const s = sampleStroke([[0, 0], [3, 0]], 0.5, 6); // prettier-ignore
    expect(nibPolys(s, 1, 69, 0)).toHaveLength(s.length - 1);
    expect(nibPolys(s, 1, 69, 0.3)).toHaveLength(2 * (s.length - 1));
    // a horizontal stroke is as thick as the nib's vertical extent: sin(69°)
    const ys = nibPolys(s, 1, 69, 0)
      .flat()
      .map(p => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(Math.sin((69 * Math.PI) / 180), 9);
    expect(dotPolys(0, 0, 1, 69, 0)).toHaveLength(1);
  });
});

describe('thuluth rasteriser', () => {
  const sq = (x: number, y: number, s: number): Poly => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]]; // prettier-ignore
  it('covers whole and partial pixels by area', () => {
    const A = new Alpha(4, 4);
    A.fill([sq(1, 1, 2)]);
    expect(Array.from(A.a)).toEqual([0, 0, 0, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0]);
    const B = new Alpha(2, 1);
    B.fill([sq(0.5, 0, 1)]);
    expect(Array.from(B.a)).toEqual([128, 128]);
  });
  it('unions the polygons of one fill, and composites separate fills', () => {
    const one = new Alpha(2, 1);
    one.fill([sq(0.5, 0, 1), sq(0.5, 0, 1)]);
    expect(one.a[0]).toBe(128);
    const two = new Alpha(2, 1);
    two.fill([sq(0.5, 0, 1)]);
    two.fill([sq(0.5, 0, 1)]);
    expect(two.a[0]).toBe(192);
  });
  it('matches the lab’s canvas within 3% of the ink', () => {
    const fx: { text: string; K: number; x0: number; y1: number; W: number; H: number; scale: number; threshold: number; runs: number[] }[] =
      JSON.parse(readFileSync(join(dir, 'canvas-masks.json'), 'utf8')); // prettier-ignore
    const th = thuluth(ROUNDEL_PEN);
    for (const f of fx) {
      const ref = new Uint8Array(f.W * f.H);
      let i = 0;
      f.runs.forEach((n, k) => {
        if (k % 2) ref.fill(1, i, i + n);
        i += n;
      });
      const X = (x: number) => (x - f.x0) * f.K,
        Y = (y: number) => (f.y1 - y) * f.K,
        A = new Alpha(f.W, f.H),
        b = th.buildStrokes(f.text);
      b.strokes.forEach(s => A.fill(toPixels(th.strokePolys(s, f.scale), X, Y)));
      b.dots.forEach(([x, y]) => A.fill(toPixels(th.dotPolysAt(x, y), X, Y)));
      const m = A.mask(f.threshold);
      let ink = 0,
        diff = 0;
      for (let k = 0; k < m.length; k++) {
        ink += ref[k];
        diff += ref[k] !== m[k] ? 1 : 0;
      }
      expect(ink, f.text).toBeGreaterThan(300);
      expect(diff / ink, f.text).toBeLessThan(0.03);
    }
  });
});

it('marks letters, kashidas and stacked joins apart in a set line', () => {
  const p = thuluth(DEFAULT_THULUTH).setLine('محمد', { kashMap: { 2: 4 } });
  expect(p.filter(isLetter)).toHaveLength(4);
  expect(p.filter(q => 'kash' in q)).toHaveLength(1);
});
