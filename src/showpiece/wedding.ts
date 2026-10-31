// Zainab and Qusay: the thuluth lab's wedding cartouche, rebuilt with the whole engine. The names in a thuluth oval
// (their pinned layout from the lab, the great returning ya, the conjunction small and turquoise under Zainab's ba),
// ringed by Ar-Rum 30:21 in square Kufic, read once from the star at the bottom, on a field of Iznik tiles. One A3
// landscape sheet.
import { resolve } from '../compose';
import type { Placed, PlacedItem } from '../compose/placed';
import { inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import type { Composition, Palette, RoundelColours, RoundelRecipe, Style } from '../model/schema';
import { DEFAULT_STYLE } from '../model/style';
import { iznikField } from '../ornament/patterns/multigrid';
import { renderPlaced } from '../render/composition';
import { U } from '../render/svg';

export const WEDDING = {
  names: 'زَيْنَب وَقُصَيّ',
  /** Ar-Rum 30:21, the words chosen for the ring, exactly as written. */
  verse: 'ومن آياته أن خلق لكم من أنفسكم أزواجا لتسكنوا إليها وجعل بينكم مودة ورحمة',
};

/** The lab's chosen arrangement (layouts/zainab-qusay.json, with Zainab lifted 1.4 as the reference renders it). */
export const WEDDING_RECIPE: RoundelRecipe = {
  elongate: true,
  cross: true,
  fillTarget: 0.5,
  noRise: true,
  cradle: true,
  oval: 1.45,
  emph: 'ب',
  kern: true,
  // the lab's variant list, with its stacked joins, so the recorded variant numbers keep their meaning, and its light
  // touch between kerned pieces
  stackPull: 1.6,
  kernTouch: 3,
  fixed: {
    lv: [2, 5, 2, 0],
    wp: [
      { x: 29.672053156432536, y: -43.52125893293541 + 1.4 },
      { x: 27.687673586216018, y: -52.90845246673958 },
    ],
  },
  great: { ya: true, yaWide: 2.6, yaDeep: 1.3 },
  tweaks: [{ at: 'و', scale: 0.62, tint: '#2AA6A0', under: { group: 1, gap: 0.7 } }],
  bowl: { clear: 5.6, autoOval: true, dotAt: 0.42 },
  markReach: 2.2,
  ornaments: true,
  density: 0.6,
  // the marks as delivered, before the rules from the Arabic sources (a short fatha; the small ح and س only), and the
  // ornaments in the largest gaps, as the lab placed them
  fathaRule: false,
  allSigns: false,
  pockets: false,
};

export type WeddingVariant = 'cobalt' | 'lapis';
interface Look {
  palette: Palette;
  cartouche: RoundelColours;
  /** Ornaments in the cartouche (0–1). */
  density: number;
}
export const LOOKS: Record<WeddingVariant, Look> = {
  // white on cobalt with turquoise counters, as the original; Iznik tiles on white
  cobalt: {
    palette: { ink: '#1F3F8F', ink2: '#2A9D9A', paper: '#F4F6F7', mark: '#B3362C' },
    cartouche: { field: '#1F3F8F', letters: '#F4F6F7', sheen: '#F4F6F7', rim: '#F4F6F7', line: '#1F3F8F', counters: '#2AA6A0' }, // prettier-ignore
    density: 0.7,
  },
  // gold on lapis: the tiles drawn in gold and pale blue on lapis, the names in gold on a night field
  lapis: {
    palette: { ink: '#D8AC45', ink2: '#9CC3D6', paper: '#1C2B5E', mark: '#E9E4D6' },
    cartouche: { field: '#0E1736', letters: '#D8AC45', sheen: '#F0D07A', rim: '#D8AC45', line: '#7A5A1C', counters: '#2AA6A0' }, // prettier-ignore
    density: 0.7,
  },
};

/** A superellipse of width/height `aspect` (exponent e: 2 an ellipse, higher squarer), as outline points. */
export function superellipse(aspect: number, e: number, n = 360): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n,
      c = Math.cos(t),
      s = Math.sin(t);
    return [aspect * Math.sign(c) * Math.abs(c) ** (2 / e), Math.sign(s) * Math.abs(s) ** (2 / e)];
  });
}

/** Iznik tiles of the corners: eight-fold and dense, as the owner likes them. */
const TILES = { fold: 8 as const, scale: 3 };

