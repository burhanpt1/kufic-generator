// Untrusted input (links, saved files, hand-written JSON) must fail fast and clearly, never hang or crash; and what
// worked before must come out exactly as it did.
import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { TEXT_TILE_BUDGET, tileCount } from '../src/compose/resolve';
import { normaliseFree, unitRing } from '../src/geometry/outlines';
import { runSeal } from '../src/kernels/seal';
import type { SealInput } from '../src/kernels/seal';
import { PRESETS } from '../src/model/presets';
import {
  CompositionError,
  CompositionSchema,
  isValidComposition,
  migrate,
  parseComposition,
  readComposition,
} from '../src/model/schema';
import type { Composition, FillerNode, Outline, RegionNode } from '../src/model/schema';
import { parkMiller, seedInt, seedState } from '../src/model/seed';
import { DEFAULT_STYLE } from '../src/model/style';
import { MONO_DEFAULTS, buildMonogram } from '../src/monogram/methods';
import { MONO_LIMITS, clampMonoParams } from '../src/monogram/params';
import { kufi } from '../src/script/kufi';
import { decodeComposition, encodeComposition } from '../src/studio/state';
import { loadCategories, loadFavourites, loadRatings, saveFavourites, skippedFavourites } from '../src/studio/storage';

const BASMALA = 'بسم الله الرحمن الرحيم';
function comp(child: Partial<RegionNode> = {}, text = BASMALA): Composition {
  return {
    version: 1,
    seed: 7,
    canvas: { shape: 'square', margin: 3 },
    style: structuredClone(DEFAULT_STYLE),
    texts: { t: { text, repeat: 'fill', wordGap: 2 }, ok: { text: BASMALA, repeat: 'fill', wordGap: 2 } },
    root: {
      type: 'frame',
      child: { type: 'region', outline: { kind: 'circle' }, borders: [{ type: 'textBorder', text: 't' }], ...child },
    },
  };
}
/** Run and time: these used to take minutes or never return. */
function quick<T>(f: () => T, ms = 5000): T {
  const t0 = performance.now(),
    r = f();
  expect(performance.now() - t0).toBeLessThan(ms);
  return r;
}

