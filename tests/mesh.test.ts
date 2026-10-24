// Phase 6.8: heightmap → printable solid (STL).
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { resolve } from '../src/compose';
import { reliefSVG } from '../src/fabricate';
import { heightmapFromPixels, heightmapToMesh, meshStats, meshToSTL } from '../src/fabricate/mesh';
import type { Mesh, Pixels } from '../src/fabricate/mesh';
import { preset } from '../src/model/presets';
import { toPNG } from '../scripts/raster.mjs';

/** Every directed edge has exactly one twin running the other way: closed and consistently wound. */
function closed(m: Mesh) {
  const e = new Map<string, number>(),
    T = m.triangles;
  for (let t = 0; t < T.length; t += 3)
    for (const [a, b] of [
      [T[t], T[t + 1]],
      [T[t + 1], T[t + 2]],
      [T[t + 2], T[t]],
    ])
      e.set(a + ',' + b, (e.get(a + ',' + b) ?? 0) + 1);
  for (const [k, c] of e) {
    const [a, b] = k.split(',');
    if (c !== 1 || e.get(b + ',' + a) !== 1) return false;
  }
  return true;
}
/** Signed volume (divergence theorem): positive when normals point out. */
function volume(m: Mesh) {
  const P = m.positions,
    T = m.triangles;
  let v = 0;
  for (let t = 0; t < T.length; t += 3) {
    const [a, b, c] = [T[t] * 3, T[t + 1] * 3, T[t + 2] * 3];
    v +=
      (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) -
        P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) +
        P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) /
      6;
  }
  return v;
}
/** A synthetic image: grey ground, a white square, a transparent disc hole. */
function image(w: number, h: number): Pixels {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4,
        hole = Math.hypot(x - w * 0.75, y - h * 0.5) < h * 0.15,
        sq = x > w * 0.1 && x < w * 0.4 && y > h * 0.2 && y < h * 0.8,
        g = sq ? 255 : 100;
      data.set([g, g, g, hole ? 0 : 255], i);
    }
  return { width: w, height: h, data };
}

describe('heightmap to mesh', () => {
  const m = heightmapToMesh(heightmapFromPixels(image(200, 100)), {
    widthMM: 100,
    baseMM: 2,
    reliefMM: 3,
    resolution: 256,
  });
  it('is a closed solid with outward normals', () => {
    expect(closed(m)).toBe(true);
    expect(volume(m)).toBeGreaterThan(0);
  });
  it('has the asked size and heights', () => {
    const s = meshStats(m);
    expect(s.min[0]).toBeCloseTo(0, 3);
    expect(s.max[0]).toBeCloseTo(100, 3);
    expect(s.max[1]).toBeCloseTo(50, 0);
    expect(s.min[2]).toBe(0);
    expect(s.max[2]).toBeCloseTo(5, 3);
  });
  it('spends few triangles on flat areas', () => {
    // a full 256 × 128 grid would be 65536 top triangles alone
    expect(meshStats(m).triangles).toBeLessThan(40000);
  });
  it('cuts away transparent pixels', () => {
    // the hole's centre is at 75 mm, 25 mm: no top triangle covers it
    const P = m.positions,
      T = m.triangles;
    let covered = false;
    for (let t = 0; t < T.length; t += 3) {
      const [a, b, c] = [T[t] * 3, T[t + 1] * 3, T[t + 2] * 3];
      if (P[a + 2] === 0) continue;
      const d = (x: number, y: number, p: number, q: number) =>
        (P[q] - P[p]) * (y - P[p + 1]) - (P[q + 1] - P[p + 1]) * (x - P[p]);
      const s1 = d(75, 25, a, b),
        s2 = d(75, 25, b, c),
        s3 = d(75, 25, c, a);
      if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) covered = true;
    }
    expect(covered).toBe(false);
  });
  it('writes binary STL', () => {
    const stl = meshToSTL(m),
      dv = new DataView(stl.buffer);
    expect(stl.length).toBe(84 + 50 * meshStats(m).triangles);
    expect(dv.getUint32(80, true)).toBe(meshStats(m).triangles);
  });
});

describe('relief of a composition', () => {
  it('becomes a closed medallion cut to its outline', async () => {
    const png = PNG.sync.read(await toPNG(reliefSVG(resolve(preset('fatimid-medallion'))), 512)),
      hm = heightmapFromPixels(png, { cutBelow: 0.05 }),
      m = heightmapToMesh(hm, { widthMM: 120, resolution: 512 });
    expect(closed(m)).toBe(true);
    expect(volume(m)).toBeGreaterThan(0);
    const s = meshStats(m);
    expect(s.max[0] - s.min[0]).toBeGreaterThan(110);
    expect(s.max[2]).toBeCloseTo(5, 1);
  });
});
