// Two names in a thuluth cartouche, as worked out for Burhan and Shamira: the names nested and layered inside the
// great bowl of a free-standing final nun (or a returning ya), tails drawn out under what nests in them, tall stems
// rising into the room the bowl leaves, on quiet Iznik tiles inside a single rim. Colours come from one primary and
// one accent (namePalette): both names in the primary, their eyes and the conjunction in the accent.
//
// The great nun: where a name ends in an isolated nun (برهان), the nun stands free at the head of its own bowl and
// sweeps round beneath everything (bowl.free, on by default), the owner's favourite gesture of the cartouche.
import type { Composition, RoundelRecipe, Style } from '../model/schema';
import { DEFAULT_STYLE } from '../model/style';
import { namePalette } from '../ornament/palette';
import { superellipse } from './wedding';

/** The recipe the Burhan and Shamira search settled on (layout chosen by the composer, nothing pinned). */
export const NAMES_RECIPE: RoundelRecipe = {
  elongate: true,
  cross: true,
  noRise: true,
  cradle: true,
  kern: true,
  nest: true,
  stack: true,
  // the stacked joins the lab offered, which this design was found with
  stackPull: 1.6,
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

/** The cartouche for a text of two names joined by و (vocalised as it should be written), in the given colours. */
export function namesComposition(text: string, primary: string, accent: string, o: NamesOptions = {}): Composition {
  const pal = namePalette(primary, accent),
    style = structuredClone(DEFAULT_STYLE) as Style;
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
