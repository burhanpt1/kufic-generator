import type { BandGlyph, Seg, Strip } from '../types';

/** Stem-rhythm search switch; compose() sets it from opts.rhythm. */
export const RHY = { on: false };
/** Share of a line's slack that long alternates may take. */
const ALT_SHARE = 0.6;

// Justify a line of segments to width W. Extra cells go to word-final tails (3), letter bodies (2.5), word gaps (2),
// joins before a final letter (2) and other joins (1). With rhythm on, the split is then nudged so tall stems fall evenly.
// Returns null if the segments don't fit; W = null means natural width. close: blank cells wanted at the left end,
// where a ring's line meets its own start (a word gap less the ring's one-cell seam), taken from the slack.
export function strip(
  segs: Seg[],
  Hb: number,
  base: number,
  wg: number,
  W: number | null,
  wrap?: boolean,
  close = 0,
): Strip | null {
  const gapAfter = (i: number) => (segs[i].endsWord ? wg : 1);
  let nat = 0;
  segs.forEach((s, i) => {
    nat += s.minW + (i < segs.length - 1 ? gapAfter(i) : 0);
  });
  if (W == null) W = nat;
  if (nat > W) return null;
  nat += Math.max(0, Math.min(close, W - nat));
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
  if (RHY.on && extra > 1 && pts.length > 1) {
    // The search below prices a few hundred to a few thousand allocations, so the walk along the line that finds the
    // tall stems is laid out once as flat arrays of indices into a (no keys built, nothing looked up or allocated
    // per allocation). Per glyph in reading order: its width, its stretch points, its tall columns, and what follows
    // it (a join or a gap, with the point that widens it, if any).
    const at = (k: string) => idx.get(k) ?? -1;
    const gW0: number[] = [],
      gStr0 = [0], // glyph q's stretch points are sI0/sC0[gStr0[q] .. gStr0[q + 1])
      gTall0 = [0], // and its tall columns tC0[gTall0[q] .. gTall0[q + 1])
      gDec0: number[] = [],
      gAfter0: number[] = [],
      sI0: number[] = [],
      sC0: number[] = [],
      tC0: number[] = [];
    segs.forEach((s, si) => {
      if (!s.glyphs.length && si < segs.length - 1) {
        // an empty segment still takes its gap
        gW0.push(0);
        gStr0.push(sI0.length);
        gTall0.push(tC0.length);
        gDec0.push(gapAfter(si));
        gAfter0.push(at('g' + si));
      }
      s.glyphs.forEach((g, gi) => {
        gW0.push(g.w);
        g.str.forEach(st => {
          sI0.push(at('t' + si + ',' + gi + ',' + st.c));
          sC0.push(st.c);
        });
        gStr0.push(sI0.length);
        g.tall.forEach(c => tC0.push(c));
        gTall0.push(tC0.length);
        if (gi < s.seps.length) {
          gDec0.push(1);
          gAfter0.push(at('j' + si + ',' + gi));
        } else if (si < segs.length - 1) {
          gDec0.push(gapAfter(si));
          gAfter0.push(at('g' + si));
        } else {
          gDec0.push(0);
          gAfter0.push(-1);
        }
      });
    });
    const nStems = tC0.length,
      nG = gW0.length,
      [gW, gStr, gTall, gDec, gAfter, sI, sC, tC] = [gW0, gStr0, gTall0, gDec0, gAfter0, sI0, sC0, tC0].map(v =>
        Int32Array.from(v),
      ),
      ptW = Float64Array.from(pts, p => p.w),
      walk = new Int32Array(nStems), // stem positions in reading order (right to left)
      xs = new Int32Array(nStems); // and sorted, left to right
    const positions = () => {
      let x = width - padR,
        n = 0;
      for (let q = 0; q < nG; q++) {
        const k0 = gStr[q],
          k1 = gStr[q + 1];
        let gw = gW[q];
        for (let k = k0; k < k1; k++) gw += a[sI[k]];
        x -= gw;
        for (let t = gTall[q]; t < gTall[q + 1]; t++) {
          const c = tC[t];
          let sh = 0;
          for (let k = k0; k < k1; k++) if (sC[k] < c) sh += a[sI[k]];
          walk[n++] = x + c + sh;
        }
        x -= gDec[q] + (gAfter[q] < 0 ? 0 : a[gAfter[q]]);
      }
    };
    // Stretching never reorders stems (glyphs keep their order and a glyph's columns theirs), so the order found
    // once sorts every allocation; were it ever not to, the positions are sorted outright.
    positions();
    const order = Array.from(walk, (_, i) => i).sort((p, q) => walk[p] - walk[q] || p - q);
    const stems = () => {
      positions();
      let sorted = true;
      for (let k = 0; k < nStems; k++) {
        xs[k] = walk[order[k]];
        if (k && xs[k] < xs[k - 1]) sorted = false;
      }
      if (!sorted) xs.sort();
    };
    const a0 = a.slice(),
      norm = (extra * extra) / pts.length + 1;
    // the same sums in the same order as the plain form (gaps left to right, then the wrap), so the same floats
    const cost = () => {
      stems();
      if (nStems < 2) return 0;
      const span = xs[nStems - 1] - xs[0],
        nGaps = wrap ? nStems : nStems - 1,
        m = (wrap ? width + 1 : span) / nGaps;
      let v = 0;
      for (let i = 1; i < nStems; i++) {
        const g = xs[i] - xs[i - 1];
        v += (g - m) * (g - m);
      }
      if (wrap) {
        const g = width + 1 - span;
        v += (g - m) * (g - m);
      }
      let nc = 0;
      for (let i = 0; i < a.length; i++) nc += ((a[i] - a0[i]) * (a[i] - a0[i])) / ptW[i];
      return (v / nGaps / (m * m + 1)) * 4 + (0.15 * nc) / norm;
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
