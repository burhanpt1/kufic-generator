// Lab port §6: seal letters grow taller by repeating one row of their body.
import { describe, expect, it } from 'vitest';
import { loadSealWasm, loadSealWasmSync, unloadSealWasm } from '../src/kernels/seal';
import { buildMonogram, clearMonogramCache } from '../src/monogram/methods';
import { letterShape } from '../src/monogram/words';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolve } from '../src/compose';
import { renderPlaced } from '../src/render/composition';
import { comparePNG } from '../scripts/compare-lab.mjs';
import { toPNG } from '../scripts/raster.mjs';
import { LAB_CASES } from './golden-lab/cases.mjs';
import { labCaseToComposition } from './golden-lab/compositions';

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
  it('with reshaping and the block penalty off, the seals still match the old references', () => {
    // the scores recorded for these cases before reshaping existed (tests/golden-lab/reviewed.json before §6)
    const old: Record<string, number> = {
      'mono--seal': 0.098,
      'mono--seal-joined-mirror': 0.067,
      'mono--seal-turn-curved': 0.092,
    };
    const dir = join(import.meta.dirname, 'golden-lab');
    for (const [id, score] of Object.entries(old)) {
      const comp = labCaseToComposition(LAB_CASES.find(c => c.id === id)!),
        f = comp.root.child.fill;
      if (f?.type !== 'monogram') throw new Error('monogram case expected');
      f.params = { ...f.params, reshape: false, blocks: 0 };
      clearMonogramCache();
      const r = comparePNG(readFileSync(join(dir, `${id}.png`)), toPNG(renderPlaced(resolve(comp), { idPrefix: id })));
      expect(Math.round(r.ratio * 1000) / 1000, id).toBe(score);
    }
  });
});

const blocks = (g: { w: number; h: number; data: ArrayLike<number> }) => {
  let b = 0;
  const at = (x: number, y: number) => g.data[y * g.w + x];
  for (let y = 0; y < g.h - 1; y++)
    for (let x = 0; x < g.w - 1; x++) if (at(x, y) && at(x + 1, y) && at(x, y + 1) && at(x + 1, y + 1)) b++;
  return b;
};

describe('solid-block penalty in the seal search', () => {
  // neutral words and names, at both ascender heights the decision was measured at
  const TEXTS = ['محمد علي', 'الحسن الحسين', 'فاطمة الزهراء', 'يا علي مدد'];
  const seal = (p: Record<string, unknown>, text: string) => {
    clearMonogramCache();
    return buildMonogram('seal', { sym: 'mirror', tries: 6, ...p }, text, kufi, DEFAULT_STYLE.letter)!;
  };
  it('is on by default and gives the same seal in the kernel and the JS fallback', () => {
    const p = { H: 9, sym: 'mirror' as const, tries: 1, seed: 4243 },
      text = 'محمد علي';
    clearMonogramCache();
    const w = buildMonogram('seal', p, text, kufi, DEFAULT_STYLE.letter)!;
    unloadSealWasm();
    clearMonogramCache();
    const j = buildMonogram('seal', p, text, kufi, DEFAULT_STYLE.letter)!;
    loadSealWasmSync();
    expect([w.stats?.engine, j.stats?.engine]).toEqual(['wasm', 'js']);
    expect(Array.from(j.grid.data)).toEqual(Array.from(w.grid.data));
    clearMonogramCache();
    const off = buildMonogram('seal', { ...p, blocks: 0 }, text, kufi, DEFAULT_STYLE.letter)!;
    expect(Array.from(off.grid.data)).not.toEqual(Array.from(w.grid.data));
  });
  it('packs fewer solid blocks into reshaped seals while they share more cells', () => {
    for (const H of [7, 9]) {
      let on = 0,
        off = 0,
        sharedOn = 0,
        sharedOff = 0,
        old = 0,
        blocksOn = 0,
        blocksOld = 0;
      for (const text of TEXTS) {
        const a = seal({ H }, text),
          b = seal({ H, reshape: false }, text),
          c = seal({ H, blocks: 0 }, text);
        blocksOn += blocks(a.grid);
        blocksOld += blocks(c.grid);
        on += a.metrics.total;
        off += b.metrics.total;
        old += c.metrics.total;
        sharedOn += a.stats!.shared!;
        sharedOff += b.stats!.shared!;
      }
      // some letters' own designs hold a block (a doubled wall), so blocks fall rather than vanish
      expect(blocksOn, `H${H}`).toBeLessThan(blocksOld);
      expect(sharedOn, `H${H}`).toBeGreaterThan(sharedOff);
      // within seed noise of reshaping off, and clearly better than the search without the penalty
      expect(on, `H${H}`).toBeGreaterThan(off - 0.02 * TEXTS.length);
      expect(on, `H${H}`).toBeGreaterThan(old);
    }
  }, 120_000);
});
