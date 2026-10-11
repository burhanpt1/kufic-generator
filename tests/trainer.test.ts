// Lab port §3: the taste trainer's models, screening and the lab importer.
import { describe, expect, it } from 'vitest';
import { traitsOf } from '../src/evolve/genes';
import { applyTrait, randomComposition } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';
import {
  blendScore,
  capRatings,
  compositionFromLab,
  fitLogit,
  labTraits,
  leastSure,
  learned,
  MAX_RATINGS,
  parseLabRatings,
  proposals,
  screenGeneration,
  train,
} from '../src/evolve/trainer';
import type { Grade, Rating } from '../src/evolve/trainer';
import { isValidComposition } from '../src/model/schema';
import type { Composition } from '../src/model/schema';

const texts: Composition['texts'] = { main: { text: 'بسم الله الرحمن الرحيم', repeat: 'fill', wordGap: 2 } };
const rng = new Rng(5);
function shaped(outline: string, weight = 0.65): Composition {
  const c = randomComposition(texts, { rng });
  applyTrait(c, 'outline', outline, rng);
  applyTrait(c, 'weight', weight, rng);
  return c;
}
// the owner's pattern: hearts and heavy strokes vetoed, circles and polygons liked, stars meh
function ratings(n: number): Rating[] {
  const out: Rating[] = [];
  for (let i = 0; i < n; i++) {
    const o = ['heart', 'circle', 'polygon', 'star'][i % 4],
      heavy = i % 5 === 0;
    const r: Grade = o === 'heart' || heavy ? 0 : o === 'star' ? 0.5 : 1;
    out.push({ comp: shaped(o, heavy ? 0.85 : 0.65), r, m: { space: r === 0 ? 0.2 : 0.9 }, at: i });
  }
  return out;
}

describe('fitLogit', () => {
  it('separates separable data and handles soft targets', () => {
    const X = [
        [1, 0],
        [1, 0],
        [0, 1],
        [0, 1],
      ],
      m = fitLogit(X, [1, 1, 0, 0]);
    expect(m.predict([1, 0])).toBeGreaterThan(0.8);
    expect(m.predict([0, 1])).toBeLessThan(0.2);
    const s = fitLogit([[1], [1]], [0.5, 0.5], 0.02, 2000);
    expect(s.predict([1])).toBeCloseTo(0.5, 2);
  });
});

describe('models', () => {
  it('needs six ratings', () => {
    expect(train(ratings(5))).toBeNull();
    expect(train(ratings(6))).not.toBeNull();
  });
  const model = train(ratings(120))!;
  // averaged over fresh compositions, whose other traits are random
  const mean = (f: (c: Composition) => number, o: string) =>
    Array.from({ length: 30 }, () => f(shaped(o))).reduce((a, b) => a + b, 0) / 30;
  it('learns the vetoes from traits alone, and liking from traits and measures', () => {
    expect(mean(c => model.pVeto(c), 'heart')).toBeGreaterThan(0.55);
    expect(mean(c => model.pVeto(c), 'circle')).toBeLessThan(0.3);
    expect(mean(c => model.pLike(c, { space: 0.9 }), 'circle')).toBeGreaterThan(
      mean(c => model.pLike(c, { space: 0.2 }), 'heart') + 0.3,
    );
  });
  it('explains itself: hearts in the vetoes, circles in the likes, empty space among the measures', () => {
    const l = learned(model);
    expect(l.vetoes.some(f => f.trait === 'outline' && f.value === 'heart')).toBe(true);
    expect(l.likes.some(f => f.trait === 'outline' && f.value === 'circle')).toBe(true);
    expect(l.lower.every(f => f.w < -0.15)).toBe(true);
    expect(l.measures.map(m => m.key)).toContain('space');
    expect(l.measures).toHaveLength(3);
  });
  it('screens generations and blends scores', () => {
    const gen = [...Array.from({ length: 6 }, () => shaped('heart')), shaped('circle')];
    const before = gen.filter(c => model.pVeto(c) > 0.55).length;
    const { comps, swapped } = screenGeneration(gen, model, () => shaped(rng.pick(['heart', 'polygon'])));
    expect(before).toBeGreaterThanOrEqual(1);
    expect(swapped).toBe(before);
    expect(comps.filter(c => model.pVeto(c) > 0.55).length).toBe(0);
    expect(screenGeneration(gen, null, () => gen[0]).swapped).toBe(0);
    expect(blendScore(0.5, null, gen[0], null)).toBe(0.5);
    const b = blendScore(0.5, model, gen[1], { space: 0.9 });
    expect(b).toBeCloseTo(0.2 + 0.6 * model.pLike(gen[1], { space: 0.9 }), 9);
  });
  it('proposes valid, screened genomes and shows the one it is least sure about', () => {
    const ps = proposals(6, texts, ratings(40), model, { rng });
    expect(ps.every(isValidComposition)).toBe(true);
    expect(ps.filter(c => model.pVeto(c) > 0.55).length).toBeLessThanOrEqual(1);
    const c = [
        { comp: shaped('circle'), m: { space: 0.9 } },
        { comp: shaped('star'), m: { space: 0.5 } },
      ],
      d = c.map(x => Math.abs(model.pLike(x.comp, x.m) - 0.5));
    expect(leastSure(c, model)).toBe(d[0] < d[1] ? 0 : 1);
    expect(leastSure(c, null)).toBe(0);
  });
  it('keeps the last 600 ratings', () => {
    const many = Array.from({ length: 650 }, (_, i) => ({ ...ratings(1)[0], at: i }));
    const kept = capRatings(many);
    expect(kept).toHaveLength(MAX_RATINGS);
    expect(kept[0].at).toBe(50);
  });
});

