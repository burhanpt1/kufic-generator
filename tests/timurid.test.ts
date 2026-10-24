// The Timurid band (src/showpiece/timurid.ts; PLAN-2 §9): a Kufic line in the upper zone of a jali thuluth band.
import { describe, expect, it } from 'vitest';
import { timuridBand } from '../src/showpiece/timurid';

describe('the Timurid band', () => {
  const b = timuridBand('بسم الله الرحمن الرحيم', 'لا اله الا الله محمد رسول الله')!;
  it('sets the Kufic line above the thuluth bodies and below the stems’ tops', () => {
    expect(b.zone.y1 - b.zone.y0).toBeGreaterThan(1.5);
    expect(b.kufiCells).toBeGreaterThan(400);
  });
  it('lets the thuluth uprights pass over it, edged with a hairline in the ground', () => {
    expect(b.uprights).toBeGreaterThanOrEqual(5);
    expect(b.svg).toContain('paint-order="stroke"');
    expect(timuridBand('بسم الله الرحمن الرحيم', 'لا اله الا الله')!.svg).toBe(timuridBand('بسم الله الرحمن الرحيم', 'لا اله الا الله')!.svg); // prettier-ignore
  });
});
