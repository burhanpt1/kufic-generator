// The rules for the marks from the Arabic sources (PORT-PLAN.md §1–2; lab marks2.js): fatha length by its space, all
// fathas parallel, three pens, the clarifying letters; the dagger alif of الله, once seated on its shadda, is now drawn
// by the ligature of the name (tests/thuluth-allah.test.ts).
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { ALIF_ANG, ALIF_PEN } from '../src/script/thuluth/marks';
import type { FrameOptions, RoundelSpec } from '../src/script/thuluth/roundel';
import { buildRoundel, FATHA_DOTS, miniSign } from '../src/script/thuluth/roundel';
import type { Stroke } from '../src/script/thuluth/types';

const th = thuluth(ROUNDEL_PEN),
  nib = th.style.nib;
const built = (text: string, frame: FrameOptions = {}) => {
  const spec: RoundelSpec = { text, compose: { elongate: true, cross: true, kern: true, tries: 2, iters: 1500 }, frame: { ornaments: true, density: 0.4, ...frame }, judge: 1 }; // prettier-ignore
  return buildRoundel(th, spec)!;
};
const build = (text: string, frame: FrameOptions = {}) => built(text, frame).f.solved!;
/** The small alif of الله, drawn by its ligature: strokes at the marks' angle and pen in the name's own ink. */
const allahAlif = (b: ReturnType<typeof built>) =>
  b.r.shapes[b.r.groups.findIndex(g => g.allah)].b.strokes.filter(q => q.ang === ALIF_ANG && Math.abs((q.nib ?? 0) - nib * ALIF_PEN) < 1e-9); // prettier-ignore
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
  it('draws the dagger alif of الله, as the text writes it, in its ligature: upright at the stems’ angle with half the pen', () => {
    const b = built('اللّٰهُ'),
      alif = allahAlif(b);
    expect(alif).toHaveLength(1);
    // not also among the solved marks
    expect(b.f.solved!.strokes.filter(q => q.ang === ALIF_ANG)).toHaveLength(0);
    const a = box(alif[0]);
    expect(a.y1 - a.y0).toBeGreaterThan((a.x1 - a.x0) * 2);
    // without it in the text, the name is drawn without it
    expect(allahAlif(built('اللّهُ'))).toHaveLength(0);
  });
  it('writes a clarifying letter under ح س ص ط ع ك م, made from the engine’s own letter', () => {
    expect(build('حُسَيْن').signs.sort()).toEqual(['mini:ح', 'mini:س']);
    expect(build('حُسَيْن', { allSigns: false }).signs.sort()).toEqual(['minihah', 'minisin']);
    for (const c of 'حسصطعكم') expect(miniSign(th, c), c).not.toBeNull();
  });
});

describe('marks, second generation', { timeout: 180_000 }, () => {
  const text = 'اَللّٰهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ';
  it('thin from Sâmi to Râkım: fathas go first, the shadda and dagger alif stay', () => {
    const dense = build(text, { markDensity: 1 }),
      mid = build(text, { markDensity: 0.5 }),
      sparseRoundel = built(text, { markDensity: 0.1 }),
      sparse = sparseRoundel.f.solved!;
    expect(dense.fathas.length).toBeGreaterThan(0);
    expect(mid.fathas).toHaveLength(0);
    expect(sparse.count).toBeLessThan(mid.count);
    // the dagger alif belongs to the ligature of the name, which thinning never touches
    expect(allahAlif(sparseRoundel)).toHaveLength(1);
    expect(sparse.signs).toHaveLength(0);
  });
  it('keep a clearance as a rule, and report what could not be cleared', () => {
    const loose = build(text),
      clear = build(text, { clearance: 0.8 });
    expect(loose.clearFaults).toBe(0); // no clearance asked, none reported
    expect(clear.clearFaults).toBeLessThanOrEqual(Math.ceil(clear.count / 4));
  });
  it('write the long fatha only across a gap when asked', () => {
    const all = build(text),
      gap = build(text, { fathaGap: true }),
      longs = (f: number[]) => f.filter(x => x === FATHA_DOTS.long).length;
    expect(longs(gap.fathas)).toBeLessThanOrEqual(longs(all.fathas));
  });
});
