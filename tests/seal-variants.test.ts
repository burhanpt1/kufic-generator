// Lab port §6: seal letters grow taller by repeating one row of their body.
import { describe, expect, it } from 'vitest';
import { loadSealWasm, loadSealWasmSync, unloadSealWasm } from '../src/kernels/seal';
import { buildMonogram, clearMonogramCache } from '../src/monogram/methods';
import { letterShape } from '../src/monogram/words';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';

await loadSealWasm();
const L = { ...DEFAULT_STYLE.letter, ascenders: 9 };
const gridOf = (s: NonNullable<ReturnType<typeof letterShape>>) => {
  const g = Array.from({ length: s.h }, () => new Array<number>(s.w).fill(0));
  for (const [x, y, v] of s.cells) g[y][x] = v;
  return g;
};

describe('taller seal variants', () => {
  it('repeat one body row three times, at 0.8 per row', () => {
    for (const c of [...'ابسطكلنهوي']) {
      const a = letterShape(kufi, c, L, 0, 'iso', 0)!,
        b = letterShape(kufi, c, L, 0, 'iso', 3)!;
      expect(b.h).toBe(a.h + 3);
      expect(b.w).toBe(a.w);
      expect(b.cost).toBeCloseTo(a.cost + 2.4, 9);
      // the grown letter is the original with one qualifying row repeated: inked cells in it have letter ink
      // directly above and below and none beside
      const ga = gridOf(a),
        gb = gridOf(b),
        same = (r: number[], q: number[]) => r.every((v, i) => v === q[i]),
        isL = (y: number, x: number) => ga[y]?.[x] === 1,
        qualifies = (y: number) =>
          ga[y].some(v => v) &&
          ga[y].every((v, x) => !v || (v === 1 && isL(y - 1, x) && isL(y + 1, x) && !isL(y, x - 1) && !isL(y, x + 1)));
      const r = ga.findIndex(
        (_, y) =>
          y > 0 &&
          y < a.h - 1 &&
          qualifies(y) &&
          ga.every((row, k) => same(row, gb[k <= y ? k : k + 3])) &&
          [1, 2, 3].every(k => same(gb[y + k], ga[y])),
      );
      expect(r, c).toBeGreaterThan(0);
    }
  });
  it('skip letters with no such row', () => {
    expect(letterShape(kufi, 'م', L, 0, 'iso', 3)).toBeNull();
    expect(letterShape(kufi, 'م', L, 0, 'iso', 0)).not.toBeNull();
  });
  it('are offered to the seal search identically by the kernel and the JS fallback', () => {
    const p = { H: 7, sym: 'none' as const, box: 0.7, share: 2, tries: 1, seed: 4243 },
      text = 'بسم الله الرحمن الرحيم';
    clearMonogramCache();
    const w = buildMonogram('seal', p, text, kufi, DEFAULT_STYLE.letter)!;
    unloadSealWasm();
    clearMonogramCache();
    const j = buildMonogram('seal', p, text, kufi, DEFAULT_STYLE.letter)!;
    loadSealWasmSync();
    expect(w.stats?.engine).toBe('wasm');
    expect(j.stats?.engine).toBe('js');
    expect(Array.from(j.grid.data)).toEqual(Array.from(w.grid.data));
  });
});
