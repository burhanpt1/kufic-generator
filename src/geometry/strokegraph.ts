// Letter grids as stroke centrelines: the graph the curved and pen renderers draw, and the tughra grows from.

type P2 = [number, number];

/** A letter grid as a stroke graph: chains of cells between junctions and ends (straight runs continue through
 *  crossings), and the crossing cells. */
export function strokeGraph(W: number, H: number, isInk: (x: number, y: number) => boolean) {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && isInk(x, y);
  const nbrs = (x: number, y: number): P2[] => {
    const out: P2[] = [];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as P2[])
      if (on(x + dx, y + dy)) out.push([dx, dy]);
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as P2[])
      if (on(x + dx, y + dy) && !on(x + dx, y) && !on(x, y + dy)) out.push([dx, dy]);
    return out;
  };
  const key = (x: number, y: number) => y * W + x,
    deg = new Map<number, P2[]>(),
    cells: P2[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (on(x, y)) {
        cells.push([x, y]);
        deg.set(key(x, y), nbrs(x, y));
      }
  const crossing = (x: number, y: number) => {
    const n = deg.get(key(x, y));
    if (!n || n.length !== 4) return false;
    return n.every(([dx, dy]) => n.some(([ex, ey]) => ex === -dx && ey === -dy));
  };
  const seen = new Set<string>(),
    ekey = (a: number, b: number, c: number, d: number) =>
      a < c || (a === c && b < d) ? `${a},${b},${c},${d}` : `${c},${d},${a},${b}`;
  const chains: { pts: P2[]; closed: boolean }[] = [],
    crosses: P2[] = [];
  const walk = (x0: number, y0: number, dx: number, dy: number) => {
    const pts: P2[] = [[x0, y0]];
    let px = x0,
      py = y0,
      x = x0 + dx,
      y = y0 + dy;
    seen.add(ekey(px, py, x, y));
    for (;;) {
      pts.push([x, y]);
      const n = deg.get(key(x, y))!;
      let nx: number, ny: number;
      if (crossing(x, y)) {
        nx = x + (x - px);
        ny = y + (y - py);
      } else if (n.length === 2) {
        const o = n.find(([ex, ey]) => !(x + ex === px && y + ey === py));
        if (!o) break;
        nx = x + o[0];
        ny = y + o[1];
      } else break;
      const ek = ekey(x, y, nx, ny);
      if (seen.has(ek)) break;
      seen.add(ek);
      px = x;
      py = y;
      x = nx;
      y = ny;
    }
    return pts;
  };
  cells.forEach(([x, y]) => {
    const n = deg.get(key(x, y))!;
    if (n.length === 2 || crossing(x, y)) return;
    n.forEach(([dx, dy]) => {
      if (!seen.has(ekey(x, y, x + dx, y + dy))) chains.push({ pts: walk(x, y, dx, dy), closed: false });
    });
    if (!n.length) chains.push({ pts: [[x, y]], closed: false });
  });
  cells.forEach(([x, y]) => {
    deg.get(key(x, y))!.forEach(([dx, dy]) => {
      if (!seen.has(ekey(x, y, x + dx, y + dy))) {
        const pts = walk(x, y, dx, dy);
        chains.push({ pts, closed: pts.length > 2 && pts[pts.length - 1][0] === x && pts[pts.length - 1][1] === y });
      }
    });
  });
  cells.forEach(([x, y]) => {
    if (crossing(x, y)) crosses.push([x, y]);
  });
  return { chains, crosses };
}

/** The corner cells of a chain (straight stretches collapsed). */
export function cornerPoints(pts: P2[], closed: boolean): P2[] {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1],
      [bx, by] = pts[i],
      [cx, cy] = pts[i + 1];
    if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) !== 0 || (bx - ax) * (cx - bx) + (by - ay) * (cy - by) < 0)
      out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  if (closed && out.length > 2) out.pop();
  return out;
}
/** A chain through cell centres with its corners rounded (radius R cells, 0 = sharp), densely sampled. */
export function smoothChain(cs: P2[], closed: boolean, R: number): P2[] {
  const n = cs.length;
  if (n < 2) return cs.map(([x, y]) => [x + 0.5, y + 0.5]);
  const P = cs.map(([x, y]) => [x + 0.5, y + 0.5] as P2),
    out: P2[] = [];
  const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const seg = (a: P2, b: P2) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      k = Math.max(1, Math.ceil(l * 2));
    for (let i = 1; i <= k; i++) out.push(lerp(a, b, i / k));
  };
  const idx = (i: number) => P[(i + n) % n];
  const startI = closed ? 0 : 1,
    endI = closed ? n : n - 1;
  let prevEnd: P2 | null = closed ? null : P[0];
  if (!closed) out.push(P[0]);
  for (let i = startI; i < endI; i++) {
    const a = idx(i - 1),
      b = idx(i),
      c = idx(i + 1),
      la = Math.hypot(b[0] - a[0], b[1] - a[1]),
      lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const d = Math.min(R, la / 2, lc / 2),
      p1 = lerp(b, a, d / la),
      p2 = lerp(b, c, d / lc);
    if (prevEnd) seg(prevEnd, p1);
    else out.push(p1);
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      out.push([
        (1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0],
        (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1],
      ]);
    }
    prevEnd = p2;
  }
  if (closed) seg(prevEnd!, out[0]);
  else seg(prevEnd!, P[n - 1]);
  return out;
}
