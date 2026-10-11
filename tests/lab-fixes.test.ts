// Lab port §1: tight-curve rings, trait ranges after the owner's vetoes, flow fill out of evolution.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { traitsOf } from '../src/evolve/genes';
import { mutate, randomComposition } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';
import { runMinRadius } from '../src/geometry/runs';
import type { Outline } from '../src/geometry/outlines';
import { preset, PRESETS, TEXTS } from '../src/model/presets';
import { SILHOUETTES } from '../src/model/silhouettes';
import type { Composition } from '../src/model/schema';

const CURVED: [string, Outline][] = [
  ['teardrop', { kind: 'preset', name: 'teardrop' }],
  ['heart', { kind: 'preset', name: 'heart' }],
  ['mihrab', { kind: 'preset', name: 'mihrab' }],
  ...Object.entries(SILHOUETTES).map(([k, path]) => [k, { kind: 'svg', path }] as [string, Outline]),
];

describe('rings on tight curves', () => {
  for (const [name, outline] of CURVED)
    for (const base of ['fatimid-medallion', 'octagon-panel', 'teardrop-gold'])
      it(`${name} (${base}): no placed ring curves tighter than 1.25 × its band height`, () => {
        const c = structuredClone(preset(base));
        c.root.child.outline = outline;
        const p = resolve(c);
        for (const it of p.items)
          if (it.type === 'strip' && it.place.type === 'run' && it.strip.kind === 'cells') {
            const { pts, cum } = it.place,
              r = runMinRadius({ pts, cum, len: cum[cum.length - 1], start: null, end: null });
            expect(r).toBeGreaterThanOrEqual(it.strip.Hb * it.place.s * 1.25 * 0.97); // resampling tolerance
          }
      });
});

describe('evolvable ranges', () => {
  const texts: Composition['texts'] = { main: { text: TEXTS.basmala, repeat: 'fill', wordGap: 2 } };
  const comps: Composition[] = [];
  const rng = new Rng(11);
  for (let i = 0; i < 300; i++) comps.push(randomComposition(texts, { rng }));
  for (let i = 0; i < 300; i++) comps.push(mutate(PRESETS[i % PRESETS.length].comp, 0.6, { rng }));
  it('random and mutated compositions stay inside the narrowed ranges', () => {
    comps.forEach((c, i) => {
      // fresh genomes draw only from the new values; mutants of presets may keep a preset's own weight
      if (i < 300) expect([0.55, 0.65, 0.75, 0.85]).toContain(traitsOf(c).weight);
      expect(c.style.stroke.softness).toBeLessThanOrEqual(0.3);
      expect(c.root.child.spread ?? 1).toBeLessThanOrEqual(1.3);
    });
  });
  it('never evolves the flow fill', () => {
    for (const c of comps) expect(c.root.child.fill?.type).not.toBe('flow');
  });
});
