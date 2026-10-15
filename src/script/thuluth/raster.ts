// A pure polygon rasteriser standing in for the browser canvas the lab used to measure ink (collision masks, mark
// occupancy, counters). It reproduces what the lab relied on: each fill() is the antialiased non-zero union of its
// polygons (4 sub-scanlines per pixel, exact coverage along each), composited source-over into an 8-bit alpha channel, so thresholds such as
// "alpha > 100" mean what they meant in the lab. Expect small differences at edges, not in shape.
import type { Poly } from './types';

/** Sub-scanlines per pixel; coverage along each is measured exactly. */
const S = 4;

export class Alpha {
  readonly a: Uint8Array;
  constructor(
    readonly W: number,
    readonly H: number,
  ) {
    this.a = new Uint8Array(Math.max(0, W * H));
  }
  /** Fill polygons (pixel coordinates, y down) as one path, black at full opacity. */
  fill(polys: readonly Poly[]): void {
    const { W, H } = this;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const q of polys)
      for (const [x, y] of q) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    const px0 = Math.max(0, Math.floor(x0)),
      px1 = Math.min(W - 1, Math.ceil(x1)),
      py0 = Math.max(0, Math.floor(y0)),
      py1 = Math.min(H - 1, Math.ceil(y1));
    if (px0 > px1 || py0 > py1) return;
    const bw = px1 - px0 + 1,
      cov = new Float32Array(bw * (py1 - py0 + 1));
    // edges, with direction for the non-zero rule
    const edges: [number, number, number, number, number][] = [];
    for (const q of polys)
      for (let i = 0; i < q.length; i++) {
        const [ax, ay] = q[i],
          [bx, by] = q[(i + 1) % q.length];
        if (ay === by) continue;
        edges.push(ay < by ? [ax, ay, bx, by, 1] : [bx, by, ax, ay, -1]);
      }
    const xs: number[] = [],
      ws: number[] = [];
    for (let py = py0; py <= py1; py++)
      for (let sj = 0; sj < S; sj++) {
        const sy = py + (sj + 0.5) / S;
        xs.length = 0;
        ws.length = 0;
        for (const [ax, ay, bx, by, d] of edges)
          if (sy >= ay && sy < by) {
            xs.push(ax + ((sy - ay) * (bx - ax)) / (by - ay));
            ws.push(d);
          }
        if (xs.length < 2) continue;
        const ord = xs.map((_, i) => i).sort((i, j) => xs[i] - xs[j]);
        let wind = 0;
        for (let k = 0; k < ord.length - 1; k++) {
          wind += ws[ord[k]];
          if (!wind) continue;
          // the span [xa, xb) on this sub-scanline, with exact coverage of the pixels at its ends
          const xa = Math.max(xs[ord[k]], px0),
            xb = Math.min(xs[ord[k + 1]], px1 + 1);
          if (xb <= xa) continue;
          const row = (py - py0) * bw - px0,
            ia = Math.floor(xa),
            ib = Math.min(px1, Math.ceil(xb) - 1);
          for (let px = ia; px <= ib; px++) cov[row + px] += (Math.min(xb, px + 1) - Math.max(xa, px)) / S;
        }
      }
    const a = this.a;
    for (let py = py0; py <= py1; py++)
      for (let px = px0; px <= px1; px++) {
        const c = cov[(py - py0) * bw + px - px0];
        if (!c) continue;
        const i = py * W + px,
          src = Math.round(Math.min(c, 1) * 255);
        a[i] = Math.min(255, a[i] + Math.round((src * (255 - a[i])) / 255));
      }
  }
  /** Cells whose alpha is above a threshold (0–255). */
  mask(threshold: number): Uint8Array {
    const m = new Uint8Array(this.a.length);
    for (let i = 0; i < m.length; i++) m[i] = this.a[i] > threshold ? 1 : 0;
    return m;
  }
}

/** Map polygons from pen units to pixels, rounding to 0.1 as the lab's path strings did. */
export function toPixels(polys: readonly Poly[], X: (x: number) => number, Y: (y: number) => number): Poly[] {
  const r = (v: number) => Math.round(v * 10) / 10;
  return polys.map(q => q.map(([x, y]) => [r(X(x)), r(Y(y))] as [number, number]));
}
