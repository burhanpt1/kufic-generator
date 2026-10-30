// Mirrored composition, müsennâ (lab deco.js musenna, renderMusennaCombined; PORT-PLAN.md §4): a text composed once,
// set against a vertical axis, and mirrored. The halves are one design (the owner's principle): what falls on or near
// the axis is shared, not doubled. A dot group overlapping its own mirror image becomes one group with the same number
// of dots, symmetric on the axis; a mark overlapping its mirror image is drawn once on the axis, or left out if it is
// slanted (fatha, kasra), since vowels are optional in decorative work; a narrow letter stroke on the axis becomes one
// shared stroke (the two lams of علي, one central stem). The mirrored half's pen is mirrored too, so thick and thin
// mirror. Mirrored compositions work when a tall stroke can be shared (علي) and are weak when the halves only face each
// other (محمد); the owner does not want الله mirrored, and it is refused (and only it: other divine names stay allowed,
// owner, 30 October 2026). Double symmetry and hairline piercing lost
// every rating and are not ported.
import type { Thuluth } from '../engine';
import { dotPolys } from '../pen';
import { parseVowels } from '../shape';
import type { Poly, Sample } from '../types';
import type { Roundel, RoundelOptions } from './compose';
import { composeRoundel } from './compose';
import type { DecoFeatures } from './deco';
import { featuresIn, rasterUnits, tasteScores } from './deco';
import type { FinishOptions, Finished, Unit } from './finish';
import { finishRoundel, roundelParts } from './finish';

/** True when a text may not be mirrored: it holds the divine name (الله, لله, بالله, عبدالله…). */
export function refusesMirror(text: string): boolean {
  const bare = parseVowels(text)
    .bare.replace(/[ٱأإآ]/g, 'ا')
    .replace(/\s+/g, ' ');
  return /لله/.test(bare);
}

export interface MusennaOptions {
  seeds?: number[];
  ovals?: number[];
  /** How far the axis lies inside the text's left edge (pen units): the halves meet or interlace. Axes through tall
   *  stems in its left part are tried as well. For علي, an engine with the returning ya (great.ya) brings the lam to
   *  the edge, as in the lab's cup form. */
  overlaps?: number[];
  tries?: number;
  iters?: number;
  compose?: RoundelOptions;
  finish?: FinishOptions;
  /** The score a shared stroke on the axis adds (2.5; in units of the taste's spread). */
  shareBonus?: number;
}
export interface MusennaCandidate {
  seed: number;
  oval: number;
  overlap: number;
  r: Roundel;
  f: Finished;
  units: Unit[];
  axis: number;
  cy: number;
  /** The field's radius round the mirrored whole. */
  rad: number;
  features: DecoFeatures;
  /** Share of the strip on the axis covered by ink (the halves must not collide in a blob there). */
  axisInk: number;
  /** Letter strokes shared on the axis. */
  shared?: number;
  score: number;
}

/** Compose once per seed and field proportion, set the text against the axis at several overlaps, and rank every
 *  candidate by the fitted taste (letters first), less a penalty for a blob of ink on the axis. Best first; empty for
 *  a text with no letters or one that holds الله. */
