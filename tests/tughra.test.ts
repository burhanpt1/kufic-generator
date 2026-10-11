// Phase 6.5: the tughra with true curved loops and arms.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { preset } from '../src/model/presets';
import { buildMonogram, clearMonogramCache, strokeEnds } from '../src/monogram/methods';
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
    it(`${text}: overlays as curves inside the grid`, () => {
      const m = buildMonogram('tughra', { loops: 2, arms: 2, curved: true }, text, kufi, L)!;
      expect(m.curves!.length).toBeGreaterThanOrEqual(1);
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
  for (const text of ['علي', 'الحسن', 'عبد الله', 'محمد'])
    it(`${text}: every overlay grows out of a letter stroke end, in the stroke's direction, and turns smoothly`, () => {
      const m = buildMonogram('tughra', { loops: 2, arms: 2, flags: 2, curved: true }, text, kufi, L)!,
        ends = strokeEnds(m.grid);
      for (const c of m.curves ?? []) {
        const [x0, y0] = c[0],
          e = ends.find(q => Math.hypot(q.p[0] - x0, q.p[1] - y0) <= 0.5);
        expect(e, `start ${x0},${y0}`).toBeDefined();
        const dx = c[1][0] - x0,
          dy = c[1][1] - y0,
          l = Math.hypot(dx, dy);
        const ang = Math.acos(Math.max(-1, Math.min(1, (dx * e!.d[0] + dy * e!.d[1]) / l)));
        expect(ang).toBeLessThanOrEqual((15 * Math.PI) / 180);
        // no sudden change of direction anywhere along it
        for (let i = 2; i < c.length; i++) {
          const ax = c[i - 1][0] - c[i - 2][0],
            ay = c[i - 1][1] - c[i - 2][1],
            bx = c[i][0] - c[i - 1][0],
            by = c[i][1] - c[i - 1][1],
            la = Math.hypot(ax, ay),
            lb = Math.hypot(bx, by);
          if (la < 1e-9 || lb < 1e-9) continue;
          expect((ax * bx + ay * by) / (la * lb)).toBeGreaterThan(Math.cos((35 * Math.PI) / 180));
        }
      }
    });
});
