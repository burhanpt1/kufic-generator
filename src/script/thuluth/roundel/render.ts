// Drawing a roundel (lab roundel.js renderRoundel, without the inscription ring and illumination): a gilded rim, a
// field, the letters in gold (or in their own colour), and colour in the counters. `roundelArt` gives the same as
// geometry in pen units, for placing inside a composition.
import type { Thuluth } from '../engine';
import type { Poly } from '../types';
import type { Roundel } from './compose';
import { findCounters } from './counters';
import type { Finished, Unit } from './finish';
import { roundelParts } from './finish';

export interface RoundelPaint {
  /** Pixels per pen unit. */
  U?: number;
  field?: string;
  gold?: string;
  goldDark?: string;
  outline?: string;
  bg?: string;
  /** Frame radius as a share of the disc's (fitFrame sets 1). */
  discScale?: number;
  noOutline?: boolean;
  /** Colour for the counters, if they are filled. */
  counters?: string;
}

/** The frame and the ink of a finished roundel, in pen units (y up). */
export interface RoundelArt {
  cx: number;
  cy: number;
  /** Width over height. */
  oval: number;
  /** The field's radius (vertical), the rim's width, and the outer radius. */
  Rf: number;
  rim: number;
  Rout: number;
  /** One list of polygons per unit, in writing order, with its tint. */
  units: { polys: Poly[]; tint?: string; mark: boolean }[];
  counters: Poly[][];
}

export function roundelArt(th: Thuluth, r: Roundel, f: Finished, o: RoundelPaint = {}): RoundelArt {
  const nib = th.style.nib,
    units: Unit[] = roundelParts(r, { solved: f.solved, marks: f.marks, companion: f.companion }),
    d = r.disc,
    OV = d.oval || 1;
  let R0 = d.r * (o.discScale ?? f.discScale ?? 1.12);
  units.forEach(u => u.s?.forEach(q => (R0 = Math.max(R0, Math.hypot((q.x - d.cx) / OV, q.y - d.cy) + nib * 0.7))));
  const Rin = R0 * 1.03,
    Rf = Rin,
    rim = Rin * 0.075;
  const polys = units.map(u => ({
    polys: u.dot
      ? th.dotPolysAt(u.dot[0], u.dot[1], u.dot[2] ?? 1, u.dot[3] || 0)
      : th.strokePolys({ ang: u.ang!, nib: u.nib, s: u.s! }),
    tint: u.tint,
    mark: !!u.mark || !!u.dot,
  }));
  // counters of the letters only, not the marks
  const ls = units.filter(u => u.s && !u.mark && (u.nib || nib) > nib * 0.6).map(u => ({ ang: u.ang!, nib: u.nib, s: u.s! })); // prettier-ignore
  const counters = o.counters ? findCounters(th, ls) : [];
  return { cx: d.cx, cy: d.cy, oval: OV, Rf, rim, Rout: Rf + rim, units: polys, counters };
}

let RID = 0;
/** The roundel on its own page, as the lab drew it. */
export function renderRoundel(th: Thuluth, r: Roundel, f: Finished, o: RoundelPaint = {}): string {
  const U = o.U ?? 10,
    field = o.field ?? '#1d4a3a',
    gold = o.gold ?? '#d6ab4f',
    goldDark = o.goldDark ?? '#7a5a1c',
    outline = o.outline ?? '#3a2a0c',
    bg = o.bg ?? '#ece6d6',
    id = 'r' + ++RID;
  const art = roundelArt(th, r, f, o),
    { Rf, rim, Rout } = art,
    OV = art.oval;
  const pad = 1.5,
    S2 = (Rout * OV + pad) * 2 * U,
    C = S2 / 2;
  const X = (x: number) => C + (x - art.cx) * U,
    Y = (y: number) => C - (y - art.cy) * U;
  const path = (ps: Poly[]) => ps.map(q => 'M' + q.map(([x, y]) => X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join('L') + 'Z').join(''); // prettier-ignore
  const holes = o.counters
    ? `<path d="${art.counters.flatMap(rs => rs.map(([[a, b], [c], [, e]]) => `M${X(a).toFixed(1)} ${Y(b).toFixed(1)}H${X(c).toFixed(1)}V${Y(e).toFixed(1)}H${X(a).toFixed(1)}Z`)).join('')}" fill="${o.counters}"/>` // prettier-ignore
    : '';
  const all = art.units
      .filter(u => !u.tint)
      .map(u => path(u.polys))
      .join(''),
    tints = new Map<string, string>();
  art.units.forEach(u => u.tint && tints.set(u.tint, (tints.get(u.tint) || '') + path(u.polys)));
  const body =
    (o.noOutline ? '' : `<g fill="${outline}" stroke="${outline}" stroke-width="${(0.22 * U).toFixed(1)}" stroke-linejoin="round"><path d="${all}"/></g>`) + // prettier-ignore
    `<g fill="url(#gd${id})"><path d="${all}"/></g>` +
    [...tints].map(([t, d2]) => `<path fill="${t}" d="${d2}"/>`).join('');
  const wide = (Rout * OV - Rout) * U;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S2.toFixed(0)} ${S2.toFixed(0)}" width="${S2.toFixed(0)}" height="${S2.toFixed(0)}">
<defs><linearGradient id="gd${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gold}"/><stop offset="0.5" stop-color="#f0d07a"/><stop offset="1" stop-color="${gold}"/></linearGradient>
<radialGradient id="fd${id}" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="${field}" stop-opacity="0.85"/><stop offset="1" stop-color="${field}"/></radialGradient></defs>
<rect width="100%" height="100%" fill="${bg}"/>
<ellipse cx="${C}" cy="${C}" rx="${(((Rout + rim * (OV - 1)) * OV * U) / OV + wide).toFixed(1)}" ry="${(Rout * U).toFixed(1)}" fill="url(#gd${id})" stroke="${goldDark}" stroke-width="${(0.12 * U).toFixed(1)}"/>
<ellipse cx="${C}" cy="${C}" rx="${((Rout - rim * 0.32) * U + wide).toFixed(1)}" ry="${((Rout - rim * 0.32) * U).toFixed(1)}" fill="none" stroke="${goldDark}" stroke-width="${(0.08 * U).toFixed(1)}"/>
<ellipse cx="${C}" cy="${C}" rx="${(Rf * U + wide).toFixed(1)}" ry="${(Rf * U).toFixed(1)}" fill="url(#fd${id})" stroke="${goldDark}" stroke-width="${(0.1 * U).toFixed(1)}"/>
${holes}${body}
</svg>`;
}
