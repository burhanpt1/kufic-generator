// Shaped fields (PLAN-2 §3): the classical fields of istif after Derman (pear, drop, tulip, mihrab arch, ship's hull)
// as outlines, so a roundel can fill a shape instead of a disc. The lanes become chords of the shape, the composer
// keeps the letters inside it, the frame is fitted to it, marks and ornaments stay within it, and a shape that narrows
// to a point gets a finial there to balance its empty tip.
import type { ReadingPath } from './paths';

export type FieldName = 'pear' | 'drop' | 'tulip' | 'mihrab' | 'hull';
/** A field: its half-width at each height v (−1 bottom … 1 top, as a share of its widest), and its width over height. */
interface FieldDef {
  half: (v: number) => number;
  aspect: number;
  /** It narrows to a point at the top (a finial belongs there). */
  tip: boolean;
}
// the pointed arch of the mihrab: two arcs from shoulder height 0.2, meeting at the top
const ARCH_R = 0.8017,
  ARCH_C = ARCH_R - 0.75;
export const FIELDS: Record<FieldName, FieldDef> = {
  // round below, narrowing to a rounded neck above
  pear: {
    half: v =>
      v < 0.15 ? Math.sqrt(Math.max(0, 1 - ((v - 0.15) / 1.15) ** 2)) : 1 - 0.68 * ((v - 0.15) / 0.85) ** 0.8,
    aspect: 0.82,
    tip: false,
  },
  // round below, rising to a point
  drop: { half: v => (v < 0 ? Math.sqrt(Math.max(0, 1 - v * v)) : 1 - v ** 1.1), aspect: 0.8, tip: true },
  // a cup that swells, draws in and rises to a point
  tulip: {
    half: v => (v < -0.2 ? Math.sqrt(Math.max(0, 1 - ((v + 0.2) / 0.8) ** 2)) : Math.max(0, 1 - ((v + 0.2) / 1.2) ** 1.6 + 0.12 * Math.sin(Math.PI * (v + 0.2) / 1.2))), // prettier-ignore
    aspect: 0.78,
    tip: true,
  },
  // upright sides under a pointed arch
  mihrab: {
    half: v => (v < 0.2 ? 0.75 : Math.max(0, Math.sqrt(Math.max(0, ARCH_R * ARCH_R - (v - 0.2) ** 2)) - ARCH_C)) / 0.75,
    aspect: 0.72,
    tip: true,
  },
  // a ship's hull: a level deck above a long curved keel
  hull: { half: v => (v >= 0.2 ? 1 : Math.sqrt(Math.max(0, 1 - ((v - 0.2) / 1.2) ** 2))), aspect: 1.9, tip: false },
};

/** The field's outline: a polygon in unit coordinates (y up; height −1…1, width ±aspect), counter-clockwise. */
export function fieldPolygon(name: FieldName, n = 64): [number, number][] {
  const F = FIELDS[name],
    right: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const v = -1 + (2 * i) / n;
    right.push([F.aspect * F.half(v), v]);
  }
  const left = right
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as [number, number]);
  return [...right, ...left].filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-9);
}

