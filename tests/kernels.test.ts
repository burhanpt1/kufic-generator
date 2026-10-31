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

describe('roundel kernels', () => {
  // the mark solver's empty-space measure, the enclosing disc and the frame's oval: the whole cartouche, built with
  // the WebAssembly and with the TypeScript, comes out the same to the last bit
  it('build the same cartouche as the TypeScript', async () => {
    const { roundelWasmLoaded, setRoundelBackend } = await import('../src/kernels/roundel');
    const { ROUNDEL_PEN, thuluth } = await import('../src/script/thuluth');
    const { buildRoundel } = await import('../src/script/thuluth/roundel');
    expect(roundelWasmLoaded()).toBe(true);
    const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true } }),
      spec = {
        text: 'مُحَمَّد عَلِيّ',
        compose: { elongate: true, cross: true, fillTarget: 0.5, kern: true, oval: 1.45, tries: 2, iters: 800 },
        bowl: { clear: 5.6, autoOval: true },
        frame: { markReach: 2.2 },
      },
      run = (b: 'auto' | 'js') => {
        setRoundelBackend(b);
        try {
          const f = buildRoundel(th, spec)!;
          return JSON.stringify([f.r.st, f.r.lv, f.r.E, f.r.disc, f.f.solved?.items, f.f.discScale]);
        } finally {
          setRoundelBackend('auto');
        }
      };
    expect(run('auto')).toBe(run('js'));
  }, 120_000);
});

describe('ratings kernel', () => {
  it('fits the same weights as the TypeScript', async () => {
    const { ratingsWasmLoaded, setRatingsBackend } = await import('../src/kernels/ratings');
    const { fitPairwise } = await import('../src/evolve/ratings');
    expect(ratingsWasmLoaded()).toBe(true);
    const rng = new Rng(7),
      ids = Array.from({ length: 30 }, (_, i) => 'c' + i),
      features = Object.fromEntries(ids.map(id => [id, Array.from({ length: 6 }, () => rng.next() * 8 - 3)])),
      votes = Array.from({ length: 50 }, () => ({
        a: ids[Math.floor(rng.next() * 30)],
        b: ids[Math.floor(rng.next() * 30)],
        w: (rng.next() < 0.45 ? 'a' : rng.next() < 0.9 ? 'b' : 'tie') as 'a' | 'b' | 'tie',
      })).filter(v => v.a !== v.b);
    const run = (b: 'auto' | 'js') => {
      setRatingsBackend(b);
      try {
        return fitPairwise(votes, features, { looTest: true, iters: 600 });
      } finally {
        setRatingsBackend('auto');
      }
    };
    expect(run('auto')).toEqual(run('js'));
  });
});

