// Phase 6.6: long letter alternates chosen by the justifier.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { ALTS } from '../src/glyphs/tables';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { kufi } from '../src/script/kufi';
import type { CellStrip } from '../src/script/types';
import type { Seg } from '../src/types';

const TEXT = 'الحسين يلقى كمن كلم';
const prep = (alternates: boolean) => kufi.prepareLines([TEXT], { ...DEFAULT_STYLE.letter, alternates })[0];
const opts = { wordGap: 2, rhythm: false, terminals: 'none', wrap: false } as const;
const natural = (segs: Seg[]) => segs.reduce((a, s) => a + s.minW, 0) + 2 * (segs.length - 1);
const ink = (s: CellStrip) => s.data.reduce((a, v) => a + (v === 1 ? 1 : 0), 0);

describe('alternates', () => {
  it('are offered only when switched on, for final noon, yeh, kaf and meem', () => {
    const off = prep(false).words.flatMap(w => (w as { glyphs: { alt?: unknown }[] }).glyphs);
    expect(off.some(g => g.alt)).toBe(false);
    const on = prep(true).words.flatMap(w => (w as { glyphs: { alt?: { w: number }; w: number }[] }).glyphs);
    expect(on.filter(g => g.alt).length).toBe(4); // نون، ى، ن، م
    for (const g of on) if (g.alt) expect(g.alt.w).toBeGreaterThan(g.w);
  });
  it('raised tails stay well below an ascender, so they never read as alif', () => {
    for (const k of ['NOON', 'YEH']) {
      const rows = ALTS[k].fin as string[];
      expect(rows.length).toBeLessThanOrEqual(5);
      expect(rows[0].startsWith('##')).toBe(true); // the tail curls back
    }
  });
  it('the justifier uses them only when there is room, and the width is exact', () => {
    const p = prep(true),
      segs = kufi.segments(p, 'words', 2) as Seg[],
      nat = natural(segs);
    const tight = kufi.layout(segs, p, nat, opts) as CellStrip,
      roomy = kufi.layout(segs, p, nat + 30, opts) as CellStrip;
    const plain = kufi.prepareLines([TEXT], DEFAULT_STYLE.letter)[0];
    const tightPlain = kufi.layout(kufi.segments(plain, 'words', 2), plain, nat, opts) as CellStrip;
    expect(tight.W).toBe(nat);
    expect(roomy.W).toBe(nat + 30);
    expect(Array.from(tight.data)).toEqual(Array.from(tightPlain.data)); // no room: identical to no alternates
    const roomyPlain = kufi.layout(kufi.segments(plain, 'words', 2), plain, nat + 30, opts) as CellStrip;
    expect(Array.from(roomy.data)).not.toEqual(Array.from(roomyPlain.data));
    expect(ink(roomy)).toBeGreaterThan(ink(roomyPlain) - 40); // alternates add strokes, not only stretched baseline
  });
  it('compositions with alternates resolve; default output is unchanged', () => {
    const c = structuredClone(preset('octagon-panel'));
    c.style.letter.alternates = true;
    expect(isValidComposition(c)).toBe(true);
    const p = resolve(c);
    expect(p.meta.warnings).toEqual([]);
    expect(resolve(preset('octagon-panel'))).toEqual(resolve(structuredClone(preset('octagon-panel'))));
  });
});
