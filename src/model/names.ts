// Two names in a thuluth cartouche, as worked out for Burhan and Shamira: the names nested and layered inside the
// great bowl of a free-standing final nun (or a returning ya), tails drawn out under what nests in them, tall stems
// rising into the room the bowl leaves, on quiet Iznik tiles inside a single rim. Both names in one colour, their
// eyes and the conjunction in another.
//
// The great nun: where a name ends in an isolated nun (برهان), the nun stands free at the head of its own bowl and
// sweeps round beneath everything (bowl.free, on by default), the owner's favourite gesture of the cartouche.
//
// The tree is plain data built from a palette, so the presets hold it without the colour engine or the composer;
// src/showpiece/names makes the palette from a primary and an accent colour.
import { superellipse } from '../geometry/superellipse';
import type { NamePalette } from '../ornament/palette';
import type { Composition, RoundelRecipe, Style } from './schema';
import { DEFAULT_STYLE } from './style';

/** The recipe the Burhan and Shamira search settled on (layout chosen by the composer, nothing pinned). */
export const NAMES_RECIPE: RoundelRecipe = {
  elongate: true,
  cross: true,
  noRise: true,
  cradle: true,
  kern: true,
  nest: true,
  stack: true,
  oval: 1.3,
  fillTarget: 0.55,
  tries: 6,
  markReach: 2.2,
  great: { ya: true, yaWide: 2.6, yaDeep: 1.3 },
  tails: { reach: 6 },
  rise: {},
  // the great bowl: a final nun or returning ya swept round beneath both names, a free-standing nun at its own head
  bowl: { clear: 5.6, autoOval: true, free: true },
};

export interface NamesOptions {
  seed?: number;
  /** Changes to the recipe (a seed, stacked joins, a pinned layout). */
  recipe?: Partial<RoundelRecipe>;
  /** How much of the field colour lies over the tiles (0–1). */
  wash?: number;
}

/** The region: a squarish oval, coarse enough to keep a shared link short (the cartouche is fitted inside it). */
const OUTLINE = superellipse(1.5, 2.2, 48).map(([x, y]) => [Math.round(x * 1000) / 1000 || 0, Math.round(y * 1000) / 1000 || 0] as [number, number]); // prettier-ignore

/** The cartouche for a text of two names joined by و (vocalised as it should be written), in a palette's colours. */
export function namesCartouche(text: string, pal: NamePalette, o: NamesOptions = {}): Composition {
  const style = structuredClone(DEFAULT_STYLE) as Style;
  style.palette = { ink: pal.tiles.ink, ink2: pal.tiles.ink2, paper: pal.field, mark: pal.tiles.mark };
  return {
    version: 1,
    seed: 21,
    canvas: { shape: 'landscape', margin: 3 },
    style,
    texts: { names: { text, repeat: 'once', wordGap: 2 } },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'poly', points: OUTLINE },
        borders: [],
        fill: {
          type: 'roundel',
          text: 'names',
          rim: 'single',
          fieldTiles: { fold: 8, scale: 3.2, wash: o.wash ?? 0.2 },
          colours: {
            field: pal.field,
            letters: pal.names,
            sheen: pal.sheen,
            rim: pal.rim,
            line: pal.line,
            counters: pal.eyes,
            pair: { first: pal.names, second: pal.names, accent: pal.accent, eyes: pal.eyes },
          },
          recipe: {
            ...NAMES_RECIPE,
            tweaks: [{ at: 'و', scale: 0.62, tint: pal.accent }],
            ...(o.seed != null ? { seed: o.seed } : {}),
            ...o.recipe,
          },
        },
      },
    },
  };
}

/** The shipped cartouche: its names, its two colours, and the palette namePalette makes of them, written out so the
 *  presets need no colour engine (a test holds it to namePalette's answer). */
export const NAMES_PRESET: { text: string; primary: string; accent: string; palette: NamePalette } = {
  text: 'بُرْهَان وَشَمِيرَة',
  primary: '#1E5B4F',
  accent: '#D9A23A',
  palette: {
    field: '#f3f6f5',
    tiles: { ink: '#abc0ba', ink2: '#e5be7e', mark: '#d9a23a' },
    names: '#0a4c41',
    eyes: '#d59e35',
    accent: '#9a6600',
    rim: '#225d52',
    line: '#003f34',
    sheen: '#3a6c61',
  },
};
