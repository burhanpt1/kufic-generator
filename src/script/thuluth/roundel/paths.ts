// Reading paths (lab roundel.js, PORT-PLAN.md §3): a path is a composition's spine, one or more strokes in reading
// order with pen lifts between them, in field coordinates (x right, y up, about −1…1). Each word takes a target point
// along it in proportion to its width, and the composer keeps every word near its target; letters still stack, dip and
// interlock round the spine. Fitted horizontal lanes, read from the top lane down, gave the owner's best basmala,
// salawat and الحمد لله رب العالمين.
import { CALLIAR_ROUTES } from './calliar.data';

/** A path: subpaths (a break is a pen lift), each a polyline in reading order. */
export type ReadingPath = [number, number][][];

/** Each word's target point along a path, scaled so the path's length is `fill` of the text's width. */
export function pathTargets(path: ReadingPath, widths: readonly number[], fill = 0.7): [number, number][] {
  const segs: { a: [number, number]; b: [number, number]; L: number; s0: number }[] = [];
  let Lp = 0;
  for (const sp of path)
    for (let i = 0; i + 1 < sp.length; i++) {
      const L = Math.hypot(sp[i + 1][0] - sp[i][0], sp[i + 1][1] - sp[i][1]);
      segs.push({ a: sp[i], b: sp[i + 1], L, s0: Lp });
      Lp += L;
    }
  const Wt = widths.reduce((s, v) => s + v, 0),
    sc = (Wt * fill) / Math.max(1e-6, Lp);
  let cum = 0;
  return widths.map(w => {
    const u = ((cum + w / 2) / Wt) * Lp;
    cum += w;
    const g = segs.find(q => u <= q.s0 + q.L + 1e-9) || segs[segs.length - 1],
      f = Math.max(0, Math.min(1, (u - g.s0) / Math.max(1e-9, g.L)));
    return [sc * (g.a[0] + (g.b[0] - g.a[0]) * f), sc * (g.a[1] + (g.b[1] - g.a[1]) * f)];
  });
}

/** Sketching a path (Studio's pad): */
/** Ramer–Douglas–Peucker: keep the points that carry the stroke's shape. */
export function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0],
    [bx, by] = pts[pts.length - 1],
    L = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0,
    at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
    if (d > far) [far, at] = [d, i];
  }
  if (far <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/** Strokes in pad pixels to a reading path: normalised to −1…1 with y up, simplified, at most 8 strokes of 40 points
 *  (the recipe's limits); strokes too short to read along are dropped. */
export function toReadingPath(strokes: [number, number][][], size: number): ReadingPath {
  return strokes
    .map(s =>
      s.map(([x, y]) => [+((2 * x) / size - 1).toFixed(3), +(1 - (2 * y) / size).toFixed(3)] as [number, number]),
    )
    .map(s => simplify(s, 0.03).slice(0, 40))
    .filter(s => s.length >= 2 && Math.hypot(s[s.length - 1][0] - s[0][0], s[s.length - 1][1] - s[0][1]) > 0.15)
    .slice(0, 8);
}

/** n parallel chords of the field's circle (radius R), travelling at `deg` (180 = right to left), `gap` apart, sorted
 *  upper lane first; outer chords are shorter, so together the lanes fill the disc. */
export function lanes(deg: number, n: number, gap: number, R = 0.95): ReadingPath {
  const a = (deg * Math.PI) / 180,
    d = [Math.cos(a), Math.sin(a)],
    nr = [-d[1], d[0]],
    out: ReadingPath = [];
  for (let i = 0; i < n; i++) {
    const off = ((n - 1) / 2 - i) * gap,
      half = Math.sqrt(Math.max(0.05, R * R - off * off)),
      c = [nr[0] * off, nr[1] * off];
    out.push([
      [c[0] - d[0] * half, c[1] - d[1] * half],
      [c[0] + d[0] * half, c[1] + d[1] * half],
    ]);
  }
  return out.sort((p, q) => Math.max(q[0][1], q[1][1]) - Math.max(p[0][1], p[1][1]) || q[0][0] - p[0][0]);
}

/** Fitted lanes: the number of lanes (2–4, or `n`) and their spacing chosen so each band is about a word high
 *  (`bandFrac` of the mean word height), the lanes' total length about the text's (`fill`), and together they span
 *  the field (about 1.85 of its radius). */
export function fitLanes(
  words: number,
  textWidth: number,
  wordHeight: number,
  o: { deg?: number; n?: number; bandFrac?: number } = {},
  fill = 0.7,
  make: (n: number, gap: number) => ReadingPath = (n, gap) => lanes(o.deg ?? 180, n, gap),
): { path: ReadingPath; n: number; gap: number } {
  let best: { cost: number; path: ReadingPath; n: number; gap: number } | null = null;
  for (const n of o.n ? [o.n] : [2, 3, 4])
    for (let k = 0; k <= 15; k++) {
      const gap = 0.3 + k * 0.05,
        L = make(n, gap),
        Lp = L.reduce((s, q) => s + Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), 0),
        band = ((textWidth * fill) / Lp) * gap,
        cost = Math.log(band / ((o.bandFrac ?? 0.75) * wordHeight)) ** 2 + 0.6 * (n * gap - 1.85) ** 2 + (n > words ? 9 : 0); // prettier-ignore
      if (!best || cost < best.cost) best = { cost, path: L, n, gap: +gap.toFixed(2) };
    }
  return best!;
}

