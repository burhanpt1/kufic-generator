import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { loadSealWasmSync, runSeal, unloadSealWasm } from '../src/kernels/seal';
import type { SealInput } from '../src/kernels/seal';
import { SOURCE_SHA256 } from '../src/kernels/seal.wasm';
import { PRESETS, preset } from '../src/model/presets';
import { DEFAULT_STYLE } from '../src/model/style';
import { buildMonogram, clearMonogramCache } from '../src/monogram/methods';
import type { MonoMethod } from '../src/monogram/methods';
import { renderPlaced } from '../src/render/composition';
import { kufi } from '../src/script/kufi';
import { createHash } from 'node:crypto';

describe('seal kernel', () => {
  // a small but real search input: three letters with a few variants
  const input = (): SealInput => {
    const L = [2, 0, 1, 2, 2, 3],
      V: number[] = [],
      C: number[] = [],
      J: number[] = [];
    const letter = (w: number, h: number, cells: number[][], joins: number[][] = []) => {
      V.push(w, h, 500, C.length / 3, cells.length, J.length / 3, joins.length);
      cells.forEach(c => C.push(...c));
      joins.forEach(j => J.push(...j));
    };
    const bar = (n: number) => Array.from({ length: n }, (_, i) => [i, 2, i > 0 && i < n - 1 ? 1 : 0]);
    letter(6, 3, [...bar(6), [0, 0, 0], [0, 1, 0]]);
    letter(8, 3, [...bar(8), [0, 0, 0], [0, 1, 0]], [[7, 2, 1]]);
    letter(
      3,
      7,
      Array.from({ length: 7 }, (_, i) => [1, i, i > 0 && i < 6 ? 1 : 0]),
    );
    letter(5, 5, [...bar(5).map(([x, , s]) => [x, 4, s]), [0, 0, 0], [4, 0, 0], [0, 1, 0], [4, 1, 0]]);
    letter(7, 5, [...bar(7).map(([x, , s]) => [x, 4, s]), [0, 0, 0], [6, 0, 0]], [[0, 4, -1]]);
    return {
      L,
      V,
      C,
      J,
      P: [1, 1, 0, 5, 9, 0, 9, 3, 0],
      n: 3,
      N: 22,
      copies: 2,
      sym: 1,
      iters: 3000,
      seed: 4243,
      shareMilli: 2000,
      ink0: 60,
    };
  };
  it('gives bit-identical results in WebAssembly and in the TypeScript port', () => {
    expect(loadSealWasmSync()).toBe(true);
    const w = runSeal(input(), 'wasm')!,
      j = runSeal(input(), 'js')!;
    expect(w.engine).toBe('wasm');
    expect(j.engine).toBe('js');
    expect(j.P).toEqual(w.P);
    expect(j.S).toEqual(w.S);
    // and for a seal built from real letters, through both backends
    clearMonogramCache();
    const viaWasm = buildMonogram(
      'seal',
      { H: 7, sym: 'mirror', seed: 99, words: false },
      'علي',
      kufi,
      DEFAULT_STYLE.letter,
    )!;
    unloadSealWasm();
    clearMonogramCache();
    const viaJs = buildMonogram(
      'seal',
      { H: 7, sym: 'mirror', seed: 99, words: false },
      'علي',
      kufi,
      DEFAULT_STYLE.letter,
    )!;
    expect(viaWasm.stats?.engine).toBe('wasm');
    expect(viaJs.stats?.engine).toBe('js');
    expect(Array.from(viaJs.grid.data)).toEqual(Array.from(viaWasm.grid.data));
    loadSealWasmSync();
  });
  it('is built from the C source in the repository', () => {
    const src = readFileSync(join(import.meta.dirname, '../src/kernels/seal.c'));
    expect(createHash('sha256').update(src).digest('hex'), 'run npm run build:wasm').toBe(SOURCE_SHA256);
  });
  it('rejects grids larger than the kernel can hold', () => {
    expect(runSeal({ ...input(), N: 300 }, 'js')).toBeNull();
  });
});