describe('text with nothing to write', () => {
  const NOTHING = ['Hello world', '123', '١٢٣', '،؛ ... !'];
  it.each(NOTHING)('a border of %j is reported at once instead of searching every size', text => {
    const p = quick(() => resolve(comp({}, text)));
    expect(p.meta.warnings).toEqual(['no Arabic letters in text "t"']);
    expect(p.meta.borders).toEqual([]);
    expect(p.items.some(i => i.type === 'strip')).toBe(false);
  });
  it('says an empty text is empty', () => {
    for (const text of ['', '  \n\n '])
      expect(quick(() => resolve(comp({}, text))).meta.warnings).toEqual(['text "t" is empty']);
    // also at a fixed size, where an empty border was skipped in silence
    expect(resolve(comp({ size: 40 }, '')).meta.warnings).toEqual(['text "t" is empty']);
  });
  it('writes the other borders, sized by the first that has letters', () => {
    const both = comp({
        borders: [
          { type: 'textBorder', text: 't' },
          { type: 'textBorder', text: 'ok' },
        ],
      }),
      alone = comp({ borders: [{ type: 'textBorder', text: 'ok' }] });
    both.texts.t.text = 'Hello';
    const p = resolve(both),
      q = resolve(alone);
    expect(p.meta.warnings).toEqual(['no Arabic letters in text "t"']);
    expect(p.meta.size).toBe(q.meta.size);
    expect(p.meta.borders).toEqual(q.meta.borders);
  });
  it('leaves out the lines of a border that have no letters', () => {
    const p = resolve(comp({}, `${BASMALA}\n2024\n${BASMALA}`));
    expect(p.meta.borders[0].rings).toHaveLength(2);
    expect(p.meta.warnings).toEqual(['text "t": lines without Arabic letters are left out']);
  });
  const FILLS: FillerNode[] = [
    { type: 'lines', text: 't', lineGap: 1 },
    { type: 'lines', text: 't', lineGap: 1, vary: 0.5 },
    { type: 'flow', text: 't', lineGap: 1 },
    { type: 'lattice', text: 't' },
    { type: 'strapwork', text: 't', tiling: '488' },
    { type: 'pattern', pattern: { tiling: '488', angle: 60, scale: 5 }, text: 't' },
    { type: 'maze', text: 't', corridors: 0.5, wall: true },
    { type: 'maze', text: 't', corridors: 0.5, wall: true, interlace: true },
    { type: 'monogram', text: 't', method: 'seal', params: {} },
    { type: 'monogram', text: 't', method: 'seal', params: { words: false } },
    { type: 'monogram', text: 't', method: 'block', params: {} },
    { type: 'monogram', text: 't', method: 'spiral', params: {} },
    { type: 'monogram', text: 't', method: 'tughra', params: {} },
    { type: 'monogram', text: 't', method: 'pinwheel', params: {} },
  ];
  it.each(FILLS)('fill $type $method fails at once, without enlarging the region', fill => {
    const base = resolve(comp({ borders: [{ type: 'textBorder', text: 'ok' }] }));
    for (const [text, why] of [
      ['Hello world', 'no Arabic letters in text "t"'],
      ['', 'text "t" is empty'],
    ]) {
      const p = quick(() => resolve(comp({ borders: [{ type: 'textBorder', text: 'ok' }], fill }, text)), 2000);
      expect(p.meta.fill).toEqual({ type: fill.type, ok: false, note: why });
      expect(p.meta.warnings).toEqual([why]);
      // the automatic size is the border's own, not the largest enlargement
      expect(p.meta.size).toBe(base.meta.size);
      expect(p.meta.borders).toEqual(base.meta.borders);
    }
  });
  it('also in thuluth, and in a nested region', () => {
    const th = comp({}, 'Hello world');
    th.style.script = 'thuluth';
    th.style.pen = { preset: 'band' };
    expect(quick(() => resolve(th)).meta.warnings).toEqual(['no Arabic letters in text "t"']);
    th.texts.t.text = `Hello ${BASMALA}`;
    // a word it cannot write among words it can: no search without end either
    quick(() => resolve(th));
    const nested = comp(
      {
        borders: [{ type: 'textBorder', text: 'ok' }],
        fill: {
          type: 'region',
          node: {
            type: 'region',
            outline: { kind: 'polygon', sides: 4 },
            borders: [{ type: 'textBorder', text: 't' }],
            fill: { type: 'lines', text: 't', lineGap: 1 },
          },
        },
      },
      '2024',
    );
    expect(quick(() => resolve(nested)).meta.warnings).toEqual(['no Arabic letters in text "t"']);
  });
  it('still gives the abjad of a text without letters as 0', () => {
    const p = resolve(
      comp({ borders: [{ type: 'textBorder', text: 'ok' }], fill: { type: 'abjad', text: 't' } }, '12'),
    );
    expect(p.meta.fill).toEqual({ type: 'abjad', ok: true });
    expect(p.meta.warnings).toEqual([]);
  });
});

