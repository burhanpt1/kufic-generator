// Quasi-periodic rhomb tilings and their Iznik dressing (the thuluth lab's multigrid.js). de Bruijn's multigrid: N
// families of parallel lines at angles πj/N give a rhomb tiling with exact 2N-fold symmetry about the centre. N = 4 is
// the 8-fold Ammann–Beenker tiling, N = 5 the 10-fold Penrose-type tiling, N = 6 a 12-fold dodecagonal tiling.

export interface Rhomb {
  q: [number, number][];
  /** The rhomb's acute angle, in radians (π/2 for a square). */
  angle: number;
}

/** Rhombs of the N-grid with edge `edge` whose centres lie within `reach` of the origin. */
export function multigrid(N: number, reach: number, edge: number): Rhomb[] {
  const e = [...Array(N)].map((_, j) => [Math.cos((Math.PI * j) / N), Math.sin((Math.PI * j) / N)]),
    g = 0.5 + 1e-7,
    tiles: Rhomb[] = [];
  const Kmax = Math.ceil(reach / edge / 1.2) + 2;
  for (let r = 0; r < N; r++)
    for (let s = r + 1; s < N; s++) {
      const det = e[r][0] * e[s][1] - e[r][1] * e[s][0];
      for (let kr = -Kmax; kr <= Kmax; kr++)
        for (let ks = -Kmax; ks <= Kmax; ks++) {
          const a = kr + g,
            b = ks + g,
            px = (a * e[s][1] - b * e[r][1]) / det,
            py = (b * e[r][0] - a * e[s][0]) / det;
          const K = e.map(([ex, ey], j) => (j === r ? kr : j === s ? ks : Math.ceil(px * ex + py * ey - g)));
          const V = (da: number, db: number): [number, number] => {
            let x = 0,
              y = 0;
            K.forEach((k, j) => {
              const kk = k + (j === r ? da : 0) + (j === s ? db : 0);
              x += kk * e[j][0];
              y += kk * e[j][1];
            });
            return [x * edge, y * edge];
          };
          const q = [V(0, 0), V(1, 0), V(1, 1), V(0, 1)],
            cx = q.reduce((a2, p) => a2 + p[0], 0) / 4,
            cy = q.reduce((a2, p) => a2 + p[1], 0) / 4;
          if (Math.hypot(cx, cy) < reach)
            tiles.push({ q, angle: Math.acos(Math.abs(e[r][0] * e[s][0] + e[r][1] * e[s][1])) });
        }
    }
  return tiles;
}

export interface IznikOptions {
  /** Symmetry (8, 10 or 12) and tiles across the field. */
  fold?: number;
  density?: number;
  ground?: string;
  cobalt?: string;
  turq?: string;
  red?: string;
  /** Square ceramic joints over the top, and their spacing (default S / 6). */
  seams?: boolean;
  tile?: number;
  /** Only the rhombs whose centre (in field coordinates) passes: the rest would be clipped or covered anyway. */
  keep?: (x: number, y: number) => boolean;
  /** Rhomb edge (default S / (density · 6.5)). */
  edge?: number;
  /** Centre of symmetry and how far the tiling reaches (default the middle, 0.75 S). */
  cx?: number;
  cy?: number;
  reach?: number;
}

/** The Iznik dressing of a multigrid tiling over an S × S field: cobalt vines along the edges, saz leaves and curling
 *  tendrils, hatayi flowers where many edges meet, buds elsewhere, small stars in the squares and the thinnest
 *  rhombs. Symmetric under rotation about the centre. SVG elements, no wrapper. */