describe('monograms', () => {
  const METHODS: MonoMethod[] = [
    'mirror',
    'below',
    'quad',
    'pair',
    'pinwheel',
    'pinwheelIn',
    'block',
    'spiral',
    'tughra',
    'seal',
  ];
  it.each(METHODS)('%s builds a legible grid of strokes', m => {
    const r = buildMonogram(m, { seed: 4243 }, 'محمد', kufi, DEFAULT_STYLE.letter)!;
    expect(r).not.toBeNull();
    expect(r.grid.w * r.grid.h).toBeGreaterThan(20);
    let ink = 0;
    for (const v of r.grid.data) if (v) ink++;
    expect(ink).toBeGreaterThan(15);
    expect(r.metrics.total).toBeGreaterThan(0);
    expect(r.metrics.total).toBeLessThanOrEqual(1);
  });
  it('is deterministic for a seed and changes with it', () => {
    // letter seals (a one-word word seal has nothing to arrange)
    const a = buildMonogram('seal', { seed: 11, words: false }, 'فاطمة', kufi, DEFAULT_STYLE.letter)!,
      b = buildMonogram('seal', { seed: 11, tries: 1, words: false }, 'فاطمة', kufi, DEFAULT_STYLE.letter)!,
      c = buildMonogram('seal', { seed: 12, words: false }, 'فاطمة', kufi, DEFAULT_STYLE.letter)!;
    expect(Array.from(a.grid.data)).toEqual(Array.from(b.grid.data));
    expect(Array.from(a.grid.data)).not.toEqual(Array.from(c.grid.data));
  });
});

describe('presets', () => {
  it.each(PRESETS.map(p => [p.id, p] as const))('%s resolves cleanly and renders', (_, p) => {
    const placed = resolve(p.comp);
    expect(placed.meta.warnings).toEqual([]);
    expect(placed.meta.fill?.ok).toBe(true);
    for (const b of placed.meta.borders)
      for (const r of b.rings) expect(r.groupSizes.reduce((a, x) => a + x, 0)).toBe(r.rep * r.segsPerRep);
    const svg = renderPlaced(placed, { idPrefix: p.id });
    expect(svg.length).toBeGreaterThan(1000);
  });
  it('is deterministic', () => {
    for (const p of PRESETS)
      expect(JSON.stringify(resolve(p.comp))).toBe(JSON.stringify(resolve(structuredClone(p.comp))));
  });
});

describe('line fill', () => {
  it('sets the whole text once, in lines inside the region, top to bottom and right to left', () => {
    const placed = resolve(preset('mihrab-ayat-al-kursi'));
    const ring = Math.max(...placed.items.map(i => ('ring' in i ? i.ring : 0)));
    const lines = placed.items.filter(i => i.type === 'strip' && i.ring === ring);
    expect(lines.length).toBeGreaterThan(5);
    // every line is horizontal and the first starts at the top right
    const O = lines.map(l => (l.type === 'strip' && l.place.type === 'line' ? l.place.O : [0, 0]));
    for (let i = 1; i < O.length; i++) expect(O[i][1] > O[i - 1][1] - 1e-9 || O[i][0] < O[i - 1][0]).toBe(true);
    // the letters are no smaller than the minimum ratio of the border's
    const border = placed.meta.borders[0].rings[0].scale;
    expect(placed.meta.fill!.scale! / border).toBeGreaterThanOrEqual(0.42);
  });
  it('enlarges the composition when the fill would be too small', () => {
    const c = preset('mihrab-ayat-al-kursi');
    const auto = resolve(c).meta.size;
    const base = resolve({ ...c, root: { ...c.root, child: { ...c.root.child, fill: undefined } } }).meta.size;
    expect(auto).toBeGreaterThan(base);
  });
});

describe('maze', () => {
  it('winds one continuous line through the region, inside its outline', () => {
    const placed = resolve(preset('kufic-maze-tile'));
    const g = placed.items.find(i => i.type === 'grid')!;
    expect(g.type).toBe('grid');
    if (g.type !== 'grid') return;
    const half = 60,
      right = g.at[0] + g.grid.w * g.cell,
      bottom = g.at[1] + g.grid.h * g.cell;
    expect(g.at[0]).toBeGreaterThanOrEqual(-half - 1e-6);
    expect(g.at[1]).toBeGreaterThanOrEqual(-half - 1e-6);
    expect(right).toBeLessThanOrEqual(half + 1e-6);
    expect(bottom).toBeLessThanOrEqual(half + 1e-6);
  });
  it('changes with its seed', () => {
    const c = preset('kufic-maze-tile');
    const other = structuredClone(c);
    (other.root.child.fill as { seed?: number }).seed = 99;
    const grid = (x: typeof c) => resolve(x).items.find(i => i.type === 'grid');
    expect(JSON.stringify(grid(c))).not.toBe(JSON.stringify(grid(other)));
  });
});
