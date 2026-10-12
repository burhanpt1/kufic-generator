// Word seals (owner's review: a seal of the text's distinct letters can't be read): whole words, joined as written,
// interlocked in reading order.
import { describe, expect, it } from 'vitest';
import { loadSealWasm, loadSealWasmSync, unloadSealWasm } from '../src/kernels/seal';
import { buildMonogram, clearMonogramCache, MONO_DEFAULTS } from '../src/monogram/methods';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';

await loadSealWasm();
const TEXTS = ['يا علي مدد', 'محمد علي', 'بسم الله الرحمن الرحيم', 'لا اله الا الله', 'الحمد لله رب العالمين'];

describe('word seals', () => {
  it('are the default, unmirrored', () => {
    expect(MONO_DEFAULTS.words).toBe(true);
    clearMonogramCache();
    const m = buildMonogram('seal', { sym: 'mirror' }, 'يا علي مدد', kufi, DEFAULT_STYLE.letter)!;
    expect(m.stats?.sym).toBe('none');
    expect(m.stats?.letters).toEqual(['يا', 'علي', 'مدد']);
  });
  it.each(TEXTS)('read in order: %s', text => {
    clearMonogramCache();
    const m = buildMonogram('seal', { H: 7, tries: 2 }, text, kufi, DEFAULT_STYLE.letter)!;
    expect(m.stats?.readingOrder).toBe(true);
    expect(m.metrics.legibility).toBeGreaterThan(0.8);
  });
  it('agree byte for byte between WebAssembly and JS', () => {
    const p = { H: 7, tries: 2, seed: 77 };
    clearMonogramCache();
    const w = buildMonogram('seal', p, 'بسم الله الرحمن الرحيم', kufi, DEFAULT_STYLE.letter)!;
    unloadSealWasm();
    clearMonogramCache();
    const j = buildMonogram('seal', p, 'بسم الله الرحمن الرحيم', kufi, DEFAULT_STYLE.letter)!;
    loadSealWasmSync();
    expect([w.stats?.engine, j.stats?.engine]).toEqual(['wasm', 'js']);
    expect(Array.from(j.grid.data)).toEqual(Array.from(w.grid.data));
  });
});
