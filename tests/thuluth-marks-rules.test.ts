// The rules for the marks from the Arabic sources (PORT-PLAN.md §1–2; lab marks2.js): fatha length by its space, all
// fathas parallel, three pens, the clarifying letters, and the dagger alif of الله seated on its shadda.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { ALIF_ANG, ALIF_PEN } from '../src/script/thuluth/marks';
import type { FrameOptions, RoundelSpec } from '../src/script/thuluth/roundel';
import { buildRoundel, FATHA_DOTS, miniSign } from '../src/script/thuluth/roundel';
import type { Stroke } from '../src/script/thuluth/types';

const th = thuluth(ROUNDEL_PEN),
  nib = th.style.nib;
const build = (text: string, frame: FrameOptions = {}) => {
  const spec: RoundelSpec = { text, compose: { elongate: true, cross: true, kern: true, tries: 2, iters: 1500 }, frame: { ornaments: true, density: 0.4, ...frame } }; // prettier-ignore
  return buildRoundel(th, spec)!.f.solved!;
};
const box = (s: Stroke) => {
  const xs = s.s.map(q => q.x),
    ys = s.s.map(q => q.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

describe('mark rules', () => {
  const light = build('اَللّٰهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ');
  it('gives each fatha a length from the sources, in dots of the main pen', () => {
    expect(light.fathas.length).toBeGreaterThanOrEqual(4);
    for (const f of light.fathas) expect(Object.values(FATHA_DOTS)).toContain(f);
  });
  it('keeps all fathas parallel, a long one with the main pen', () => {
    // a fatha drawn to length: one straight stroke, thinning from 0.3 to 0.35
    const fathas = light.strokes.filter(s => s.s[0].w === 0.3 && s.s.at(-1)!.w === 0.35);
    expect(fathas.length).toBe(light.fathas.length);
    const slant = (s: Stroke) => Math.atan2(s.s[0].y - s.s.at(-1)!.y, s.s[0].x - s.s.at(-1)!.x);
    for (const s of fathas) expect(slant(s)).toBeCloseTo(slant(fathas[0]), 6);
    const pens = fathas.map(s => +(s.nib! / nib).toFixed(3)).sort();
    expect(pens).toEqual(light.fathas.map(f => (f === 10 ? 1 : 0.391)).sort());
  });
  it('can go back to the short mark', () => {
    const old = build('اَللّٰهُ نُورُ', { fathaRule: false });
    expect(old.fathas.every(f => f === 0)).toBe(true);
  });
  it('seats the dagger alif of الله on its shadda, upright at the stems’ angle with half the pen', () => {
    const s = build('اللّٰهُ'),
      alif = s.strokes.filter(q => q.ang === ALIF_ANG);
    expect(alif).toHaveLength(1);
    expect(alif[0].nib).toBeCloseTo(nib * ALIF_PEN, 6);
    const a = box(alif[0]),
      cx = (a.x0 + a.x1) / 2;
    // the shadda: the widest mark just beneath it
    const below = s.strokes
      .filter(q => q !== alif[0] && q.mark)
      .map(box)
      .filter(b => b.x0 < cx && b.x1 > cx && b.y1 <= a.y0 + nib && b.y1 > a.y0 - nib * 1.5);
    expect(below.length).toBeGreaterThanOrEqual(1);
    expect(a.y1 - a.y0).toBeGreaterThan((a.x1 - a.x0) * 2);
  });
  it('writes a clarifying letter under ح س ص ط ع ك م, made from the engine’s own letter', () => {
    expect(build('حُسَيْن').signs.sort()).toEqual(['mini:ح', 'mini:س']);
    expect(build('حُسَيْن', { allSigns: false }).signs.sort()).toEqual(['minihah', 'minisin']);
    for (const c of 'حسصطعكم') expect(miniSign(th, c), c).not.toBeNull();
  });
});