type Params = Record<string, number | string | boolean>;
const paramsOf = (c: Composition) => (c.root.child.fill as unknown as { params: Params }).params;
describe('monogram parameters', () => {
  const mono = (params: Record<string, number | string | boolean>, method = 'seal'): Composition =>
    comp({
      size: 40,
      borders: [],
      fill: { type: 'monogram', text: 't', method: method as 'seal', params },
    });
  it('are held to their ranges by the schema', () => {
    for (const bad of <Params[]>[
      { H: 1e6 },
      { tries: 1e9 },
      { H: 7.5 },
      { armLen: 1e7 },
      { flags: 1e9 },
      { spiralRings: 1e9 },
      { box: -5 },
      { sym: 'sideways' },
      { nest: 'yes' },
      { lineGap: -400 },
    ])
      expect(isValidComposition(mono(bad)), JSON.stringify(bad)).toBe(false);
    expect(isValidComposition(mono({}))).toBe(true);
    expect(isValidComposition(mono({ seed: -3 }))).toBe(true);
  });
  it('have a range for every parameter, with the defaults, the presets and the lab cases inside', () => {
    expect(Object.keys(MONO_LIMITS).sort()).toEqual(Object.keys(MONO_DEFAULTS).sort());
    expect(clampMonoParams(MONO_DEFAULTS as never)).toEqual(MONO_DEFAULTS);
    for (const p of PRESETS) expect(CompositionSchema.safeParse(p.comp).success, p.id).toBe(true);
    // values the lab's reference cases and evolution use
    for (const ok of <Params[]>[
      { H: 7, sym: 'mirror', box: 0.7, share: 2, tries: 4, seed: 4243, words: false },
      { H: 7, sym: 'mirror', tries: 2, seed: 2147483640, curved: true },
      { spineH: 19, flags: 2, loops: 2, arms: 2 },
      { core: 'seal', spiralRings: 2 },
      { alternate: true, lines: 1, H: 9, stretch: 2 },
      { joins: true, sym: 'turn', dots: true, frame: 'double', reshape: false, blocks: 0 },
    ]) {
      expect(isValidComposition(mono(ok)), JSON.stringify(ok)).toBe(true);
      expect(clampMonoParams(ok)).toEqual(ok);
    }
  });
  it('are clamped, not rejected, when an older composition is read', () => {
    const old = mono({ H: 1e6, tries: 1e9, armLen: 4.4, box: -2, frame: 'triple', extra: 1, seed: -12.5 });
    expect(isValidComposition(old)).toBe(false);
    const c = parseComposition(old);
    expect(paramsOf(c)).toEqual({ H: 21, tries: 8, armLen: 4, box: 0, seed: 12 });
    // the input is left as it was, and what is already in range is not copied
    expect(paramsOf(old).H).toBe(1e6);
    const fine = mono({ H: 7, tries: 2 });
    expect(migrate(fine)).toBe(fine);
  });
  it('no longer hang the search: {H: 1e6, tries: 1e9} resolves', () => {
    const p = quick(() => resolve(mono({ H: 1e6, tries: 1e9 })), 20_000);
    expect(p.meta.fill?.type).toBe('monogram');
  });
  it('are clamped again by the builder, whatever reaches it', () => {
    const wild = { H: 1e6, spineH: 1e6, armLen: 1e7, flags: 1e9, loops: 1e9, spiralRings: 1e9, box: -50, tries: 1e9, stretch: 1e8, lineGap: -1e6, overlap: 1e9, seed: -7 }; // prettier-ignore
    for (const method of ['seal', 'tughra', 'spiral', 'block', 'mirror', 'pinwheel', 'quad'] as const)
      for (const words of [true, false]) {
        const m = quick(() => buildMonogram(method, { ...wild, words }, 'علي', kufi, DEFAULT_STYLE.letter), 20_000);
        if (m) expect(Math.max(m.grid.w, m.grid.h)).toBeLessThan(400);
      }
  });
});

describe('seeds', () => {
  it('pass through unchanged when they were usable, and are normalised when not', () => {
    for (const s of [1, 7, 4243, 2147483646]) {
      expect(seedInt(s)).toBe(s);
      expect(seedState(s)).toBe(s);
    }
    expect(seedState(0)).toBe(1);
    expect(seedState(2147483647)).toBe(1);
    expect(seedState(2 * 2147483647)).toBe(1);
    expect(seedState(-5)).toBe(5);
    expect(seedState(12.9)).toBe(12);
    expect(seedState(NaN)).toBe(1);
    expect(seedState(Infinity)).toBe(1);
    expect(seedState(2147483647 + 9)).toBe(9);
  });
  it('give the Park–Miller stream the fillers always drew from', () => {
    for (const seed of [1, 7, 4243, 2147483646]) {
      let sd = seed;
      const old = () => (sd = (sd * 16807) % 2147483647) / 2147483647,
        R = parkMiller(seed);
      for (let i = 0; i < 200; i++) expect(R()).toBe(old());
    }
    // a degenerate seed is no longer a constant stream
    const R = parkMiller(0),
      a = R(),
      b = R();
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(b).not.toBe(a);
  });
  const maze = (seed: number | undefined, interlace = false): Composition =>
    comp({
      size: 50,
      borders: [],
      fill: { type: 'maze', text: 't', corridors: 0.6, wall: true, ...(seed === undefined ? {} : { seed }), interlace },
    });
  it.each([false, true])('a maze (interlaced: %s) takes any seed', interlace => {
    const at = (seed: number) => JSON.stringify(resolve(maze(seed, interlace)).items);
    for (const seed of [-5, 0, 2147483647, -2147483647, 4294967294]) {
      const p = resolve(maze(seed, interlace));
      expect(p.meta.fill, String(seed)).toMatchObject({ type: 'maze', ok: true });
    }
    // normalised, not replaced: -5 is 5, and 0 and the modulus are 1
    expect(at(-5)).toBe(at(5));
    expect(at(0)).toBe(at(1));
    expect(at(2147483647)).toBe(at(1));
    expect(new Set([1, 2, 3, 5, 8, 13].map(at)).size).toBeGreaterThan(1);
  });
  it('a seal takes any seed, in both kernels', () => {
    const seal = (seed: number) =>
      buildMonogram('seal', { H: 7, seed, words: false, tries: 2 }, 'علي', kufi, DEFAULT_STYLE.letter)!;
    for (const seed of [-5, 0, 2147483647, 1.5]) expect(seal(seed).grid.w).toBeGreaterThan(3);
    expect(Array.from(seal(-5).grid.data)).toEqual(Array.from(seal(5).grid.data));
    for (const backend of ['js', 'wasm'] as const) {
      const run = (seed: number) => runSeal({ ...sealInput(), seed }, backend)!;
      expect(run(0)).toEqual(run(1));
      expect(run(2147483647)).toEqual(run(1));
      expect(run(-4243)).toEqual(run(4243));
    }
  });
});

