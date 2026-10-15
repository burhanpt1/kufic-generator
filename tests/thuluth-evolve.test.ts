// Evolution and the editor with two scripts: script and pen are traits, Kufi-only traits drop out for thuluth, fills
// the script can't build are never offered, and Kufi breeding is exactly as it was.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { freshGeneration } from '../src/evolve/breed';
import { traitsOf } from '../src/evolve/genes';
import { crossover, mutate, pickValue, randomComposition, relevantTraits } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';

const texts: Composition['texts'] = { main: { text: 'محمد علي فاطمة الحسن الحسين', repeat: 'fill', wordGap: 2 } };
const locked = { script: 'thuluth' };

describe('script-aware evolution', () => {
  it('never picks thuluth at random, and Kufi breeding draws exactly as before', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 40; i++) expect(randomComposition(texts, { rng }).style.script).toBe('kufi');
    // a choice with one possible value takes no draw
    const a = new Rng(5),
      b = new Rng(5);
    const k = randomComposition(texts, { rng: a });
    expect(pickValue('script', a, undefined, k)).toBe('kufi');
    b.next();
    expect(a.next()).not.toBe(b.next());
  });
  it('breeds thuluth when asked, without monograms or mazes, and every child resolves', () => {
    const gen = freshGeneration(12, texts, { rng: new Rng(21), locks: locked });
    for (const c of gen) {
      expect(c.style.script).toBe('thuluth');
      expect(['monogram', 'maze']).not.toContain(c.root.child.fill?.type);
      expect(isValidComposition(c)).toBe(true);
    }
    for (const c of gen.slice(0, 4)) expect(resolve(c).items.some(it => it.type === 'strip')).toBe(true);
  });
  it('shows thuluth its own traits: the pen, not Kufi letters, strokes, endings or plaits', () => {
    const th = randomComposition(texts, { rng: new Rng(3), locks: locked }),
      rel = relevantTraits(th);
    expect(rel).toContain('pen');
    expect(rel).toContain('script');
    for (const k of [
      'ascenders',
      'ra',
      'lamAlif',
      'letterSet',
      'stroke',
      'weight',
      'terminal',
      'reach',
      'plait',
    ] as const)
      expect(rel).not.toContain(k);
    const ku = randomComposition(texts, { rng: new Rng(3) });
    expect(relevantTraits(ku)).not.toContain('pen');
    expect(relevantTraits(ku)).toContain('ascenders');
    expect(traitsOf(th).pen).toBeDefined();
  });
  it('keeps fills buildable through mutation and crossover between the scripts', () => {
    const rng = new Rng(77);
    let th = randomComposition(texts, { rng, locks: locked });
    for (let i = 0; i < 30; i++) {
      th = mutate(th, 0.6, { rng, locks: locked });
      expect(['monogram', 'maze']).not.toContain(th.root.child.fill?.type);
    }
    for (let i = 0; i < 30; i++) {
      const ku = randomComposition(texts, { rng }),
        x = crossover(ku, th, { rng });
      expect(isValidComposition(x)).toBe(true);
      if (x.style.script === 'thuluth') {
        expect(['monogram', 'maze']).not.toContain(x.root.child.fill?.type);
        expect(x.style.pen).toBeDefined();
      }
    }
  });
});

describe('features gated by capability', () => {
  const base = (fill: Composition['root']['child']['fill'], plait = false): Composition => ({
    version: 1,
    seed: 4,
    canvas: { shape: 'square', margin: 3 },
    style: { ...structuredClone(DEFAULT_STYLE), script: 'thuluth', pen: { preset: 'band' } } as Style,
    texts,
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: 'main', plait, separator: { kind: 'lines', width: 2 } }],
        fill,
      },
    },
  });
  it('writes a star pattern in thuluth words', () => {
    const p = resolve(base({ type: 'pattern', pattern: { tiling: '488', angle: 67, scale: 9 }, text: 'main' }));
    expect(p.meta.fill?.ok).toBe(true);
    expect(p.items.filter(it => it.type === 'strip' && it.strip.kind === 'vector').length).toBeGreaterThan(5);
  });
  it('ignores plaits, which need Kufi stems, and declines monograms and mazes with a note', () => {
    expect(resolve(base(undefined, true)).meta.warnings).toEqual([]);
    const m = resolve(base({ type: 'monogram', text: 'main', method: 'seal', params: {} }));
    expect(m.meta.fill?.ok).toBe(false);
  });
});
