// Tilings for star patterns, as polygons (vertex lists) covering a disc of radius R around (cx, cy). a = edge length.
export type Poly = number[][];
import { multigrid } from './multigrid';

export type Tiling = 'sq' | '488' | 'hex' | '31212' | 'mg8' | 'mg10' | 'mg12';
/** The quasi-periodic tilings: symmetry fold of each multigrid. */
const FOLD: Partial<Record<Tiling, number>> = { mg8: 8, mg10: 10, mg12: 12 };

export function tiles(kind: Tiling, a: number, cx: number, cy: number, R: number): Poly[] {
  const out: Poly[] = [],
    poly = (x: number, y: number, n: number, rc: number, rot: number) => {
      const p = [];
      for (let k = 0; k < n; k++) {
        const t = rot + (k * 2 * Math.PI) / n;
        p.push([x + rc * Math.cos(t), y + rc * Math.sin(t)]);
      }
      return p;
    };
  const fold = FOLD[kind];
  if (fold) return multigrid(fold / 2, R + a * 2, a).map(t => t.q.map(([x, y]) => [cx + x, cy + y]));
  if (kind === 'sq') {
    const n = Math.ceil(R / a) + 1;
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++) out.push(poly(cx + i * a, cy + j * a, 4, a / Math.SQRT2, Math.PI / 4));
  } else if (kind === '488') {
    const D = a * (1 + Math.SQRT2),
      n = Math.ceil(R / D) + 1,
      ro = a / (2 * Math.sin(Math.PI / 8));
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++) {
        out.push(poly(cx + i * D, cy + j * D, 8, ro, Math.PI / 8));
        out.push(poly(cx + (i + 0.5) * D, cy + (j + 0.5) * D, 4, a / Math.SQRT2, 0));
      }
  } else if (kind === 'hex') {
    const n = Math.ceil(R / (1.5 * a)) + 2;
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++)
        out.push(poly(cx + a * Math.sqrt(3) * (i + j / 2), cy + 1.5 * a * j, 6, a, -Math.PI / 2));
  } else {
    const d = a * (2 + Math.sqrt(3)),
      rc = a / (2 * Math.sin(Math.PI / 12)),
      n = Math.ceil(R / d) + 2,
      rt = a / Math.sqrt(3);
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++) {
        const px = cx + d * (i + j / 2),
          py = cy + ((d * Math.sqrt(3)) / 2) * j;
        out.push(poly(px, py, 12, rc, Math.PI / 12));
        out.push(poly(px + d / 2, py + (d * Math.sqrt(3)) / 6, 3, rt, Math.PI / 6));
        out.push(poly(px + d, py + (d * Math.sqrt(3)) / 3, 3, rt, Math.PI / 2));
      }
  }
  return out.filter(p => p.some(([x, y]) => Math.hypot(x - cx, y - cy) < R + a * 2));
}
