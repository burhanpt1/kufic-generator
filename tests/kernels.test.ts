// The native kernels against the TypeScript they stand in for: the partition solver and the rasteriser give the same
// results bit for bit; Clipper2's C++ gives the same outlines as its TypeScript port up to rounding.
import { afterEach, describe, expect, it } from 'vitest';
import { partitionWasmLoaded, setPartitionBackend } from '../src/kernels/partition';
import { partition } from '../src/layout/solvers';
import { Rng } from '../src/evolve/rng';
import type { Seg, Segs } from '../src/types';

const segsOf = (rng: Rng, n: number, wg: number): Segs => {
  const s = Array.from({ length: n }, () => ({ minW: 2 + Math.floor(rng.next() * 30), endsWord: rng.next() < 0.6 }) as unknown as Seg) as Segs; // prettier-ignore
  s.wg = wg;
  return s;
};
const run = (segs: Segs, caps: number[], b: 'auto' | 'js') => {
  setPartitionBackend(b);
  const p = partition(segs, caps);
  return p && { bounds: p.groups.map(g => g.length), score: p.score };
};

describe('partition kernel', () => {
  afterEach(() => setPartitionBackend('auto'));
  it('loads', () => expect(partitionWasmLoaded()).toBe(true));
  it('matches the TypeScript exactly on random inputs', () => {
    const rng = new Rng(42);
    let some = 0;
    for (let t = 0; t < 3000; t++) {
      const n = 1 + Math.floor(rng.next() * 160),
        G = 1 + Math.floor(rng.next() * Math.min(30, n)),
        wg = [2, 3.2, 4][t % 3],
        segs = segsOf(rng, n, wg),
        total = segs.reduce((a, s) => a + s.minW, 0),
        caps = Array.from({ length: G }, () => Math.round((total / G) * (0.8 + rng.next() * 0.9)) + (t % 5 ? 0 : 0.5));
      const a = run(segs, caps, 'js'),
        b = run(segs, caps, 'auto');
      expect(b).toEqual(a);
      if (a) some++;
    }
    expect(some).toBeGreaterThan(500);
  });
  it('falls back for what it cannot hold', () => {
    const rng = new Rng(1),
      segs = segsOf(rng, 5000, 2),
      caps = [1e6];
    expect(run(segs, caps, 'auto')).toEqual(run(segs, caps, 'js'));
  });
});

describe('f2', () => {
  it('formats exactly as Math.round(n * 100) / 100 does', async () => {
    const { f2 } = await import('../src/render/svg');
    const plain = (n: number) => (Math.round(n * 100) / 100).toString(),
      rng = new Rng(3);
    for (const v of [0, -0, 0.004, -0.004, 0.005, -0.005, 1.005, 2.675, 99.995, -1e12, NaN, Infinity, -Infinity, 1e17])
      expect(f2(v)).toBe(plain(v));
    for (let k = 0; k < 200000; k++) {
      const v = (rng.next() - 0.5) * 10 ** (Math.floor(rng.next() * 9) - 2);
      expect(f2(v)).toBe(plain(v));
    }
  });
});

describe('raster kernel', () => {
  it('fills exactly the bytes the TypeScript does', async () => {
    const { Alpha } = await import('../src/script/thuluth/raster');
    const { setRasterBackend, rasterWasmLoaded } = await import('../src/kernels/raster');
    expect(rasterWasmLoaded()).toBe(true);
    const rng = new Rng(11);
    const shape = (): [number, number][][] =>
      Array.from({ length: 1 + Math.floor(rng.next() * 6) }, () => {
        const cx = rng.next() * 120 - 10,
          cy = rng.next() * 90 - 10,
          n = 3 + Math.floor(rng.next() * 6),
          r = 0.3 + rng.next() * 25;
        return Array.from({ length: n }, (_, i) => {
          const t = (i / n) * 2 * Math.PI + rng.next() * 0.8,
            rr = r * (0.3 + rng.next());
          return [Math.round((cx + rr * Math.cos(t)) * 10) / 10, Math.round((cy + rr * Math.sin(t)) * 10) / 10] as [number, number]; // prettier-ignore
        });
      });
    for (let t = 0; t < 300; t++) {
      const fills = Array.from({ length: 1 + Math.floor(rng.next() * 12) }, shape),
        out: Uint8Array[] = [];
      for (const b of ['js', 'auto'] as const) {
        setRasterBackend(b);
        const A = new Alpha(110, 80);
        fills.forEach(f => A.fill(f));
        out.push(A.a);
      }
      setRasterBackend('auto');
      expect(Buffer.from(out[1]).equals(Buffer.from(out[0]))).toBe(true);
    }
  });
});

describe('Clipper2 kernel', () => {
  it('outlines thuluth as the TypeScript port does, to within rounding', async () => {
    const { clipper2, setClipperBackend } = await import('../src/kernels/clipper2');
    const { ROUNDEL_PEN, thuluth, inkPolys } = await import('../src/script/thuluth');
    const { outline } = await import('../src/script/thuluth/outline');
    expect(clipper2()).not.toBeNull();
    const th = thuluth(ROUNDEL_PEN),
      area = (ps: [number, number][][]) =>
        ps.reduce((a, q) => a + q.reduce((s, p, i) => s + p[0] * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * p[1], 0) / 2, 0); // prettier-ignore
    for (const text of ['بسم الله الرحمن الرحيم', 'زينب وقصي', 'محمد رسول الله']) {
      const polys = inkPolys(th, th.buildStrokes(text)),
        native = outline(polys);
      setClipperBackend('js');
      const ts = outline(polys);
      setClipperBackend('auto');
      expect(native.length).toBeGreaterThan(0);
      expect(Math.abs(area(native) - area(ts)) / Math.abs(area(ts))).toBeLessThan(1e-3);
    }
  });
});
