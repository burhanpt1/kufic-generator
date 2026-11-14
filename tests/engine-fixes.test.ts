// Regressions from a review of the engine: the ring solver's first probe, plaited stems' tags, glyph edits and
// variants, and small option handling.
import { afterAll, describe, expect, it } from 'vitest';
import { compose } from '../src/engine';
import type { ComposeOptions, ComposeResult, SquareRing } from '../src/engine';
import { bitmap } from '../src/glyphs/bitmap';
import { V, altDef, def, getRows, overrideFor, setOverrides, setVariants } from '../src/glyphs/overrides';
import { makeGrid, rotate } from '../src/layout/grid';
import { plaitStrip } from '../src/layout/plait';
import { fitFlow } from '../src/layout/solvers';
import { renderSquare } from '../src/render';
import type { RenderOptions } from '../src/render';
import { prepare, wordSegs } from '../src/shaping/prepare';
import { shape } from '../src/shaping/shape';
import type { Segs } from '../src/types';

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const BASE: ComposeOptions = { text: 'بسم الله الرحمن الرحيم', layout: 'rings', H: 9, wordGap: 2, center: 'none', rings: 1 }; // prettier-ignore
type Square = Extract<ComposeResult, { kind: 'square' | 'circle' }>;

afterAll(() => {
  setOverrides({});
  setVariants({});
});

describe('fitFlow(): the group count', () => {
  it('fits many rings round a reserved centre, where the first probe size has no geometry', () => {
    const r = compose({ ...BASE, text: BASMALA, H: 12, rings: 8, centre: 0.5, marks: 'all' });
    expect(r.kind).toBe('square');
    expect(r.info.tooBig).toBeUndefined();
    expect(r.info.size).toBeGreaterThanOrEqual(480);
    expect((r as Square).rings).toHaveLength(8);
  });
  it('probes upward for the first size with capacities', () => {
    const segs: Segs = wordSegs(prepare(shape('بسم الله').words, 9, 'off', 'modern').words);
    segs.wg = 2;
    // no capacities below 1000 (the first probe is at L0 + 400)
    const p = fitFlow(segs, L => (L < 1000 ? null : [L - 950, L - 950]), 10, false);
    expect(p).not.toBeNull();
    expect(p!.L).toBeGreaterThanOrEqual(1000);
    expect(p!.groups).toHaveLength(2);
    expect(fitFlow(segs, () => null, 10, false)).toBeNull();
  });
});

describe('plaitStrip(): tags', () => {
  const W = 9,
    Hb = 14,
    base = 2,
    H = 11,
    top = base + H - 1;
  /** Two stems at columns 2 and 6 on a baseline; the right half of the strip belongs to copy 1, the left to copy 2. */
  const plaited = () => {
    const data = new Uint8Array(W * Hb),
      tag = new Uint8Array(W * Hb);
    const put = (x: number, y: number) => {
      data[y * W + x] = 1;
      tag[y * W + x] = x >= 4 ? 1 : 2;
    };
    for (let x = 0; x < W; x++) put(x, base);
    for (const x of [2, 6]) for (let y = base; y <= top; y++) put(x, y);
    return plaitStrip({ W, data, tag }, Hb, base, H);
  };
  it('tags every ink cell, and no blank one', () => {
    const st = plaited();
    for (let i = 0; i < W * Hb; i++) expect(!!st.tag[i], `cell ${i % W},${Math.floor(i / W)}`).toBe(!!st.data[i]);
  });
  it('carries each stem’s tag along its strand, through the crossing and up the other column', () => {
    const st = plaited(),
      y1 = top - 4 - 1, // the stems are 4 apart: the crossing starts here
      t = (x: number, y: number) => st.tag[y * W + x];
    expect([t(2, y1), t(6, y1)]).toEqual([2, 1]);
    // the strand from column 2 climbs to the right, the one from column 6 to the left
    expect([t(3, y1 + 1), t(5, y1 + 3), t(6, y1 + 4)]).toEqual([2, 2, 2]);
    expect([t(5, y1 + 1), t(3, y1 + 3), t(2, y1 + 4)]).toEqual([1, 1, 1]);
    for (let y = y1 + 5; y <= top; y++) expect([t(2, y), t(6, y)]).toEqual([1, 2]);
  });
});

