// "Houses of rest" (src/showpiece/flat): a flat's plan as one A1 sheet. `FLAT=1 npx vitest run tests/flat.test.ts`
// writes the print file to docs/showpiece.
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadSealWasm } from '../src/kernels/seal';
import { kufi } from '../src/script/kufi';
import { DEFAULT_STYLE } from '../src/model/style';
import type { Shaped } from '../src/types';
import { FLAT, flatSheet } from '../src/showpiece/flat';
import { AN_NUR, rasm } from '../src/showpiece/an-nur';
import { altAz, lst, wanderers } from '../src/showpiece/sky';

await loadSealWasm();

describe('Houses of rest', () => {
  it('cuts its An-Nur phrases from the verified text, and every text shapes', () => {
    expect(rasm(AN_NUR[60]).includes(FLAT.hall)).toBe(true);
    expect(rasm(AN_NUR[60]).includes(FLAT.kitchen)).toBe(true);
    for (const t of Object.values(FLAT))
      expect((kufi.shape(t, DEFAULT_STYLE.letter) as Shaped).unsupported).toEqual([]);
  });
  it('puts the Moon and the planets where they were on nights that are known', () => {
    const at = (t: string) => Object.fromEntries(wanderers(new Date(t)).map(w => [w.body, w]));
    // the great conjunction of 21 December 2020: Jupiter and Saturn together at 300°, the Moon at first quarter
    const gc = at('2020-12-21T18:00:00Z');
    expect(gc.jupiter.lon).toBeCloseTo(300.3, 0);
    expect(Math.abs(gc.jupiter.lon - gc.saturn.lon)).toBeLessThan(0.3);
    expect(gc.moon.lit).toBeCloseTo(0.5, 1);
    expect(gc.moon.waxing).toBe(true);
    // the solar eclipse of 8 April 2024: a new Moon
    expect(at('2024-04-08T18:18:00Z').moon.lit).toBeLessThan(0.005);
    // the full Moon of 24 November 2026, three days before completion
    expect(at('2026-11-24T14:53:00Z').moon.lit).toBeGreaterThan(0.995);
    // completion night: a waning gibbous Moon rising in the east-north-east, Saturn high in the south
    const night = at('2026-11-27T21:00:00Z'),
      L = lst(new Date('2026-11-27T21:00:00Z'), -0.19),
      moon = altAz(night.moon.ra, night.moon.dec, 51.53, L),
      saturn = altAz(night.saturn.ra, night.saturn.dec, 51.53, L);
    expect(night.moon.waxing).toBe(false);
    expect(night.moon.lit).toBeCloseTo(0.85, 1);
    expect(moon.alt).toBeGreaterThan(10);
    expect(moon.az).toBeGreaterThan(60);
    expect(moon.az).toBeLessThan(90);
    expect(saturn.alt).toBeGreaterThan(30);
    expect(altAz(night.jupiter.ra, night.jupiter.dec, 51.53, L).alt).toBeLessThan(0);
  });
  it('makes one A1 sheet, on one pen, with nothing left out (resolve and wall-inscription warnings alike)', () => {
    const s = flatSheet();
    expect(s.warnings).toEqual([]);
    expect(s.h / s.w).toBeCloseTo(Math.SQRT2, 6);
    expect(s.pen.scale).toBeGreaterThan(0.4);
    expect(s.svg).toContain('aria-label="Houses of rest: a flat plan in square Kufic"');
    // the written rays remain an option
    expect(flatSheet({ rays: true }).warnings).toEqual([]);
    if (process.env.FLAT) {
      console.log('pen', s.pen);
      mkdirSync('docs/showpiece', { recursive: true });
      writeFileSync('docs/showpiece/houses-of-rest.svg', s.svg);
    }
  }, 600000);
});
