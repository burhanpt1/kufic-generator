// Curved strokes with variable width (contrast, taper) and floriation (leaves on free stems). All opt-in: the
// defaults leave curved output unchanged.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { renderPlaced } from '../src/render/composition';
import { preset } from '../src/model/presets';
import { loadSealWasm } from '../src/kernels/seal';
import { CompositionSchema } from '../src/model/schema';
import { traitsOf } from '../src/evolve/genes';
import { applyTrait, relevantTraits } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';

await loadSealWasm();
const render = (id: string, stroke: object, flourish?: 'none' | 'sprouts') => {
  const c = structuredClone(preset(id));
  c.style.stroke = { ...c.style.stroke, kind: 'curved', ...stroke };
  if (flourish) c.style.terminals = { ...c.style.terminals, flourish };
  return renderPlaced(resolve(c), { idPrefix: 't' });
};
const leaves = (svg: string, plain: string) =>
  (svg.match(/<path fill=/g) ?? []).length - (plain.match(/<path fill=/g) ?? []).length;

describe('curved strokes: width and floriation', () => {
  it('leave the output unchanged at their defaults', () => {
    const plain = render('basmala-seal', {});
    expect(render('basmala-seal', { contrast: 0, taper: 0 }, 'none')).toBe(plain);
  });
  it('draw shaped strokes as filled outlines instead of stroked paths', () => {
    const plain = render('basmala-seal', {}),
      shaped = render('basmala-seal', { contrast: 0.7, taper: 0.7 });
    expect(shaped).not.toBe(plain);
    expect((shaped.match(/stroke-width/g) ?? []).length).toBeLessThan((plain.match(/stroke-width/g) ?? []).length);
  });
  it('sprout a few leaves from free stems, not from the frame', () => {
    const plain = render('basmala-seal', { contrast: 0.7, taper: 0.7 }),
      sprouts = render('basmala-seal', { contrast: 0.7, taper: 0.7 }, 'sprouts');
    const n = leaves(sprouts, plain);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(8);
  });
  it('are deterministic', () => {
    expect(render('octagon-panel', { contrast: 0.5, taper: 0.5 }, 'sprouts')).toBe(
      render('octagon-panel', { contrast: 0.5, taper: 0.5 }, 'sprouts'),
    );
  });
  it('validate in the schema', () => {
    const c = structuredClone(preset('basmala-seal'));
    c.style.stroke = { ...c.style.stroke, contrast: 0.4, taper: 0.2 };
    c.style.terminals = { ...c.style.terminals, flourish: 'sprouts' };
    expect(CompositionSchema.safeParse(c).success).toBe(true);
    c.style.stroke.contrast = 2;
    expect(CompositionSchema.safeParse(c).success).toBe(false);
  });
  it('evolve as traits of curved compositions only', () => {
    const c = structuredClone(preset('basmala-seal'));
    c.style.stroke.kind = 'blocks';
    expect(relevantTraits(c)).not.toContain('sprouts');
    c.style.stroke.kind = 'curved';
    expect(relevantTraits(c)).toEqual(expect.arrayContaining(['contrast', 'stemTaper', 'sprouts']));
    const rng = new Rng(1);
    applyTrait(c, 'contrast', 0.7, rng);
    applyTrait(c, 'stemTaper', 0.5, rng);
    applyTrait(c, 'sprouts', true, rng);
    expect(traitsOf(c)).toMatchObject({ contrast: 0.7, stemTaper: 0.5, sprouts: true });
    expect(c.style.terminals.flourish).toBe('sprouts');
  });
});