/** A small search input (as in tests/fillers.test.ts): three letters with a few variants. */
function sealInput(): SealInput {
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
  return { L, V, C, J, P: [1, 1, 0, 5, 9, 0, 9, 3, 0], n: 3, N: 22, copies: 2, sym: 1, iters: 3000, seed: 4243, shareMilli: 2000, ink0: 60 }; // prettier-ignore
}

describe('seal kernel memory', () => {
  it('is reused by the TypeScript port without one run leaking into the next', () => {
    const a = sealInput(),
      // a larger problem in between, to leave the memory dirty
      b = { ...sealInput(), N: 40, seed: 99, iters: 500, copies: 1, sym: 0 };
    const first = runSeal(a, 'js')!;
    runSeal(b, 'js');
    const again = runSeal(a, 'js')!;
    expect(again).toEqual(first);
    expect(first.P).toEqual(runSeal(a, 'wasm')!.P);
    expect(first.S).toEqual(runSeal(a, 'wasm')!.S);
  });
});

describe('text slot references', () => {
  it("are looked up among the composition's own slots only", () => {
    for (const name of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
      const c = comp({
        borders: [{ type: 'textBorder', text: name }],
        fill: { type: 'lines', text: name, lineGap: 1 },
      });
      expect(isValidComposition(c), name).toBe(false);
      expect(() => resolve(c)).toThrow(CompositionError);
      expect(() => resolve(c)).toThrow(`unknown text slot "${name}"`);
    }
  });
});

describe('degenerate outlines', () => {
  const BAD: [string, Outline][] = [
    ['three identical points', { kind: 'poly', points: [[5, 5], [5, 5], [5, 5]] }], // prettier-ignore
    ['two distinct points', { kind: 'poly', points: [[0, 0], [1, 1], [0, 0], [1, 1]] }], // prettier-ignore
    ['points on a line', { kind: 'poly', points: [[0, 0], [1, 1], [2, 2], [3, 3]] }], // prettier-ignore
    ['a triangle of 1e-300', { kind: 'poly', points: [[0, 0], [1e-300, 0], [0, 1e-300]] }], // prettier-ignore
    ['coordinates that overflow', { kind: 'poly', points: [[-1.7e308, 0], [1.7e308, 0], [0, 1.7e308]] }], // prettier-ignore
    ['an svg path that is a line', { kind: 'svg', path: 'M0 0 L10 0 Z' }],
    ['an svg path that is a point', { kind: 'svg', path: 'M3 3 Z' }],
  ];
  it.each(BAD)('%s is rejected with a CompositionError', (_, outline) => {
    expect(() => unitRing(outline)).toThrow(CompositionError);
    expect(() => resolve(comp({ outline }))).toThrow(/invalid composition: outline: /);
    // also nested
    const nested = comp({
      borders: [{ type: 'textBorder', text: 'ok' }],
      fill: { type: 'region', node: { type: 'region', outline, borders: [] } },
    });
    expect(() => resolve(nested)).toThrow(CompositionError);
  });
  it('normaliseFree rejects them too, and keeps real outlines as they were', () => {
    expect(() => normaliseFree([])).toThrow(CompositionError);
    expect(() => normaliseFree([[1, 1]])).toThrow(CompositionError);
    const tri = normaliseFree([
      [0, 0],
      [4, 0],
      [0, 3],
    ]);
    expect(tri.pts).toHaveLength(3);
    expect(tri.area).toBeGreaterThan(0.5);
    // a thin but real shape (1000 : 1) still passes
    expect(
      normaliseFree([
        [0, 0],
        [1000, 0],
        [1000, 1],
        [0, 1],
      ]).pts,
    ).toHaveLength(4);
  });
  it("bounds a polygon's rotation, and takes whole turns off an older one", () => {
    const at = (rotation: number) => comp({ outline: { kind: 'polygon', sides: 6, rotation } });
    for (const r of [0, 45, -30, 360, 3600, -3600]) expect(isValidComposition(at(r)), String(r)).toBe(true);
    for (const r of [3601, -1e9, 1e300]) expect(isValidComposition(at(r)), String(r)).toBe(false);
    expect(parseComposition(at(3645)).root.child.outline).toEqual({ kind: 'polygon', sides: 6, rotation: 45 });
    expect(parseComposition(at(-3690)).root.child.outline).toEqual({ kind: 'polygon', sides: 6, rotation: -90 });
    const p = quick(() => resolve(at(1e300)));
    expect(p.meta.borders).toHaveLength(1);
    // in range: exactly as before
    expect(migrate(at(45))).toEqual(at(45));
    expect(JSON.stringify(resolve(at(3645)).meta.borders)).toBe(JSON.stringify(resolve(at(45)).meta.borders));
  });
});

