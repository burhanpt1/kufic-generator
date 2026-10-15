
// ================= FIT A LETTER TO A PHOTO =================
// Render the engine's letter with the photo's pen, then search over its control points, size and position until its
// ink matches the photo's ink (intersection over union), with a gentle pull towards smooth, small changes.
function fitGlyph(target, glyph, o = {}) {
  const { w, h, data } = target, nibPx = o.nibPx || 14, ang = o.ang || 69, iters = o.iters || 5000;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d', { willReadFrequently: true });
  const strokes = glyph.s.map(st => st.pts.map(p => p.slice()));
  const nPts = strokes.reduce((a, s) => a + s.length, 0);
  let P = { s: o.s0 || 20, tx: 0, ty: 0, d: strokes.map(s => s.map(() => [0, 0])) };
  const render = Q => { cx.clearRect(0, 0, w, h); cx.fillStyle = '#000';
    strokes.forEach((s, si) => { const pts = s.map((p, pi) => [p[0] + Q.d[si][pi][0], p[1] + Q.d[si][pi][1], p[2] ?? 1, p[3]]);
      cx.fill(new Path2D(nibPath(sampleStroke(pts), nibPx / Q.s, ang, x => Q.tx + x * Q.s, y => Q.ty - y * Q.s))); });
    return cx.getImageData(0, 0, w, h).data; };
  const score = Q => { const r = render(Q); let inter = 0, uni = 0; for (let i = 0; i < w * h; i++) { const a = r[i * 4 + 3] > 100 ? 1 : 0, b = data[i]; inter += a & b; uni += a | b; }
    // points that fall outside the box have nothing to match, so they are held where they were; the joins too
    let reg = 0, rough = 0; Q.d.forEach((ds, si) => ds.forEach(([dx, dy], j) => { const p = strokes[si][j], px = Q.tx + (p[0] + dx) * Q.s, py = Q.ty - (p[1] + dy) * Q.s, out = px < 2 || py < 2 || px > w - 2 || py > h - 2;
      const end = (si === 0 && j === 0) || (si === strokes.length - 1 && j === ds.length - 1); reg += (dx * dx + dy * dy) * (out ? 60 : end ? 12 : 1); if (j > 0 && j < ds.length - 1) { const a = ds[j - 1], c = ds[j + 1]; rough += (dx - (a[0] + c[0]) / 2) ** 2 + (dy - (a[1] + c[1]) / 2) ** 2; } }));
    return inter / Math.max(1, uni) - 0.002 * reg - 0.01 * rough; };
  // start: centre the letter's bounding box on the target's ink
  let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9; strokes.forEach(s => s.forEach(p => { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); }));
  let ix0 = 1e9, ix1 = -1e9, iy0 = 1e9, iy1 = -1e9; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x]) { ix0 = Math.min(ix0, x); ix1 = Math.max(ix1, x); iy0 = Math.min(iy0, y); iy1 = Math.max(iy1, y); }
  if (!o.s0) P.s = Math.min((ix1 - ix0) / Math.max(0.5, bx1 - bx0), (iy1 - iy0) / Math.max(0.5, by1 - by0)) * 0.9;
  P.tx = (ix0 + ix1) / 2 - (bx0 + bx1) / 2 * P.s; P.ty = (iy0 + iy1) / 2 + (by0 + by1) / 2 * P.s;
  let sd = 9871; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  let E = score(P), T = 0.02, best = { P: JSON.parse(JSON.stringify(P)), E }; const start = E;
  for (let it = 0; it < iters; it++) {
    const Q = JSON.parse(JSON.stringify(P)), mv = it < iters * 0.25 || o.shapeFrozen ? 0 : R(); // first a quarter of the search only places and sizes the letter
    if (mv < 0.25) { Q.tx += (R() - 0.5) * 4; Q.ty += (R() - 0.5) * 4; Q.s *= 1 + (R() - 0.5) * 0.06; }
    else { const si = Math.floor(R() * strokes.length), pi = Math.floor(R() * strokes[si].length), st = 1.2 * (1 - it / iters) + 0.15; Q.d[si][pi][0] += (R() - 0.5) * st; Q.d[si][pi][1] += (R() - 0.5) * st; }
    const E2 = score(Q); if (E2 >= E || R() < Math.exp((E2 - E) / T)) { P = Q; E = E2; if (E > best.E) best = { P: JSON.parse(JSON.stringify(P)), E }; }
    T = Math.max(0.0005, T * 0.9993);
  }
  P = best.P; const fitted = strokes.map((s, si) => s.map((p, pi) => [+(p[0] + P.d[si][pi][0]).toFixed(2), +(p[1] + P.d[si][pi][1]).toFixed(2), p[2] ?? 1].concat(p[3] ? [p[3]] : [])));
  return { fitted, s: P.s, tx: P.tx, ty: P.ty, iouStart: start, iou: best.E, render: () => { render(P); return cv.toDataURL(); } };
}
