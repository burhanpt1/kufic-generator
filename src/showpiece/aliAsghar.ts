// Ali Asghar: the name in a thuluth cartouche, علي on the right of أصغر with the alif rising between them, framed by
// ornament alone (a braid between pearls and rules, no text round it), on Iznik tiles to the edge of an A3 sheet.
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

export function aliAsgharComposition(variant: WeddingVariant = 'lapis'): Composition {
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
          recipe: ALI_ASGHAR_RECIPE,
          ground: { fold: 8, scale: 2.2 },
        },
      },
    },
  };
}

export function aliAsgharSheet(variant: WeddingVariant = 'lapis'): WeddingSheet {
  return cartoucheSheet(aliAsgharComposition(variant), LOOKS[variant].palette, 'aa');
}
