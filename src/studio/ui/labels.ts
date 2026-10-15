// Human labels for trait values.
import { PALETTE_LIST } from '../../evolve/genes';
import type { Trait } from '../../evolve/genes';
import { PALETTE_NAMES, PALETTES } from '../../model/style';

const NAMES: Record<string, string> = {
  polygon: 'Polygon', circle: 'Circle', star: 'Star', teardrop: 'Teardrop', heart: 'Heart', mihrab: 'Mihrab',
  custom: 'Custom', none: 'None', lines: 'Lines', pearls: 'Pearls', chevron: 'Chevron', braid: 'Braid',
  plain: 'Plain', tint: 'Tinted', vine: 'Vine', pattern: 'Star pattern', monogram: 'Monogram', abjad: 'Abjad number',
  rings: 'Rings', solid: 'Solid', maze: 'Maze', strapwork: 'Strapwork', lattice: 'Woven lattice', flow: 'Flowing lines', seal: 'Seal', mirror: 'Mirror', quad: 'Four-way mirror',
  pinwheel: 'Pinwheel', pinwheelIn: 'Pinwheel inward', block: 'Stacked block', spiral: 'Spiral', tughra: 'Tughra',
  below: 'Above and below', pair: 'Facing pair', stars: 'Stars', square: 'Square', '488': '8-fold',
  hex: '6-fold', '31212': '12-fold', mg8: '8-fold rhombs', mg10: '10-fold rhombs', mg12: '12-fold rhombs', iznik: 'Iznik tiles', finial: 'Finials', diamond: 'Diamonds', notch: 'Notched', bevel: 'Bevelled',
  leaf: 'Leaf', palmette: 'Palmette', tall: 'Tall stems', tails: 'Tall stems + tails', all: 'Every stem',
  byRing: 'By ring', byRepeat: 'By repeat', radial: 'Radial', blocks: 'Grid blocks', curved: 'Curved', pen: 'Broad pen',
  fatimid: 'Fatimid', knot: 'Knotted', desc: 'Descending', short: 'Flat', hook: 'Hooked', dots: 'Dots', off: 'None',
}; // prettier-ignore

export function valueLabel(trait: Trait | string, v: string | number | boolean): string {
  if (trait === 'palette' && typeof v === 'number') {
    const p = PALETTE_LIST[v],
      key = (Object.keys(PALETTES) as (keyof typeof PALETTES)[]).find(k => PALETTES[k] === p);
    return key ? PALETTE_NAMES[key] : `Palette ${v + 1}`;
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (trait === 'angle') return `${v}°`;
  if (trait === 'spread') return `×${v}`;
  return NAMES[String(v)] ?? String(v);
}