describe('lab importer', () => {
  const g = {
    layout: 'poly',
    sides: 6,
    points: 8,
    depth: 0.55,
    spread: 1.6,
    rings: 4,
    taper: 0.5,
    centre: 0.22,
    H: 11,
    gap: 2,
    terminal: 'leaf',
    reach: 'asc',
    bandStyle: 'braid',
    ground: 'geo',
    corners: 'geo',
    center: 'mono',
    tiling: 'sq',
    geoAngle: 67,
    geoScale: 5,
    palette: 4,
    colourMode: 'ring',
    letterStyle: 'banded',
    weight: 1,
    soft: 0.5,
    la: 'knot',
    ra: 'short',
    marks: 'off',
    stroke: 'curved',
    curve: 0.6,
    plait: true,
    sparkle: 3,
  };
  it('maps lab genes to studio traits and reports what did not carry over', () => {
    const { traits, dropped } = labTraits(g);
    expect(traits).toMatchObject({
      outline: 'polygon',
      sides: 6,
      spread: 1.3,
      borders: 3,
      ascenders: 11,
      separatorWidth: 2,
      reach: 'tall',
      separator: 'braid',
      ground: 'pattern',
      spandrels: 'pattern',
      fill: 'monogram',
      tiling: 'square',
      palette: 4,
      colouring: 'byRing',
      banded: true,
      weight: 0.85,
      softness: 0.3,
      lamAlif: 'knot',
      ra: 'short',
      marks: 'off',
      stroke: 'curved',
      corner: 0.6,
    });
    expect(dropped).toEqual(
      expect.arrayContaining([
        'centre (no studio equivalent)',
        'plait (no studio equivalent)',
        'sparkle (unknown gene)',
        'rings 4 → 3',
        'weight 1 → 0.85',
        'soft 0.5 → 0.3',
      ]),
    );
  });
  it('builds a valid composition carrying those traits', () => {
    const { comp } = compositionFromLab(g, 'يا علي مدد', 3),
      t = traitsOf(comp);
    expect(isValidComposition(comp)).toBe(true);
    expect(t).toMatchObject({
      outline: 'polygon',
      sides: 6,
      borders: 3,
      fill: 'monogram',
      monogram: 'seal',
      weight: 0.85,
    });
    expect(comp.texts.main.text).toBe('يا علي مدد');
  });
  it('parses pasted ratings, skipping bad records, and ignores the lab measures', () => {
    const p = parseLabRatings(
      JSON.stringify([
        { g, text: 'محمد', r: 1, m: { rhythm: 99 } },
        { g: { layout: 'heart' }, r: 0 },
        { g: { layout: 'circle' }, r: 0.7 },
        { r: 1 },
      ]),
    );
    expect(p.error).toBeNull();
    expect(p.items.map(i => i.r)).toEqual([1, 0]);
    expect(p.skipped).toBe(2);
    expect(p.dropped.get('centre (no studio equivalent)')).toBe(1);
    expect(traitsOf(p.items[1].comp).outline).toBe('heart');
    expect(parseLabRatings('{').error).toMatch(/JSON/);
    expect(parseLabRatings('{}').error).toMatch(/array/);
  });
});
