// A sheet: several resolved compositions set into one SVG (a frame with a niche and cartouches over its field, a
// plan with a composition in every room). Each part is drawn in its own coordinates and set into the sheet either
// fitted to a box (nest) or at a stated size per cell (set), so parts set at one size share one pen. What a part
// covers is recorded, so the lines of a field underneath it can be left out.
import { inscriptions } from '../compose/inscription';
import type { Inscription } from '../compose/inscription';
import type { Placed, PlacedItem } from '../compose/placed';
import type { Style } from '../model/schema';
import { inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import { renderPlaced } from './composition';
import { U } from './svg';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const f = (n: number) => +n.toFixed(1);

/** A rendered composition's contents, without its <svg> element and background, to set inside another drawing. */
export const svgBody = (svg: string) =>
  svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/^<rect width="[^"]*" height="[^"]*" fill="[^"]*"\/>/, '');

/** Points of a placed composition (cells, about its origin) in the units it is drawn in. */
export const drawnPts = (pl: Placed, P: Pt[]) =>
  P.map(([x, y]) => [(pl.canvas.origin[0] + x) * U, (pl.canvas.origin[1] + y) * U] as Pt);

export const pathD = (P: Pt[]) => 'M' + P.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z';

export const bbox = (P: Pt[]): Box => {
  const xs = P.map(p => p[0]),
    ys = P.map(p => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
};

export type PlacedOutline = Extract<PlacedItem, { type: 'outline' }>;
/** A placed composition's outlines, outermost region first. */
export const outlinesOf = (pl: Placed) => pl.items.filter((i): i is PlacedOutline => i.type === 'outline');
export const outlineOf = (pl: Placed) => outlinesOf(pl)[0];

/** Where a part landed: sheet point = at + (drawn point − crop corner) × k. */
export interface Setting {
  svg: string;
  k: number;
  box: Box;
  /** A point in the part's drawn units, in the sheet's. */
  map: (p: Pt) => Pt;
}

export interface PartOptions {
  /** Prefix for the ids in the part's SVG; parts of one sheet need different ones. */
  id: string;
  /** Fit the part's outline into this box of the sheet, centred, keeping its proportions. */
  slot?: Box;
  /** Or set it at this many sheet units per cell, its outline's box centred on a point: every part set at one
   *  size is written with one pen. */
  unit?: number;
  centre?: Pt;
  /** Fill the part's outline with this colour first (its own ground, over whatever is beneath). */
  ground?: string;
  /** Whether the part hides the field under it (default: yes). */
  covers?: boolean;
}

export class SheetLayout {
  /** The parts' SVG, in the order they were set. */
  parts: string[] = [];
  /** Outlines of what has been set over the sheet, in its coordinates. */
  covers: Pt[][] = [];

  private setting(crop: Box, k: number, x0: number, y0: number, svgBody: string, cover?: Pt[]): Setting {
    const w = crop.w * k,
      h = crop.h * k,
      map = ([x, y]: Pt): Pt => [x0 + (x - crop.x) * k, y0 + (y - crop.y) * k];
    if (cover) this.covers.push(cover.map(map));
    const svg = `<svg x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" viewBox="${f(crop.x)} ${f(crop.y)} ${f(crop.w)} ${f(crop.h)}" overflow="visible">${svgBody}</svg>`;
    return { svg, k, box: { x: x0, y: y0, w, h }, map };
  }

  /** Fit a body drawn in its own coordinates (crop) into a box of the sheet, centred; cover = its outline, in the
   *  body's coordinates, when it hides what is beneath. The SVG is returned, not added to the parts. */
  nest(svgBody: string, crop: Box, slot: Box, cover?: Pt[]): Setting {
    const k = Math.min(slot.w / crop.w, slot.h / crop.h);
    return this.setting(
      crop,
      k,
      slot.x + (slot.w - crop.w * k) / 2,
      slot.y + (slot.h - crop.h * k) / 2,
      svgBody,
      cover,
    );
  }

  /** Set a body at k sheet units per drawn unit, its crop centred on a point. */
  set(svgBody: string, crop: Box, k: number, centre: Pt, cover?: Pt[]): Setting {
    return this.setting(crop, k, centre[0] - (crop.w * k) / 2, centre[1] - (crop.h * k) / 2, svgBody, cover);
  }

  /** Render a resolved composition and set it into the sheet by its outermost outline, added to the parts. */
  place(pl: Placed, o: PartOptions): Setting {
    const P = drawnPts(pl, outlineOf(pl).outer),
      crop = bbox(P),
      drawn =
        (o.ground ? `<path d="${pathD(P)}" fill="${o.ground}"/>` : '') + svgBody(renderPlaced(pl, { idPrefix: o.id })),
      cover = o.covers === false ? undefined : P;
    let s: Setting;
    if (o.slot) s = this.nest(drawn, crop, o.slot, cover);
    else if (o.unit && o.centre) s = this.set(drawn, crop, o.unit / U, o.centre, cover);
    else throw new Error('a part needs a slot, or a unit and a centre');
    this.parts.push(s.svg);
    return s;
  }

  /** Inscriptions written straight onto the sheet: their segments (and depths) are in the sheet's units, at `unit`
   *  sheet units per cell, so they share the pen of parts set at that unit. Added to the parts; returns the
   *  warnings for any that didn't fit. */
  write(list: Inscription[], style: Style, o: { id: string; unit: number }): string[] {
    const k = 1 / o.unit,
      cells = (p: Pt): Pt => [p[0] * k, p[1] * k],
      pl = inscriptions(
        list.map(i => ({ ...i, from: cells(i.from), to: cells(i.to), ...(i.depth ? { depth: i.depth * k } : {}) })),
        style,
      ),
      [ox, oy] = pl.canvas.origin;
    this.parts.push(
      `<g transform="translate(${f(-ox * o.unit)} ${f(-oy * o.unit)}) scale(${+(o.unit / U).toFixed(5)})">` +
        svgBody(renderPlaced(pl, { idPrefix: o.id })) +
        '</g>',
    );
    return pl.meta.warnings;
  }

  /** A placed composition without the lines of its field that lie under the sheet's parts (a pattern written in
   *  words, the lines of a text): words half hidden are not drawn at all. toSheet takes the composition's cells to
   *  the sheet's coordinates; by default they are drawn directly on the sheet. */
  uncovered(pl: Placed, toSheet: (p: Pt) => Pt = p => drawnPts(pl, [p])[0]): Placed {
    const hidden = this.covers.map(P => ({ P, b: bbox(P) }));
    return {
      ...pl,
      items: pl.items.filter(it => {
        if (it.type !== 'strip' || it.place.type !== 'line') return true;
        const [x, y] = toSheet(it.place.O);
        return !hidden.some(({ P, b }) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h && inside(P, x, y));
      }),
    };
  }
}

/** The box round `inner` plus a margin (a share of its width), at exactly 1 : √2: an A-series sheet, upright. */
export function aSeries(inner: Box, margin = 0.035): Box {
  const m = inner.w * margin,
    w = inner.w + 2 * m,
    h = w * Math.SQRT2;
  return { x: inner.x - m, y: inner.y + inner.h / 2 - h / 2, w, h };
}

/** A-series paper sizes in millimetres, upright. */
export const A_MM = { A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297] } as const;

/** The sheet's opening tag and ground. */
export function sheetOpen(view: Box, paper: keyof typeof A_MM, fill: string, label: string): string {
  const [w, h] = A_MM[paper];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(view.x)} ${f(view.y)} ${f(view.w)} ${f(view.h)}" width="${w}mm" height="${h}mm" role="img" aria-label="${label}">` +
    `<rect x="${f(view.x)}" y="${f(view.y)}" width="${f(view.w)}" height="${f(view.h)}" fill="${fill}"/>`
  );
}
