// Lab port §5: plaited stems.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { relevantTraits, applyTrait } from '../src/evolve/operators';
import { traitsOf } from '../src/evolve/genes';
import { Rng } from '../src/evolve/rng';
import { plaitStrip } from '../src/layout/plait';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { renderPlaced } from '../src/render/composition';
import { kufi } from '../src/script/kufi';
import type { CellStrip } from '../src/script/types';

/** Plaits found by comparing a strip before and after: runs of changed columns. */
function plaits(before: Uint8Array, after: Uint8Array, W: number, Hb: number) {
  const changed = new Set<number>();
  for (let y = 0; y < Hb; y++) for (let x = 0; x < W; x++) if (before[y * W + x] !== after[y * W + x]) changed.add(x);
  const xs = [...changed].sort((a, b) => a - b),
    groups: [number, number][] = [];
  for (const x of xs)
    if (groups.length && x === groups[groups.length - 1][1] + 1) groups[groups.length - 1][1] = x;
    else groups.push([x, x]);
  return groups;
}
const crossings = (d: Uint8Array, W: number, Hb: number, a: number, b: number) => {
  const ink = (x: number, y: number) => x >= a && x <= b && y >= 0 && y < Hb && !!d[y * W + x];
  let n = 0;
  for (let y = 0; y < Hb; y++)
    for (let x = a + 1; x < b; x++)
      if (ink(x, y) && ink(x - 1, y - 1) && ink(x + 1, y - 1) && ink(x - 1, y + 1) && ink(x + 1, y + 1)) n++;
  return n;
};

describe('plaitStrip', () => {
  const W = 9,
    Hb = 14,
    base = 2,
    H = 11,
    top = base + H - 1;
  const strip = () => {
    const data = new Uint8Array(W * Hb);
    for (let x = 0; x < W; x++) data[base * W + x] = 1; // baseline stroke
    for (const x of [2, 6]) for (let y = base; y <= top; y++) data[y * W + x] = 1;
    return { W, data, tag: new Uint8Array(W) };
  };
  it('crosses two stems in an X near the top, each carrying on in the other column', () => {
    const st = strip(),
      before = st.data.slice();
    plaitStrip(st, Hb, base, H);
    const [g] = plaits(before, st.data, W, Hb);
    expect(g).toEqual([2, 6]);
    expect(crossings(st.data, W, Hb, 2, 6)).toBe(1);
    expect(st.data[top * W + 2]).toBe(1);
    expect(st.data[top * W + 6]).toBe(1);
    // below the plait nothing changed
    const y1 = top - 4 - 1;
    for (let y = 0; y <= y1; y++) for (let x = 0; x < W; x++) expect(st.data[y * W + x]).toBe(before[y * W + x]);
  });
  it('leaves short ascenders, odd gaps and crowded stems alone', () => {
    const st = strip(),
      before = st.data.slice();
    plaitStrip(st, Hb, base, 7);
    expect(st.data).toEqual(before);
    const odd = strip();
    for (let y = base; y <= top; y++) {
      odd.data[y * W + 6] = 0;
      odd.data[y * W + 5] = 1;
    }
    const ob = odd.data.slice();
    plaitStrip(odd, Hb, base, H);
    expect(odd.data).toEqual(ob);
    const crowd = strip();
    crowd.data[(top - 1) * W + 4] = 1;
    const cb = crowd.data.slice();
    plaitStrip(crowd, Hb, base, H);
    expect(crowd.data).toEqual(cb);
  });
});

describe('plaits in real text', () => {
  for (const text of ['لا اله الا الله', 'بسم الله الرحمن الرحيم', 'الله الله الله']) {
    it(`only touches the two stems and the space between them, one crossing each: ${text}`, () => {
      const style = { ...DEFAULT_STYLE.letter, ascenders: 11 },
        prep = kufi.prepareLines([text], style)[0],
        segs = kufi.segments(prep, 'words', 2),
        o = { wrap: false, rhythm: true, wordGap: 2, terminals: 'none' as const },
        plain = kufi.layout(segs, prep, null, o) as CellStrip,
        W = plain.W,
        plaited = kufi.layout(segs, prep, W, { ...o, plait: true }) as CellStrip,
        flat = kufi.layout(segs, prep, W, o) as CellStrip;
      const gs = plaits(flat.data, plaited.data, W, prep.Hb);
      expect(gs.length).toBeGreaterThan(0);
      for (const [a, b] of gs) {
        expect(b - a).toBeGreaterThanOrEqual(2);
        expect((b - a) % 2).toBe(0);
        expect(crossings(plaited.data, W, prep.Hb, a, b)).toBe(1);
        // the two outer columns were free-standing stems before
        for (const x of [a, b]) expect(flat.data[(prep.base + 5) * W + x]).toBeTruthy();
        for (let x = a + 1; x < b; x++) expect(flat.data[(prep.base + 10) * W + x]).toBe(0);
      }
    });
  }
});

describe('as an option and a trait', () => {
  it('is off by default: presets render as before', () => {
    const c = preset('fatimid-medallion');
    expect(JSON.stringify(c)).not.toContain('plait');
  });
  it('plaits a text border and renders the crossings', () => {
    const c = structuredClone(preset('octagon-panel'));
    c.style.letter.ascenders = 11;
    const before = resolve(c);
    const b = c.root.child.borders[0];
    if (b.type === 'textBorder') b.plait = true;
    expect(isValidComposition(c)).toBe(true);
    const after = resolve(c);
    const ink = (p: typeof after) =>
      p.items
        .filter(i => i.type === 'strip')
        .map(i => (i.type === 'strip' && i.strip.kind === 'cells' ? [...i.strip.data].join('') : ''));
    expect(ink(after)).not.toEqual(ink(before));
    expect(renderPlaced(after, { idPrefix: 'p' }).length).toBeGreaterThan(1000);
  });
  it('is evolvable on curved or pen bands with tall stems only', () => {
    const c = structuredClone(preset('octagon-panel')),
      rng = new Rng(1);
    c.style.stroke.kind = 'curved';
    c.style.letter.ascenders = 7;
    expect(relevantTraits(c)).not.toContain('plait');
    c.style.letter.ascenders = 11;
    expect(relevantTraits(c)).toContain('plait');
    applyTrait(c, 'plait', true, rng);
    expect(traitsOf(c).plait).toBe(true);
    expect(c.root.child.borders.every(b => b.type !== 'textBorder' || b.plait)).toBe(true);
    // block strokes: not offered, and switching to them takes the plaits off
    applyTrait(c, 'stroke', 'blocks', rng);
    expect(traitsOf(c).plait).toBe(false);
    expect(relevantTraits(c)).not.toContain('plait');
    applyTrait(c, 'plait', true, rng);
    expect(traitsOf(c).plait).toBe(false);
    // never on line fills or mazes
    const m = structuredClone(preset('kufic-maze-tile'));
    m.style.stroke.kind = 'pen';
    m.style.letter.ascenders = 11;
    applyTrait(m, 'plait', true, rng);
    expect(m.root.child.fill).not.toHaveProperty('plait', true);
  });
});