describe('work budget', () => {
  const pattern = (size: number, scale: number, text?: string): Composition =>
    comp({
      size,
      borders: [],
      fill: { type: 'pattern', pattern: { tiling: '488', angle: 60, scale }, ...(text ? { text } : {}) },
    });
  it('a pattern in words too fine for its region is left out with a warning (size 300, scale 1)', () => {
    const p = quick(() => resolve(pattern(300, 1, 't')));
    expect(p.meta.fill).toEqual({ type: 'pattern', ok: false, note: 'the tiles are too small for this size' });
    expect(p.meta.warnings).toEqual([
      "the pattern left out: its tiles are too small for this size (raise the pattern's scale)",
    ]);
    expect(p.items.some(i => i.type === 'strip')).toBe(false);
  });
  it('so are a plain pattern, tilework, a ground and spandrels of millions of tiles', () => {
    const plain = quick(() => resolve(pattern(2000, 1)));
    expect(plain.meta.fill?.ok).toBe(false);
    expect(plain.items.some(i => i.type === 'pattern')).toBe(false);
    const izn = resolve(comp({ size: 2000, borders: [], fill: { type: 'iznik', iznik: { fold: 8, scale: 1 } } }));
    expect(izn.meta.fill?.ok).toBe(false);
    expect(izn.items.some(i => i.type === 'tilework')).toBe(false);
    const c = comp({
      size: 2000,
      borders: [{ type: 'textBorder', text: 't', ground: { kind: 'iznik', iznik: { fold: 8, scale: 1 } } }],
    });
    c.root.spandrels = { type: 'pattern', pattern: { tiling: 'hex', angle: 60, scale: 1 } };
    const p = resolve(c);
    expect(p.items.some(i => i.type === 'tilework' || i.type === 'spandrels')).toBe(false);
    expect(p.meta.borders).toHaveLength(1);
    expect(p.meta.warnings).toHaveLength(2);
  });
  it('leaves everything within the budget alone, and many items no longer overflow the stack', () => {
    for (const q of PRESETS) {
      const p = resolve(q.comp);
      expect(
        p.meta.warnings.filter(w => /tiles are too small/.test(w)),
        q.id,
      ).toEqual([]);
    }
    // thousands of strips, pushed one by one
    const size = 80,
      scale = 2;
    expect(tileCount(size * 1.05, scale)).toBeLessThan(TEXT_TILE_BUDGET);
    const p = resolve(pattern(size, scale, 't'));
    expect(p.meta.fill?.ok).toBe(true);
    expect(p.items.length).toBeGreaterThan(3000);
  });
});

