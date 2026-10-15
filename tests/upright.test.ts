// Straight bands read upright (owner's review: the Ninety-Nine Names along the top of the frame hung upside down).
// Curved and circular bands follow their curve, letters pointing to the centre, as on domes, coins and bowls.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { UPRIGHT } from '../src/compose/textBorder';
import { preset } from '../src/model/presets';
import { NAMES_99 } from '../src/mosque/texts';
import { frame } from '../src/showpiece/nur';

const lines = (c: Parameters<typeof resolve>[0]) =>
  resolve(c).items.filter(i => i.type === 'strip' && i.place.type === 'line' && i.place.s > 0.5);

describe('straight bands read upright', () => {
  it.each([
    ['octagon panel', preset('octagon-panel')],
    ['Light upon light frame', frame(NAMES_99.join(' '))],
  ])('%s: no straight band hangs upside down', (_, c) => {
    const ls = lines(c);
    expect(ls.length).toBeGreaterThan(3);
    for (const it of ls)
      if (it.type === 'strip' && it.place.type === 'line') expect(it.place.n[1]).toBeLessThanOrEqual(UPRIGHT);
  });
  it('the top of a frame reads upright: letters point up the page', () => {
    const top = lines(frame(NAMES_99.join(' '))).filter(
      it => it.type === 'strip' && it.place.type === 'line' && Math.abs(it.place.t[0]) > 0.99 && it.place.O[1] < 0,
    );
    expect(top.length).toBeGreaterThan(0);
    for (const it of top)
      if (it.type === 'strip' && it.place.type === 'line') expect(it.place.n[1]).toBeLessThan(-0.99);
  });
  it('circular bands are left to follow the circle', () => {
    const arcs = resolve(preset('fatimid-medallion')).items.filter(i => i.type === 'strip' && i.place.type === 'arc');
    expect(arcs.length).toBeGreaterThan(0);
  });
});