/** Make a path read downward: every stretch that climbs (within a stroke, or at a pen lift) is flipped to fall by as
 *  much, and the result is set back into the path's own height. A path traced from a master may climb before it
 *  descends (the sharp V), and words on the rising stretch would land above earlier ones. */
export function downward(path: ReadingPath): ReadingPath {
  const ys = path.flat().map(p => p[1]),
    lo = Math.min(...ys),
    hi = Math.max(...ys);
  let prev: number | null = null,
    y = 0;
  const raw = path.map(sp =>
    sp.map(([x, py]) => {
      y = prev == null ? 0 : y - Math.abs(py - prev);
      prev = py;
      return [x, y] as [number, number];
    }),
  );
  const rl = Math.min(...raw.flat().map(p => p[1])),
    k = rl < 0 ? (hi - lo) / -rl : 0;
  return raw.map(sp => sp.map(([x, ry]) => [x, hi + ry * k] as [number, number]));
}

/** A staircase of level rows: n rows from the top down, each shifted left of the one above by `shift` (of the field's
 *  width), so the outline is a diagonal while every line reads across (the owner liked the diagonal staircase but not
 *  its empty corners, and parallel diagonal lanes scramble the reading). Each row is a chord of the field's circle. */
export function stairs(n: number, shift = 0.22, R = 0.95): ReadingPath {
  const out: ReadingPath = [];
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 0.8 - (1.6 * i) / (n - 1),
      half = Math.sqrt(Math.max(0.05, R * R - y * y)),
      c = ((n - 1) / 2 - i) * shift,
      x1 = Math.min(half, c + half * 0.75),
      x0 = Math.max(-half, c - half * 0.75);
    out.push([
      [x1, y],
      [x0, y],
    ]);
  }
  return out;
}

/** Reading paths traced from Calliar thuluth compositions (prototypes/thuluth-lab/refresh/data/calliar_picks.json):
 *  letter centres in writing order, split where the route jumps back right, smoothed within each storey, simplified,
 *  and those built from the bottom up flipped to read from the top; made to read downward. */
const CALLIAR: Record<string, ReadingPath> = {
  calliar1: [[[0.954, 0.076], [0.438, -0.293], [0.233, -0.117], [-0.804, -0.288]]],
  calliar2: [[[0.843, 0.033], [0.238, -0.058], [0.009, 0.141], [-0.778, -0.292]]],
  calliar3: [[[0.848, 0.216], [0.584, -0.112], [0.366, 0.389], [0.072, 0.51], [-0.164, -0.565]], [[-0.294, 0.064], [-0.77, 0.463]]],
  calliar4: [[[0.953, 0.012], [0.356, -0.197], [-0.157, 0.149], [-0.547, 0.101]], [[0.223, -0.043], [-0.518, -0.366], [-0.96, -0.253]]],
  calliar6: [[[0.848, 0.297], [0.079, 0.655]], [[0.411, 0.097], [-0.287, 0.205]], [[0.346, -0.171], [0.105, 0.009], [-0.693, -0.471], [-0.704, -0.779]]],
}; // prettier-ignore

/** Named paths. Horizontal lanes, and sloping lanes whose heights don't overlap (stag2, stag3), read correctly;
 *  parallel diagonal lanes do not (words of neighbouring lanes sit side by side and read as a pair), so none is
 *  offered. */
export const PATHS: Record<string, ReadingPath> = {
  line: [[[1, 0], [-1, 0]]],
  diagonal: [[[1, 0.8], [-1, -0.8]]],
  zigzag: [[[1, 0.75], [-1, 0.75]], [[1, -0.75], [-1, -0.75]]],
  bolt: [[[1, 1], [-0.25, 0.12]], [[0.25, -0.12], [-1, -1]]],
  cup: [Array.from({ length: 9 }, (_, i) => [Math.cos(Math.PI * (i / 8)), -0.9 * Math.sin(Math.PI * (i / 8)) + 0.35] as [number, number])],
  rows2: lanes(180, 2, 0.85),
  rows3: lanes(180, 3, 0.62),
  stag2: [[[0.92, 0.88], [-0.92, 0.12]], [[0.92, -0.12], [-0.92, -0.88]]],
  stag3: [[[0.9, 0.92], [-0.9, 0.42]], [[0.95, 0.25], [-0.95, -0.25]], [[0.9, -0.42], [-0.9, -0.92]]],
  stairs2: stairs(2), stairs3: stairs(3), stairs4: stairs(4),
  ...Object.fromEntries(Object.entries(CALLIAR).map(([k, p]) => [k, downward(p)])),
  // every route traced from Calliar (calliar.data.ts), made to read downward: route:0 … route:63
  ...Object.fromEntries(CALLIAR_ROUTES.map((r, i) => [`route:${i}`, downward(r.path)])),
}; // prettier-ignore

/** The families path: 'auto' chooses among, by how the finished roundel is judged: fitted lanes, staggered lanes, the
 *  staircase, and the master routes that gave the densest, quietest compositions. */
export const AUTO_PATHS = ['lanes', 'stag2', 'stag3', 'stairs3', 'calliar3', 'calliar4'] as const;