export function iznikField(S: number, o: IznikOptions = {}): string {
  const fold = o.fold ?? 8,
    density = o.density ?? 3,
    ground = o.ground ?? '#f4f6f7',
    cobalt = o.cobalt ?? '#1f3f8f',
    turq = o.turq ?? '#2a9d9a',
    red = o.red ?? '#b3362c',
    seams = o.seams ?? true,
    tile = o.tile ?? 0,
    N = fold / 2;
  const cx = o.cx ?? S / 2,
    cy = o.cy ?? S / 2,
    reach = o.reach || S * 0.75,
    L = o.edge ?? S / (density * 6.5);
  const keep = o.keep,
    tiles = multigrid(N, reach, L).filter(
      t => !keep || keep(cx + (t.q[0][0] + t.q[2][0]) / 2, cy + (t.q[0][1] + t.q[2][1]) / 2),
    ),
    f = (n: number) => n.toFixed(1),
    P = (p: [number, number]): [number, number] => [cx + p[0], cy + p[1]];
  const key = (p: [number, number]) => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20),
    edges = new Map<string, [[number, number], [number, number]]>(),
    deg = new Map<string, number>(),
    verts = new Map<string, [number, number]>();
  tiles.forEach(t =>
    t.q.forEach((a, i) => {
      const b = t.q[(i + 1) % 4],
        k1 = key(a),
        k2 = key(b),
        k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      if (edges.has(k)) return;
      edges.set(k, [a, b]);
      for (const [kk, pt] of [
        [k1, a],
        [k2, b],
      ] as const) {
        deg.set(kk, (deg.get(kk) || 0) + 1);
        verts.set(kk, pt);
      }
    }),
  );
  const leafPath = (x: number, y: number, ang: number, len: number, wid: number) => {
    const c = Math.cos(ang),
      s = Math.sin(ang),
      px = -s,
      py = c,
      tx = x + c * len,
      ty = y + s * len;
    return `M${f(x)} ${f(y)}Q${f(x + c * len * 0.45 + px * wid)} ${f(y + s * len * 0.45 + py * wid)} ${f(tx)} ${f(ty)}Q${f(x + c * len * 0.55 - px * wid * 0.6)} ${f(y + s * len * 0.55 - py * wid * 0.6)} ${f(x)} ${f(y)}Z`; // prettier-ignore
  };
  const saz = (x: number, y: number, ang: number, len: number, wid: number, fill: string, bend: number) => {
    const c = Math.cos(ang),
      s = Math.sin(ang),
      px = -s,
      py = c,
      n = 9;
    let d = `M${f(x)} ${f(y)}`;
    for (let i = 1; i <= n; i++) {
      const t2 = i / n,
        w = wid * Math.sin(Math.PI * Math.min(1, t2 * 1.1)) * (i % 2 ? 1 : 0.62),
        cv = Math.sin(t2 * Math.PI) * bend * len;
      d += `L${f(x + c * len * t2 + px * (w + cv))} ${f(y + s * len * t2 + py * (w + cv))}`;
    }
    for (let i = n - 1; i >= 1; i--) {
      const t2 = i / n,
        w = wid * 0.55 * Math.sin(Math.PI * t2),
        cv = Math.sin(t2 * Math.PI) * bend * len;
      d += `L${f(x + c * len * t2 + px * (cv - w))} ${f(y + s * len * t2 + py * (cv - w))}`;
    }
    return `<path d="${d}Z" fill="${fill}"/>`;
  };
  let vines = '',
    leaves = '',
    tend = '',
    flowers = '',
    stars = '';
  const tendril = (x: number, y: number, ang: number, len: number, turn: number, depth: number) => {
    let d = `M${f(x)} ${f(y)}`,
      px = x,
      py = y,
      a = ang;
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      a += ((turn * (0.5 + (i / steps) * 1.6)) / steps) * 2.2;
      px += (Math.cos(a) * len) / steps;
      py += (Math.sin(a) * len) / steps;
      d += `L${f(px)} ${f(py)}`;
      if (depth > 0 && i === 5) tendril(px, py, a - turn * 0.9, len * 0.5, -turn, depth - 1);
    }
    tend += `<path d="${d}" fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.6, len * 0.045))}" stroke-linecap="round"/>`; // prettier-ignore
    leaves += `<path d="${leafPath(px, py, a, len * 0.32, len * 0.1)}" fill="${depth % 2 ? turq : cobalt}"/>`;
  };
  edges.forEach(([a0, b0]) => {
    // orient each edge outward from the centre and always bulge to its left: invariant under any rotation about the
    // centre
    let [a, b] = Math.hypot(...a0) <= Math.hypot(...b0) - 1e-6 ? [a0, b0] : [b0, a0];
    if (Math.abs(Math.hypot(...a0) - Math.hypot(...b0)) < 1e-6) {
      const ca = Math.atan2(a0[1], a0[0]),
        cb = Math.atan2(b0[1], b0[0]);
      if (((cb - ca + 3 * Math.PI) % (2 * Math.PI)) - Math.PI < 0) [a, b] = [b0, a0];
      else [a, b] = [a0, b0];
    }
    const [x1, y1] = P(a),
      [x2, y2] = P(b),
      dx = x2 - x1,
      dy = y2 - y1,
      len = Math.hypot(dx, dy),
      ang = Math.atan2(dy, dx),
      nx = -dy / len,
      ny = dx / len;
    const mx = (x1 + x2) / 2 + nx * len * 0.18,
      my = (y1 + y2) / 2 + ny * len * 0.18;
    vines += `<path d="M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}"/>`;
    const at = (t2: number) => [
      (1 - t2) * (1 - t2) * x1 + 2 * (1 - t2) * t2 * mx + t2 * t2 * x2,
      (1 - t2) * (1 - t2) * y1 + 2 * (1 - t2) * t2 * my + t2 * t2 * y2,
    ];
    [
      [0.28, -1],
      [0.62, 1],
    ].forEach(([t2, side], j) => {
      // prettier-ignore
      const [qx, qy] = at(t2);
      leaves += saz(qx, qy, ang + side * 0.95 + (side > 0 ? Math.PI : 0), len * 0.34, len * 0.07, j ? turq : cobalt, 0.18 * side); // prettier-ignore
    });
    tendril(mx, my, Math.atan2(ny, nx), len * 0.36, 1, 2);
  });
  verts.forEach((pt, k) => {
    const [x, y] = P(pt),
      d = deg.get(k)!;
    if (d >= Math.min(6, fold - 1)) {
      const r = L * 0.27,
        petals = d >= fold ? fold : d;
      let outer = '',
        inner = '';
      for (let i = 0; i < petals; i++) {
        const a2 = (i / petals) * 2 * Math.PI - Math.PI / 2;
        outer += `<path d="${leafPath(x, y, a2, r * 1.15, r * 0.4)}" fill="${cobalt}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`; // prettier-ignore
        inner += `<path d="${leafPath(x, y, a2 + Math.PI / petals, r * 0.62, r * 0.2)}" fill="${turq}"/>`;
      }
      if (d >= fold) {
        let sd = '';
        for (let i = 0; i < 2 * fold; i++) {
          const a2 = (i / (2 * fold)) * 2 * Math.PI - Math.PI / 2,
            rr = i % 2 ? L * 0.36 : L * 0.56;
          sd += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr);
        }
        flowers += `<path d="${sd}Z" fill="${ground}" stroke="${turq}" stroke-width="${f(L * 0.02)}"/>`;
      }
      flowers += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.2)}" fill="${ground}"/>${outer}${inner}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.24)}" fill="${red}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`; // prettier-ignore
    } else if (d >= 3) {
      const a2 = Math.atan2(y - cy, x - cx),
        r = L * 0.13;
      flowers += `<path d="${leafPath(x, y, a2 - 0.45, r * 1.5, r * 0.5)}${leafPath(x, y, a2 + 0.45, r * 1.5, r * 0.5)}" fill="${cobalt}"/><path d="${leafPath(x, y, a2, r * 1.8, r * 0.55)}" fill="${red}"/>`; // prettier-ignore
    }
  });
  // small stars in the narrowest tiles, four-pointed stars in the squares
  tiles.forEach(t => {
    const [x, y] = P([t.q.reduce((a2, p) => a2 + p[0], 0) / 4, t.q.reduce((a2, p) => a2 + p[1], 0) / 4]),
      sq = Math.abs(t.angle - Math.PI / 2) < 0.05,
      thin = t.angle < Math.PI / 4.5;
    if (!sq && !thin) return;
    const n = sq ? 4 : 5,
      r = L * (sq ? 0.12 : 0.07);
    let d = '';
    for (let i = 0; i < 2 * n; i++) {
      const a2 = (i / (2 * n)) * 2 * Math.PI - Math.PI / 2 + (sq ? Math.PI / 4 : 0),
        rr = i % 2 ? r * 0.42 : r;
      d += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr);
    }
    stars += `<path d="${d}Z" fill="${ground}" stroke="${cobalt}" stroke-width="${f(r * 0.18)}"/>`;
  });
  let joints = '';
  if (seams) {
    const T = tile || S / 6;
    for (let v = T; v < S; v += T) joints += `<path d="M${f(v)} 0V${f(S)}M0 ${f(v)}H${f(S)}"/>`;
    joints = `<g stroke="#c9d1d6" stroke-width="${f(S / 700)}">${joints}</g>`;
  }
  return `<rect width="${S}" height="${S}" fill="${ground}"/><g fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.7, L * 0.028))}" stroke-linecap="round">${vines}</g>${tend}${leaves}${stars}${flowers}${joints}`; // prettier-ignore
}