export function musenna(th: Thuluth, text: string, o: MusennaOptions = {}): MusennaCandidate[] {
  if (refusesMirror(text)) return [];
  const seen = new Set<string>(),
    raw: Omit<MusennaCandidate, 'score'>[] = [];
  for (const seed of o.seeds ?? [11, 23, 37])
    for (const oval of o.ovals ?? [1, 1.25]) {
      const r = composeRoundel(th, text, { tries: o.tries ?? 3, iters: o.iters ?? 3000, seed, elongate: true, cross: true, cradle: true, deep: true, fillTarget: 0.45, oval, ...o.compose })[0]; // prettier-ignore
      if (!r) continue;
      // seeds that settle on the same arrangement give the same candidates
      const key = JSON.stringify([r.lv, r.st.map(p => [Math.round(p.x * 10), Math.round(p.y * 10)])]);
      if (seen.has(key)) continue;
      seen.add(key);
      const f = finishRoundel(th, r, '', o.finish ?? {}),
        units = roundelParts(r, { solved: f.solved, marks: f.marks });
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      units.forEach(u =>
        u.s?.forEach(q => {
          x0 = Math.min(x0, q.x);
          x1 = Math.max(x1, q.x);
          y0 = Math.min(y0, q.y);
          y1 = Math.max(y1, q.y);
        }),
      );
      // the axis inside the text's left edge by each overlap, and through each tall stem in its left part, where the
      // stem and its mirror image become one shared stroke (the lam of علي written with a returning ya)
      const stems = units
        .filter(u => u.s && u.ang === 38 && !u.mark)
        .map(u => {
          const xs = u.s!.map(q => q.x);
          return (Math.min(...xs) + Math.max(...xs)) / 2 - x0;
        })
        .filter(v => v < 0.6 * (x1 - x0));
      for (const ov of [...(o.overlaps ?? [-0.6, 0.4, 1.4, 2.6]), ...stems]) {
        const axis = x0 + ov,
          half = Math.max(x1 - axis, axis - x0) + 1.5,
          cy = (y0 + y1) / 2,
          rad = Math.max(half, (y1 - y0) / 2 + 1.5) * 1.06,
          e = { cx: axis, cy, rx: rad, ry: rad };
        const features = featuresIn(th, units, e, 320, axis),
          axisInk = axisShare(th, units, axis, cy, rad);
        raw.push({ seed, oval, overlap: ov, r, f, units, axis, cy, rad, features, axisInk });
      }
    }
  const s = tasteScores(
    raw.map(c => c.features),
    'mirror',
  );
  return raw
    .map((c, i) => {
      // the halves are one design (the owner's principle, which the fitted taste never saw: the combined علي ranked
      // 2nd of 81, the same drawn apart 29th): a stroke shared on the axis earns a bonus
      const shared = musennaArt(th, { ...c, score: 0 }).shared.strokes;
      return { ...c, shared, score: s[i] - 3 * Math.max(0, c.axisInk - 0.18) + (o.shareBonus ?? 2.5) * Math.min(1, shared) }; // prettier-ignore
    })
    .sort((a, b) => b.score - a.score);
}

/** Ink in a thin strip on the axis (seven pixels at 320 across), as a share of the strip. */
function axisShare(th: Thuluth, units: readonly Unit[], axis: number, cy: number, rad: number): number {
  const box = { x0: axis - rad, x1: axis + rad, y0: cy - rad, y1: cy + rad },
    R = rasterUnits(th, units, box, 320, 'all', axis),
    ax = Math.round((axis - box.x0) * R.K);
  let n = 0,
    ink = 0;
  for (let y = 0; y < R.H; y++)
    for (let x = ax - 3; x <= ax + 3; x++) {
      n++;
      ink += R.ink[y * R.W + x] || 0;
    }
  return ink / Math.max(1, n);
}

/** The combined mirrored drawing: polygons in pen units (y up) round the axis, and the field. */
export interface MusennaArt {
  cx: number;
  cy: number;
  /** The field's radius. */
  rad: number;
  polys: Poly[];
  /** How many dot groups, marks and strokes were shared on the axis, and the slanted marks left out there. */
  shared: { dots: number; marks: number; strokes: number; dropped: number };
}

/** Letters with a stem that can stand on the axis. */
const STEMS = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ', 'ل', 'ك', 'ط', 'ظ', 'ﻻ']);

const mirrorPoly = (q: Poly, ax: number): Poly => q.map(([x, y]) => [2 * ax - x, y] as [number, number]).reverse();

/** Draw a candidate as one design (renderMusennaCombined), with `shareStrokes` (on by default) fusing narrow letter
 *  strokes on the axis into one. */
