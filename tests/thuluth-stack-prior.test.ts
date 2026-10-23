// The learned stacking prior (PORT-PLAN.md §6; lab tarkib.js STACK_PRIOR): stack the joins masters stack.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { composeRoundel, groupVariants, stackable, stackDepth, stackWeight } from '../src/script/thuluth/roundel';
import { splitGroups } from '../src/script/thuluth/shape';

describe('learned stacking', () => {
  it('opens the joins masters stack, and keeps the rule otherwise', () => {
    // حسين: sin (0.125) stays closed, final nun (0.31) opens; ya medial is a tooth
    expect(stackable('حسين')).toEqual([]);
    expect(stackable('حسين', { learnedStack: true })).toEqual([3]);
    // محمد: before hah and mim by the rule, and before the final dal (0.5) too
    expect(stackable('محمد')).toEqual([1, 2]);
    expect(stackable('محمد', { learnedStack: true })).toEqual([1, 2, 3]);
    expect(stackable('محمد', { learnedStack: true, stackMin: 0.45 })).toEqual([3]);
  });
  it('pulls each join by how often masters stack it', () => {
    expect(stackWeight('محمد', 1)).toBe(1);
    expect(stackWeight('محمد', 3, { learnedStack: true })).toBeCloseTo(1.25, 6);
    expect(stackWeight('بر', 1, { learnedStack: true })).toBeCloseTo(0.559 / 0.4, 6);
    expect(stackWeight('بن', 1, { learnedStack: true })).toBeCloseTo(0.306 / 0.4, 6);
  });
  it('lowers the composer’s energy for the names it opens joins in', () => {
    const th = thuluth(ROUNDEL_PEN),
      E = (learnedStack: boolean) => composeRoundel(th, 'حسن', { elongate: true, cross: true, deep: true, tries: 2, iters: 2000, seed: 29, learnedStack })[0]; // prettier-ignore
    const a = E(false),
      b = E(true);
    expect(b.E).toBeLessThan(a.E);
    expect(b.shapes.some(s => s.stacked)).toBe(true);
  });
});

describe('stacking like the masters', () => {
  const th = thuluth(ROUNDEL_PEN);
  it('drops a stacked letter as far as masters do for the pair', () => {
    const alif = Math.max(...th.glyphFor('ا', 'iso')!.s.flatMap(st => st.pts.map(q => q[1])));
    expect(stackDepth(th, 'لر', 1)).toBeCloseTo(0.463 * alif, 6);
    // a pair seen level in the medians still drops past the stacking threshold
    expect(stackDepth(th, 'حم', 1)).toBeCloseTo(0.25 * alif, 6);
    expect(stackDepth(th, 'بب', 1)).toBeNull();
  });
  it('builds towers of three stacked joins on a long run', () => {
    const [g] = splitGroups('محمد'),
      vs = groupVariants(th, g, { learnedStack: true, towers: true, deep: true }, 1.6);
    expect(vs.some(v => v.tower === 3)).toBe(true);
    expect(groupVariants(th, g, { learnedStack: true }, 1.6).some(v => v.tower)).toBe(false);
  });
  it('makes a cradle of a shallower bowl when nesting', () => {
    const shelves = (nest: boolean) =>
      splitGroups('حسن قرين').flatMap(g => groupVariants(th, g, { nest }, 1.6)).filter(v => v.shelves.some(s => s.cradle)).length; // prettier-ignore
    expect(shelves(true)).toBeGreaterThan(shelves(false));
  });
});
