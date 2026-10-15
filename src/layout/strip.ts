import type { BandGlyph, Seg, Strip } from '../types';

/** Stem-rhythm search switch; compose() sets it from opts.rhythm. */
export const RHY = { on: false };
/** Share of a line's slack that long alternates may take. */
const ALT_SHARE = 0.6;

// Justify a line of segments to width W. Extra cells go to word-final tails (3), letter bodies (2.5), word gaps (2),
// joins before a final letter (2) and other joins (1). With rhythm on, the split is then nudged so tall stems fall evenly.
// Returns null if the segments don't fit; W = null means natural width.
export function strip(
  segs: Seg[],
  Hb: number,
  base: number,
  wg: number,
  W: number | null,
  wrap?: boolean,
): Strip | null {
  const gapAfter = (i: number) => (segs[i].endsWord ? wg : 1);
  let nat = 0;
  segs.forEach((s, i) => {
    nat += s.minW + (i < segs.length - 1 ? gapAfter(i) : 0);
  });
  if (W == null) W = nat;
  if (nat > W) return null;
  // long alternates: when there is room, some final letters take their designed long forms instead of leaving all
  // the slack to stretching. Up to ALT_SHARE of the slack, spread along the line (farthest from those already used).
  if (W > nat && segs.some(s => s.glyphs.some(g => g.alt))) {
    const cands: { si: number; gi: number; k: number; cost: number }[] = [];
    let k = 0;
    segs.forEach((s, si) =>
      s.glyphs.forEach((g, gi) => {
        if (g.alt) cands.push({ si, gi, k, cost: g.alt.w - g.w });
        k++;
      }),
    );
    let budget = Math.floor((W - nat) * ALT_SHARE);
    const used: typeof cands = [];
    while (cands.length) {
      let bi = -1,
        bd = -1;
      cands.forEach((c, i) => {
        if (c.cost > budget) return;
        const d = used.length ? Math.min(...used.map(u => Math.abs(u.k - c.k))) : Math.min(c.k + 1, k - c.k);
        if (d > bd) [bd, bi] = [d, i];
      });
      if (bi < 0) break;
      const c = cands.splice(bi, 1)[0];
      used.push(c);
      budget -= c.cost;
    }
    if (used.length) {
      segs = segs.map((s, si) =>
        used.some(u => u.si === si)
          ? {
              ...s,
              glyphs: s.glyphs.map((g, gi) => (used.some(u => u.si === si && u.gi === gi) ? g.alt! : g)),
              minW: s.minW + used.filter(u => u.si === si).reduce((a, u) => a + u.cost, 0),
            }
          : s,
      );
      nat += used.reduce((a, u) => a + u.cost, 0);
    }
  }
  const width = W;
  const extra = W - nat,
    pts: { w: number }[] = [],
    idx = new Map<string, number>();
  segs.forEach((s, si) => {
    s.glyphs.forEach((g, gi) => {
      g.str.forEach(st => {
        idx.set('t' + si + ',' + gi + ',' + st.c, pts.length);
        pts.push({ w: st.w });
      });
      if (gi < s.seps.length && s.seps[gi] === 'join') {
        idx.set('j' + si + ',' + gi, pts.length);
        pts.push({ w: s.glyphs[gi + 1].form === 'fin' ? 2 : 1 });
      }
    });
    if (si < segs.length - 1 && s.endsWord) {
      idx.set('g' + si, pts.length);
      pts.push({ w: 2 });
    }
  });
  const a = new Int32Array(pts.length);
  let padR = 0;
  if (pts.length && extra) {
    const tw = pts.reduce((x, p) => x + p.w, 0);
    let used = 0;
    const fr = pts.map((p, i) => {
      const ex = (extra * p.w) / tw,
        f = Math.floor(ex);
      a[i] = f;
      used += f;
      return [ex - f, i];
    });
    fr.sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    for (let i = 0; i < extra - used; i++) a[fr[i % fr.length][1]]++;
  } else padR = Math.floor(extra / 2);
  const get = (k: string) => {
    const i = idx.get(k);
    return i == null ? 0 : a[i];
  };
  // tall-stem positions for an allocation
  const stems = () => {
    const xs: number[] = [];
    let x = width - padR;
    segs.forEach((s, si) => {
      s.glyphs.forEach((g, gi) => {
        let gw = g.w;
        g.str.forEach(st => (gw += get('t' + si + ',' + gi + ',' + st.c)));
        x -= gw;
        g.tall.forEach(c => {
          let sh = 0;
          g.str.forEach(st => {
            if (st.c < c) sh += get('t' + si + ',' + gi + ',' + st.c);
          });
          xs.push(x + c + sh);
        });
        if (gi < s.seps.length) x -= 1 + get('j' + si + ',' + gi);
      });
      if (si < segs.length - 1) x -= gapAfter(si) + get('g' + si);
    });
    return xs.sort((p, q) => p - q);
  };
  if (RHY.on && extra > 1 && pts.length > 1) {
    const a0 = Array.from(a),
      norm = (extra * extra) / pts.length + 1;
    const cost = () => {
      const xs = stems();
      if (xs.length < 2) return 0;
      const gaps: number[] = [];
      for (let i = 1; i < xs.length; i++) gaps.push(xs[i] - xs[i - 1]);
      if (wrap) gaps.push(width + 1 - (xs[xs.length - 1] - xs[0]));
      const m = gaps.reduce((p, q) => p + q, 0) / gaps.length;
      let v = 0;
      gaps.forEach(g => (v += (g - m) * (g - m)));
      let nc = 0;
      for (let i = 0; i < a.length; i++) nc += ((a[i] - a0[i]) * (a[i] - a0[i])) / pts[i].w;
      return (v / gaps.length / (m * m + 1)) * 4 + (0.15 * nc) / norm;
    };
    let c = cost(),
      seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 16807) % 2147483647;
      return seed % n;
    };
    for (let it = 0; it < 400 + 25 * pts.length; it++) {
      const i = rnd(a.length),
        j = rnd(a.length);
      if (i === j || a[i] === 0) continue;
      a[i]--;
      a[j]++;
      const c2 = cost();
      if (c2 < c) c = c2;
      else {
        a[i]++;
        a[j]--;
      }
    }
  }
  const data = new Uint8Array(width * Hb),
    tag = new Uint8Array(width * Hb);
  let x = width - padR;
  // where each glyph landed, for the ي cup below
  const placed: { g: BandGlyph; x: number; col: (gx: number) => number; join: boolean }[][] = [];
  segs.forEach((s, si) => {
    const rt = (s.rep || 0) + 1;
    placed.push([]);
    s.glyphs.forEach((g, gi) => {
      const ex = g.str.map(st => get('t' + si + ',' + gi + ',' + st.c));
      const gw = g.w + ex.reduce((p, q) => p + q, 0);
      x -= gw;
      const gx0 = x;
      placed[si].push({
        g,
        x: gx0,
        col: c => gx0 + c + g.str.reduce((a, st, k) => a + (st.c < c ? ex[k] : 0), 0),
        join: gi < s.seps.length && s.seps[gi] === 'join',
      });
      // marks (vowels, dots) above and below the baseline: each group keeps its shape and its place across the
      // stretched glyph (owner's review: stretching split the dots of ي, or left them off its widened cup)
      const markAt = (y: number, gx: number) => {
          const v = g.data[y * g.w + gx];
          return v === 2 || v === 3;
        },
        markShift = [0, 0];
      if (gw > g.w)
        for (const side of [0, 1]) {
          let lo = Infinity,
            hi = -Infinity;
          for (let y = 0; y < Hb; y++)
            if (y > base === !side)
              for (let gx = 0; gx < g.w; gx++)
                if (markAt(y, gx)) {
                  lo = Math.min(lo, gx);
                  hi = Math.max(hi, gx);
                }
          if (lo <= hi) {
            const c = (lo + hi + 1) / 2;
            markShift[side] = Math.round((c * gw) / g.w - c);
          }
        }
      for (let gx = 0; gx < g.w; gx++) {
        let sh = 0,
          rep = 1;
        g.str.forEach((st, k) => {
          if (st.c < gx) sh += ex[k];
          else if (st.c === gx) rep = 1 + ex[k];
        });
        for (let y = 0; y < Hb; y++) {
          const v = g.data[y * g.w + gx];
          if (!v) continue;
          if (markAt(y, gx) && gw > g.w) {
            const X = x + gx + markShift[y > base ? 0 : 1];
            if (data[y * width + X] === 1) continue; // never over a letter
            data[y * width + X] = v;
            tag[y * width + X] = rt;
            continue;
          }
          for (let r = 0; r < rep; r++) {
            const v2 = v === 4 ? 1 : v;
            data[y * width + x + gx + sh + r] = v2;
            tag[y * width + x + gx + sh + r] = rt;
          }
        }
      }
      if (gi < s.seps.length) {
        const len = 1 + get('j' + si + ',' + gi);
        x -= len;
        if (s.seps[gi] === 'join')
          for (let k = 0; k < len; k++) {
            data[base * width + x + k] = 1;
            tag[base * width + x + k] = rt;
          }
      }
    });
    if (si < segs.length - 1) x -= gapAfter(si) + get('g' + si);
  });
  // a tooth letter next to a tall letter (يا, بل, كتب): its dots, above and below, centre in the hollow between its
  // tooth and that letter's stem, the following letter's first (owner's review: dots go in the hollow the letter makes)
  for (const row of placed)
    row.forEach(({ g, col, join }, i) => {
      if (!g.cup) return;
      const nx = join ? row[i + 1] : undefined,
        pv = i && row[i - 1].join ? row[i - 1] : undefined,
        stem = nx?.g.tall.length
          ? nx.col(Math.max(...nx.g.tall))
          : pv?.g.tall.length
            ? pv.col(Math.min(...pv.g.tall))
            : null;
      if (stem == null) return;
      let tooth = -1;
      for (let gx = 0; gx < g.w; gx++) if (g.data[(base + 1) * g.w + gx] === 1) tooth = gx;
      if (tooth < 0) return;
      const t = col(tooth),
        x0 = col(0),
        x1 = col(g.w - 1);
      // the marks above, then those below, as written inside the glyph's own stretched span
      for (const above of [true, false]) {
        const cells: [number, number, number][] = [];
        for (let y = 0; y < Hb; y++)
          if (above ? y > base : y < base)
            for (let X = x0; X <= x1; X++) {
              const v = data[y * width + X];
              if (v === 2 || v === 3) cells.push([X, y, v]);
            }
        if (!cells.length) continue;
        const lo = Math.min(...cells.map(c => c[0])),
          hi = Math.max(...cells.map(c => c[0])),
          d = Math.round((t + stem) / 2 - (lo + hi) / 2);
        const mine = new Set(cells.map(([X, y]) => y * width + X));
        // never onto a stroke or another letter's mark
        if (
          !d ||
          cells.some(
            ([X, y]) => X + d < 0 || X + d >= width || (data[y * width + X + d] && !mine.has(y * width + X + d)),
          )
        )
          continue;
        const tg = cells.map(([X, y]) => tag[y * width + X]);
        cells.forEach(([X, y]) => (data[y * width + X] = tag[y * width + X] = 0));
        cells.forEach(([X, y, v], k) => {
          data[y * width + X + d] = v;
          tag[y * width + X + d] = tg[k];
        });
      }
    });
  return { W: width, data, tag };
}