export function musennaArt(th: Thuluth, c: MusennaCandidate, o: { shareStrokes?: boolean } = {}): MusennaArt {
  const nib = th.style.nib,
    ax = c.axis,
    isLetter = (u: Unit) => !!u.s && !u.dot && (u.nib || nib) > nib * 0.6,
    polys: Poly[] = [],
    both = (ps: Poly[]) => ps.forEach(q => polys.push(q, mirrorPoly(q, ax))),
    shared = { dots: 0, marks: 0, strokes: 0, dropped: 0 };
  const strokeOf = (u: Unit, s: Sample[] = u.s!) => th.strokePolys({ ang: u.ang!, nib: u.nib, s });
  // dots, group by group (dots within about a dot and a half belong together, like a ya's pair)
  const groups: { x: number; y: number; s: number }[][] = [];
  c.units
    .filter(u => u.dot)
    .forEach(u => {
      const d = { x: u.dot![0], y: u.dot![1], s: u.dot![2] ?? 1 },
        g = groups.find(G => G.some(e => Math.hypot(e.x - d.x, e.y - d.y) < nib * 1.6));
      if (g) g.push(d);
      else groups.push([d]);
    });
  // a group its own mirror image would join, by the same reach that groups dots, is shared
  const reach = nib * 1.6;
  for (const g of groups) {
    const onAxis = g.some(a => g.some(b => Math.hypot(a.x - (2 * ax - b.x), a.y - b.y) < reach * Math.max(a.s, b.s)));
    if (!onAxis) {
      g.forEach(d => both(th.dotPolysAt(d.x, d.y, d.s)));
      continue;
    }
    // one shared group with the same number of dots, symmetric on the axis, drawn as diamonds
    shared.dots++;
    const n = g.length,
      s = Math.max(...g.map(d => d.s)),
      cy = g.reduce((v, d) => v + d.y, 0) / n,
      // diamonds a little apart (at 45° a dot is about 1.35 pens wide)
      h = nib * s * 0.8,
      at: [number, number][] =
        n === 1 ? [[ax, cy]] : n === 2 ? [[ax - h, cy], [ax + h, cy]] : [[ax - 1.15 * h, cy - 0.5 * h], [ax + 1.15 * h, cy - 0.5 * h], [ax, cy + 0.85 * h]]; // prettier-ignore
    at.forEach(([x, y]) => polys.push(...dotPolys(x, y, nib * s, 45, th.style.floor)));
  }
  // marks: one overlapping its own mirror image is centred on the axis and drawn once, if it is symmetric itself
  c.units
    .filter(u => u.s && !u.dot && !isLetter(u))
    .forEach(u => {
      const xs = u.s!.map(q => q.x),
        x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        cx = (x0 + x1) / 2;
      if (Math.abs(cx - ax) >= (x1 - x0) / 2 + nib * 0.3) return both(strokeOf(u));
      const s = u.s!.map(q => ({ ...q, x: q.x + ax - cx })),
        err = s.reduce((m, q) => Math.max(m, Math.min(...s.map(p => Math.hypot(q.x - ax + (p.x - ax), q.y - p.y)))), 0);
      if (err > nib * 0.45) {
        shared.dropped++;
        return;
      }
      shared.marks++;
      both(strokeOf(u, s)); // its own mirror image covers it: drawn once, and exactly symmetric
    });
  // letters: the original and its mirror image; a tall stroke standing on the axis is shared, centred on it. Tall:
  // drawn mostly by a letter with a stem (alif, lam, kaf, ta, za, known from the stroke's owners), and upright
  const tall = (u: Unit) => {
    const S = u.gi != null ? c.r.shapes[u.gi] : null;
    if (!S || !u.own) return false;
    const letter = new Map(S.b.placed.flatMap(p => ('g' in p ? [[p.li, p.c] as [number, string]] : []))),
      mine = u.own.filter(li => STEMS.has(letter.get(li) ?? '')).length,
      ys = u.s!.map(q => q.y),
      xs = u.s!.map(q => q.x);
    return mine > u.own.length / 2 && Math.max(...ys) - Math.min(...ys) > 2 * (Math.max(...xs) - Math.min(...xs));
  };
  c.units.filter(isLetter).forEach(u => {
    const xs = u.s!.map(q => q.x),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      cx = (x0 + x1) / 2;
    if (o.shareStrokes !== false && Math.abs(cx - ax) < nib * 1.1 && (x1 - x0) / 2 < nib * 2.2 && tall(u)) {
      shared.strokes++;
      both(
        strokeOf(
          u,
          u.s!.map(q => ({ ...q, x: q.x + ax - cx })),
        ),
      );
    } else both(strokeOf(u));
  });
  return { cx: ax, cy: c.cy, rad: c.rad, polys, shared };
}

/** A mirrored roundel on its own page: gilded rim, night field, gold letters (lab renderMusenna's palette). */
export function musennaSVG(
  a: MusennaArt,
  o: { U?: number; letters?: string; field?: string; rim?: string; bg?: string } = {},
): string {
  const U = o.U ?? 10,
    pad = a.rad * 0.12,
    S = (a.rad + pad) * 2 * U,
    C = S / 2,
    d = a.polys
      .map(
        q =>
          'M' +
          q.map(([x, y]) => (C + (x - a.cx) * U).toFixed(1) + ' ' + (C - (y - a.cy) * U).toFixed(1)).join('L') +
          'Z',
      ) // prettier-ignore
      .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.toFixed(0)} ${S.toFixed(0)}" width="${S.toFixed(0)}" height="${S.toFixed(0)}"><rect width="100%" height="100%" fill="${o.bg ?? '#0b1029'}"/><circle cx="${C}" cy="${C}" r="${((a.rad + pad * 0.55) * U).toFixed(1)}" fill="${o.rim ?? '#D8AC45'}"/><circle cx="${C}" cy="${C}" r="${((a.rad + pad * 0.3) * U).toFixed(1)}" fill="${o.field ?? '#0E1736'}"/><path fill="${o.letters ?? '#D8AC45'}" d="${d}"/></svg>`; // prettier-ignore
}
