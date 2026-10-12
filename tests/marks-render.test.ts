// Marks whose cells touch only diagonally (the three dots of ش, ث, پ, چ) are each drawn: the lone-cell pass used to
// drop any cell a diagonal link touched, and marks draw no links, so these dots vanished (found by the held-out seal
// review: شيء read as سيء).
import { describe, expect, it } from 'vitest';
import { prims } from '../src/render/prims';
import { resolve } from '../src/compose';
import { preset } from '../src/model/presets';
import { renderPlaced } from '../src/render/composition';

describe('diagonally touching marks', () => {
  it('are all lone cells', () => {
    // .#.
    // #.#
    const on = new Set(['1,0', '0,1', '2,1']),
      p = prims((x, y) => on.has(x + ',' + y), 3, 2);
    expect(p.lone).toHaveLength(3);
    expect(p.D).toHaveLength(0); // the letter pass still leaves them to the diagonal links
  });
  it.each([
    ['شيء', 'سيء', 3],
    ['ثمر', 'نمر', 2],
  ] as const)('are drawn: %s has %s’s dots plus %i', (withDots, fewer, more) => {
    // a seal of each word; each dot is drawn as a closed path
    const svgOf = (text: string) => {
      const c = structuredClone(preset('basmala-seal'));
      c.texts[Object.keys(c.texts)[0]].text = text;
      return renderPlaced(resolve(c), { idPrefix: 'm' });
    };
    const closes = (s: string) => s.split('Z').length;
    expect(closes(svgOf(withDots)) - closes(svgOf(fewer))).toBe(more);
  });
});
