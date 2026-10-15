
// ================= IZNIK BACKDROP =================
// A Penrose rhomb tiling (Robinson-triangle subdivision from a ten-triangle "sun", so it has exact 5-fold rotational
// symmetry about its centre and never repeats), dressed as Iznik tilework: cobalt vines along the tile edges (continuous
// across the field because edges meet at vertices), rosettes where five or ten edges meet, small stars and leaves inside
// the tiles, and recursive curling tendrils. Square ceramic joints can be drawn over the top.
const PHI = (1 + Math.sqrt(5)) / 2;
function penrose(levels, R) {
  let tris = [];
  for (let i = 0; i < 10; i++) {
    let B = [R * Math.cos((2 * i - 1) * Math.PI / 10), R * Math.sin((2 * i - 1) * Math.PI / 10)], C = [R * Math.cos((2 * i + 1) * Math.PI / 10), R * Math.sin((2 * i + 1) * Math.PI / 10)];
    if (i % 2 === 0) [B, C] = [C, B];
    tris.push([0, [0, 0], B, C]);
  }
  for (let l = 0; l < levels; l++) {
    const out = [];
    tris.forEach(([c, A, B, C]) => {
      if (c === 0) { const P = [A[0] + (B[0] - A[0]) / PHI, A[1] + (B[1] - A[1]) / PHI]; out.push([0, C, P, B], [1, P, C, A]); }
      else { const Q = [B[0] + (A[0] - B[0]) / PHI, B[1] + (A[1] - B[1]) / PHI], Rr = [B[0] + (C[0] - B[0]) / PHI, B[1] + (C[1] - B[1]) / PHI]; out.push([1, Rr, C, A], [1, Q, Rr, B], [0, Rr, Q, A]); }
    });
    tris = out;
  }
  return tris;
}
function iznikBackdrop(S, o = {}) {
  const { levels = 5, ground = '#f4f6f7', cobalt = '#1f3f8f', turq = '#2a9d9a', red = '#b3362c', seams = true, tile = 0, cx = S / 2, cy = S / 2, reach = S * 0.75 } = o;
  const tris = penrose(levels, reach);
  const key = p => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10), P = p => [cx + p[0], cy + p[1]];
  // rhomb edges are A-B and A-C of each Robinson triangle; B-C is a rhomb's diagonal
  const edges = new Map(), deg = new Map(), verts = new Map();
  const addE = (a, b) => { const k1 = key(a), k2 = key(b), k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; if (edges.has(k)) return; edges.set(k, [a, b]); [[k1, a], [k2, b]].forEach(([kk, pt]) => { deg.set(kk, (deg.get(kk) || 0) + 1); verts.set(kk, pt); }); };
  tris.forEach(([c, A, B, C]) => { addE(A, B); addE(A, C); });
  const L = Math.hypot(...[0, 1].map(i => tris[0][1][i] - tris[0][2][i])); // edge length after subdivision
  let vines = '', leaves = '', flowers = '', stars = '', tend = '';
  const f = n => n.toFixed(1);
  const leafPath = (x, y, ang, len, wid) => { const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c, tx = x + c * len, ty = y + s * len;
    return `M${f(x)} ${f(y)}Q${f(x + c * len * 0.45 + px * wid)} ${f(y + s * len * 0.45 + py * wid)} ${f(tx)} ${f(ty)}Q${f(x + c * len * 0.55 - px * wid * 0.6)} ${f(y + s * len * 0.55 - py * wid * 0.6)} ${f(x)} ${f(y)}Z`; };
  // a curling tendril, recursively sprouting smaller curls (the "fractal" part)
  const tendril = (x, y, ang, len, turn, depth) => {
    let d = `M${f(x)} ${f(y)}`, px = x, py = y, a = ang; const steps = 14;
    for (let i = 1; i <= steps; i++) { a += turn * (0.5 + i / steps * 1.6) / steps * 2.2; px += Math.cos(a) * len / steps; py += Math.sin(a) * len / steps; d += `L${f(px)} ${f(py)}`;
      if (depth > 0 && i === Math.round(steps * 0.45)) tend += tendril(px, py, a - turn * 0.9, len * 0.5, -turn, depth - 1); }
    tend += `<path d="${d}" fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.7, len * 0.045))}" stroke-linecap="round"/>`;
    leaves += `<path d="${leafPath(px, py, a, len * 0.32, len * 0.1)}" fill="${depth % 2 ? turq : cobalt}"/>`;
    return '';
  };
  // a saz leaf: long and curved, smooth on one side, serrated on the other
  const saz = (x, y, ang, len, wid, fill, bend = 0.25) => { const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c; let d = `M${f(x)} ${f(y)}`;
    const N = 9; for (let i = 1; i <= N; i++) { const t2 = i / N, w = wid * Math.sin(Math.PI * Math.min(1, t2 * 1.1)) * (i % 2 ? 1 : 0.62), cv = Math.sin(t2 * Math.PI) * bend * len; d += `L${f(x + c * len * t2 + px * (w + cv))} ${f(y + s * len * t2 + py * (w + cv))}`; }
    for (let i = N - 1; i >= 1; i--) { const t2 = i / N, w = wid * 0.55 * Math.sin(Math.PI * t2), cv = Math.sin(t2 * Math.PI) * bend * len; d += `L${f(x + c * len * t2 + px * (cv - w))} ${f(y + s * len * t2 + py * (cv - w))}`; }
    return `<path d="${d}Z" fill="${fill}"/>`; };
  edges.forEach(([a, b]) => {
    const [x1, y1] = P(a), [x2, y2] = P(b), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    // the bulge side depends only on the edge's direction, so the decoration keeps the tiling's 5-fold symmetry
    const idx = ((Math.round(ang / (Math.PI / 5)) % 10) + 10) % 10, sg = idx % 2 ? 1 : -1, nx = -dy / len * sg, ny = dx / len * sg;
    const mx = (x1 + x2) / 2 + nx * len * 0.18, my = (y1 + y2) / 2 + ny * len * 0.18;
    vines += `<path d="M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}"/>`;
    const at = t2 => [(1 - t2) * (1 - t2) * x1 + 2 * (1 - t2) * t2 * mx + t2 * t2 * x2, (1 - t2) * (1 - t2) * y1 + 2 * (1 - t2) * t2 * my + t2 * t2 * y2];
    // saz leaves leaning off the vine, alternating sides
    [[0.28, -1], [0.62, 1]].forEach(([t2, side], j) => { const [qx, qy] = at(t2), ta = ang + side * 0.95 * sg + (side > 0 ? Math.PI : 0);
      leaves += saz(qx, qy, ta, len * 0.34, len * 0.07, j ? turq : cobalt, 0.18 * side); });
    tendril(mx, my, Math.atan2(ny, nx), len * 0.36, sg * 1.0, 2);
  });
  // vertices: layered hatayi flowers where 5 or 10 edges meet, tulip buds elsewhere (pointing away from the centre)
  verts.forEach((pt, k) => {
    const [x, y] = P(pt), d = deg.get(k);
    if (d >= 5) {
      const r = L * 0.27, petals = d >= 10 ? 10 : 5; let outer = '', inner = '';
      for (let i = 0; i < petals; i++) { const a2 = i / petals * 2 * Math.PI - Math.PI / 2;
        outer += `<path d="${leafPath(x, y, a2, r * 1.15, r * 0.42)}" fill="${cobalt}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`;
        inner += `<path d="${leafPath(x, y, a2 + Math.PI / petals, r * 0.62, r * 0.22)}" fill="${turq}"/>`; }
      if (d >= 10) { let sd = ''; for (let i = 0; i < 20; i++) { const a2 = i / 20 * 2 * Math.PI - Math.PI / 2, rr = i % 2 ? L * 0.36 : L * 0.55; sd += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr); }
        flowers += `<path d="${sd}Z" fill="${ground}" stroke="${turq}" stroke-width="${f(L * 0.02)}"/>`; }
      flowers += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.2)}" fill="${ground}"/>${outer}${inner}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.24)}" fill="${red}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`;
    } else {
      const a2 = Math.atan2(y - cy, x - cx), r = L * 0.13;
      flowers += `<path d="${leafPath(x, y, a2 - 0.45, r * 1.5, r * 0.5)}${leafPath(x, y, a2 + 0.45, r * 1.5, r * 0.5)}" fill="${cobalt}"/><path d="${leafPath(x, y, a2, r * 1.8, r * 0.55)}" fill="${red}"/>`;
    }
  });
  // small outlined five-pointed stars at the centres of the thin rhombs
  tris.forEach(([c, A, B, C]) => { if (c !== 0) return; const [x, y] = P([(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]), r = L * 0.07; let d = '';
    for (let i = 0; i < 10; i++) { const a2 = i / 10 * 2 * Math.PI - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr); }
    stars += `<path d="${d}Z" fill="${ground}" stroke="${cobalt}" stroke-width="${f(r * 0.18)}"/>`; });
  let joints = '';
  if (seams) { const T = tile || S / 6; for (let v = T; v < S; v += T) joints += `<path d="M${f(v)} 0V${f(S)}M0 ${f(v)}H${f(S)}"/>`; joints = `<g stroke="#c9d1d6" stroke-width="${f(S / 700)}">${joints}</g>`; }
  return `<rect width="${S}" height="${S}" fill="${ground}"/><g fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.8, L * 0.028))}" stroke-linecap="round">${vines}</g>${tend}${leaves}${stars}${flowers}${joints}`;
}
