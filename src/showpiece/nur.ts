// "Light upon light": a single A1 showpiece on the Light Verse (al-Nur 24:35). The verse is itself a nesting (a niche,
// in it a lamp, the lamp in a glass, the glass like a shining star, lit from a blessed olive tree), so the composition
// nests the same way: each layer is the thing the verse names, inscribed with the words that name it.
import type { Composition, RegionNode, Style, TextSlot } from '../model/schema';
import { SILHOUETTES } from '../model/silhouettes';
import { DEFAULT_STYLE } from '../model/style';

export const NUR = {
  verse:
    'الله نور السماوات والأرض مثل نوره كمشكاة فيها مصباح المصباح في زجاجة الزجاجة كأنها كوكب دري يوقد من شجرة مباركة زيتونة لا شرقية ولا غربية يكاد زيتها يضيء ولو لم تمسسه نار نور على نور يهدي الله لنوره من يشاء ويضرب الله الأمثال للناس والله بكل شيء عليم',
  niche: 'مثل نوره كمشكاة فيها مصباح',
  lamp: 'المصباح في زجاجة',
  glass: 'الزجاجة كأنها كوكب دري',
  tree: 'يوقد من شجرة مباركة زيتونة لا شرقية ولا غربية',
  oil: 'يكاد زيتها يضيء ولو لم تمسسه نار',
  core: 'نور على نور',
  opening: 'الله نور السماوات والأرض',
  guidance: 'يهدي الله لنوره من يشاء',
};

/** Night lapis, gold leaf, pale lamp-glass blue, ivory. */
export const NIGHT = { ink: '#D9AE48', ink2: '#A9CCDD', paper: '#0E1736', mark: '#F1E7C9' };
const GLASS = { ink: '#F3E3B0', ink2: '#D9AE48', paper: '#13214A', mark: '#FFF6DA' };

const slot = (text: string, repeat: 'fill' | 'once' = 'fill'): TextSlot => ({ text, repeat, wordGap: 2 });
export const nurStyle = (): Style => {
  const s = structuredClone(DEFAULT_STYLE) as Style;
  s.palette = { ...NIGHT };
  s.letter = { ...s.letter, ascenders: 11 };
  s.terminals = { kind: 'palmette', reach: 'tails', flourish: 'sprouts' };
  s.colouring = 'byRing';
  s.stroke = { ...s.stroke, kind: 'curved', corner: 0.6, weight: 0.85, contrast: 0.45, taper: 0.5 };
  return s;
};

/** The niche and everything in it: mihrab → lamp → glass → star → light upon light. */
export function niche(): Composition {
  const star: RegionNode = {
    type: 'region',
    outline: { kind: 'star', points: 8, depth: 0.9 },
    borders: [{ type: 'ornamentBorder', ornament: 'lines', width: 1 }],
    features: { tips: 'none' },
    style: { palette: { ...GLASS } },
    // light upon light winding in on itself: a square Kufic spiral
    fill: { type: 'monogram', text: 'core', method: 'spiral', params: { H: 7 } },
  };
  const glass: RegionNode = {
    type: 'region',
    outline: { kind: 'circle' },
    borders: [
      { type: 'textBorder', text: 'glass', separator: { kind: 'braid', width: 3 } },
      { type: 'textBorder', text: 'tree', taper: 0.7, separator: { kind: 'pearls', width: 2 } },
      { type: 'textBorder', text: 'oil', taper: 0.7, separator: { kind: 'lines', width: 2 } },
    ],
    fill: { type: 'region', node: star },
  };
  const lamp: RegionNode = {
    type: 'region',
    outline: { kind: 'svg', path: SILHOUETTES.lamp },
    borders: [
      {
        type: 'textBorder',
        text: 'lamp',
        separator: { kind: 'chevron', width: 3 },
        ground: { kind: 'pattern', pattern: { tiling: '488', angle: 67, scale: 4 } },
      },
    ],
    features: { tips: 'finial' },
    fill: { type: 'region', node: glass },
  };
  return {
    version: 1,
    seed: 2435,
    canvas: { shape: 'portrait', margin: 3 },
    style: nurStyle(),
    texts: {
      verse: slot(NUR.verse, 'once'),
      niche: slot(NUR.niche),
      lamp: slot(NUR.lamp),
      glass: slot(NUR.glass),
      tree: slot(NUR.tree),
      oil: slot(NUR.oil),
      core: slot(NUR.core),
    },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'preset', name: 'mihrab' },
        borders: [
          {
            type: 'textBorder',
            text: 'verse',
            separator: { kind: 'braid', width: 4 },
            ground: { kind: 'vine' },
          },
          { type: 'textBorder', text: 'niche', taper: 0.3, separator: { kind: 'pearls', width: 3 } },
        ],
        features: { tips: 'finial' },
        fill: { type: 'region', node: lamp },
      },
    },
  };
}

/** The A1 frame: the Ninety-Nine Names around a field of eight-fold stars whose
 *  every line is written in the word نور, light. Portrait at A-series
 *  proportions (1 : √2). */
export function frame(names: string): Composition {
  const h = 1 / Math.sqrt(1 + 0.5),
    w = h / Math.SQRT2;
  return {
    version: 1,
    seed: 99,
    canvas: { shape: 'portrait', margin: 2 },
    // the star field in the pale blue of light; the names stay gold
    style: { ...nurStyle(), palette: { ...NIGHT, ink2: '#6F96CF' } },
    texts: { names: slot(names, 'once'), light: slot('نور') },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: {
          kind: 'poly',
          points: [
            [-w, -h],
            [w, -h],
            [w, h],
            [-w, h],
          ],
        },
        borders: [
          { type: 'textBorder', text: 'names', separator: { kind: 'braid', width: 4 }, ground: { kind: 'tint' } },
          { type: 'ornamentBorder', ornament: 'pearls', width: 3 },
        ],
        features: { corners: 'star' },
        // the stars of the field outlined in the word light, thousands of times
        fill: { type: 'pattern', pattern: { tiling: '488', angle: 67, scale: 18 }, text: 'light' },
      },
    },
  };
}

/** A cartouche: one line of text in an elongated hexagon. */
export function cartouche(text: string, seed: number): Composition {
  return {
    version: 1,
    seed,
    canvas: { shape: 'landscape', margin: 1 },
    style: nurStyle(),
    texts: { t: slot(text, 'once') },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: {
          kind: 'poly',
          points: [
            [-1, 0],
            [-0.82, -0.32],
            [0.82, -0.32],
            [1, 0],
            [0.82, 0.32],
            [-0.82, 0.32],
          ],
        },
        size: 34,
        borders: [{ type: 'ornamentBorder', ornament: 'braid', width: 2 }],
        fill: { type: 'lines', text: 't', lineGap: 1 },
      },
    },
  };
}