describe('migration', () => {
  const old = (): Composition => {
    const c = comp({
      outline: { kind: 'polygon', sides: 8, rotation: 7245 },
      fill: { type: 'monogram', text: 'ok', method: 'seal', params: { H: 7, tries: 40, legacy: 'x' } },
    });
    return c;
  };
  it('is one entry: parse, links and storage read older compositions the same way', async () => {
    const want = parseComposition(old());
    expect(want.root.child.outline).toEqual({ kind: 'polygon', sides: 8, rotation: 45 });
    expect(paramsOf(want)).toEqual({ H: 7, tries: 8 });
    expect(readComposition(old())).toEqual(want);
    expect(await decodeComposition(await encodeComposition(old()))).toEqual(want);
    expect(parseComposition(migrate(old()))).toEqual(want);
    // migrated output is valid as the current model has it, and migrating again changes nothing
    expect(isValidComposition(want)).toBe(true);
    expect(migrate(want)).toBe(want);
  });
  it('reaches nested regions and spandrels, and leaves what it cannot read to the schema', () => {
    const c = comp({ fill: { type: 'region', node: old().root.child } });
    const m = parseComposition(c);
    expect((m.root.child.fill as { node: RegionNode }).node.outline).toEqual({
      kind: 'polygon',
      sides: 8,
      rotation: 45,
    });
    for (const junk of [null, 3, 'x', [], {}, { root: 4 }, { root: { child: 'no' } }, { version: 2 }])
      expect(readComposition(junk)).toBeNull();
    expect(() => parseComposition({ ...comp(), version: 2 })).toThrow(CompositionError);
    expect(readComposition({ ...comp(), version: 2 })).toBeNull();
  });
  it('leaves every preset exactly as it is', () => {
    for (const p of PRESETS) {
      expect(migrate(p.comp)).toBe(p.comp);
      expect(parseComposition(p.comp)).toEqual(p.comp);
    }
  });
});

describe('storage', () => {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const withStorage = (f: () => void) => {
    const g = globalThis as { localStorage?: unknown },
      had = Object.getOwnPropertyDescriptor(g, 'localStorage');
    Object.defineProperty(g, 'localStorage', { value: mock, configurable: true, writable: true });
    try {
      f();
    } finally {
      if (had) Object.defineProperty(g, 'localStorage', had);
      else delete g.localStorage;
    }
  };
  afterEach(() => store.clear());
  const stored = () => JSON.parse(store.get('kufi-favourites')!) as { name: string }[];

  it('migrates older favourites, and keeps the ones it cannot read instead of deleting them', () =>
    withStorage(() => {
      const good = { name: 'good', comp: comp(), at: 1 },
        older = {
          name: 'older',
          comp: comp({ fill: { type: 'monogram', text: 'ok', method: 'seal', params: { tries: 99 } } }),
          at: 2,
        },
        future = { name: 'future', comp: { ...comp(), version: 2 }, at: 3 };
      store.set('kufi-favourites', JSON.stringify([good, older, null, future, 'junk']));
      const favs = loadFavourites();
      expect(favs.map(f => f.name)).toEqual(['good', 'older']);
      expect(paramsOf(favs[1].comp)).toEqual({ tries: 8 });
      expect(skippedFavourites()).toEqual(['future']);
      // saving (adding one, deleting one) keeps the unreadable favourite in storage, untouched
      favs.shift();
      favs.unshift({ name: 'new', comp: comp(), at: 4 });
      saveFavourites(favs);
      expect(stored().map(f => f.name)).toEqual(['new', 'older', 'future']);
      expect(stored()[2]).toEqual(future);
      expect(loadFavourites().map(f => f.name)).toEqual(['new', 'older']);
      saveFavourites([]);
      expect(stored()).toEqual([future]);
    }));
  it('falls back when what is stored is not a list', () =>
    withStorage(() => {
      const fallback = ['a', 'b'];
      expect(loadCategories(fallback)).toEqual(fallback);
      for (const bad of ['{"a":1}', '42', '"text"', 'null', 'not json']) {
        store.set('kufi-chrono-cats', bad);
        store.set('kufi-favourites', bad);
        store.set('kufi-ratings', bad);
        expect(loadCategories(fallback), bad).toEqual(fallback);
        expect(() => new Set(loadCategories(fallback))).not.toThrow();
        expect(loadFavourites()).toEqual([]);
        expect(loadRatings()).toEqual([]);
      }
      store.set('kufi-chrono-cats', '["x", 3, "y"]');
      expect(loadCategories(fallback)).toEqual(['x', 'y']);
    }));
});
