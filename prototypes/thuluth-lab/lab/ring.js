
// ================= INSCRIPTION RING =================
// A line of thuluth bent round a circle, letter tops towards the centre, reading clockwise from the bottom, as on a
// dome or a medallion's border. The pen turns with the writing. The text is stretched (or shrunk) to go round once,
// leaving a small gap at the bottom for a rosette.
function lineMarks(bs, pvMarks, o, yTop, yBot) {
  // vowel marks for a line of text, placed in free space over or under their letters, within the band
  const nib = o.nib || 1.3, K = 2, out = [];
  let x0 = 1e9, x1 = -1e9; bs.strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); }));
  x0 -= 2; x1 += 2; const y0 = yBot - 1, y1 = yTop + 1, Wd = Math.ceil((x1 - x0) * K), Hd = Math.ceil((y1 - y0) * K);
  const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const c2 = cv.getContext('2d'); c2.fillStyle = '#000';
  const X = x => (x - x0) * K, Y = y => (y1 - y) * K;
  bs.strokes.forEach(s => c2.fill(new Path2D(nibPath(s.s, (s.nib || nib) * 1.5, s.ang, X, Y))));
  bs.dots.forEach(([a, b]) => c2.fill(new Path2D(dotPath(a, b, nib * 1.4, o.ang || 70, X, Y))));
  const px = c2.getImageData(0, 0, Wd, Hd).data, occ = new Uint8Array(Wd * Hd); for (let i = 0; i < Wd * Hd; i++) occ[i] = px[i * 4 + 3] > 60 ? 1 : 0;
  const ms2 = o.markScale || 1.5;
  pvMarks.forEach((ms, wi) => ms.forEach(({ li, m }) => {
    const p = bs.placed.find(q => q.g && q.wi === wi && q.li === li); if (!p) return;
    const pts = p.g.s.flatMap(st => st.pts.map(q => [q[0] + p.ox, q[1] + (p.oy || 0)]));
    const lx = pts.reduce((a, q) => a + q[0], 0) / pts.length, top = Math.max(...pts.map(q => q[1])), bot = Math.min(...pts.map(q => q[1])), below = BELOW.has(m);
    const [w0, h0] = MARK_SIZE[m] || [1.4, 1.2], w = w0 * ms2, h = h0 * ms2;
    let spot = null;
    for (let rad = 0; rad <= 6 && !spot; rad += 0.3) for (let a = 0; a < 20; a++) {
      const mx = lx + Math.cos(a / 20 * 6.283) * rad, my = (below ? bot - h / 2 - 0.4 : top + h / 2 + 0.4) + Math.sin(a / 20 * 6.283) * rad * 0.6;
      if (below ? my + h / 2 > bot - 0.2 : my - h / 2 < Math.min(top, 3.0) + 0.2) continue;
      if (my + h / 2 > yTop || my - h / 2 < yBot) continue;
      const ax = Math.floor(X(mx - w / 2)), bx = Math.ceil(X(mx + w / 2)), ay = Math.floor(Y(my + h / 2)), by = Math.ceil(Y(my - h / 2)); let ok = true;
      for (let y = ay; y <= by && ok; y++) for (let x = ax; x <= bx; x++) if (x < 0 || y < 0 || x >= Wd || y >= Hd || occ[y * Wd + x]) { ok = false; break; }
      if (ok) { spot = [mx, my]; for (let y = ay - 1; y <= by + 1; y++) for (let x = ax - 1; x <= bx + 1; x++) if (x >= 0 && y >= 0 && x < Wd && y < Hd) occ[y * Wd + x] = 1; break; }
    }
    if (!spot) return;
    (MARK_SHAPES[m] || []).forEach(sh => out.push({ ang: 70, nib: nib * 0.34, s: sampleStroke(sh.map(([a2, b2, ww, c]) => [spot[0] + a2 * ms2, spot[1] + b2 * ms2, ww ?? 1, c])) }));
  }));
  return out;
}
function makeRing(text, cx, cy, R0, band, o = {}) {
  if (!text || !text.trim()) return null;
  const pv = parseVowels(text), seam = o.seam || 0.26; // radians left open at the bottom, for the rosette
  const measure = k => { const bs = buildStrokes(pv.bare, { ...o, kashida: k }); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; bs.strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); })); bs.dots.forEach(([a, b]) => { y0 = Math.min(y0, b); y1 = Math.max(y1, b); }); return { bs, x0, x1, y0, y1 }; };
  // the band holds the letters plus room for marks above; choose the stretch that sends the text once round
  let m0 = measure(0); const reserve = 2.6, hText = (m0.y1 + reserve) - Math.min(m0.y0, -2.5);
  let s = band / hText, Rb = R0 + band - (-Math.min(m0.y0, -2.5)) * s;
  const target = (2 * Math.PI - seam) * Rb;
  let best = m0;
  if ((m0.x1 - m0.x0) * s < target) { for (let k = 0.25; k <= 12; k += 0.25) { const m = measure(k); if ((m.x1 - m.x0) * s > target) break; best = m; } }
  else { s = target / (m0.x1 - m0.x0); Rb = R0 + band - (-Math.min(m0.y0, -2.5)) * s; }
  const { bs } = best, yTop = best.y1 + reserve, yBot = Math.min(best.y0, -2.5);
  const marks = lineMarks(bs, pv.marks, o, yTop, yBot);
  // leftover space is shared between the words, so the text goes all the way round
  const span = (best.x1 - best.x0) * s, extra = Math.max(0, ((2 * Math.PI - seam) * Rb - span) / Rb);
  const wx = {}; bs.placed.forEach(p => { if (!p.g) return; const xs = p.g.s.flatMap(st => st.pts.map(q => q[0] + p.ox)); const w = wx[p.wi] || (wx[p.wi] = [1e9, -1e9]); w[0] = Math.min(w[0], ...xs); w[1] = Math.max(w[1], ...xs); });
  const nW = Object.keys(wx).length, perGap = nW > 1 ? extra / (nW - 1) : 0, lead = nW > 1 ? 0 : extra / 2;
  const wordOf = x => { let best2 = 0, bd = 1e9; Object.entries(wx).forEach(([wi, [a2, b2]]) => { const dd = x < a2 ? a2 - x : x > b2 ? x - b2 : 0; if (dd < bd) { bd = dd; best2 = +wi; } }); return best2; };
  const map = (x, y, wi) => { const u = (best.x1 - x) * s, phi = -Math.PI / 2 - seam / 2 - lead - (wi ?? wordOf(x)) * perGap - u / Rb, r = Rb - y * s; return { x: cx + r * Math.cos(phi), y: cy + r * Math.sin(phi), rot: phi + Math.PI / 2 }; };
  const bend = st => { const xs = st.s.map(q => q.x), wi = wordOf((Math.min(...xs) + Math.max(...xs)) / 2); return { ...st, nib: (st.nib || o.nib || 1.3) * s, s: st.s.map(q => { const m = map(q.x, q.y, wi); return { x: m.x, y: m.y, w: q.w, rot: m.rot }; }) }; };
  return { strokes: bs.strokes.map(bend), marks: marks.map(bend), dots: bs.dots.map(([a, b]) => { const m = map(a, b); return [m.x, m.y, s, m.rot]; }), R0, R1: R0 + band, s };
}

