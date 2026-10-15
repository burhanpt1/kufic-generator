// Style defaults and inheritance.
import type { Style, StyleOverride } from './schema';

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
};

export const PALETTES = deepFreeze({
  carvedStone: { ink: '#4A3A2A', ink2: '#9A6B3C', paper: '#DDD0B6', mark: '#9C3A22' },
  bannaiBrick: { ink: '#1E8586', ink2: '#24427E', paper: '#C99D74', mark: '#7B2A1C' },
  cobalt: { ink: '#1F3F8C', ink2: '#2C8F9A', paper: '#F1EFE8', mark: '#B7322A' },
  ink: { ink: '#161616', ink2: '#A2772E', paper: '#ECE8DF', mark: '#B7322A' },
  goldOnLapis: { ink: '#D8AC45', ink2: '#9CC3D6', paper: '#1C2B5E', mark: '#E9E4D6' },
  chalk: { ink: '#EFECE3', ink2: '#D49A6A', paper: '#233130', mark: '#E3895A' },
} as const);
export const PALETTE_NAMES: Record<keyof typeof PALETTES, string> = {
  carvedStone: 'Carved stone',
  bannaiBrick: "Banna'i brick",
  cobalt: 'Cobalt',
  ink: 'Ink',
  goldOnLapis: 'Gold on lapis',
  chalk: 'Chalk',
};

/** Frozen: copy before changing (structuredClone, or inherit() with an override). */
export const DEFAULT_STYLE: Style = deepFreeze({
  script: 'kufi',
  letter: { ascenders: 9, ra: 'desc', ayn: 'cup', lamAlif: 'knot', marks: 'dots', vowels: 'modern' },
  stroke: { kind: 'blocks', corner: 0.6, weight: 0.85, softness: 0.2, banded: false },
  terminals: { kind: 'none', reach: 'tails' },
  palette: { ...PALETTES.carvedStone },
  colouring: 'solid',
  abjad: { taMarbuta: 5, system: 'mashriqi' },
} as Style);

/** Apply an override on top of a style (each group merged one level deep). */
export function inherit(base: Style, o?: StyleOverride): Style {
  if (!o) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    const b = (base as unknown as Record<string, unknown>)[k];
    out[k] = v && typeof v === 'object' && b && typeof b === 'object' ? { ...b, ...v } : v;
  }
  return out as unknown as Style;
}
