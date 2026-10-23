// Ali Asghar: the name in a thuluth cartouche (علي on the right of أصغر, or أصغر nested in the swoop of علي's ya, or
// stacked on the drawn-out join of its lam and ya), framed by ornament alone (a braid between pearls and rules, no text
// round it), on Iznik tiles to the edge of an A3 sheet.
import type { Composition, RoundelRecipe, Style } from '../model/schema';
import { DEFAULT_STYLE } from '../model/style';
import { cartoucheSheet, LOOKS, superellipse } from './wedding';
import type { WeddingSheet, WeddingVariant } from './wedding';

export const ALI_ASGHAR = 'عَلِيّ أَصْغَر';

/** A pinned arrangement: left to itself the composer puts علي's great ya to the left of أصغر, so the name reads
 *  backwards; here علي (its plain ya) stands to the right and a little higher, أصغر to its left. */
export const ALI_ASGHAR_RECIPE: RoundelRecipe = {
  elongate: true,
  cross: true,
  fillTarget: 0.65,
  noRise: true,
  cradle: true,
  kern: true,
  oval: 1.7,
  fixed: {
    lv: [0, 2, 2],
    wp: [
      { x: -22, y: 1 },
      { x: -46, y: -4 },
    ],
  },
  bowl: { clear: 5.6, autoOval: true },
  markReach: 1.6,
  ornaments: true,
  density: 0.5,
};

const MARKS = { markReach: 1.8, ornaments: true, density: 0.5 };
/** أصغر nested in the swoop of علي's ya, the ra of أصغر swooping too: the ya's tail runs on under the next word, the
 *  ra's is drawn out with nothing in it, both dipping. */
const swoop = (seed: number, fillTarget: number, oval: number, free: number, reach: number, sag: number): RoundelRecipe => ({
  cross: true,
  noRise: true,
  kern: true,
  fillTarget,
  oval,
  seed,
  seat: [{ word: 1, on: 0, tail: true }],
  tails: { across: true, free, reach, follow: 'level', sag },
  ...MARKS,
}); // prettier-ignore
/** The join between علي's lam and ya drawn out long, and أصغر stacked on it. */
const shelf = (seed: number, fillTarget: number, oval: number, rise: boolean): RoundelRecipe => ({
  elongate: true,
  cross: true,
  kern: true,
  fillTarget,
  oval,
  seed,
  kashLengths: [13, 17, 21],
  seat: [{ word: 1, on: 0, at: 2 }],
  ...(rise ? { rise: {} } : {}),
  ...MARKS,
});

/** The arrangements: side by side, and the best three of thirty seeds of each of the swoop and the shelf (each seed
 *  also drew its proportions). */
export const ALI_ASGHAR_LAYOUTS = {
  side: ALI_ASGHAR_RECIPE,
  'swoop-27': swoop(27, 0.6, 1.68, 10.76, 2.1, 2.33),
  'swoop-1': swoop(1, 0.56, 1.63, 6.73, 1.8, 3.2),
  'swoop-6': swoop(6, 0.49, 1.61, 9.39, 0.81, 3.45),
  'shelf-18': shelf(18, 0.6, 1.7, false),
  'shelf-29': shelf(29, 0.51, 1.76, true),
  'shelf-6': shelf(6, 0.49, 1.45, true),
} satisfies Record<string, RoundelRecipe>;
export type AliAsgharLayout = keyof typeof ALI_ASGHAR_LAYOUTS;

export function aliAsgharComposition(variant: WeddingVariant = 'lapis', layout: AliAsgharLayout = 'side'): Composition {
  const look = LOOKS[variant],
    style = structuredClone(DEFAULT_STYLE) as Style;
  style.palette = { ...look.palette };
  return {
    version: 1,
    seed: 21,
    canvas: { shape: 'landscape', margin: 6 },
    style,
    texts: { names: { text: ALI_ASGHAR, repeat: 'once', wordGap: 2 } },
    root: {
      type: 'frame',
      spandrels: { type: 'iznik', iznik: { fold: 8, scale: 3 } },
      child: {
        type: 'region',
        outline: { kind: 'poly', points: superellipse(1.45, 2.6) },
        size: 40,
        borders: [
          { type: 'ornamentBorder', ornament: 'lines', width: 1 },
          { type: 'ornamentBorder', ornament: 'braid', width: 4 },
          { type: 'ornamentBorder', ornament: 'pearls', width: 2 },
          { type: 'ornamentBorder', ornament: 'lines', width: 1 },
        ],
        fill: {
          type: 'roundel',
          text: 'names',
          colours: look.cartouche,
          recipe: ALI_ASGHAR_LAYOUTS[layout],
          ground: { fold: 8, scale: 2.2 },
        },
      },
    },
  };
}

export function aliAsgharSheet(variant: WeddingVariant = 'lapis', layout: AliAsgharLayout = 'side'): WeddingSheet {
  return cartoucheSheet(aliAsgharComposition(variant, layout), LOOKS[variant].palette, 'aa');
}
