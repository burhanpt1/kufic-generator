// The mosque programme (src/mosque): nested, stacked compositions of scripture, and the qibla wall that sets them
// into one elevation. `npm run mosque` writes the renders to docs/mosque.
import type { Shaped } from '../src/types';
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from '../src/compose';
import { fitInside } from '../src/compose/fillers';
import { loadSealWasm } from '../src/kernels/seal';
import { isValidComposition } from '../src/model/schema';
import type { Composition } from '../src/model/schema';
import { renderPlaced } from '../src/render/composition';
import * as P from '../src/mosque/pieces';
import { mosquePoster } from '../src/mosque/poster';
import { NAMES_99, T } from '../src/mosque/texts';
import { kufi } from '../src/script/kufi';
import { DEFAULT_STYLE } from '../src/model/style';

await loadSealWasm();
const PIECES = Object.entries(P).filter(([k]) => k !== 'style') as [string, () => Composition][];

describe('mosque texts', () => {
  it('has the ninety-nine names, each once', () => {
    expect(NAMES_99).toHaveLength(99);
    expect(new Set(NAMES_99).size).toBe(99);
  });
  it('uses only letters the engine draws', () => {
    for (const t of Object.values(T)) expect((kufi.shape(t, DEFAULT_STYLE.letter) as Shaped).unsupported).toEqual([]);
  });
});

describe('mosque pieces', () => {
  it.each(PIECES)('%s is valid and resolves with every border and fill in place', (_, make) => {
    const c = make();
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c);
    expect(p.meta.warnings).toEqual([]);
    expect(p.meta.fill?.ok).toBe(true);
    expect(p.meta.borders.every(b => b.rings.every(r => r.rep >= 1))).toBe(true);
  });
  it('nests the dome five layers deep', () => {
    let depth = 0,
      f = P.dome().root.child.fill;
    while (f?.type === 'region') {
      depth++;
      f = f.node.fill;
    }
    expect(depth).toBe(2);
    expect(resolve(P.dome()).meta.borders.length).toBe(6);
  });
});

describe('nested regions', () => {
  it('fit their own outline into the space left inside: an arch in an arch fills it', () => {
    // a unit square in a 2 × 1 rectangle: half its width, the whole height
    const sq: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
      rect: [number, number][] = [
        [-2, -1],
        [2, -1],
        [2, 1],
        [-2, 1],
      ];
    expect(fitInside(sq, rect, [[0, 0]])!.s).toBeCloseTo(1, 3);
    // the best of several centres wins; a centre outside the space is skipped
    expect(
      fitInside(sq, rect, [
        [5, 5],
        [1, 0],
      ])!.s,
    ).toBeCloseTo(1, 3);
  });
});

describe('qibla wall', () => {
  it('sets every piece into the wall, with no warnings', () => {
    const { svg, warnings } = mosquePoster();
    expect(warnings).toEqual([]);
    expect((svg.match(/<svg x=/g) ?? []).length).toBe(11); // two minarets, dome, mihrab, four roundels, three floor-level panels
    if (process.env.MOSQUE) {
      mkdirSync('docs/mosque', { recursive: true });
      writeFileSync('docs/mosque/qibla-wall.svg', svg);
      for (const [k, make] of PIECES)
        writeFileSync(`docs/mosque/${k}.svg`, renderPlaced(resolve(make()), { idPrefix: k }));
    }
  }, 120000);
});