// ================= ILLUMINATION =================
// Ottoman-style illumination: radiating rays round the rim, a band of small palmettes, and for a full panel, scrolling
// spirals with leaves and rosettes in the corners. All parametric.
function rosette(x, y, r, petals, fill, centre) {
  let d = ''; for (let i = 0; i < petals; i++) { const a = i / petals * 2 * Math.PI, a1 = a - Math.PI / petals * 0.8, a2 = a + Math.PI / petals * 0.8;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}Q${(x + Math.cos(a1) * r * 1.2).toFixed(1)} ${(y + Math.sin(a1) * r * 1.2).toFixed(1)} ${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}Q${(x + Math.cos(a2) * r * 1.2).toFixed(1)} ${(y + Math.sin(a2) * r * 1.2).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z`; }
  return `<path d="${d}" fill="${fill}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.32).toFixed(1)}" fill="${centre}"/>`;
}
function leaf(x, y, ang, len, wid, fill) { // a pointed leaf along direction ang (screen radians)
  const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c, tip = [x + c * len, y + s * len];
  return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}Q${(x + c * len * 0.5 + px * wid).toFixed(1)} ${(y + s * len * 0.5 + py * wid).toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Q${(x + c * len * 0.5 - px * wid).toFixed(1)} ${(y + s * len * 0.5 - py * wid).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z" fill="${fill}"/>`;
}
function illumination(C, Rout, U, P, mode, S2) {
  const gold = P.gold, blue = P.blue || '#2c4a8c', red = P.red || '#a3352b', dark = P.goldDark; let under = '', over = '';
  const R = Rout * U;
  // rays: alternating long and short, thin, tipped with dots (tığ)
  const N = 96; let rays = '';
  for (let i = 0; i < N; i++) { const a = i / N * 2 * Math.PI, long = i % 2 === 0, l = R * (long ? 0.2 : 0.11), w = R * (long ? 0.012 : 0.009), c = Math.cos(a), s = Math.sin(a), x0 = C + c * R * 1.0, y0 = C + s * R * 1.0, x1 = C + c * (R + l), y1 = C + s * (R + l);
    rays += `<path d="M${(x0 - s * w).toFixed(1)} ${(y0 + c * w).toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${(x0 + s * w).toFixed(1)} ${(y0 - c * w).toFixed(1)}Z" fill="${i % 4 === 0 ? blue : gold}"/>`;
    if (long) rays += `<circle cx="${(C + c * (R + l + R * 0.012)).toFixed(1)}" cy="${(C + s * (R + l + R * 0.012)).toFixed(1)}" r="${(R * 0.008).toFixed(1)}" fill="${i % 4 === 0 ? blue : gold}"/>`; }
  if (mode !== 'iznik') under += rays;
  // a band of small palmettes just outside the rim
  const M = 48; let band = `<circle cx="${C}" cy="${C}" r="${(R * 1.035).toFixed(1)}" fill="none" stroke="${dark}" stroke-width="${(R * 0.004).toFixed(1)}"/>`;
  for (let i = 0; i < M; i++) { const a = (i + 0.5) / M * 2 * Math.PI, x = C + Math.cos(a) * R * 1.02, y = C + Math.sin(a) * R * 1.02; band += leaf(x, y, a, R * 0.045, R * 0.014, i % 2 ? gold : red); }
  under += band;
  if (mode === 'iznik') {
    // the medallion on a field of Iznik tiles, a white halo round the rim and a cobalt frame
    const half = S2 / 2;
    const ov = P.ov || 1;
    if (ov > 1.01) { // an oval cartouche on a landscape panel of tiles, with an oval halo and a cobalt frame round the panel
      const rx = R * 1.07 * ov, ry = R * 1.07, m = R * 0.3, fx = C - rx - m, fy = C - ry - m, fw = 2 * (rx + m), fh = 2 * (ry + m);
      return { under: iznikField(S2, { fold: P.fold || 8, density: P.density || 3, cx: C, cy: C, reach: S2 * 0.85, tile: fh / 3 }) + `<ellipse cx="${C}" cy="${C}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#f4f6f7" stroke="#1f3f8f" stroke-width="${(R * 0.012).toFixed(1)}"/>`
        + `<rect x="${(fx + m * 0.12).toFixed(1)}" y="${(fy + m * 0.12).toFixed(1)}" width="${(fw - m * 0.24).toFixed(1)}" height="${(fh - m * 0.24).toFixed(1)}" fill="none" stroke="#1f3f8f" stroke-width="${(m * 0.12).toFixed(1)}"/>`, over: '', panel: [fx, fy, fw, fh] };
    }
    return { under: iznikField(S2, { fold: P.fold || 8, density: P.density || 3, cx: C, cy: C, reach: S2 * 0.85, tile: S2 / 5 }) + `<circle cx="${C}" cy="${C}" r="${(R * 1.07).toFixed(1)}" fill="#f4f6f7" stroke="#1f3f8f" stroke-width="${(R * 0.012).toFixed(1)}"/>` + band
      + `<rect x="${(half * 0.03).toFixed(1)}" y="${(half * 0.03).toFixed(1)}" width="${(S2 - half * 0.06).toFixed(1)}" height="${(S2 - half * 0.06).toFixed(1)}" fill="none" stroke="#1f3f8f" stroke-width="${(half * 0.03).toFixed(1)}"/>`, over: '' };
  }
  if (mode === 'panel') {
    // corner scrolls: a spiral stem with leaves and rosettes, mirrored into all four corners and across each diagonal
    const half = S2 / 2; let sc = '';
    const spiral = (flip) => {
      let d = '', g = ''; const pts = [];
      for (let t = 0; t <= 1; t += 0.01) { const th = 0.6 + t * 4.2, r = half * 0.42 * Math.exp(-0.33 * th); let x = half * 0.86 - Math.cos(th) * r * 1.0 - half * 0.05, y = half * 0.86 - Math.sin(th) * r * 0.9 - half * 0.18; if (flip) [x, y] = [y, x]; pts.push([x, y]); }
      d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
      g += `<path d="${d}" fill="none" stroke="${gold}" stroke-width="${(half * 0.008).toFixed(1)}" stroke-linecap="round"/>`;
      for (let i = 6; i < pts.length - 4; i += 9) { const [x, y] = pts[i], [x2, y2] = pts[i + 1], a = Math.atan2(y2 - y, x2 - x) + (i % 18 < 9 ? 1 : -1) * 0.9; g += leaf(x, y, a, half * 0.06 * (1 - i / pts.length * 0.5), half * 0.018, i % 27 < 9 ? blue : gold); }
      const [ex, ey] = pts[pts.length - 1]; g += rosette(ex, ey, half * 0.035, 6, red, gold);
      const [sx, sy] = pts[0]; g += rosette(sx, sy, half * 0.05, 8, gold, blue);
      return g;
    };
    const corner = spiral(false) + spiral(true);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([fx, fy]) => { sc += `<g transform="translate(${C} ${C}) scale(${fx} ${fy})">${corner}</g>`; });
    under = `<rect x="${(C - half + half * 0.04).toFixed(1)}" y="${(C - half + half * 0.04).toFixed(1)}" width="${(half * 1.92).toFixed(1)}" height="${(half * 1.92).toFixed(1)}" fill="none" stroke="${gold}" stroke-width="${(half * 0.012).toFixed(1)}"/><rect x="${(C - half + half * 0.065).toFixed(1)}" y="${(C - half + half * 0.065).toFixed(1)}" width="${(half * 1.87).toFixed(1)}" height="${(half * 1.87).toFixed(1)}" fill="none" stroke="${dark}" stroke-width="${(half * 0.004).toFixed(1)}"/>` + sc + under;
  }
  return { under, over };
}
