// The shipped presets and what breeding makes of them, pinned bit for bit: both are built by code the page loads at
// start, which is kept apart from the composing engine, and moving that code about must not change a value.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { breedFrom, freshGeneration } from '../src/evolve/breed';
import { crossover, mutate, randomComposition, relevantTraits } from '../src/evolve/operators';
import { Rng } from '../src/evolve/rng';
import { namePalette } from '../src/ornament/palette';
import { NAMES_PRESET } from '../src/model/names';
import { PRESETS } from '../src/model/presets';
import { namesComposition } from '../src/showpiece/names';

// sha-256 of each preset's JSON, and of all of them and of the breeding run below, as they were before the page's
// start-up code was parted from the engine
const PRESET_HASHES: [string, string][] = [
  ['fatimid-medallion', '4575eec36d68358f941a6a8cb858ea7f27ae01fd3c6b4dc9185c9f6bf53f68bd'],
  ['mihrab-ayat-al-kursi', '20c6d95821be420cb8dde04e38442d18bcd9c2c79122822267b2fb1a2caa0e6b'],
  ['octagon-panel', 'b07742ecda064c0829871ad8584c753ccea14c46e4f1e433b4e002ccb64fe073'],
  ['basmala-seal', 'cb0959c504fc19b796f2b798284a752d340351b9734453a1acf666e2f512563b'],
  ['shahada-block', 'fd858c3b40cf77d99f780c58ca07a810f18ad05c32055125cee5c2878947a62e'],
  ['kufic-maze-tile', '4ae1177a3e6c64a3ad607df1d837ab55c4d089406253115591c7097cf2fb6ec9'],
  ['teardrop-gold', 'b849e1c89125fe5b8a8bb1f24548d1a34162db0f4c25ee1a4176741e6575c7f0'],
  ['hexagon-lapis', '36bb20cb60e333ace32f8fb24683803d0d6eea582b5a7cd7111d0faaf1d511b6'],
  ['ahl-al-bayt', '5beb3c1dfac74655462e617b605842b0704987b4f20d3ca1c4e6281ea8f49d00'],
  ['names-cartouche', 'e25f9ca6d942c839438b4cae779bd6f6eaa9085c8de000a4136c17c5c7737d74'],
];
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('presets', () => {
  it('are what they were, to the last key', () => {
    expect(PRESETS.map(p => [p.id, sha(p)])).toEqual(PRESET_HASHES);
    expect(sha(PRESETS)).toBe('b73c1716ad5f2f44cabb5063748639f78746aa4f39191288f37d723a9c90e1da');
  });
  it('keep the names cartouche equal to the one built from its two colours', () => {
    const { text, primary, accent, palette } = NAMES_PRESET;
    expect(palette).toEqual(namePalette(primary, accent));
    expect(PRESETS.find(p => p.id === 'names-cartouche')!.comp).toEqual(namesComposition(text, primary, accent));
  });
});

describe('breeding', () => {
  it('makes the same children from the same seed', () => {
    const rng = new Rng(20261114),
      texts = PRESETS[0].comp.texts,
      out: unknown[] = [];
    for (const p of PRESETS) {
      out.push(relevantTraits(p.comp));
      for (let i = 0; i < 12; i++) out.push(mutate(p.comp, 0.3 + 0.1 * i, { rng }));
      out.push(breedFrom([p.comp], 6, 0.5, { rng }));
    }
    for (let i = 0; i + 1 < PRESETS.length; i++) {
      out.push(crossover(PRESETS[i].comp, PRESETS[i + 1].comp, { rng }));
      out.push(breedFrom([PRESETS[i].comp, PRESETS[i + 1].comp], 6, 0.5, { rng }));
    }
    for (let i = 0; i < 40; i++) out.push(randomComposition(texts, { rng }));
    for (const script of ['kufi', 'thuluth'] as const)
      out.push(freshGeneration(12, texts, { rng, locks: { script }, first: [PRESETS[1].comp] }));
    for (const c of out.flat().filter(c => c && typeof c === 'object' && 'root' in (c as object)))
      out.push(relevantTraits(c as (typeof PRESETS)[number]['comp']));
    expect(sha(out)).toBe('0bf1db4e7c861c08e43ca357ae86a3015925805bbb79778f8b8df5da5e8f35a7');
  });
});