/** Point in polygon (even–odd). */
export function inPolygon(P: readonly [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i],
      [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Distance from a point to the polygon's edge. */
export function edgeDistance(P: readonly [number, number][], x: number, y: number): number {
  let d = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j],
      [bx, by] = P[i],
      dx = bx - ax,
      dy = by - ay,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return d;
}

/** Lanes across a field: n level chords, `gap` apart (in the field's half-height), upper first, each spanning the
 *  field at its height, inset a little (the field's version of lanes()). */
export function fieldLanes(name: FieldName, n: number, gap: number, inset = 0.92): ReadingPath {
  const F = FIELDS[name],
    out: ReadingPath = [];
  for (let i = 0; i < n; i++) {
    const y = ((n - 1) / 2 - i) * gap,
      // the narrower of the field's width at the band's top and bottom, so a word in the band stays inside
      half = F.aspect * Math.min(F.half(Math.min(1, y + gap / 3)), F.half(Math.max(-1, y - gap / 3))) * inset;
    out.push([
      [Math.max(0.05, half), y],
      [-Math.max(0.05, half), y],
    ]);
  }
  return out;
}

/** The field's place round some points: its centre and scale (its half-height), the smallest that holds every point
 *  with its margin. For each scale tried, the centre is searched over the field's own extent round the points' centre,
 *  so the text can sit in the shape's wide part. */
export function fitField(
  name: FieldName,
  pts: readonly [number, number, number][],
): { cx: number; cy: number; k: number } {
  const P = fieldPolygon(name),
    xs = pts.map(q => q[0]),
    ys = pts.map(q => q[1]),
    mx = (Math.min(...xs) + Math.max(...xs)) / 2,
    my = (Math.min(...ys) + Math.max(...ys)) / 2,
    W = Math.max(...xs) - Math.min(...xs),
    H = Math.max(...ys) - Math.min(...ys),
    few = pts.filter((_, i) => i % 3 === 0),
    fitsAll = (set: readonly [number, number, number][], cx: number, cy: number, k: number) =>
      set.every(([x, y, m]) => {
        const u = (x - cx) / k,
          v = (y - cy) / k;
        return inPolygon(P, u, v) && edgeDistance(P, u, v) * k >= m;
      });
  const centreFor = (k: number) => {
    for (let a = 0; a <= 12; a++)
      for (let b = 0; b <= 8; b++) {
        // from the points' own centre outward, so the nearest fitting centre is found first
        const dy = (a % 2 ? -1 : 1) * Math.ceil(a / 2) * 0.1 * k,
          dx = (b % 2 ? -1 : 1) * Math.ceil(b / 2) * 0.06 * k,
          cx = mx + dx,
          cy = my + dy;
        if (fitsAll(few, cx, cy, k) && fitsAll(pts, cx, cy, k)) return { cx, cy };
      }
    return null;
  };
  let lo = Math.max(W, H) * 0.3,
    hi = Math.max(W, H) * 4 + 10,
    best = centreFor(hi) ?? { cx: mx, cy: my };
  for (let it = 0; it < 24; it++) {
    const mid = (lo + hi) / 2,
      c = centreFor(mid);
    if (c) {
      hi = mid;
      best = c;
    } else lo = mid;
  }
  return { ...best, k: hi };
}

/** SVG path data of the field at scale k about (0, 0), y down, and of its rim grown by `grow` (pen units). */
export function fieldPath(name: FieldName, k: number, grow = 0): string {
  const P = fieldPolygon(name),
    out = P.map(([x, y]) => {
      // grown outward along the direction from the centre of the field's box, by about `grow`
      const l = Math.hypot(x, y) || 1;
      return [(x * k + (x / l) * grow).toFixed(3), (-(y * k + (y / l) * grow)).toFixed(3)];
    });
  return 'M' + out.map(([x, y]) => x + ' ' + y).join('L') + 'Z';
}

/** A finial at a pointed field's tip: an eight-petalled rosette with a bead above, centred on the axis just above the
 *  tip (pen units, y down, about the field's centre); empty for a field with no point. */
export function finialPath(name: FieldName, k: number, size: number): string {
  if (!FIELDS[name].tip) return '';
  const fx = 0,
    fy = -(k + size * 1.3);
  let p = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      ex = fx + Math.cos(a) * size,
      ey = fy + Math.sin(a) * size,
      l = Math.cos(a + 0.5) * size * 0.64,
      m = Math.sin(a + 0.5) * size * 0.64,
      l2 = Math.cos(a - 0.5) * size * 0.64,
      m2 = Math.sin(a - 0.5) * size * 0.64;
    p += `M${fx.toFixed(3)} ${fy.toFixed(3)}Q${(fx + l2).toFixed(3)} ${(fy + m2).toFixed(3)} ${ex.toFixed(3)} ${ey.toFixed(3)}Q${(fx + l).toFixed(3)} ${(fy + m).toFixed(3)} ${fx.toFixed(3)} ${fy.toFixed(3)}Z`; // prettier-ignore
  }
  // the bead above the rosette, as a small diamond
  const by = fy - size * 1.6,
    r = size * 0.28;
  return p + `M0 ${(by - r).toFixed(3)}L${r.toFixed(3)} ${by.toFixed(3)}L0 ${(by + r).toFixed(3)}L${(-r).toFixed(3)} ${by.toFixed(3)}Z`; // prettier-ignore
}

/** What a field (a disc, an oval or a shaped field) allows, at a scale of its radius and less a margin: whether a
 *  point, with a pad round it, lies inside, and the box to search. */
export function fieldTest(
  D: { cx: number; cy: number; r: number; oval?: number; field?: FieldName },
  scale: number,
  margin: number,
): {
  inside: (x: number, y: number, pad?: number) => boolean;
  /** The free room from a point to the field's edge (0 outside). */
  room: (x: number, y: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
} {
  const k = D.r * scale,
    OV = D.oval || 1;
  if (!D.field) {
    const R = k - margin;
    return {
      inside: (x, y, pad = 0) => Math.hypot((x - D.cx) / OV, y - D.cy) + pad < R,
      room: (x, y) => Math.max(0, R - Math.hypot((x - D.cx) / OV, y - D.cy)),
      x0: D.cx - R * OV,
      x1: D.cx + R * OV,
      y0: D.cy - R,
      y1: D.cy + R,
    };
  }
  const P = fieldPolygon(D.field),
    A = FIELDS[D.field].aspect;
  return {
    inside: (x, y, pad = 0) => {
      const u = (x - D.cx) / k,
        v = (y - D.cy) / k;
      return inPolygon(P, u, v) && edgeDistance(P, u, v) * k > pad + margin;
    },
    room: (x, y) => {
      const u = (x - D.cx) / k,
        v = (y - D.cy) / k;
      return inPolygon(P, u, v) ? Math.max(0, edgeDistance(P, u, v) * k - margin) : 0;
    },
    x0: D.cx - k * A,
    x1: D.cx + k * A,
    y0: D.cy - k,
    y1: D.cy + k,
  };
}
