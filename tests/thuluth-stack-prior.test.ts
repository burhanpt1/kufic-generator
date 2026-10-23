// The learned stacking prior (PORT-PLAN.md §6; lab tarkib.js STACK_PRIOR): stack the joins masters stack.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { composeRoundel, stackable, stackWeight } from '../src/script/thuluth/roundel';

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