describe('roundel kernels, call by call', () => {
  // against the plain algorithms they replace (as first written: every distance measured, no shortcuts), on random
  // input, every result equal to the last bit
  it('the empty-space measure', async () => {
    const { gapKernel } = await import('../src/kernels/roundel');
    const rng = new Rng(3),
      nc = 600,
      ni = 14,
      cx = Array.from({ length: nc }, () => rng.next() * 60),
      cy = Array.from({ length: nc }, () => rng.next() * 40),
      cb = Array.from({ length: nc }, () => (rng.next() < 0.3 ? 0 : rng.next() * 9)),
      items = Array.from({ length: ni }, () => ({ x: rng.next() * 60, y: rng.next() * 40, r: 0.3 + rng.next() * 2 })),
      naive = () => {
        let e2 = 0;
        for (let c = 0; c < nc; c++) {
          let d = cb[c];
          for (const it of items) d = Math.min(d, Math.max(0, Math.hypot(cx[c] - it.x, cy[c] - it.y) - it.r));
          if (d > 1.6) e2 += (d - 1.6) ** 2;
        }
        return e2 / Math.max(1, nc);
      };
    const K = gapKernel(cx, cy, cb, ni)!;
    items.forEach((it, k) => K.move(k, it.x, it.y, it.r, true));
    K.rescanAll();
    expect(K.sum()).toBe(naive());
    for (let t = 0; t < 3000; t++) {
      const k = Math.floor(rng.next() * ni),
        it = items[k];
      // small steps, big jumps, and back to where it was
      if (t % 7 === 0) [it.x, it.y] = [rng.next() * 60, rng.next() * 40];
      else [it.x, it.y] = [it.x + (rng.next() - 0.5) * 3, it.y + (rng.next() - 0.5) * 3];
      K.move(k, it.x, it.y, it.r, false);
      expect(K.sum()).toBe(naive());
    }
  });
  it('the enclosing disc', async () => {
    const { discKernel } = await import('../src/kernels/roundel');
    const rng = new Rng(5);
    for (let t = 0; t < 200; t++) {
      const hulls = Array.from(
          { length: 4 + Math.floor(rng.next() * 8) },
          () =>
          Array.from({ length: 3 + Math.floor(rng.next() * 30) }, () => [rng.next() * 12 - 6, rng.next() * 9 - 4] as [number, number]), // prettier-ignore
        ),
        ng = 3 + Math.floor(rng.next() * 9),
        oval = [1, 1.3, 1.45, 2][t % 4],
        placed = Array.from({ length: ng }, () => ({ h: hulls[Math.floor(rng.next() * hulls.length)], x: rng.next() * 50 - 25, y: rng.next() * 30 - 15 })), // prettier-ignore
        K = discKernel(hulls, ng)!;
      placed.forEach((p, i) => K.place(i, p.x, p.y, p.h));
      // as composeRoundel first measured it
      const pts: [number, number][] = placed.flatMap(p => p.h.map(([hx, hy]) => [p.x + hx, p.y + hy] as [number, number])); // prettier-ignore
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      pts.forEach(([x, y]) => ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)))); // prettier-ignore
      let cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2;
      for (let it = 0; it < 12; it++) {
        let far = pts[0],
          fd = -1;
        pts.forEach(p => {
          const dd = Math.hypot(p[0] - cx, p[1] - cy);
          if (dd > fd) [fd, far] = [dd, p];
        });
        cx += ((far[0] - cx) * 0.08) / (1 + it * 0.3);
        cy += ((far[1] - cy) * 0.08) / (1 + it * 0.3);
      }
      let r = 0;
      pts.forEach(p => (r = Math.max(r, Math.hypot((p[0] - cx) / oval, p[1] - cy))));
      expect(K.run(ng, oval)).toEqual([cx, cy, r]);
    }
  });
  it('the frame oval', async () => {
    const { ovalKernel } = await import('../src/kernels/roundel');
    const rng = new Rng(9);
    for (let t = 0; t < 40; t++) {
      const pts = Array.from({ length: 50 + Math.floor(rng.next() * 400) }, () => [rng.next() * 40 - 20, rng.next() * 30 - 15, [0.35, 0.4][Math.floor(rng.next() * 2)]] as [number, number, number]), // prettier-ignore
        ovals = [1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.0, 2.2],
        mx = rng.next() - 0.5,
        my = rng.next() - 0.5,
        [Wd, Hd, pull, pref] = [40, 30, 0.12, [1.5, 1.2][t % 2]];
      // as fitFrame first searched
      let best: { area: number; cx: number; cy: number; R: number; v: number } | null = null;
      for (const v of ovals)
        for (let dx = -0.15; dx <= 0.1501; dx += 0.03)
          for (let dy = -0.15; dy <= 0.1501; dy += 0.03) {
            const ccx = mx + dx * Wd,
              ccy = my + dy * Hd;
            let R = 0;
            pts.forEach(([x, y, m]) => (R = Math.max(R, Math.hypot((x - ccx) / v, y - ccy) + m)));
            const area = R * R * v * (1 + pull * Math.abs(v - pref));
            if (!best || area < best.area) best = { area, cx: ccx, cy: ccy, R, v };
          }
      expect(ovalKernel(pts, ovals, mx, my, Wd, Hd, pull, pref)).toEqual(best);
    }
  });
});