describe('glyph edits (overrides)', () => {
  const EDIT = ['#.#', '..#', '###']; // a 3-row ر drawn on the line
  it('an edit stored with its baseline sits the same under every variant', () => {
    const o = overrideFor('REH', 'iso', EDIT, { ra: 'short' });
    expect(o).toEqual({ rows: EDIT, base: 0 });
    setOverrides({ 'REH.iso': o });
    for (const ra of ['short', 'desc', 'hook'] as const) {
      setVariants({ ra });
      expect(bitmap(def('REH', 'iso'), 9).base, ra).toBe(0);
      expect(getRows('REH', 'iso', { ra })).toEqual(EDIT);
    }
    // and one drawn on the descending ر keeps its two rows below the line
    const d = overrideFor('REH', 'iso', ['..#', '..#', '.##', '###'], { ra: 'desc' });
    expect(d).toMatchObject({ base: 2 });
    setOverrides({ 'REH.iso': d });
    setVariants({ ra: 'short' });
    expect(bitmap(def('REH', 'iso'), 9).base).toBe(2);
  });
  it('rows alone (the format already in localStorage) still take the active variant’s baseline', () => {
    setOverrides({ 'REH.iso': EDIT, 'BEH.ini': ['#', '#'] });
    setVariants({ ra: 'short' });
    expect(def('REH', 'iso')).toEqual(EDIT);
    setVariants({ ra: 'desc' });
    expect(def('REH', 'iso')).toEqual({ rows: EDIT, base: 2 });
    expect(def('BEH', 'ini')).toEqual(['#', '#']);
    expect(getRows('REH', 'iso', { ra: 'desc' })).toEqual(EDIT);
  });
  it('ignores an entry that is neither format', () => {
    setOverrides({ 'REH.iso': { nope: 1 } as never, 'DAL.iso': 'x' as never });
    setVariants({ ra: 'short' });
    expect(def('REH', 'iso')).toEqual(['..#', '..#', '###']);
    expect(def('DAL', 'iso')).toEqual(['###', '..#', '###']);
  });
  it('overrideFor copies the rows and leaves the stored overrides alone', () => {
    setOverrides({});
    const rows = ['#'],
      o = overrideFor('ALEF', 'iso', rows) as { rows: string[] };
    expect(o.rows).not.toBe(rows);
    expect(def('ALEF', 'iso')).toHaveLength(7);
  });
});

describe('setVariants()', () => {
  it('falls back to the default for a value that is not one of the variant’s', () => {
    setOverrides({});
    setVariants({ ra: 'foo', ayn: 'bar', la: 1, meem: null, sad: '', loops: 'x', set: 'gothic' } as never);
    expect(V).toEqual({
      ra: 'desc',
      ayn: 'cup',
      la: 'plain',
      meem: 'drop',
      sad: 'short',
      loops: 'rigid',
      set: 'square',
    });
    expect(() => getRows('REH', 'iso', { ra: 'foo' } as never)).not.toThrow();
    expect(compose({ ...BASE, ra: 'foo', ayn: 'bar' } as never).kind).toBe('square');
  });
  it('keeps every valid value', () => {
    const all = { ra: 'hook', ayn: 'open', la: 'knot', meem: 'flat', sad: 'tall', loops: 'stretch', set: 'fatimid' } as const; // prettier-ignore
    setVariants(all);
    expect(V).toEqual(all);
    setVariants({});
  });
});

describe('small fixes', () => {
  it('a flat final م has no dropping long alternate', () => {
    setVariants({ meem: 'flat' });
    expect(altDef('MEEM', 'fin')).toBeNull();
    expect(altDef('MEEM', 'iso')).toBeNull();
    expect(altDef('NOON', 'fin')).not.toBeNull();
    setVariants({ meem: 'drop' });
    expect(altDef('MEEM', 'fin')).toMatchObject({ base: 2 });
    // with alternates on, a justified line of flat م stays on the line
    setVariants({ meem: 'flat' });
    const p = prepare(shape('سلام عليكم').words, 9, 'off', 'modern', true);
    expect(p.base).toBe(0);
    expect(p.words.flatMap(w => w.glyphs).filter(g => g.alt && g.form !== 'ini' && g.form !== 'med')).toHaveLength(0);
    setVariants({});
  });
  it('rotate() turns by quarter turns for any angle', () => {
    const g = makeGrid(3, 3);
    g.data[0] = 1; // top left
    g.tag[0] = 5;
    g.ring[0] = 2;
    const where = (deg: number) => {
      const r = rotate(g, deg),
        i = r.data.indexOf(1);
      expect([r.tag[i], r.ring[i]]).toEqual([5, 2]);
      return i;
    };
    expect([0, 90, 180, 270].map(where)).toEqual([0, 2, 8, 6]);
    expect([-90, -180, -270, 360, 450, -360].map(where)).toEqual([6, 8, 2, 0, 2, 0]);
    expect([44, 46, 100, NaN, Infinity].map(where)).toEqual([0, 2, 2, 0, 0]);
  });
  it('a gap of 0 is a gap: the rings touch', () => {
    const at = (gap: number | undefined) => compose({ ...BASE, rings: 2, gap }) as Square,
      off = (r: Square) => (r.rings[1] as SquareRing).off;
    expect(at(0).info.gap).toBe(0);
    expect(off(at(0))).toBe(off(at(1)) - 1);
    // a missing or unusable gap is the default
    for (const g of [undefined, NaN, -2]) expect(at(g).info.gap).toBe(1);
    const opt: RenderOptions = {
      weight: 0.85, soft: 0.2, ink: '#111111', ink2: '#aa0000', paper: '#ffffff', mark: '#00aa00', grid: false,
      label: 't', terminal: 'none', colourMode: 'solid', ground: 'plain', corners: 'none', bandStyle: 'lines',
      tiling: '488', geoAngle: 67, geoScale: 5, letterStyle: 'solid',
    }; // prettier-ignore
    expect(renderSquare(at(0), opt)).not.toMatch(/NaN|Infinity|undefined/);
  });
});
