// Geometric star patterns by Hankin's polygons-in-contact method: rays from each tile-edge midpoint at the contact
// angle, stopped where they meet the ray from the neighbouring edge.
import type { RenderOptions } from '../../render/svg';
import { U, acc, f2, mix } from '../../render/svg';
import type { Poly } from './tilings';
import { tiles } from './tilings';

/** The pattern's lines as polylines: per tile edge pair, the two rays from the edge midpoints to where they meet
 *  (or one straight line when they are parallel or meet behind). */
export function picLines(polys: Poly[], theta: number): number[][][] {
  const out: number[][][] = [];
  const rotv = ([x, y]: number[], t: number) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
  polys.forEach(p => {
    const n = p.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = p[i],
        [x2, y2] = p[(i + 1) % n];
      area += x1 * y2 - x2 * y1;
    }
    const sg = area > 0 ? 1 : -1;
    const mid = (i: number) => {
      const [x1, y1] = p[i % n],
        [x2, y2] = p[(i + 1) % n];
      return [(x1 + x2) / 2, (y1 + y2) / 2];
    };
    const dir = (i: number) => {
      const [x1, y1] = p[i % n],
        [x2, y2] = p[(i + 1) % n],
        l = Math.hypot(x2 - x1, y2 - y1);
      return [(x2 - x1) / l, (y2 - y1) / l];
    };
    for (let i = 0; i < n; i++) {
      const m1 = mid(i),
        m2 = mid(i + 1),
        df = rotv(dir(i), sg * theta),
        e2 = dir(i + 1),
        db = rotv([-e2[0], -e2[1]], -sg * theta);
      const det = df[0] * -db[1] - df[1] * -db[0];
      if (Math.abs(det) < 1e-6) {
        out.push([m1, m2]);
        continue;
      }
      const rx = m2[0] - m1[0],
        ry = m2[1] - m1[1],
        t = (rx * -db[1] - ry * -db[0]) / det;
      const q = [m1[0] + t * df[0], m1[1] + t * df[1]];
      out.push(t > 0 ? [m1, q, m2] : [m1, m2]);
    }
  });
  return out;
}

export function picPath(polys: Poly[], theta: number) {
  return picLines(polys, theta)
    .map(l => l.map(([x, y], k) => (k ? 'L' : 'M') + f2(x) + ' ' + f2(y)).join(''))
    .join('');
}

/** Star pattern around (cx, cy) radius R, clipped to clipId; strength mixes the line colour from paper to accent. */
export function patternSVG(opt: RenderOptions, cx: number, cy: number, R: number, clipId: string, strength: number) {
  const a = opt.geoScale * U,
    d = picPath(tiles(opt.tiling, a, cx, cy, R), (opt.geoAngle * Math.PI) / 180);
  const c = mix(opt.paper, acc(opt), strength),
    sw = a * 0.16;
  return `<g clip-path="url(#${clipId})" fill="none" stroke-linejoin="miter" stroke-linecap="butt"><path d="${d}" stroke="${c}" stroke-width="${f2(sw)}"/><path d="${d}" stroke="${mix(opt.paper, c, 0.25)}" stroke-width="${f2(sw * 0.38)}"/></g>`;
}
