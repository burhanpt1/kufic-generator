// Lamiah (لمية) in thuluth, three ways, letters only (no ring, field or paper): a classic line, a tughra after the
// Ottoman imperial monogram (a tall spine with its flag, nested loops sweeping left, arms running right) and a mirrored
// (aynalı) monogram, the name and its reflection meeting at the lam. And as square Kufic monograms from the
// composition engine: a maze, a pinwheel and a spiral. `npm run lamiah` writes them to docs/lamiah.
import { resolve } from '../compose';
import { preset } from '../model/presets';
import type { Composition, FillerNode } from '../model/schema';
import { renderPlaced } from '../render/composition';
import { DEFAULT_THULUTH, nibPolys, polyPath, sampleStroke, thuluth } from '../script/thuluth';
import type { Poly, SkelPt, ThuluthStyle } from '../script/thuluth';

export const LAMIAH = 'لمية';
/** The line pen, a little finer than the default so the medial mim keeps its eye. */
export const LAMIAH_PEN: ThuluthStyle = { ...DEFAULT_THULUTH, nib: 1.15 };

export interface InkOptions {
  /** Pixels per pen unit, margin in pen units, and the ink colour. */
  U?: number;
  pad?: number;
  ink?: string;
}

/** Polygons (pen units, y up) as a tight SVG on a transparent page. */
export function inkSVG(polys: readonly Poly[], o: InkOptions = {}): string {
  const U = o.U ?? 20,
    pad = o.pad ?? 1.5,
    ink = o.ink ?? '#1b1b1b';
  const xs = polys.flatMap(q => q.map(p => p[0])),
    ys = polys.flatMap(q => q.map(p => p[1])),
    x0 = Math.min(...xs) - pad,
    x1 = Math.max(...xs) + pad,
    y0 = Math.min(...ys) - pad,
    y1 = Math.max(...ys) + pad;
  const W = ((x1 - x0) * U).toFixed(0),
    H = ((y1 - y0) * U).toFixed(0);
  const d = polyPath(
    polys,
    x => (x - x0) * U,
    y => (y1 - y) * U,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path fill="${ink}" fill-rule="nonzero" d="${d}"/></svg>`; // prettier-ignore
}

/** The engine for this piece: the medial mim written as the round loop sitting on the line (the initial form's
 *  stroke a little smaller, entered from the lam), whose eye stays open where the dipping
 *  medial closes up. Only this engine's table changes, not the letter set. */
function lamiahEngine(st: ThuluthStyle) {
  const th = thuluth(st);
  const ini = th.table.mim.ini!,
    k = 0.8;
  th.table.mim = {
    ...th.table.mim,
    med: { ...ini, exit: ini.exit! * k, s: ini.s.map(sd => ({ ...sd, pts: sd.pts.map(([x, y, w, c]) => [x * k, y * k, w, c] as SkelPt) })) }, // prettier-ignore
  };
  return th;
}

/** The name as written on the line: every stroke and dot as polygons. */
function linePolys(th: ReturnType<typeof thuluth>, kashida: number): Poly[] {
  const b = th.buildStrokes(LAMIAH, { kashida });
  return [...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))];
}

/** A free pen stroke through skeleton points (x, y, width), with the line's nib. */
function penStroke(st: ThuluthStyle, pts: SkelPt[], nibScale = 1, ang = st.ang): Poly[] {
  return nibPolys(sampleStroke(pts, st.tension, 24), st.nib * nibScale, ang, st.floor);
}

/** The classic line: the name with a measured kashida after the lam. */
export function classicPolys(): Poly[] {
  return linePolys(lamiahEngine(LAMIAH_PEN), 1.6);
}

/** The tughra: the name along the base, its lam drawn up into a tall spine with a flag, two nested loops (beyze)
 *  sweeping out to the left from the end of the name, crossing the spine and running on to the right as the arms. */
export function tughraPolys(): Poly[] {
  // a heavier pen than the line's: the flourishes make the whole larger, and the name must still hold its own
  const st = { ...LAMIAH_PEN, nib: 1.5 },
    th = lamiahEngine(st),
    name = linePolys(th, 2.4);
  // the lam's stem leans left (x ≈ -1.4 - 0.045y); the name runs from x -1.2 to -19.5, its ta marbuta ending at
  // (-19.5, 0.2) heading left
  const spine = penStroke(
    st,
    [
      [-1.62, 7, 1],
      [-2.05, 16, 1],
      [-2.45, 25, 0.95],
      [-2.2, 26.4, 0.5],
      [-1.6, 26.8, 0.15],
    ],
    1,
    12,
  );
  // the flag (zülfe): a wave falling leftward across the top of the spine
  const flag = penStroke(
    st,
    [
      [5.4, 24.8, 0.12],
      [3.2, 24.2, 0.7],
      [0.6, 22.6, 1],
      [-2.0, 21.0, 1],
      [-4.6, 20.4, 1],
      [-6.6, 18.8, 0.7],
      [-7.4, 16.6, 0.12],
    ],
    0.85,
  );
  const outer = penStroke(
    st,
    [
      [-19.4, 0.2, 1],
      [-22.8, -1.0, 1],
      [-27.4, 0.4, 1],
      [-30.0, 4.8, 1],
      [-28.8, 10.2, 1],
      [-23.6, 13.8, 1],
      [-15.8, 14.4, 1],
      [-8.4, 12.6, 1],
      [-2.6, 9.0, 1],
      [3.2, 5.4, 1],
      [10, 3.4, 0.85],
      [16.5, 2.6, 0.5],
      [21.5, 2.4, 0.12],
    ],
    0.95,
  );
  const inner = penStroke(
    st,
    [
      [-20.8, -0.5, 0.7],
      [-23.6, 0.9, 1],
      [-25.8, 4.2, 1],
      [-25.2, 8.0, 1],
      [-21.4, 10.6, 1],
      [-14.8, 11.0, 1],
      [-8.0, 9.4, 1],
      [-2.4, 5.8, 1],
      [3.4, 2.6, 1],
      [9.4, 1.2, 0.8],
      [15, 0.6, 0.45],
      [18.5, 0.5, 0.1],
    ],
    0.7,
  );
  return [...outer, ...inner, ...spine, ...flag, ...name];
}

/** The mirrored monogram: the name and its reflection, the lams back to back as one spine, crowned with a lozenge. */
export function mirrorPolys(): Poly[] {
  const st = LAMIAH_PEN,
    th = lamiahEngine(st),
    name = linePolys(th, 0.8);
  // reflect about the middle of the lam's stem (it leans from x -1.4 at the foot to -1.8 at the head)
  const axis = -1.6,
    twin = name.map(q => q.map(([x, y]) => [2 * axis - x, y] as [number, number]).reverse());
  // one upright spine over both stems, drawn with the nib flat so it keeps their weight, rising to a point
  const spine = penStroke(
    st,
    [
      [axis, 0.8, 1],
      [axis, 9, 1],
      [axis, 11.4, 0.55],
      [axis, 12.4, 0.08],
    ],
    0.95,
    0,
  );
  return [...name, ...twin, ...spine, ...th.dotPolysAt(axis, 13.9)];
}

export const lamiahSVGs = (o: InkOptions = {}) => ({
  classic: inkSVG(classicPolys(), o),
  tughra: inkSVG(tughraPolys(), o),
  monogram: inkSVG(mirrorPolys(), o),
});

/** The square Kufic monograms: the name filling a square region with no border, by each method. */
export const KUFIC_FILLS: Record<'maze' | 'pinwheel' | 'spiral', FillerNode> = {
  maze: { type: 'maze', text: 'name', corridors: 0.55, wall: false, seed: 3 },
  pinwheel: { type: 'monogram', text: 'name', method: 'pinwheel', params: {} },
  spiral: { type: 'monogram', text: 'name', method: 'spiral', params: {} },
};

/** A square Kufic monogram of the name in one ink on a transparent page (the paper rect, which the palette needs as a colour, left out). The page keeps
 *  the composition's square; crop to the ink where that matters. */
export function kuficSVG(kind: keyof typeof KUFIC_FILLS, ink = '#1b1b1b'): string {
  const c = structuredClone(preset('kufic-maze-tile')) as Composition;
  c.texts = { name: { text: LAMIAH, repeat: 'fill', wordGap: 2 } };
  c.style.palette = { ink, ink2: ink, mark: ink, paper: '#ffffff' };
  c.root.child = { ...c.root.child, borders: [], fill: KUFIC_FILLS[kind] };
  return renderPlaced(resolve(c), { idPrefix: kind }).replace(
    /<rect width="[\d.]+" height="[\d.]+" fill="#ffffff"\/>/,
    '',
  );
}

export const lamiahKuficSVGs = () => ({
  maze: kuficSVG('maze'),
  pinwheel: kuficSVG('pinwheel'),
  spiral: kuficSVG('spiral'),
});