export function weddingComposition(variant: WeddingVariant = 'cobalt'): Composition {
  const look = LOOKS[variant],
    style = structuredClone(DEFAULT_STYLE) as Style;
  style.palette = { ...look.palette };
  // dots and hamzas on the Kufic so the verse reads; shorter ascenders keep the band slim round the names
  style.letter = { ...style.letter, marks: 'dots', ascenders: 7 };
  return {
    version: 1,
    seed: 21,
    canvas: { shape: 'landscape', margin: 6 },
    style,
    texts: {
      verse: { text: WEDDING.verse, repeat: 'once', wordGap: 4 },
      names: { text: WEDDING.names, repeat: 'once', wordGap: 2 },
    },
    root: {
      type: 'frame',
      spandrels: { type: 'iznik', iznik: TILES },
      child: {
        type: 'region',
        outline: { kind: 'poly', points: superellipse(1.45, 2.6) },
        borders: [{ type: 'textBorder', text: 'verse', separator: { kind: 'lines', width: 1.2 }, seam: 8 }],
        fill: {
          type: 'roundel',
          text: 'names',
          colours: look.cartouche,
          recipe: { ...WEDDING_RECIPE, density: look.density },
          // the cartouche sits on finer tiles inside the ring, as the original sat on its tile panel
          ground: { fold: 8, scale: 2.2 },
        },
      },
    },
  };
}

export interface WeddingSheet {
  svg: string;
  placed: Placed;
  /** Page size in SVG units (A3 landscape proportions). */
  w: number;
  h: number;
}

const body = (svg: string) =>
  svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/^<rect width="[^"]*" height="[^"]*" fill="[^"]*"\/>/, '');
const f1 = (n: number) => +n.toFixed(1);

/** The composition on an A3 landscape sheet: the tiles continue to the page edge (the same tiling about the same
 *  centre, so they meet the composition's corners seamlessly), inside a double rule in the ink colour. */
export function weddingSheet(variant: WeddingVariant = 'cobalt'): WeddingSheet {
  const look = LOOKS[variant],
    p = resolve(weddingComposition(variant)),
    cw = p.canvas.w * U,
    ch = p.canvas.h * U;
  const h = ch * 1.04,
    w = h * Math.SQRT2,
    ox = (w - cw) / 2,
    oy = (h - ch) / 2;
  // the corners' tiles are drawn once, over the whole page
  const tiles = p.items
      .filter((i): i is Extract<PlacedItem, { type: 'tilework' }> => i.type === 'tilework')
      .reduce((a, b) => (b.radius > a.radius ? b : a)),
    outline = p.items.find((i): i is Extract<PlacedItem, { type: 'outline' }> => i.type === 'outline')!;
  const P = ([x, y]: Pt): Pt => [ox + (p.canvas.origin[0] + x) * U, oy + (p.canvas.origin[1] + y) * U];
  const ring = outline.outer.map(P),
    [rx, ry] = P([0, 0]),
    core = ring.map(([x, y]) => [rx + (x - rx) * 0.9, ry + (y - ry) * 0.9] as Pt),
    [cx, cy] = P(tiles.centre),
    edge = tiles.iznik.scale * U;
  const field = iznikField(Math.max(w, h), {
    fold: tiles.iznik.fold,
    edge,
    cx,
    cy,
    reach: Math.hypot(w, h) / 2 + edge * 2,
    seams: false,
    // nothing under the region's plain ground, which covers it
    keep: (x, y) => !inside(core, x, y),
    ground: look.palette.paper,
    cobalt: look.palette.ink,
    turq: look.palette.ink2,
    red: look.palette.mark,
  });
  // the region keeps its plain ground over the tiles
  const halo = 'M' + outline.outer.map(q => P(q).map(f1).join(' ')).join('L') + 'Z';
  const rule = (inset: number, sw: number) =>
    `<rect x="${f1(inset)}" y="${f1(inset)}" width="${f1(w - 2 * inset)}" height="${f1(h - 2 * inset)}" fill="none" stroke="${look.palette.ink}" stroke-width="${f1(sw)}"/>`; // prettier-ignore
  const m = h * 0.012;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(w)} ${f1(h)}" width="420mm" height="297mm">` +
    `<rect width="100%" height="100%" fill="${look.palette.paper}"/>` +
    `<g clip-path="url(#wd-page)"><clipPath id="wd-page"><rect x="${f1(m)}" y="${f1(m)}" width="${f1(w - 2 * m)}" height="${f1(h - 2 * m)}"/></clipPath>${field}</g>` + // prettier-ignore
    `<path d="${halo}" fill="${look.palette.paper}"/>` +
    `<g transform="translate(${f1(ox)} ${f1(oy)})">${body(renderPlaced({ ...p, items: p.items.filter(i => i !== tiles) }, { idPrefix: 'wd' }))}</g>` +
    rule(m, h * 0.006) +
    rule(m * 1.9, h * 0.0018) +
    `</svg>`;
  return { svg, placed: p, w, h };
}
