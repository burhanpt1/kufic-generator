// Phase 6.5: the tughra with true curved loops and arms.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { preset } from '../src/model/presets';
import { buildMonogram, clearMonogramCache } from '../src/monogram/methods';
import { renderPlaced } from '../src/render/composition';
import { kufi } from '../src/script/kufi';
import { DEFAULT_STYLE } from '../src/model/style';

const L = DEFAULT_STYLE.letter;

describe('curved tughra', () => {
  it('leaves the grid tughra unchanged when off', () => {
    clearMonogramCache();
    const a = buildMonogram('tughra', { loops: 2 }, 'علي', kufi, L)!,
      b = buildMonogram('tughra', { loops: 2, curved: false }, 'علي', kufi, L)!;
    expect(Array.from(b.grid.data)).toEqual(Array.from(a.grid.data));
    expect(a.curves).toBeUndefined();
  });
  for (const text of ['علي', 'محمد', 'عبد الله'])
    it(`${text}: loops and arms as curves inside the grid, loops broken where they pass under a spine`, () => {
      const m = buildMonogram('tughra', { loops: 2, arms: 2, curved: true }, text, kufi, L)!;
      expect(m.curves!.length).toBeGreaterThanOrEqual(4); // 2 loops (maybe in pieces) + 2 arms
      for (const c of m.curves!)
        for (const [x, y] of c) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(m.grid.w);
          expect(y).toBeLessThanOrEqual(m.grid.h);
        }
      expect(m.metrics.legibility).toBeGreaterThan(0.5);
    });
  it('renders as curves in a composition', () => {
    const c = structuredClone(preset('basmala-seal'));
    c.texts.mono = { text: 'علي', repeat: 'fill', wordGap: 2 };
    c.root.child.fill = { type: 'monogram', text: 'mono', method: 'tughra', params: { curved: true, loops: 2 } };
    const p = resolve(c);
    const ribbon = p.items.find(i => i.type === 'ribbon');
    expect(ribbon).toBeDefined();
    expect(renderPlaced(p)).toContain('stroke-linecap="round"');
  });
});
