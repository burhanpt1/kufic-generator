// Text bands keep headroom: ink stays at least half a cell clear of every separator and of the outline, measured on
// the placed geometry (true distances to the separator paths), across the presets and random compositions.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Placed, PlacedItem } from '../src/compose/placed';
import { EDGE_CLEAR, bandPad, inkReach, placeMap } from '../src/compose/textBorder';
import { Rng } from '../src/evolve/rng';
import { randomComposition } from '../src/evolve/operators';
import { PRESETS, TEXTS } from '../src/model/presets';
import type { Composition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import type { Pt } from '../src/geometry/types';

type Seg = [Pt, Pt, number];

/** Separator bands (and the outline, as a band of no width) as segments with their half-width, bucketed. */
function edges(p: Placed) {
  const segs: Seg[] = [];
  const ring = (pts: Pt[], half: number) => {
    for (let i = 0; i < pts.length; i++) segs.push([pts[i], pts[(i + 1) % pts.length], half]);
  };
  ring(p.meta.outline, 0);
  for (const it of p.items) if (it.type === 'separator' && it.kind !== 'none') ring(it.path, it.width / 2);
  const B = 4,
    grid = new Map<string, Seg[]>();
  for (const sg of segs) {
    const [a, b, h] = sg,
      x0 = Math.floor((Math.min(a[0], b[0]) - h) / B),
      x1 = Math.floor((Math.max(a[0], b[0]) + h) / B),
      y0 = Math.floor((Math.min(a[1], b[1]) - h) / B),
      y1 = Math.floor((Math.max(a[1], b[1]) + h) / B);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const k = x + ',' + y;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(sg);
      }
  }
  /** Distance from q to the nearest separator band's edge, looking no further than r. */
  return (q: Pt, r: number) => {
    let best = Infinity;
    const x0 = Math.floor((q[0] - r) / B),
      x1 = Math.floor((q[0] + r) / B),
      y0 = Math.floor((q[1] - r) / B),
      y1 = Math.floor((q[1] + r) / B);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (const [a, b, h] of grid.get(x + ',' + y) ?? []) {
          const dx = b[0] - a[0],
            dy = b[1] - a[1],
            l2 = dx * dx + dy * dy,
            t = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0,
            d = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy) - h;
          if (d < best) best = d;
        }
    return best;
  };
}

/** Worst shortfall (in cells, > 0 means too close) of a band's ink from the separators and outline. */
export function worstShortfall(p: Placed, strips: Extract<PlacedItem, { type: 'strip' }>[]) {
  const near = edges(p);
  let worst = -Infinity;
  for (const it of strips) {
    const st = it.strip;
    if (st.kind !== 'cells') continue;
    const style = p.styles[it.style],
      reach = inkReach(style.terminals.kind, style.stroke.weight),
      map = placeMap(it.place),
      s = it.place.s;
    for (let x = 0; x < st.W; x++) {
      let lo = -1,
        hi = -1;
      for (let y = 0; y < st.Hb; y++)
        if (st.data[y * st.W + x]) {
          if (lo < 0) lo = y;
          hi = y;
        }
      if (lo < 0) continue;
      for (const y of lo === hi ? [lo] : [lo, hi]) {
        const v = st.data[y * st.W + x],
          need = (0.5 + EDGE_CLEAR + (v === 4 && style.terminals.kind !== 'none' ? reach.up : reach.out)) * s,
          d = near(map(x + 0.5, y + 0.5), need + 1);
        worst = Math.max(worst, (need - d) / s);
      }
    }
  }
  return worst;
}

/** The text-border strips of a composition: resolve it with the fill removed, so only the borders' strips remain. */
function borderStrips(c: Composition) {
  const bare = structuredClone(c);
  delete bare.root.child.fill;
  bare.root.child.size ??= resolve(c).meta.size;
  const p = resolve(bare);
  return { p, strips: p.items.filter((it): it is Extract<PlacedItem, { type: 'strip' }> => it.type === 'strip') };
}

const withHeadroom = (c: Composition, on: boolean) => {
  const d = structuredClone(c);
  for (const b of d.root.child.borders) if (b.type === 'textBorder') b.headroom = on;
  return d;
};

describe('band headroom', () => {
  it('pads by at least half a cell beyond any ink, and leaves the tallest ink at about 86% of the band', () => {
    for (const kind of ['none', 'notch', 'bevel', 'leaf', 'palmette'] as const)
      for (const weight of [0.1, 0.6, 0.85, 1.2])
        for (const Hb of [8, 11, 13, 17]) {
          const style = {
              terminals: { ...DEFAULT_STYLE.terminals, kind },
              stroke: { ...DEFAULT_STYLE.stroke, weight },
            },
            r = inkReach(kind, weight),
            { bot, top } = bandPad(Hb, style);
          expect(bot).toBeGreaterThanOrEqual(EDGE_CLEAR + r.out);
          expect(top).toBeGreaterThanOrEqual(EDGE_CLEAR + r.up);
          expect((bot + Hb) / (bot + Hb + top)).toBeLessThanOrEqual(0.86);
          // and no more than one row beyond what either rule needs
          expect((bot + Hb) / (bot + Hb + top - 1) > 0.86 || top - 1 < EDGE_CLEAR + r.up).toBe(true);
        }
  });
  it('keeps every preset’s ink clear of its separators and outline', () => {
    for (const pr of PRESETS) {
      const { p, strips } = borderStrips(pr.comp);
      expect(worstShortfall(p, strips), pr.id).toBeLessThanOrEqual(1e-6);
    }
  });
  it('keeps the ink of 200 random compositions clear of their separators and outlines', () => {
    const rng = new Rng(20261011),
      texts = [TEXTS.basmala, TEXTS.names, TEXTS.shahada, TEXTS.yaAli];
    for (let i = 0; i < 200; i++) {
      const c = randomComposition({ main: { text: texts[i % texts.length], repeat: 'fill', wordGap: 2 } }, { rng });
      const { p, strips } = borderStrips(c);
      expect(worstShortfall(p, strips), `random ${i}: ${JSON.stringify(c).slice(0, 300)}`).toBeLessThanOrEqual(1e-6);
    }
  }, 300_000);
  it('can be turned off, which gives the earlier layout (ink up to the separators)', () => {
    const c = PRESETS.find(q => q.id === 'fatimid-medallion')!.comp,
      off = borderStrips(withHeadroom(c, false)),
      on = borderStrips(c);
    expect(worstShortfall(off.p, off.strips)).toBeGreaterThan(0.5);
    expect(worstShortfall(on.p, on.strips)).toBeLessThanOrEqual(0);
    const ring = (p: Placed) => p.meta.borders[0].rings[0];
    expect(ring(off.p).pad).toEqual({ bot: 0, top: 0 });
    expect(ring(on.p).pad.top).toBeGreaterThan(0);
  });
});
