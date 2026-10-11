// The evolvable parts of a composition, as named traits with their possible values. Traits are what taste learns
// preferences for and what the user can lock; ordinal traits step to a neighbouring value when mutated.
import type { Composition, FillerNode, Outline, Separator, TextBorder } from '../model/schema';
import { PALETTES } from '../model/style';

export const PALETTE_LIST = Object.values(PALETTES);
export interface TraitSpec {
  values: readonly (string | number | boolean)[];
  ordinal?: boolean;
  label: string;
}
export const TRAITS = {
  outline: { values: ['circle', 'polygon', 'star', 'teardrop', 'heart', 'mihrab'], label: 'Shape' },
  sides: { values: [4, 5, 6, 8, 12], ordinal: true, label: 'Polygon sides' },
  points: { values: [5, 6, 8, 12], ordinal: true, label: 'Star points' },
  depth: { values: [0.45, 0.55, 0.65, 0.75], ordinal: true, label: 'Star depth' },
  spread: { values: [1, 1.15, 1.3], ordinal: true, label: 'Size' },
  borders: { values: [1, 2, 3], ordinal: true, label: 'Text borders' },
  taper: { values: [0, 0.25, 0.5, 0.7], ordinal: true, label: 'Inner rings smaller' },
  ascenders: { values: [7, 9, 11, 13], ordinal: true, label: 'Ascenders' },
  separator: { values: ['none', 'lines', 'pearls', 'chevron', 'braid'], label: 'Between rings' },
  separatorWidth: { values: [1, 2, 3, 4], ordinal: true, label: 'Ring spacing' },
  ground: { values: ['plain', 'tint', 'vine', 'pattern'], label: 'Ground' },
  // the flow fill stays available in the layers panel but isn't evolved or offered by default (owner's feedback)
  fill: { values: ['monogram', 'abjad', 'pattern', 'rings', 'solid', 'lines', 'maze', 'strapwork'], label: 'Centre' },
  vary: { values: [0, 0.5, 1], ordinal: true, label: 'Line height follows shape' },
  interlace: { values: [false, true], label: 'Interlaced maze' },
  monogram: {
    values: ['seal', 'mirror', 'quad', 'pinwheel', 'pinwheelIn', 'block', 'spiral', 'tughra'],
    label: 'Monogram',
  },
  spandrels: { values: ['none', 'pattern', 'stars', 'vine'], label: 'Corners' },
  tiling: { values: ['square', '488', 'hex', '31212'], label: 'Pattern' },
  angle: { values: [30, 45, 55, 60, 67, 72], ordinal: true, label: 'Star angle' },
  scale: { values: [3, 4, 5, 7, 9], ordinal: true, label: 'Pattern scale' },
  tips: { values: ['finial', 'diamond', 'none'], label: 'Tips' },
  corners: { values: ['diamond', 'star', 'none'], label: 'Corner ornaments' },
  terminal: { values: ['none', 'notch', 'bevel', 'leaf', 'palmette'], label: 'Stem endings' },
  reach: { values: ['tall', 'tails', 'all'], label: 'Endings on' },
  palette: { values: PALETTE_LIST.map((_, i) => i), label: 'Colours' },
  colouring: { values: ['solid', 'byRing', 'byRepeat', 'radial'], label: 'Colouring' },
  stroke: { values: ['blocks', 'curved', 'pen'], label: 'Strokes' },
  corner: { values: [0.3, 0.6, 1], ordinal: true, label: 'Corner rounding' },
  banded: { values: [false, true], label: 'Banded' },
  // heavy and blobby compositions were vetoed: no 0.9 or 1.0 weights, no 0.5 softness
  weight: { values: [0.55, 0.65, 0.75, 0.85], ordinal: true, label: 'Line weight' },
  softness: { values: [0, 0.15, 0.3], ordinal: true, label: 'Softness' },
  lamAlif: { values: ['plain', 'knot'], label: 'Lam-alif' },
  ra: { values: ['desc', 'short'], label: 'Ra' },
  marks: { values: ['dots', 'off'], label: 'Dots' },
  alternates: { values: [false, true], label: 'Long letter forms' },
  plait: { values: [false, true], label: 'Plaited stems' },
} as const satisfies Record<string, TraitSpec>;
export type Trait = keyof typeof TRAITS;
export type Traits = { [K in Trait]?: string | number | boolean };

const outlineName = (o: Outline) =>
  o.kind === 'preset' ? o.name : o.kind === 'svg' || o.kind === 'poly' ? 'custom' : o.kind;
const paletteIndex = (c: Composition) =>
  PALETTE_LIST.findIndex(p => p.ink === c.style.palette.ink && p.paper === c.style.palette.paper);
const textBorders = (c: Composition) => c.root.child.borders.filter((b): b is TextBorder => b.type === 'textBorder');
const firstPattern = (c: Composition) => {
  const r = c.root.child,
    f = r.fill?.type === 'pattern' ? r.fill.pattern : null,
    g = textBorders(c).find(b => b.ground?.pattern)?.ground?.pattern,
    s = c.root.spandrels?.type === 'pattern' ? c.root.spandrels.pattern : null;
  return f ?? g ?? s ?? null;
};

/** The trait values of a composition (only those that apply). */
export function traitsOf(c: Composition): Traits {
  const r = c.root.child,
    tb = textBorders(c),
    sep: Separator | undefined = tb[0]?.separator,
    o = r.outline,
    pat = firstPattern(c),
    t: Traits = {};
  t.outline = outlineName(o);
  if (o.kind === 'polygon') t.sides = o.sides;
  if (o.kind === 'star') {
    t.points = o.points;
    t.depth = o.depth;
  }
  t.spread = r.spread ?? 1;
  t.borders = tb.length;
  if (tb.length > 1) t.taper = tb[1].taper ?? 0;
  t.ascenders = c.style.letter.ascenders;
  if (sep) {
    t.separator = sep.kind;
    t.separatorWidth = sep.width;
  }
  t.ground = tb[0]?.ground?.kind ?? 'plain';
  if (r.fill) t.fill = r.fill.type === 'region' ? 'nested' : r.fill.type;
  if (r.fill?.type === 'monogram') t.monogram = r.fill.method;
  if (r.fill?.type === 'lines') t.vary = r.fill.vary ?? 0;
  if (r.fill?.type === 'maze') t.interlace = !!r.fill.interlace;
  t.spandrels = c.root.spandrels?.type ?? 'none';
  if (r.fill?.type === 'strapwork') t.tiling = r.fill.tiling;
  else if (pat) {
    t.tiling = pat.tiling;
    t.angle = pat.angle;
    t.scale = pat.scale;
  }
  t.tips = r.features?.tips ?? 'finial';
  t.corners = r.features?.corners ?? 'diamond';
  t.terminal = c.style.terminals.kind;
  t.reach = c.style.terminals.reach;
  t.palette = paletteIndex(c);
  t.colouring = c.style.colouring;
  t.stroke = c.style.stroke.kind;
  t.corner = c.style.stroke.corner;
  t.banded = c.style.stroke.banded;
  t.weight = c.style.stroke.weight;
  t.softness = c.style.stroke.softness;
  t.lamAlif = c.style.letter.lamAlif;
  t.ra = c.style.letter.ra;
  t.marks = c.style.letter.marks;
  t.alternates = !!c.style.letter.alternates;
  t.plait = !!(tb[0]?.plait || ((r.fill?.type === 'lines' || r.fill?.type === 'maze') && r.fill.plait));
  return t;
}

export type { FillerNode };
